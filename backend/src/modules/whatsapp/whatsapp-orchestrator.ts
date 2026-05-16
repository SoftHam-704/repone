import { Pool } from 'pg';
import axios from 'axios';
import {
  processarMensagem, gerarResumo, avaliarQualificacao, avaliarRelevancia,
  DadosQualificacao, TenantConfig, FichaCliente,
} from './whatsapp-ai.service';
import {
  detectarIntencaoPedido, resolverItensPedido, criarRascunhoWhatsApp,
} from './whatsapp-pedido.service';

// ─── Evolution API client ─────────────────────────────────────────────────────
function evoClient() {
  return axios.create({
    baseURL: process.env.EVOLUTION_API_URL,
    headers: { apikey: process.env.EVOLUTION_API_KEY!, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

async function sendText(instance: string, phone: string, text: string) {
  try {
    await evoClient().post(`/message/sendText/${instance}`, { number: phone, text });
  } catch (e: any) {
    console.error('[WPP-ORCH] Erro ao enviar msg:', e?.message);
  }
}

// ─── Helpers de DB ────────────────────────────────────────────────────────────
async function findOrCreateContato(db: Pool, phone: string, pushName: string | null) {
  const existing = await db.query(
    'SELECT * FROM wpp_contato WHERE telefone = $1', [phone]
  );
  if (existing.rows.length > 0) {
    const c = existing.rows[0];
    if (pushName && !c.nome_push) {
      await db.query('UPDATE wpp_contato SET nome_push=$1, updated_at=NOW() WHERE id=$2', [pushName, c.id]);
      c.nome_push = pushName;
    }
    return c;
  }
  const r = await db.query(
    `INSERT INTO wpp_contato (telefone, nome_push, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW()) RETURNING *`,
    [phone, pushName]
  );
  return r.rows[0];
}

async function findOrCreateConversa(db: Pool, contatoId: number) {
  // Busca conversa ativa (não encerrada/convertida/perdida)
  const ex = await db.query(
    `SELECT * FROM wpp_conversa
     WHERE contato_id = $1 AND estado NOT IN ('encerrada','convertida','perdida')
     ORDER BY created_at DESC LIMIT 1`,
    [contatoId]
  );
  if (ex.rows.length > 0) return { conversa: ex.rows[0], isNew: false };

  const r = await db.query(
    `INSERT INTO wpp_conversa
       (contato_id, estado, origem, primeira_msg_at, ultima_msg_at, created_at, updated_at)
     VALUES ($1, 'nova', 'inbound', NOW(), NOW(), NOW(), NOW()) RETURNING *`,
    [contatoId]
  );
  return { conversa: r.rows[0], isNew: true };
}

async function saveMessage(db: Pool, params: {
  conversaId: number; contatoId: number; messageId: string | null;
  direcao: 'inbound'|'outbound'; tipo: string; remetente: string;
  conteudo: string; status: string; dadosExtraidos?: any;
  tokensPrompt?: number; tokensResposta?: number; tempoMs?: number;
}) {
  const r = await db.query(
    `INSERT INTO wpp_mensagem
       (conversa_id, contato_id, wpp_message_id, direcao, tipo, remetente,
        conteudo, status, dados_extraidos, tokens_prompt, tokens_resposta,
        tempo_resposta_ms, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING id`,
    [
      params.conversaId, params.contatoId, params.messageId,
      params.direcao, params.tipo, params.remetente,
      params.conteudo, params.status,
      params.dadosExtraidos ? JSON.stringify(params.dadosExtraidos) : null,
      params.tokensPrompt ?? null, params.tokensResposta ?? null, params.tempoMs ?? null,
    ]
  );
  return r.rows[0].id;
}

async function getHistorico(db: Pool, conversaId: number, limit = 20) {
  const r = await db.query(
    `SELECT remetente, conteudo FROM wpp_mensagem
     WHERE conversa_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [conversaId, limit]
  );
  return r.rows.reverse(); // cronológico
}

async function getTenantConfig(db: Pool): Promise<TenantConfig> {
  try {
    const r = await db.query(
      `SELECT par_valor FROM parametros WHERE par_chave = ANY($1)`,
      [['representante_nome','empresa_nome','industrias_representadas']]
    );
    const map: Record<string, string> = {};
    for (const row of r.rows) map[row.par_chave] = row.par_valor;

    // Carta confidencial da IRIS (master only, tabela auto-criada)
    let iris_carta: string | undefined;
    try {
      const cartaRes = await db.query(
        `SELECT iris_carta FROM iris_config LIMIT 1`
      );
      if (cartaRes.rows.length > 0) iris_carta = cartaRes.rows[0].iris_carta || undefined;
    } catch { /* tabela pode não existir ainda */ }

    return {
      representante_nome: map['representante_nome'] || 'Representante',
      empresa_nome:       map['empresa_nome']       || 'Empresa',
      industrias:         map['industrias_representadas'],
      iris_carta,
    };
  } catch {
    return { representante_nome: 'Representante', empresa_nome: 'Empresa' };
  }
}

// ─── Ficha do cliente por telefone ───────────────────────────────────────────
async function getFichaCliente(db: Pool, phone: string): Promise<FichaCliente | null> {
  try {
    // Normaliza: remove código país 55 se presente, mantém só dígitos locais
    const digits    = phone.replace(/\D/g, '');
    const localPhone = digits.startsWith('55') ? digits.slice(2) : digits;

    const cliRes = await db.query(`
      SELECT cli_codigo,
             COALESCE(NULLIF(TRIM(cli_nomred),''), TRIM(cli_nome)) AS nome,
             cli_cidade, cli_uf
      FROM clientes
      WHERE REGEXP_REPLACE(COALESCE(cli_celular,''), '[^0-9]', '', 'g') = $1
         OR REGEXP_REPLACE(COALESCE(cli_fone1,''),   '[^0-9]', '', 'g') = $1
         OR RIGHT(REGEXP_REPLACE(COALESCE(cli_celular,''), '[^0-9]', '', 'g'), 9) = RIGHT($1, 9)
         OR RIGHT(REGEXP_REPLACE(COALESCE(cli_fone1,''),   '[^0-9]', '', 'g'), 9) = RIGHT($1, 9)
      LIMIT 1
    `, [localPhone]);

    if (!cliRes.rows.length) return null;
    const cli       = cliRes.rows[0];
    const cliCodigo = cli.cli_codigo;

    const [lastRes, countRes, topRes] = await Promise.all([
      db.query(`
        SELECT ped_data::date::text AS data,
               ped_totliq,
               (CURRENT_DATE - ped_data::date)::int AS dias
        FROM pedidos
        WHERE ped_cliente = $1 AND ped_situacao IN ('P','F')
        ORDER BY ped_data DESC LIMIT 1
      `, [cliCodigo]),
      db.query(`
        SELECT COUNT(*)::int AS total
        FROM pedidos
        WHERE ped_cliente = $1 AND ped_situacao IN ('P','F')
          AND EXTRACT(YEAR FROM ped_data) = EXTRACT(YEAR FROM NOW())
      `, [cliCodigo]),
      db.query(`
        SELECT TRIM(i.ite_produto) AS codigo,
               MAX(TRIM(i.ite_nomeprod)) AS nome,
               COUNT(*)::int AS qtd
        FROM itens_ped i
        INNER JOIN pedidos p ON TRIM(p.ped_pedido) = TRIM(i.ite_pedido)
        WHERE p.ped_cliente    = $1
          AND p.ped_situacao   IN ('P','F')
          AND p.ped_data       >= NOW() - INTERVAL '12 months'
        GROUP BY TRIM(i.ite_produto)
        ORDER BY qtd DESC
        LIMIT 5
      `, [cliCodigo]),
    ]);

    const last = lastRes.rows[0];
    return {
      cli_codigo:          cliCodigo,
      nome:                cli.nome,
      cidade:              cli.cli_cidade  || undefined,
      uf:                  cli.cli_uf      || undefined,
      ultimo_pedido_data:  last?.data      ?? null,
      ultimo_pedido_valor: last ? parseFloat(last.ped_totliq) : null,
      dias_sem_pedido:     last ? parseInt(last.dias) : null,
      total_pedidos_ano:   countRes.rows[0]?.total || 0,
      top_produtos:        topRes.rows.map((r: any) => ({
        codigo: r.codigo || '',
        nome:   r.nome   || '',
        qtd:    r.qtd,
      })),
    };
  } catch (err: any) {
    console.warn('[WPP-ORCH] getFichaCliente error:', err.message);
    return null;
  }
}

// ─── Decisão de rota ──────────────────────────────────────────────────────────
function decidirRota(conversa: any, contato: any, content: string): string {
  const lower = content.toLowerCase().trim();

  // Opt-out LGPD
  if (['sair','parar','cancelar','stop','não quero mais','pare'].includes(lower)) {
    return 'optout';
  }

  if (!contato.aceita_msgs) return 'nao_responder';
  if (conversa.estado === 'humano_ativo') return 'humano_ativo';
  if (content === '[Áudio recebido]')  return 'nao_responder';

  return 'ia_responde';
}

// ─── Rota IA ──────────────────────────────────────────────────────────────────
async function rotaIA(
  db: Pool, conversa: any, contato: any,
  msgId: number, instance: string,
  fichaClientePreloaded?: FichaCliente | null
) {
  // Mudar estado se nova
  if (conversa.estado === 'nova') {
    await db.query(`UPDATE wpp_conversa SET estado='ia_ativa', updated_at=NOW() WHERE id=$1`, [conversa.id]);
  }

  const historico      = await getHistorico(db, conversa.id);
  const tenantConfig   = await getTenantConfig(db);
  const fichaCliente   = fichaClientePreloaded ?? await getFichaCliente(db, contato.telefone);
  const tenantComFicha: TenantConfig = { ...tenantConfig, fichaCliente: fichaCliente ?? undefined };

  // Pré-popula dados de qualificação com a ficha (cliente já é conhecido)
  const dadosAtivos: Partial<DadosQualificacao> = { ...(conversa.dados_qualificacao || {}) };
  if (fichaCliente) {
    if (!dadosAtivos.nome)    dadosAtivos.nome    = fichaCliente.nome;
    if (!dadosAtivos.empresa) dadosAtivos.empresa = fichaCliente.nome;
    if (!dadosAtivos.cidade && fichaCliente.cidade) dadosAtivos.cidade = fichaCliente.cidade;
    if (!dadosAtivos.uf     && fichaCliente.uf)     dadosAtivos.uf     = fichaCliente.uf;
    console.log(`[WPP-ORCH] Cliente identificado: ${fichaCliente.nome} (${fichaCliente.cidade}) — último pedido há ${fichaCliente.dias_sem_pedido ?? '?'} dias`);
  }

  const startTime = Date.now();
  const resposta  = await processarMensagem({
    mensagemAtual:    (await db.query('SELECT conteudo FROM wpp_mensagem WHERE id=$1', [msgId])).rows[0]?.conteudo || '',
    historico,
    dadosQualificacao: dadosAtivos,
    tenantConfig: tenantComFicha,
  });
  const tempoMs = Date.now() - startTime;

  // Salvar resposta da IA
  await saveMessage(db, {
    conversaId: conversa.id, contatoId: contato.id, messageId: null,
    direcao: 'outbound', tipo: 'texto', remetente: 'ia',
    conteudo: resposta.texto, status: 'enviada',
    dadosExtraidos: resposta.dadosExtraidos,
    tokensPrompt: resposta.tokensPrompt, tokensResposta: resposta.tokensResposta,
    tempoMs,
  });

  // Mesclar dados extraídos
  if (Object.keys(resposta.dadosExtraidos).length > 0) {
    const merged = { ...dadosAtivos, ...resposta.dadosExtraidos };
    const qualif = avaliarQualificacao(merged);
    merged.score         = qualif.score;
    merged.classificacao = qualif.classificacao;
    merged.qualificado   = qualif.qualificado;

    await db.query(
      `UPDATE wpp_conversa SET dados_qualificacao=$1, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify(merged), conversa.id]
    );

    // Lead qualificado → mudar estado + notificar
    if (qualif.qualificado && conversa.estado !== 'ia_qualificou') {
      await db.query(
        `UPDATE wpp_conversa SET estado='ia_qualificou', qualificada_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [conversa.id]
      );
      // Gerar resumo
      const hist2 = await getHistorico(db, conversa.id, 50);
      const resumo = await gerarResumo(hist2);
      await db.query(
        `UPDATE wpp_conversa SET resumo_ia=$1, updated_at=NOW() WHERE id=$2`,
        [resumo, conversa.id]
      );
      console.log(`🔥 [WPP-ORCH] Lead QUALIFICADO! Conversa #${conversa.id} | Score: ${qualif.score}`);
    }
  }

  // Atualizar contadores e última mensagem
  await db.query(
    `UPDATE wpp_conversa SET
       total_msgs_ia = total_msgs_ia + 1,
       ultima_msg_at = NOW(),
       updated_at    = NOW()
     WHERE id = $1`,
    [conversa.id]
  );

  // Enviar via Evolution API
  await sendText(instance, contato.telefone, resposta.texto);
}

// ─── Opt-out ──────────────────────────────────────────────────────────────────
async function processarOptout(db: Pool, contato: any, conversa: any, instance: string) {
  await db.query(`UPDATE wpp_contato SET aceita_msgs=FALSE, optout_at=NOW() WHERE id=$1`, [contato.id]);
  await db.query(`UPDATE wpp_conversa SET estado='encerrada', encerrada_at=NOW() WHERE id=$1`, [conversa.id]);
  await sendText(
    instance, contato.telefone,
    'Entendido! Você não receberá mais mensagens nossas. Se mudar de ideia, é só nos procurar. Até mais! 👋'
  );
}

// ─── Rota Cliente Pedido ──────────────────────────────────────────────────────
async function rotaClientePedido(
  db: Pool, conversa: any, contato: any,
  content: string, fichaCliente: FichaCliente, instance: string
) {
  const deteccao = await detectarIntencaoPedido(content);

  if (!deteccao.eh_pedido) {
    // Não é pedido — deixa a IRIS responder normalmente como atendimento
    await rotaIA(db, conversa, contato, 0, instance, fichaCliente);
    return;
  }

  console.log(`[WPP-ORCH] Cliente ${fichaCliente.nome} — pedido detectado: ${deteccao.itens.length} item(s)`);

  const resolucao = await resolverItensPedido(db, deteccao.itens, fichaCliente.cli_codigo);
  const numeroPedido = await criarRascunhoWhatsApp(db, fichaCliente.cli_codigo, resolucao, conversa.id);

  const naoEnc = resolucao.nao_resolvidos.length;
  const msg = naoEnc > 0
    ? `Recebi seu pedido (${numeroPedido})! ${naoEnc} item(s) precisam de verificação. Nosso time confirma em breve.`
    : `Recebi seu pedido (${numeroPedido})! Nosso time confirma em breve.`;

  await sendText(instance, contato.telefone, msg);

  // Registrar resposta enviada
  await db.query(
    `INSERT INTO wpp_mensagem
       (conversa_id, contato_id, wpp_message_id, direcao, tipo, remetente,
        conteudo, status, created_at)
     VALUES ($1,$2,NULL,'outbound','texto','ia',$3,'enviada',NOW())`,
    [conversa.id, contato.id, msg]
  );

  await db.query(
    `UPDATE wpp_conversa SET ultima_msg_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [conversa.id]
  );

  console.log(`🛒 [WPP-ORCH] Pedido J criado: ${numeroPedido} | ${fichaCliente.nome} | ${resolucao.resolvidos.length} resolvidos, ${naoEnc} não encontrados`);
}

// ─── PONTO CENTRAL — processMessage ──────────────────────────────────────────
export async function processMessage(db: Pool, payload: {
  phone:       string;
  pushName:    string | null;
  messageId:   string;
  content:     string;
  messageType: string;
  instance:    string;
}) {
  const { phone, pushName, messageId, content, messageType, instance } = payload;

  try {
    // 1. Deduplicação
    const dup = await db.query(
      'SELECT id FROM wpp_mensagem WHERE wpp_message_id=$1 LIMIT 1', [messageId]
    );
    if (dup.rows.length > 0) {
      console.debug(`[WPP-ORCH] Msg duplicada ignorada: ${messageId}`);
      return;
    }

    // 2. Filtro de relevância IRIS — apenas para contatos sem conversa ativa
    // Verifica rapidamente se já existe conversa em andamento antes de chamar IA
    const contatoExistente = await db.query(
      'SELECT id FROM wpp_contato WHERE telefone = $1', [phone]
    );
    const temConversaAtiva = contatoExistente.rows.length > 0
      ? (await db.query(
          `SELECT id FROM wpp_conversa
           WHERE contato_id = $1 AND estado NOT IN ('encerrada','convertida','perdida')
           LIMIT 1`,
          [contatoExistente.rows[0].id]
        )).rows.length > 0
      : false;

    if (!temConversaAtiva) {
      const tenantCfg = await getTenantConfig(db);
      const relevante = await avaliarRelevancia(content, tenantCfg);
      if (!relevante) {
        console.log(`[WPP-ORCH] Mensagem irrelevante ignorada (IRIS) | ${phone.slice(-4)} | "${content.substring(0, 50)}"`);
        return;
      }
    }

    // 3. Identificar / criar contato
    const contato = await findOrCreateContato(db, phone, pushName);

    // 4. Buscar / criar conversa ativa
    const { conversa } = await findOrCreateConversa(db, contato.id);

    // 5. Tipo da mensagem
    const tipoMap: Record<string, string> = {
      conversation: 'texto', extendedTextMessage: 'texto',
      imageMessage: 'imagem', audioMessage: 'audio', videoMessage: 'video',
      documentMessage: 'documento', locationMessage: 'localizacao',
    };
    const tipo = tipoMap[messageType] || 'texto';

    // 6. Salvar mensagem recebida
    const msgId = await saveMessage(db, {
      conversaId: conversa.id, contatoId: contato.id, messageId,
      direcao: 'inbound', tipo, remetente: 'lead',
      conteudo: content, status: 'recebida',
    });

    await db.query(
      `UPDATE wpp_conversa SET
         total_msgs_lead = total_msgs_lead + 1,
         ultima_msg_at   = NOW(),
         updated_at      = NOW()
       WHERE id = $1`,
      [conversa.id]
    );

    // 7. Decidir rota
    const rota = decidirRota(conversa, contato, content);
    console.log(`[WPP-ORCH] Conversa #${conversa.id} | Rota: ${rota} | ${phone.slice(-4)}`);

    switch (rota) {
      case 'ia_responde': {
        // Verifica se é cliente cadastrado → rota de pedido
        const fichaCliente = await getFichaCliente(db, phone);
        if (fichaCliente) {
          await rotaClientePedido(db, conversa, contato, content, fichaCliente, instance);
        } else {
          await rotaIA(db, conversa, contato, msgId, instance);
        }
        break;
      }
      case 'optout':
        await processarOptout(db, contato, conversa, instance);
        break;
      case 'humano_ativo':
        console.log(`[WPP-ORCH] Humano ativo em #${conversa.id} — msg salva, sem resposta IA`);
        break;
      case 'nao_responder':
        break;
    }
  } catch (err: any) {
    console.error(`[WPP-ORCH] Erro processando msg de ${phone}:`, err.message);
  }
}
