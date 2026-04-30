// ─── Filtro de relevância — roda ANTES da IA, sem custo ─────────────────────
// Descarta spam, bancos, cartões, marketplaces e notificações automáticas.
// Só chega na IA o que passar aqui.

// Domínios irrelevantes conhecidos
const DOMAIN_BLACKLIST = [
  // Bancos e financeiras
  'bradesco', 'itau', 'santander', 'bb.com.br', 'caixa.gov',
  'nubank', 'inter.co', 'c6bank', 'original.com.br', 'btgpactual',
  'sicoob', 'sicredi', 'ailos', 'bancoob', 'cresol',
  'citibank', 'hsbc', 'safra', 'votorantim',
  // Cartões
  'carrefour', 'riachuelo', 'renner', 'marisa', 'casasbahia',
  'americanas', 'magazineluiza', 'mercadolivre', 'shopee', 'amazon',
  'extra.com', 'pontofrio', 'submarino',
  // Pagamentos / cobranças
  'pagseguro', 'mercadopago', 'picpay', 'paypal', 'rede.com',
  'getnet', 'cielo', 'stone.com', 'iugu', 'asaas', 'boleto',
  'serasa', 'spc', 'boa.compra',
  // Rastreamento / logística
  'correios', 'jadlog', 'totalexpress', 'loggi', 'sequoia',
  'transportadora', 'rastreamento', 'nfe.fazenda', 'nfe-',
  // Telecom / utilities
  'tim.com', 'claro.com', 'vivo.com', 'oi.com', 'nextel',
  'embratel', 'net.com', 'anatel',
  // Ferramentas / SaaS sem relação comercial
  'linkedin', 'facebook', 'instagram', 'twitter', 'google.com',
  'accounts.google', 'youtube', 'tiktok',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'mailer-daemon', 'postmaster',
  'newsletter', 'marketing@', 'promocoes@', 'contato@contato',
  'notification', 'notificacao', 'alerts@', 'alertas@',
  'autoresponder', 'bounce',
];

// Palavras no assunto que indicam email irrelevante
const SUBJECT_BLACKLIST = [
  // Financeiro pessoal
  'fatura do seu cartão', 'fatura do cartão', 'sua fatura',
  'boleto', 'boleto vencendo', 'pagamento da fatura',
  'seu débito', 'limite de crédito', 'crédito aprovado',
  'empréstimo', 'financiamento', 'cashback',
  // Logística / rastreamento
  'rastreamento', 'seu pedido foi', 'pedido enviado', 'pedido entregue',
  'saiu para entrega', 'objeto postado', 'objeto entregue',
  'nota fiscal emitida', 'nfe emitida', 'danfe',
  // Promoções / marketing
  'oferta imperdível', 'oferta exclusiva', 'aproveite agora',
  'últimas unidades', 'frete grátis', 'desconto especial',
  'só hoje', 'só amanhã', 'promoção relâmpago',
  'ganhe pontos', 'seus pontos', 'resgate seus',
  'você foi selecionado', 'você ganhou', 'parabéns',
  'confirme seu cadastro', 'ative sua conta',
  'unsubscribe', 'cancelar inscrição', 'descadastrar',
  // Sistemas automáticos
  'out of office', 'ausência temporária', 'férias',
  'delivery notification', 'mail delivery',
  'acesso à sua conta', 'senha alterada', 'código de verificação',
  'autenticação', 'token de acesso',
  // Jurídico/gov impessoal
  'receita federal', 'simples nacional', 'pgfn', 'dívida ativa',
  'certidão negativa', 'e-social', 'cnd',
];

// Padrões regex no remetente
const SENDER_PATTERNS = [
  /noreply|no-reply|donotreply|do-not-reply/i,
  /mailer-daemon|postmaster|bounce/i,
  /newsletter|marketing|promocoes?|advertising/i,
  /notification|notificacao|alert|alerta/i,
  /autoresponder|auto-reply/i,
  /suporte@.*\.(gov|mil)\.br$/i,
  /atendimento@(?:bradesco|itau|santander|nubank|inter)/i,
];

export interface FiltroResult {
  passou:  boolean;
  motivo?: string;
}

export function filtrarEmailRelevancia(
  de: string,
  assunto: string,
  corpo: string,
): FiltroResult {
  const deLower      = de.toLowerCase();
  const assuntoLower = assunto.toLowerCase();

  // 1. Padrões regex no remetente
  for (const pat of SENDER_PATTERNS) {
    if (pat.test(deLower)) {
      return { passou: false, motivo: `remetente padrão automático: ${de}` };
    }
  }

  // 2. Domínio blacklist
  for (const domain of DOMAIN_BLACKLIST) {
    if (deLower.includes(domain)) {
      return { passou: false, motivo: `domínio bloqueado: ${domain}` };
    }
  }

  // 3. Assunto blacklist
  for (const kw of SUBJECT_BLACKLIST) {
    if (assuntoLower.includes(kw)) {
      return { passou: false, motivo: `assunto irrelevante: ${kw}` };
    }
  }

  // 4. Assunto vazio / muito curto
  if (assunto.trim().length < 3) {
    return { passou: false, motivo: 'assunto ausente ou muito curto' };
  }

  return { passou: true };
}
