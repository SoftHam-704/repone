import { Pool } from 'pg';
import axios from 'axios';
import {
  processarMensagem, gerarResumo, avaliarQualificacao, avaliarRelevancia,
  DadosQualificacao, TenantConfig,
} from './whatsapp-ai.service';

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
    return {
      representante_nome: map['representante_nome'] || 'Representante',
      empresa_nome:       map['empresa_nome']       || 'Empresa',
      industrias:         map['industrias_representadas'],
    };
  } catch {
    return { representante_nome: 'Representante', empresa_nome: 'Empresa' };
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
  msgId: number, instance: string
) {
  // Mudar estado se nova
  if (conversa.estado === 'nova') {
    await db.query(`UPDATE wpp_conversa SET estado='ia_ativa', updated_at=NOW() WHERE id=$1`, [conversa.id]);
  }

  const historico    = await getHistorico(db, conversa.id);
  const tenantConfig = await getTenantConfig(db);
  const dadosAtivos: Partial<DadosQualificacao> = conversa.dados_qualificacao || {};

  const startTime = Date.now();
  const resposta  = await processarMensagem({
    mensagemAtual:    (await db.query('SELECT conteudo FROM wpp_mensagem WHERE id=$1', [msgId])).rows[0]?.conteudo || '',
    historico,
    dadosQualificacao: dadosAtivos,
    tenantConfig,
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
      case 'ia_responde':
        await rotaIA(db, conversa, contato, msgId, instance);
        break;
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
