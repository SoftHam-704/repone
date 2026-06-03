import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { masterPool, getTenantPool, registerTenantPool, resolvePoolForEmpresa } from '../../config/database';
import { env } from '../../config/env';
import { invalidateSessionCache } from '../../middleware/auth';

// Dev fallback CNPJ (SoftHam Sistemas - ambiente de testes)
const CNPJ_DEV_FALLBACK = '17504829000124';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { cnpj, nome, sobrenome, password } = req.body;

  const rawCnpj = cnpj ? cnpj.replace(/\D/g, '') : '';

  if (!rawCnpj || !nome || !sobrenome || !password) {
    res.status(400).json({
      success: false,
      message: 'CNPJ, Nome, Sobrenome e Senha são obrigatórios',
    });
    return;
  }

  const masterClient = await masterPool.connect();

  try {
    // ─── 1. BUSCAR EMPRESA NO MASTER (VIA CNPJ) ───
    const empresaResult = await masterClient.query(`
      SELECT id, cnpj, razao_social, nome_fantasia, status,
             db_host, db_nome, db_schema, db_usuario, db_senha, db_porta,
             COALESCE(limite_sessoes, 999) as limite_sessoes,
             COALESCE(bloqueio_ativo, 'N') as bloqueio_ativo,
             ramoatv, ios_enabled,
             COALESCE(modulo_bi_ativo, false) as modulo_bi_ativo,
             COALESCE(modulo_whatsapp_ativo, false) as modulo_whatsapp_ativo,
             COALESCE(modulo_crmrep_ativo, false) as modulo_crmrep_ativo,
             COALESCE(plano_ia_nivel, 'ATIVO') as plano_ia_nivel
      FROM empresas
      WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1 AND status = 'ATIVO'
    `, [rawCnpj]);

    let empresa = empresaResult.rows[0];

    // ─── DEV FALLBACK: CNPJ de teste → config local ───
    const isDev = process.env.NODE_ENV !== 'production';
    if (!empresa && isDev && rawCnpj === CNPJ_DEV_FALLBACK) {
      console.log('🔧 [AUTH] DEV FALLBACK: usando config local para CNPJ de teste');
      empresa = {
        id: 1,
        cnpj: rawCnpj,
        razao_social: 'SOFTHAM SISTEMAS LTDA',
        nome_fantasia: 'SoftHam Sistemas',
        status: 'ATIVO',
        db_host: env.DB_HOST,
        db_nome: env.DB_NAME,
        db_schema: 'public',
        db_usuario: env.DB_USER,
        db_senha: env.DB_PASSWORD,
        db_porta: env.DB_PORT,
        limite_sessoes: 999,
        bloqueio_ativo: 'N',
        ios_enabled: 'S',
        ramoatv: 'PADRAO',
        modulo_bi_ativo: true,
        modulo_whatsapp_ativo: false,
        modulo_crmrep_ativo: false,
        plano_ia_nivel: 'ATIVO',
      };
    }

    if (!empresa) {
      res.status(404).json({
        success: false,
        message: 'Empresa não encontrada ou CNPJ não autorizado.',
      });
      return;
    }

    if (empresa.bloqueio_ativo === 'S') {
      res.status(403).json({
        success: false,
        message: 'Empresa bloqueada. Entre em contato com o suporte.',
      });
      return;
    }

    // Constantes do controle de sessão (movidas pra cá; verificação real
    // acontece depois de validar usuário/senha, na seção 4.5)
    const SESSION_TIMEOUT_MINUTES = 15;
    const SESSION_LIMIT_PER_USER  = 2; // web + mobile. 3ª sessão pede pra derrubar.

    // ─── 3. REDIRECIONAR PARA O SCHEMA/BANCO DO TENANT ───
    let targetHost = empresa.db_host;
    let targetPort = empresa.db_porta || 5432;  // ← CORRIGIDO: db_porta (não db_port)

    // Dev: redireciona IPs internos ou o host do master para o host/porta público
    const isInternalIp = /^10\.|^172\.(1[6-9]|2[0-9]|3[12])\.|^192\.168\./.test(targetHost);
    const isMasterHost = targetHost === env.MASTER_DB_HOST;

    if (isDev && (isInternalIp || isMasterHost)) {
      console.log(`📡 [AUTH] Redirecionando para host público para ambiente de DEV (${targetHost} -> ${env.MASTER_DB_HOST}:${env.MASTER_DB_PORT})`);
      targetHost = env.MASTER_DB_HOST;
      targetPort = env.MASTER_DB_PORT;
    }

    const dbConfig = {
      host: targetHost,
      database: empresa.db_nome,
      schema: empresa.db_schema || 'public',
      user: empresa.db_usuario,
      password: empresa.db_senha || '',
      port: targetPort,
    };

    const tenantPool = getTenantPool(dbConfig);
    registerTenantPool(empresa.id, tenantPool); // indexa pool por empresaId para uso no tenantMiddleware
    const tenantClient = await tenantPool.connect();

    let userResult;
    const schema = dbConfig.schema.replace(/[^a-zA-Z0-9_]/g, '');

    try {
      await tenantClient.query(`SET search_path TO "${schema}", public`);

      // ─── 4. VALIDAR USUÁRIO NO TENANT ───
      userResult = await tenantClient.query(`
        SELECT codigo as id, nome, sobrenome, usuario,
               master as e_admin, gerencia, iniciais
        FROM user_nomes
        WHERE LOWER(nome) = LOWER($1)
          AND LOWER(sobrenome) = LOWER($2)
          AND senha = $3
      `, [nome, sobrenome, password]);

    } finally {
      await tenantClient.query('RESET search_path').catch(() => {});
      tenantClient.release();
    }

    if (userResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Usuário ou senha incorretos para esta empresa.',
      });
      return;
    }

    const user = userResult.rows[0];

    // ─── 4.5. CONTROLE DE SESSÕES POR USUÁRIO ───
    // Regra comercial (Hamilton 2026-05-26): cada usuário pode ter ATÉ
    // SESSION_LIMIT_PER_USER sessões ativas em paralelo (web + mobile). Modelo
    // de cobrança é por usuário (R$ 110/mês), e essa regra evita que um único
    // login seja compartilhado entre vários funcionários.
    //
    // Comportamentos:
    //   • < limite          → entra silenciosamente (sem modal)
    //   • >= limite + sem forceLogin  → 409 SESSION_LIMIT_REACHED com lista de
    //                                   sessões ativas. Frontend mostra modal:
    //                                   "Você já tem N sessões. Derrubar a mais
    //                                    antiga pra entrar aqui?"
    //   • >= limite + forceLogin=true → derruba a sessão mais antiga e prossegue
    const forceLogin = req.body?.forceLogin === true;
    try {
      const activeRes = await masterClient.query(`
        SELECT id, ip, user_agent, data_login
        FROM sessoes_ativas
        WHERE empresa_id = $1 AND tenant_user_id = $2 AND ativo = true
          AND ultima_atividade > NOW() - INTERVAL '${SESSION_TIMEOUT_MINUTES} minutes'
        ORDER BY data_login ASC
      `, [empresa.id, user.id]);
      const activeOwn = activeRes.rows;

      if (activeOwn.length >= SESSION_LIMIT_PER_USER) {
        if (!forceLogin) {
          // Resposta enviada com DOIS códigos pra compatibilidade com versões
          // anteriores do frontend que esperavam 'EXISTING_SESSION'. Frontend
          // antigo casa pelo code; frontend novo casa pelo code ou pelo
          // activeSessions[].
          const oldest = activeOwn[0];
          res.status(409).json({
            success: false,
            code: 'SESSION_LIMIT_REACHED',
            // Aliases para compatibilidade com frontend antigo:
            legacyCode: 'EXISTING_SESSION',
            existingSession: oldest ? {
              ip: oldest.ip,
              userAgent: oldest.user_agent,
              dataLogin: oldest.data_login,
            } : null,
            message: `Você já tem ${activeOwn.length} sessões ativas (limite ${SESSION_LIMIT_PER_USER}). Deseja desconectar e entrar aqui?`,
            limit: SESSION_LIMIT_PER_USER,
            activeSessions: activeOwn.map(s => ({
              ip: s.ip,
              userAgent: s.user_agent,
              dataLogin: s.data_login,
            })),
          });
          return;
        }

        // forceLogin=true → derruba TODAS as sessões ativas do usuário. É mais
        // robusto que derrubar só a mais antiga: garante que o frontend antigo
        // (que esperava esse comportamento) não entre em loop, e o frontend
        // novo entrega o que o user clicou em "entrar aqui agora".
        await masterClient.query(`
          UPDATE sessoes_ativas SET ativo = false
          WHERE empresa_id = $1 AND tenant_user_id = $2 AND ativo = true
        `, [empresa.id, user.id]);
        console.log(`🔁 [AUTH] forceLogin: ${user.nome} derrubou ${activeOwn.length} sessão(ões) anterior(es)`);
      }
    } catch (existingErr: any) {
      // Não bloqueia se a tabela sessoes_ativas estiver indisponível
      console.warn(`⚠️ [AUTH] Verificação de sessões do usuário falhou: ${existingErr.message}`);
    }

    // ─── 5. DETERMINAR ROLE ───
    const isHamilton = (user.usuario?.toLowerCase()?.includes('hamilton')) ||
                       (user.nome?.toLowerCase()?.includes('hamilton'));

    let role = 'user';
    if (isHamilton) role = 'superadmin';
    else if (user.e_admin === true || user.e_admin === 'S') role = 'admin';
    else if (user.gerencia === true || user.gerencia === 'S') role = 'manager';

    // ─── 6. GERAR JWT ───
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.usuario || `${user.nome} ${user.sobrenome}`,
        iniciais: user.iniciais,
        role,
        schema,
        name: `${user.nome} ${user.sobrenome}`,
        empresaId: empresa.id,
        cnpj: empresa.cnpj,
        iaAtiva: (empresa.plano_ia_nivel || 'INATIVA') !== 'INATIVA',  // toggle "Acesso à IRIS" do ADM — gateia IRIS Dev
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    // ─── 7. REGISTRAR SESSÃO NO MASTER (await — middleware vai consultar essa linha) ───
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
      await masterClient.query(`
        INSERT INTO sessoes_ativas (empresa_id, usuario_id, tenant_user_id, token_sessao, ip, user_agent)
        VALUES ($1, NULL, $2, $3, $4, $5)
      `, [empresa.id, user.id, token, clientIp, req.headers['user-agent'] || 'Unknown']);
    } catch (sessErr: any) {
      console.warn(`⚠️ [AUTH] Sessão não registrada: ${sessErr.message}`);
    }

    console.log(`✅ [AUTH] Login: ${user.nome} | Schema: ${schema} | Role: ${role}`);

    // ─── 8. RESPOSTA ───
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        codigo: user.id,
        empresa_id: empresa.id,
        nome: user.nome,
        sobrenome: user.sobrenome,
        iniciais: user.iniciais,
        role,
        empresa: empresa.nome_fantasia || empresa.razao_social,
        cnpj: empresa.cnpj,
        ramoatv: empresa.ramoatv || 'PADRAO',
        biEnabled: empresa.modulo_bi_ativo === true,
        whatsappEnabled: empresa.modulo_whatsapp_ativo === true,
        crmRepEnabled: empresa.modulo_crmrep_ativo === true,
        portalLojistaEnabled: empresa.ios_enabled === 'S',
        iaPlanLevel: empresa.plano_ia_nivel,
      },
      tenantConfig: {
        cnpj: empresa.cnpj,
        schema,
        ramoatv: empresa.ramoatv || 'PADRAO',
        dbConfig,
      },
    });

  } catch (error: any) {
    console.error('❌ [AUTH] Erro no login:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao processar login.',
    });
  } finally {
    masterClient.release();
  }
}

/**
 * POST /api/auth/logout
 */
export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const { token } = req.body;
  if (token) {
    masterPool.query("UPDATE sessoes_ativas SET ativo = false WHERE token_sessao = $1", [token])
      .catch(() => {});
    invalidateSessionCache(token);
  }
  res.json({ success: true, message: 'Logout realizado com sucesso' });
}

/**
 * GET /api/auth/verify
 * Valida se o token JWT ainda é válido.
 */
export async function verifyHandler(req: Request, res: Response): Promise<void> {
  const { userId, username, schema, name } = req.user!;
  res.json({
    success: true,
    user: { userId, username, schema, name },
  });
}

/**
 * GET /api/auth/marquee-companies
 * Retorna as empresas do ramo 'Autopeças' para o scroller da tela de login.
 */
export async function marqueeCompaniesHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await masterPool.query(`
      SELECT nome_fantasia 
      FROM empresas 
      WHERE ramoatv = 'Autopeças' AND status = 'ATIVO'
      ORDER BY nome_fantasia ASC
    `);
    
    res.json({
      success: true,
      data: result.rows.map(r => r.nome_fantasia)
    });
  } catch (error: any) {
    console.error('❌ [AUTH] Erro ao buscar empresas para marquee:', error.message);
    res.status(500).json({ success: false, data: [] });
  }
}
