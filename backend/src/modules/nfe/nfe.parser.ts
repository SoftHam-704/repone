// ─── NF-e XML Parser ─────────────────────────────────────────────────────────
// Extrai campos do schema NF-e 4.00 (SEFAZ) sem dependências externas.
// Suporta <nfeProc>, <NFe>, com ou sem namespace.

export interface NFeItem {
  nItem:    number;
  cProd:    string;   // código do produto (normalizado)
  xProd:    string;   // descrição
  qCom:     number;   // quantidade comercial
  vUnCom:   number;   // valor unitário comercial
  vProd:    number;   // valor total do item
  xPed:     string;   // OC do cliente (campo opcional nos itens)
}

export interface NFeData {
  nNF:      string;
  serie:    string;
  dhEmi:    string;
  // emitente (indústria)
  emitCNPJ: string;
  emitNome: string;
  // destinatário (cliente)
  destCNPJ: string;
  destNome: string;
  // total
  vNF:      number;
  // pedido da indústria extraído de infCpl ("Cod. Pedido(s): XXXXX")
  codPedidoInd: string;
  // itens
  items: NFeItem[];
}

// Extrai texto de uma tag XML (primeiro match, ignora namespace)
function tag(xml: string, tagName: string): string {
  const re = new RegExp(`<(?:[\\w]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

// Remove tudo que não é dígito
export function normCNPJ(v: string): string {
  return v.replace(/\D/g, '');
}

// Normaliza código de produto: remove espaços e zeros à esquerda
export function normCod(v: string): string {
  const t = v.trim().toUpperCase();
  return t.replace(/^0+/, '') || t;
}

export function parseNFe(xml: string): NFeData {
  const infNFe = tag(xml, 'infNFe') || xml;

  const ide  = tag(infNFe, 'ide');
  const emit = tag(infNFe, 'emit');
  const dest = tag(infNFe, 'dest');

  const nNF   = tag(ide, 'nNF');
  const serie = tag(ide, 'serie');
  const dhEmi = tag(ide, 'dhEmi') || tag(ide, 'dEmi');

  const emitCNPJ = normCNPJ(tag(emit, 'CNPJ'));
  const emitNome = tag(emit, 'xFant') || tag(emit, 'xNome');

  const destCNPJ = normCNPJ(tag(dest, 'CNPJ') || tag(dest, 'CPF'));
  const destNome = tag(dest, 'xNome');

  const totalBlk = tag(infNFe, 'ICMSTot') || tag(infNFe, 'total');
  const vNF = parseFloat(tag(totalBlk, 'vNF') || '0');

  // Extrai número do pedido da indústria de infCpl
  // Ex: "Cod. Pedido(s): 118789\ORDEM DE COMPRA..."
  const infCpl = tag(infNFe, 'infCpl');
  const codPedidoInd = (infCpl.match(/Cod\.\s*Pedido[^:]*:\s*([\d]+)/i) || [])[1] || '';

  // Itens
  const items: NFeItem[] = [];
  const detRe = /<(?:[\w]+:)?det\b[\s\S]*?<\/(?:[\w]+:)?det>/gi;
  let detMatch: RegExpExecArray | null;

  while ((detMatch = detRe.exec(infNFe)) !== null) {
    const det  = detMatch[0];
    const nItemStr = (det.match(/nItem=["'](\d+)["']/i) || [])[1] || String(items.length + 1);
    const prod = tag(det, 'prod');

    const cProd  = normCod(tag(prod, 'cProd'));
    const xProd  = tag(prod, 'xProd');
    const qCom   = parseFloat(tag(prod, 'qCom').replace(',', '.'))   || 0;
    const vUnCom = parseFloat(tag(prod, 'vUnCom').replace(',', '.')) || 0;
    const vProd  = parseFloat(tag(prod, 'vProd').replace(',', '.'))  || 0;
    const xPed   = tag(prod, 'xPed').trim();   // OC do cliente (pode estar vazio)

    if (cProd && qCom > 0) {
      items.push({ nItem: parseInt(nItemStr), cProd, xProd, qCom, vUnCom, vProd, xPed });
    }
  }

  return { nNF, serie, dhEmi, emitCNPJ, emitNome, destCNPJ, destNome, vNF, codPedidoInd, items };
}
