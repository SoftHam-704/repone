import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Search, Trash2, CheckCircle, AlertTriangle, RotateCcw, ChevronDown, RefreshCw } from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';
import { resolverPrecoFinal, type Canal } from '@/shared/utils/precoResolver';
import { useGridSort, useSortedRows, useColumnWidths, sortArrow, type ColW } from '../utils/useGridSort';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogItem {
  pro_id: number;
  pro_codigo: string;
  pro_nome: string;
  pro_grupo: number;
  pro_embalagem: number;   // múltiplo
  pro_peso: number;
  pro_conversao?: string;
  preco_bruto: number;
  preco_promo: number;
  preco_especial: number;
  preco_peso: number;
  ipi: number;
  st: number;
  grupo_desconto: string;
  desconto_add: number;
}

interface ItemRow {
  tempId: string;
  ite_seq: number;
  ite_industria: number;
  ite_produto: string;
  ite_embuch: string;
  ite_nomeprod: string;
  ite_grupo: number;
  ite_quant: number;
  ite_puni: number;
  ite_puniliq: number;
  ite_des1: number; ite_des2: number; ite_des3: number;
  ite_des4: number; ite_des5: number; ite_des6: number;
  ite_des7: number; ite_des8: number; ite_des9: number;
  ite_des10: number;
  ite_ipi: number;
  ite_st: number;
  ite_totbruto: number;
  ite_totliquido: number;
  ite_valcomipi: number;
  ite_valcomst: number;
  discountSource?: 'CLIENT_GROUP' | 'TABLE_GROUP' | 'HEADER';
}

interface OrderFull {
  ped_pedido: string;
  ped_industria: number;
  ped_cliente: number;
  ped_tabela: string;
  ped_pri: number; ped_seg: number; ped_ter: number;
  ped_qua: number; ped_qui: number; ped_sex: number;
  ped_set: number; ped_oit: number; ped_nov: number;
  ped_totbruto: number;
  ped_totliq: number;
  ped_totalipi: number;
}

interface UserParams {
  usaDecimais:   boolean;
  qtdDecimais:   number;
  qtdEnter:      number;
  fmtPesquisa:   string;
  itemDuplicado: boolean;
}

interface Props {
  order: OrderFull;
  mode: 'view' | 'edit' | 'new';
  priceTableItems: CatalogItem[];
  userParams: UserParams | null;
  orderItems: ItemRow[];
  setOrderItems: React.Dispatch<React.SetStateAction<ItemRow[]>>;
  onFinalizar: () => void;
  hasSuframa?: boolean;
  usaMenorPreco?: boolean;
  /** Canal do cliente nesta indústria (cli_ind.cli_canal). 'varejo' ignora precoEspecial. */
  cliCanal?: Canal;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const einp: React.CSSProperties = {
  width: '100%', background: '#fff', border: `1px solid ${G.border}`,
  borderRadius: 8, padding: '5px 9px', fontSize: 13, fontWeight: 700,
  color: G.text, outline: 'none', boxSizing: 'border-box',
};

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v: number) =>
  `${(v || 0).toFixed(2).replace('.', ',')}%`;

function normalizeStr(s: string) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function calculateItem(
  puni: number, quant: number,
  d1: number, d2: number, d3: number, d4: number, d5: number,
  d6: number, d7: number, d8: number, d9: number, d10: number,
  ipi: number, st: number,
  casas = 2,
) {
  let liq = puni;
  [d1, d2, d3, d4, d5, d6, d7, d8, d9].forEach(d => { liq = liq * (1 - d / 100); });
  liq = liq * (1 - d10 / 100);
  // Líquido unitário arredondado na casa configurada (par_qtddecimais); total = líquido × qtd.
  const pot = Math.pow(10, Math.max(0, Math.min(4, casas)));
  const puniliq    = Math.round(liq * pot) / pot;
  const totbruto   = Math.round((puni * quant) * 100) / 100;
  const totliquido = Math.round((puniliq * quant) * 100) / 100;
  const valcomipi  = Math.round((totliquido * (1 + ipi / 100)) * 100) / 100;
  const valcomst   = Math.round((valcomipi  * (1 + st  / 100)) * 100) / 100;
  return { puniliq, totbruto, totliquido, valcomipi, valcomst };
}

function emptyForm() {
  return {
    produto: '', embuch: '', nomeprod: '', grupo: 0,
    quant: '',
    puni: 0, puniliq: 0,
    des1: 0, des2: 0, des3: 0, des4: 0, des5: 0,
    des6: 0, des7: 0, des8: 0, des9: 0, des10: 0,
    ipi: 0, st: 0,
    totbruto: 0, totliquido: 0, valcomipi: 0, valcomst: 0,
    discountSource: undefined as 'CLIENT_GROUP' | 'TABLE_GROUP' | 'HEADER' | undefined,
    editingTempId: undefined as string | undefined,
  };
}

// ─── PercentInput ─────────────────────────────────────────────────────────────

function PercentInput({ value, onChange, tabIndex }: { value: number; onChange: (v: number) => void; tabIndex?: number }) {
  const fmtV = (v: number) => v.toFixed(2).replace('.', ',');
  const [display, setDisplay] = useState(() => fmtV(value));

  useEffect(() => { setDisplay(fmtV(value)); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const num = parseInt(digits || '0', 10);
    const floatVal = num / 100;
    if (floatVal > 100) return;
    setDisplay(fmtV(floatVal));
    onChange(floatVal);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="text" inputMode="numeric" value={display}
        onChange={handleChange}
        onFocus={e => e.target.select()}
        onBlur={() => setDisplay(fmtV(value))}
        tabIndex={tabIndex}
        style={{ ...einp, textAlign: 'right', fontFamily: 'monospace', padding: '5px 20px 5px 5px', fontSize: 12 }}
      />
      <span style={{ position: 'absolute', right: 5, fontSize: 10, fontWeight: 700, color: G.textMuted, pointerEvents: 'none' }}>%</span>
    </div>
  );
}

// ─── Discount source badge ────────────────────────────────────────────────────

function DiscountBadge({ source }: { source?: 'CLIENT_GROUP' | 'TABLE_GROUP' | 'HEADER' }) {
  if (!source) return null;
  const map = {
    CLIENT_GROUP: { label: 'CLIENTE', color: '#16A34A' },
    TABLE_GROUP:  { label: 'TABELA',  color: '#2563EB' },
    HEADER:       { label: 'CABEÇ.',  color: G.textMuted },
  };
  const { label, color } = map[source];
  return (
    <span style={{
      fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
      padding: '2px 6px', borderRadius: 6,
      background: `${color}18`, color,
      border: `1px solid ${color}40`,
    }}>{label}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ItemsSection({ order, mode, priceTableItems, userParams, orderItems, setOrderItems, onFinalizar, hasSuframa = false, usaMenorPreco = false, cliCanal = 'varejo' }: Props) {
  const isView        = mode === 'view';
  const qtdEnter      = userParams?.qtdEnter      ?? 2;
  const usaDecimais   = userParams?.usaDecimais   ?? true;
  const qtdDecimais   = userParams?.qtdDecimais   ?? 2;
  const fmtPesquisa   = userParams?.fmtPesquisa   ?? 'D';
  const itemDuplicado = userParams?.itemDuplicado ?? false;

  const [form,             setForm]             = useState(emptyForm());
  const [catalogFilter,    setCatalogFilter]    = useState('');
  const [selectedCatIdx,   setSelectedCatIdx]   = useState(-1);
  const [clientDiscounts,  setClientDiscounts]  = useState<any[]>([]);
  const [tableGroupDiscs,  setTableGroupDiscs]  = useState<any[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [dupDialog,        setDupDialog]        = useState<{ item: ItemRow; newQuant: number } | null>(null);
  const [multWarn,         setMultWarn]         = useState<string | null>(null);
  const [productHistory,   setProductHistory]   = useState<any[]>([]);
  const [loadingHistory,   setLoadingHistory]   = useState(false);
  const [conversao,        setConversao]        = useState<string>('');

  // ─── Ordenação + redimensionamento dos grids (clique no cabeçalho / arrasta borda) ───
  type GCol = ColW & { label: string; align: 'left' | 'right'; sortable?: boolean; noResize?: boolean; acc?: (it: ItemRow) => any };
  // índice original (pra coluna "#" reordenar de volta à sequência de digitação)
  const origIdx = useMemo(() => new Map(orderItems.map((it, idx) => [it.tempId, idx])), [orderItems]);
  const ITEM_COLS = useMemo<GCol[]>(() => [
    { key: 'seq',     label: '#',        align: 'left',  width: 46,  minWidth: 36, acc: (it) => origIdx.get(it.tempId) ?? 0 },
    { key: 'codigo',  label: 'Código',   align: 'left',  width: 130, minWidth: 70, acc: (it) => it.ite_produto },
    { key: 'qtd',     label: 'Qtd',      align: 'left',  width: 70,  minWidth: 48, acc: (it) => Number(it.ite_quant) },
    { key: 'puniliq', label: 'Liq.Unit', align: 'right', width: 92,  minWidth: 60, acc: (it) => Number(it.ite_puniliq) },
    { key: 'totliq',  label: 'Tot.Líq.', align: 'right', width: 100, minWidth: 60, acc: (it) => Number(it.ite_totliquido) },
    { key: '_acoes',  label: '',         align: 'left',  width: 36,  minWidth: 30, sortable: false, noResize: true },
  ], [origIdx]);
  const itemAccessors = useMemo(
    () => Object.fromEntries(ITEM_COLS.filter(c => c.acc).map(c => [c.key, c.acc!])),
    [ITEM_COLS],
  );
  const { sort: itemSort, cycle: itemCycle } = useGridSort();
  const sortedItems = useSortedRows(orderItems, itemSort, itemAccessors);
  const { widths: itemWidths, startResize: itemResize } = useColumnWidths('repone:grid:pedido-itens', ITEM_COLS);

  // Refs for focus management
  const codigoRef  = useRef<HTMLInputElement>(null);
  const embuchRef  = useRef<HTMLInputElement>(null);
  const quantRef   = useRef<HTMLInputElement>(null);
  const puniRef    = useRef<HTMLInputElement>(null);
  const puniliqRef = useRef<HTMLInputElement>(null);
  const desRefs    = useRef<(HTMLInputElement | null)[]>(Array(9).fill(null));
  const des10Ref   = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  const fmtQuant = (v: number) =>
    usaDecimais
      ? v.toLocaleString('pt-BR', { minimumFractionDigits: qtdDecimais, maximumFractionDigits: qtdDecimais })
      : String(Math.trunc(v));

  // ── Load items + discounts on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!order?.ped_pedido) return;
    setLoading(true);

    // Only load items from DB if none are loaded yet — avoids overwriting unsaved items
    // when the user navigates away and back to this tab
    const shouldLoadItems = orderItems.length === 0;

    Promise.allSettled([
      shouldLoadItems
        ? api.get(`/order-items/${encodeURIComponent(order.ped_pedido)}`)
        : Promise.resolve({ data: { success: false } }),
      order.ped_cliente ? api.get(`/clients/${order.ped_cliente}/discounts`) : Promise.resolve({ data: { success: true, data: [] } }),
      api.get('/grupo-desc'),
    ]).then(([itemsRes, cliRes, grpRes]) => {
      if (shouldLoadItems && itemsRes.status === 'fulfilled' && itemsRes.value.data.success) {
        const rows: ItemRow[] = (itemsRes.value.data.data || []).map((r: any, i: number) => ({
          ...r,
          tempId: `loaded-${i}-${r.ite_lancto}`,
        }));
        setOrderItems(rows);
      }
      if (cliRes.status === 'fulfilled' && cliRes.value.data.success) {
        setClientDiscounts(cliRes.value.data.data || []);
      }
      if (grpRes.status === 'fulfilled' && grpRes.value.data.success) {
        setTableGroupDiscs(grpRes.value.data.data || []);
      }
    }).finally(() => setLoading(false));

    setTimeout(() => codigoRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.ped_pedido]);

  // ── Load product purchase history ────────────────────────────────────────────
  useEffect(() => {
    const produto = form.produto?.trim();
    if (!produto || !order.ped_cliente || !order.ped_industria) {
      setProductHistory([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    api.get(`/order-items/product-history/${encodeURIComponent(produto)}/${order.ped_cliente}/${order.ped_industria}`)
      .then(res => {
        if (!cancelled && res.data.success) setProductHistory(res.data.data || []);
      })
      .catch(() => { if (!cancelled) setProductHistory([]); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [form.produto, order.ped_cliente, order.ped_industria]);

  // ── Catalog filter ───────────────────────────────────────────────────────────
  const filteredCatalog = React.useMemo(() => {
    const q = normalizeStr(catalogFilter);
    if (!q) return priceTableItems.slice(0, 200);
    return priceTableItems.filter(p => {
      // 'C' = Código exato: casa só quando o código (ou conversão) é IGUAL ao digitado.
      if (fmtPesquisa === 'C') {
        return normalizeStr(p.pro_codigo) === q || normalizeStr(p.pro_conversao || '') === q;
      }
      // 'D' = Código + Descrição: LIKE no código/conversão OU na descrição.
      const byCode = normalizeStr(p.pro_codigo).includes(q)
        || normalizeStr(p.pro_conversao || '').includes(q);
      return byCode || normalizeStr(p.pro_nome).includes(q);
    }).slice(0, 200);
  }, [catalogFilter, priceTableItems, fmtPesquisa]);

  // ── Recalculate totals when discount/price/quant changes ────────────────────
  const recalc = useCallback((f: typeof form) => {
    const quant = parseFloat(f.quant.replace(',', '.')) || 0;
    const calc  = calculateItem(
      f.puni, quant,
      f.des1, f.des2, f.des3, f.des4, f.des5,
      f.des6, f.des7, f.des8, f.des9, f.des10,
      f.ipi, f.st, qtdDecimais,
    );
    return { ...f, ...calc, quant: f.quant };
  }, []);

  const setFormField = (key: string, val: any) => {
    setForm(prev => {
      const updated = { ...prev, [key]: val };
      return recalc(updated);
    });
  };

  // ── Resolve discounts for a product ─────────────────────────────────────────
  function resolveDiscounts(product: CatalogItem): {
    des1: number; des2: number; des3: number; des4: number; des5: number;
    des6: number; des7: number; des8: number; des9: number;
    source: 'CLIENT_GROUP' | 'TABLE_GROUP' | 'HEADER';
  } {
    // Priority 1: client group discounts — prefer industry-specific rule, fall back to any rule for this group
    const cliRule = product.pro_grupo
      ? (clientDiscounts.find(d => Number(d.cli_grupo) === product.pro_grupo && Number(d.cli_forcodigo) === order.ped_industria)
        || clientDiscounts.find(d => Number(d.cli_grupo) === product.pro_grupo))
      : null;
    if (cliRule) {
      return {
        des1: parseFloat(cliRule.cli_desc1) || 0,
        des2: parseFloat(cliRule.cli_desc2) || 0,
        des3: parseFloat(cliRule.cli_desc3) || 0,
        des4: parseFloat(cliRule.cli_desc4) || 0,
        des5: parseFloat(cliRule.cli_desc5) || 0,
        des6: parseFloat(cliRule.cli_desc6) || 0,
        des7: parseFloat(cliRule.cli_desc7) || 0,
        des8: parseFloat(cliRule.cli_desc8) || 0,
        des9: parseFloat(cliRule.cli_desc9) || 0,
        source: 'CLIENT_GROUP',
      };
    }

    // Priority 2: table group discounts
    if (product.grupo_desconto) {
      const grpRule = tableGroupDiscs.find(g => g.gid === product.grupo_desconto);
      if (grpRule) {
        return {
          des1: parseFloat(grpRule.gde_desc1) || 0,
          des2: parseFloat(grpRule.gde_desc2) || 0,
          des3: parseFloat(grpRule.gde_desc3) || 0,
          des4: parseFloat(grpRule.gde_desc4) || 0,
          des5: parseFloat(grpRule.gde_desc5) || 0,
          des6: parseFloat(grpRule.gde_desc6) || 0,
          des7: parseFloat(grpRule.gde_desc7) || 0,
          des8: parseFloat(grpRule.gde_desc8) || 0,
          des9: parseFloat(grpRule.gde_desc9) || 0,
          source: 'TABLE_GROUP',
        };
      }
    }

    // Priority 3: order header
    const normH = (v: any) => { const n = parseFloat(v) || 0; return n > 100 ? parseFloat((n / 100).toFixed(2)) : n; };
    return {
      des1: normH(order.ped_pri), des2: normH(order.ped_seg), des3: normH(order.ped_ter),
      des4: normH(order.ped_qua), des5: normH(order.ped_qui), des6: normH(order.ped_sex),
      des7: normH(order.ped_set), des8: normH(order.ped_oit), des9: normH(order.ped_nov),
      source: 'HEADER',
    };
  }

  // ── Reaplicar política de descontos em todos os itens do pedido ─────────────
  function handleReaplicarPolitica() {
    const catalogMap = new Map(priceTableItems.map(p => [p.pro_codigo.trim().toUpperCase(), p]));
    let updated = 0;

    setOrderItems(prev => prev.map(item => {
      const product = catalogMap.get(item.ite_produto.trim().toUpperCase());
      if (!product) return item; // produto fora do catálogo — mantém como está

      const discs = resolveDiscounts(product);
      const calc = calculateItem(
        item.ite_puni, item.ite_quant,
        discs.des1, discs.des2, discs.des3, discs.des4, discs.des5,
        discs.des6, discs.des7, discs.des8, discs.des9,
        product.desconto_add || 0,
        item.ite_ipi, item.ite_st, qtdDecimais,
      );
      updated++;
      return {
        ...item,
        ite_des1: discs.des1, ite_des2: discs.des2, ite_des3: discs.des3,
        ite_des4: discs.des4, ite_des5: discs.des5, ite_des6: discs.des6,
        ite_des7: discs.des7, ite_des8: discs.des8, ite_des9: discs.des9,
        ite_des10: product.desconto_add || 0,
        ite_puniliq: calc.puniliq,
        ite_totbruto: calc.totbruto,
        ite_totliquido: calc.totliquido,
        ite_valcomipi: calc.valcomipi,
        ite_valcomst: calc.valcomst,
        discountSource: discs.source,
      };
    }));

    toast.success(`Política reaplicada em ${updated} item(s).`);
  }

  // ── Select product from catalog ──────────────────────────────────────────────
  function handleSelectProduct(product: CatalogItem) {
    const discs = resolveDiscounts(product);

    let puni: number;

    if (usaMenorPreco) {
      // Política de menor preço (flag for_usa_menor_preco): compara bruto líquido,
      // promo e — só pra distribuidor — especial. Varejo nunca compara contra especial.
      let netBruto = product.preco_bruto;
      [discs.des1, discs.des2, discs.des3, discs.des4, discs.des5,
       discs.des6, discs.des7, discs.des8, discs.des9]
        .forEach(d => { netBruto = netBruto * (1 - d / 100); });

      const candidates: { net: number; raw: number; isPromo: boolean }[] = [
        { net: netBruto, raw: product.preco_bruto, isPromo: false },
      ];
      if ((product.preco_promo    || 0) > 0) candidates.push({ net: product.preco_promo,    raw: product.preco_promo,    isPromo: true });
      if (cliCanal === 'distribuidor' && (product.preco_especial || 0) > 0)
        candidates.push({ net: product.preco_especial, raw: product.preco_especial, isPromo: true });

      const best = candidates.reduce((a, b) => a.net <= b.net ? a : b);
      puni = best.raw;

      if (best.isPromo) {
        // Min é promo/especial → zera descontos (preço já é o final)
        discs.des1 = discs.des2 = discs.des3 = discs.des4 = discs.des5 = 0;
        discs.des6 = discs.des7 = discs.des8 = discs.des9 = 0;
      }
    } else {
      // Padrão: helper canônico resolve base por canal (skill preco-canal).
      // Descontos `discs.*` continuam sendo aplicados depois no recalc — por isso
      // passamos `descontos: []` aqui, só queremos a base correta.
      const r = resolverPrecoFinal(
        {
          precoBruto:    product.preco_bruto,
          precoPromo:    product.preco_promo,
          precoEspecial: product.preco_especial,
          precoPeso:     product.preco_peso,
          pesoProduto:   product.pro_peso,
        },
        { canal: cliCanal, descontos: [] },
      );
      puni = r.precoBase;
      if (r.isPromo) {
        // Promo é líquido absoluto — zera cascata pra recalc não duplo-aplicar
        discs.des1 = discs.des2 = discs.des3 = discs.des4 = discs.des5 = 0;
        discs.des6 = discs.des7 = discs.des8 = discs.des9 = 0;
      }
    }

    const mult = product.pro_embalagem > 0 ? product.pro_embalagem : 1;
    const quantNum = mult;
    const quantStr = usaDecimais
      ? quantNum.toFixed(qtdDecimais).replace('.', ',')
      : String(Math.trunc(quantNum));

    const newForm = {
      ...emptyForm(),
      produto:   product.pro_codigo,
      nomeprod:  product.pro_nome,
      grupo:     product.pro_grupo || 0,
      quant:     quantStr,
      puni,
      des1: discs.des1, des2: discs.des2, des3: discs.des3,
      des4: discs.des4, des5: discs.des5, des6: discs.des6,
      des7: discs.des7, des8: discs.des8, des9: discs.des9,
      des10: product.desconto_add || 0,
      ipi: hasSuframa ? 0 : (parseFloat(String(product.ipi)) || 0),
      st:  hasSuframa ? 0 : (parseFloat(String(product.st))  || 0),
      discountSource: discs.source,
      editingTempId: form.editingTempId,
    };

    const filled = recalc(newForm);
    setForm(filled);
    setConversao(product.pro_conversao || '');
    setCatalogFilter('');
    setSelectedCatIdx(-1);

    // Level 1: auto-save — aplica a regra canônica de duplicação
    if (qtdEnter === 1) {
      if (checkDuplicateAndMaybeAbort(filled)) return;
      doSaveItem(filled);
      return;
    }

    // Focus next field depending on level
    setTimeout(() => {
      if (qtdEnter >= 2) embuchRef.current?.focus();
    }, 30);
  }

  // ── Validação canônica de duplicidade — ÚNICA fonte da verdade.
  // Retorna true se a operação deve ABORTAR (modal aberto pra decisão).
  // Chamada em 3 pontos: nível 1 auto-save, Enter no embuch, e handleSaveItem.
  // SEMPRE abre o modal pra perguntar; "Novo Item" só fica visível quando itemDuplicado=true.
  function checkDuplicateAndMaybeAbort(currentForm: typeof form): boolean {
    if (currentForm.editingTempId) return false;
    const codigo = (currentForm.produto || '').toUpperCase();
    if (!codigo) return false;
    const dup = orderItems.find(it => it.ite_produto === codigo);
    if (!dup) return false;
    const quant = parseFloat((currentForm.quant || '0').replace(',', '.')) || 0;
    setDupDialog({ item: dup, newQuant: quant > 0 ? quant : 1 });
    return true;
  }

  // ── Focus sequence after Enter in each field ─────────────────────────────────
  function focusAfter(field: string) {
    if (field === 'embuch') {
      // Checa duplicado ANTES de avançar — evita o rep digitar quantidade à toa
      if (checkDuplicateAndMaybeAbort(form)) return;
      if (qtdEnter >= 3) { desRefs.current[0]?.focus(); return; }
      quantRef.current?.focus();
    } else if (field.startsWith('des')) {
      const idx = parseInt(field.replace('des', '')) - 1;
      if (idx < 8) { desRefs.current[idx + 1]?.focus(); return; }
      // after des9
      des10Ref.current?.focus();
    } else if (field === 'des10') {
      quantRef.current?.focus();
    } else if (field === 'quant') {
      if (qtdEnter >= 4) { puniRef.current?.focus(); return; }
      handleSaveItem();
    } else if (field === 'puni') {
      puniliqRef.current?.focus();
    } else if (field === 'puniliq') {
      handleSaveItem();
    }
  }

  // ── Save item to local array ─────────────────────────────────────────────────
  function doSaveItem(f: typeof form) {
    const quant = parseFloat((f.quant || '0').replace(',', '.')) || 0;
    if (!f.produto) { toast.error('Selecione um produto.'); return; }
    if (quant <= 0) { toast.error('Quantidade deve ser maior que zero.'); return; }

    const calc = calculateItem(
      f.puni, quant,
      f.des1, f.des2, f.des3, f.des4, f.des5,
      f.des6, f.des7, f.des8, f.des9, f.des10,
      f.ipi, f.st, qtdDecimais,
    );

    const newItem: ItemRow = {
      tempId: f.editingTempId || `new-${Date.now()}`,
      ite_seq: 0,
      ite_industria: order.ped_industria,
      ite_produto: f.produto.toUpperCase(),
      ite_embuch: f.embuch,
      ite_nomeprod: f.nomeprod,
      ite_grupo: f.grupo,
      ite_quant: quant,
      ite_puni: f.puni,
      ite_puniliq: calc.puniliq,
      ite_des1: f.des1, ite_des2: f.des2, ite_des3: f.des3,
      ite_des4: f.des4, ite_des5: f.des5, ite_des6: f.des6,
      ite_des7: f.des7, ite_des8: f.des8, ite_des9: f.des9,
      ite_des10: f.des10,
      ite_ipi: f.ipi,
      ite_st: f.st,
      ite_totbruto: calc.totbruto,
      ite_totliquido: calc.totliquido,
      ite_valcomipi: calc.valcomipi,
      ite_valcomst: calc.valcomst,
      discountSource: f.discountSource,
    };

    setOrderItems(prev => {
      if (f.editingTempId) {
        return prev.map((it, idx) =>
          it.tempId === f.editingTempId ? { ...newItem, ite_seq: idx + 1 } : it
        );
      }
      return [...prev, { ...newItem, ite_seq: prev.length + 1 }];
    });

    setForm(emptyForm());
    setConversao('');
    setTimeout(() => codigoRef.current?.focus(), 30);
  }

  function handleSaveItem() {
    const quant = parseFloat((form.quant || '0').replace(',', '.')) || 0;
    if (!form.produto) { toast.error('Selecione um produto.'); codigoRef.current?.focus(); return; }
    if (quant <= 0) { toast.error('Quantidade deve ser maior que zero.'); quantRef.current?.focus(); return; }

    // Check multiple/embalagem
    const catalogProd = priceTableItems.find(p => p.pro_codigo === form.produto);
    const mult = catalogProd?.pro_embalagem || 0;
    if (mult > 0 && quant % mult !== 0) {
      setMultWarn(`Quantidade ${fmtQuant(quant)} não é múltiplo de ${fmtQuant(mult)}. Deseja forçar o lançamento?`);
      return;
    }

    // Regra de duplicação canônica (validada com Hamilton em 2026-05-22):
    //   par_itemduplicado='N' (não permite) → bloqueia totalmente.
    //   par_itemduplicado='S' (permite via embuch) → abre modal pra decidir
    //     entre SOMAR à linha existente ou criar NOVA linha (com seq nova).
    //   Importações em lote (smart-importer, XLS, Magic Load) NÃO passam por aqui
    //     — sobrescrevem com a última quantidade encontrada no arquivo.
    // Checagem disparada em 3 pontos: nível 1 auto-save, Enter em embuch, e aqui.
    if (checkDuplicateAndMaybeAbort(form)) return;

    doSaveItem(form);
  }

  function handleSumDuplicate() {
    if (!dupDialog) return;
    const { item, newQuant } = dupDialog;
    if (!(newQuant > 0)) { toast.error('Informe uma quantidade maior que zero.'); return; }
    const totalQuant = item.ite_quant + newQuant;
    const calc = calculateItem(
      item.ite_puni, totalQuant,
      item.ite_des1, item.ite_des2, item.ite_des3,
      item.ite_des4, item.ite_des5, item.ite_des6,
      item.ite_des7, item.ite_des8, item.ite_des9, item.ite_des10,
      hasSuframa ? 0 : item.ite_ipi,
      hasSuframa ? 0 : item.ite_st, qtdDecimais,
    );
    setOrderItems(prev =>
      prev.map(it => it.tempId === item.tempId ? { ...it, ite_quant: totalQuant, ...calc } : it)
    );
    setDupDialog(null);
    setForm(emptyForm());
    setConversao('');
    setTimeout(() => codigoRef.current?.focus(), 30);
  }

  function handleEditItem(item: ItemRow) {
    const quantStr = usaDecimais
      ? item.ite_quant.toFixed(qtdDecimais).replace('.', ',')
      : String(Math.trunc(item.ite_quant));
    const catProd = priceTableItems.find(p => p.pro_codigo === item.ite_produto);
    setConversao(catProd?.pro_conversao || '');
    setForm({
      produto: item.ite_produto, embuch: item.ite_embuch,
      nomeprod: item.ite_nomeprod, grupo: item.ite_grupo,
      quant: quantStr,
      puni: item.ite_puni, puniliq: item.ite_puniliq,
      des1: item.ite_des1, des2: item.ite_des2, des3: item.ite_des3,
      des4: item.ite_des4, des5: item.ite_des5, des6: item.ite_des6,
      des7: item.ite_des7, des8: item.ite_des8, des9: item.ite_des9,
      des10: item.ite_des10,
      ipi: hasSuframa ? 0 : item.ite_ipi,
      st:  hasSuframa ? 0 : item.ite_st,
      totbruto: item.ite_totbruto, totliquido: item.ite_totliquido,
      valcomipi: item.ite_valcomipi, valcomst: item.ite_valcomst,
      discountSource: item.discountSource,
      editingTempId: item.tempId,
    });
    codigoRef.current?.focus();
  }

  function handleDeleteItem(tempId: string) {
    setOrderItems(prev => prev.filter(it => it.tempId !== tempId).map((it, i) => ({ ...it, ite_seq: i + 1 })));
    if (form.editingTempId === tempId) { setForm(emptyForm()); setConversao(''); }
  }

  // ── Catalog keyboard navigation ──────────────────────────────────────────────
  function handleCodigoKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCatIdx(i => Math.min(i + 1, filteredCatalog.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCatIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCatIdx >= 0 && filteredCatalog[selectedCatIdx]) {
        handleSelectProduct(filteredCatalog[selectedCatIdx]);
      } else if (filteredCatalog.length === 1) {
        handleSelectProduct(filteredCatalog[0]);
      }
    } else if (e.key === 'Escape') {
      setCatalogFilter('');
      setSelectedCatIdx(-1);
    }
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totalBruto   = orderItems.reduce((s, it) => s + (it.ite_totbruto   || 0), 0);
  const totalLiquido = orderItems.reduce((s, it) => s + (it.ite_totliquido || 0), 0);
  const totalComImp  = orderItems.reduce((s, it) => s + (it.ite_valcomst   || 0), 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: G.card, borderRadius: 14,
    border: `1px solid ${G.border}`,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };

  const cardHeader = (title: string, badge?: React.ReactNode): React.ReactNode => (
    <div style={{
      padding: '10px 16px', borderBottom: `1px solid ${G.border}`,
      display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: G.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </span>
      {badge}
    </div>
  );

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: G.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 3,
  };

  const roStyle: React.CSSProperties = {
    ...einp, background: G.cardHi, color: G.textSec, fontFamily: 'monospace', textAlign: 'right',
  };

  // ─── Entry form ──────────────────────────────────────────────────────────────
  const renderEntryForm = () => {
    const currentQuant = parseFloat((form.quant || '0').replace(',', '.')) || 0;
    const calcDisplay  = calculateItem(
      form.puni, currentQuant,
      form.des1, form.des2, form.des3, form.des4, form.des5,
      form.des6, form.des7, form.des8, form.des9, form.des10,
      form.ipi, form.st, qtdDecimais,
    );

    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Row 1a: Seq | Código | Complemento */}
        <div style={{ display: 'grid', gridTemplateColumns: '44px 130px 1fr', gap: 8 }}>
          <div>
            <span style={labelStyle}>Seq.</span>
            <input style={{ ...einp, background: G.cardHi, color: G.textMuted, fontFamily: 'monospace', textAlign: 'center' }}
              value={form.editingTempId
                ? String(orderItems.findIndex(i => i.tempId === form.editingTempId) + 1).padStart(3, '0')
                : String(orderItems.length + 1).padStart(3, '0')}
              readOnly
            />
          </div>
          <div>
            <span style={labelStyle}>Código</span>
            <input
              ref={codigoRef}
              type="text"
              value={form.produto}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setFormField('produto', v);
                setCatalogFilter(v);
                setSelectedCatIdx(-1);
              }}
              onKeyDown={handleCodigoKeyDown}
              disabled={isView}
              style={{ ...einp, fontFamily: 'monospace', fontWeight: 900, textTransform: 'uppercase' }}
              placeholder="Código..."
              autoComplete="off"
            />
          </div>
          <div>
            <span style={labelStyle}>Complemento</span>
            <input
              ref={embuchRef}
              type="text"
              value={form.embuch}
              onChange={e => setFormField('embuch', e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAfter('embuch'); } }}
              disabled={isView || qtdEnter < 2}
              style={{ ...einp, textTransform: 'uppercase' }}
            />
          </div>
        </div>

        {/* Row 1b: Descrição (linha própria) */}
        <div>
          <span style={labelStyle}>Descrição do produto</span>
          <input style={{ ...einp, background: G.cardHi, color: G.text }} value={form.nomeprod} readOnly />
        </div>

        {/* Conversão (badge visível quando o produto tem valor) */}
        {conversao && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={labelStyle}>Conversão</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: G.text,
              background: G.cardHi, border: `1px solid ${G.border}`,
              borderRadius: 6, padding: '2px 8px', letterSpacing: 0.3,
            }}>
              {conversao}
            </span>
          </div>
        )}

        {/* Row 2: Descontos D1-D9 (visible if qtdEnter >= 3) */}
        {qtdEnter >= 3 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={labelStyle}>Descontos sequenciais</span>
              <DiscountBadge source={form.discountSource} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 4 }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <div key={n}>
                  <span style={{ ...labelStyle, textAlign: 'center', display: 'block' }}>{n}º</span>
                  <PercentInput
                    value={(form as any)[`des${n}`]}
                    onChange={v => setFormField(`des${n}`, v)}
                    tabIndex={isView ? -1 : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: %Add | Quantidade | Preço Bruto (preço bruto only if qtdEnter >= 4) */}
        <div style={{ display: 'grid', gridTemplateColumns: qtdEnter >= 4 ? '80px 1fr 1fr' : '80px 1fr', gap: 8 }}>
          <div>
            <span style={labelStyle}>% Add</span>
            <PercentInput value={form.des10} onChange={v => setFormField('des10', v)} />
          </div>
          <div>
            <span style={labelStyle}>Quantidade</span>
            <input
              ref={quantRef}
              type="text"
              inputMode="decimal"
              value={form.quant}
              onChange={e => setFormField('quant', e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); focusAfter('quant'); }
              }}
              disabled={isView}
              style={{ ...einp, textAlign: 'right', fontFamily: 'monospace' }}
            />
          </div>
          {qtdEnter >= 4 && (
            <div>
              <span style={labelStyle}>Preço Bruto</span>
              <input
                ref={puniRef}
                type="number"
                step="0.0001"
                value={form.puni || ''}
                onChange={e => setFormField('puni', parseFloat(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAfter('puni'); } }}
                disabled={isView}
                style={{ ...einp, textAlign: 'right', fontFamily: 'monospace' }}
              />
            </div>
          )}
        </div>

        {/* Row 4: Calculated readonly fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'Liq. Unit.', value: fmtBRL(calcDisplay.puniliq) },
            { label: 'Bruto',      value: fmtBRL(calcDisplay.totbruto) },
            { label: 'Líquido',    value: fmtBRL(calcDisplay.totliquido) },
            { label: 'c/ Imp.',    value: fmtBRL(calcDisplay.valcomst) },
          ].map(f => (
            <div key={f.label}>
              <span style={labelStyle}>{f.label}</span>
              <input style={roStyle} value={f.value} readOnly />
            </div>
          ))}
        </div>

        {/* Actions */}
        {!isView && (
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              onClick={handleSaveItem}
              style={{
                flex: 2, padding: '7px 0', borderRadius: 8, border: 'none',
                background: form.editingTempId ? '#2563EB' : G.textSec,
                color: '#fff', fontSize: 13, fontWeight: 900,
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              {form.editingTempId ? '✎ Atualizar' : '✓ Salvar (Enter)'}
            </button>
            <button
              onClick={onFinalizar}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                background: G.mustard, color: G.text,
                fontSize: 13, fontWeight: 900, cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              Finalizar
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Items grid (left bottom) ─────────────────────────────────────────────────
  const renderItemsGrid = () => (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {orderItems.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: G.textMuted, fontSize: 12, fontStyle: 'italic' }}>
          Nenhum item digitado.
        </div>
      ) : (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {ITEM_COLS.map(c => <col key={c.key} style={{ width: itemWidths[c.key] ? `${itemWidths[c.key]}px` : undefined }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: G.cardHi }}>
              {ITEM_COLS.map(c => {
                const canSort = c.sortable !== false && !!c.label;
                return (
                  <th key={c.key}
                    onClick={canSort ? () => itemCycle(c.key) : undefined}
                    style={{ padding: '6px 8px', textAlign: c.align, fontSize: 9, fontWeight: 900, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${G.border}`, position: 'relative', cursor: canSort ? 'pointer' : 'default', userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {c.label}{canSort && <span style={{ opacity: itemSort?.key === c.key ? 0.9 : 0.3 }}>{sortArrow(itemSort, c.key)}</span>}
                    {!c.noResize && (
                      <span onMouseDown={(e) => itemResize(c.key, e)} title="Arraste para ajustar a largura"
                        style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 7, cursor: 'col-resize', zIndex: 2 }} />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, i) => {
              const isEditing = form.editingTempId === item.tempId;
              return (
                <motion.tr
                  key={item.tempId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.01 }}
                  onClick={() => !isView && handleEditItem(item)}
                  style={{
                    cursor: isView ? 'default' : 'pointer',
                    background: isEditing ? `${G.mustard}18` : i % 2 === 0 ? G.card : G.cardHi,
                  }}
                >
                  <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: G.textMuted }}>{String(i + 1).padStart(3, '0')}</td>
                  <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 900, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.ite_produto}
                    {item.ite_embuch && <span style={{ color: G.textMuted, fontWeight: 400 }}> /{item.ite_embuch}</span>}
                  </td>
                  <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{fmtQuant(item.ite_quant)}</td>
                  <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: G.success, fontWeight: 700, textAlign: 'right' }}>{fmtBRL(item.ite_puniliq)}</td>
                  <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: G.text, fontWeight: 900, textAlign: 'right' }}>{fmtBRL(item.ite_totliquido)}</td>
                  <td style={{ padding: '5px 4px' }}>
                    {!isView && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteItem(item.tempId); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.danger, padding: 2 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  // ─── Catalog (right panel) ────────────────────────────────────────────────────
  const renderCatalog = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Filter input */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
          <input
            type="text"
            placeholder="Filtrar catálogo..."
            value={catalogFilter}
            onChange={e => { setCatalogFilter(e.target.value); setSelectedCatIdx(-1); }}
            style={{ ...einp, paddingLeft: 28, fontSize: 12 }}
          />
        </div>
      </div>

      {/* Table header */}
      <div style={{ flexShrink: 0, background: G.cardHi, borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 80px 1fr 70px 70px 44px', padding: '5px 10px', gap: 6 }}>
          {['Código', 'Conversão', 'Descrição', 'Bruto', 'Promo', 'Mult.'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 900, color: G.textSec, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
          ))}
        </div>
      </div>

      {/* Catalog rows */}
      <div ref={catalogRef} style={{ flex: 1, overflowY: 'auto' }}>
        {filteredCatalog.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: G.textMuted, fontSize: 12, fontStyle: 'italic' }}>
            {priceTableItems.length === 0 ? 'Selecione uma tabela de preço na aba Principal.' : 'Nenhum produto encontrado.'}
          </div>
        ) : (
          filteredCatalog.map((p, i) => {
            const isSelected = i === selectedCatIdx;
            return (
              <div
                key={p.pro_id}
                onClick={() => !isView && handleSelectProduct(p)}
                style={{
                  display: 'grid', gridTemplateColumns: '90px 80px 1fr 70px 70px 44px',
                  padding: '5px 10px', gap: 6,
                  cursor: isView ? 'default' : 'pointer',
                  background: isSelected ? `${G.mustard}22` : i % 2 === 0 ? G.card : G.cardHi,
                  borderLeft: isSelected ? `3px solid ${G.mustard}` : '3px solid transparent',
                  borderBottom: `1px solid ${G.border}40`,
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.pro_codigo}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.pro_conversao || '—'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.pro_nome}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: G.textSec, textAlign: 'right' }}>
                  {fmtBRL(p.preco_bruto)}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: p.preco_promo > 0 ? G.success : G.textSec, textAlign: 'right', fontWeight: p.preco_promo > 0 ? 900 : 400 }}>
                  {p.preco_promo > 0 ? fmtBRL(p.preco_promo) : '—'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: G.textSec, textAlign: 'right' }}>
                  {p.pro_embalagem > 0 ? p.pro_embalagem : '—'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ─── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 16, padding: '16px 20px' }}>

      {/* ── Left panel ── */}
      <div style={{ width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

        {/* Entry card */}
        <div style={{ ...cardStyle, flexShrink: 0 }}>
          {cardHeader(
            form.editingTempId ? 'Editando Item' : 'Entrada de Item',
            <>
              {hasSuframa && (
                <span style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                  padding: '2px 7px', borderRadius: 4,
                  background: '#065F4618', border: '1px solid #059669',
                  color: '#059669',
                }}>
                  SUFRAMA — IPI/ST isentos
                </span>
              )}
              {form.discountSource && <DiscountBadge source={form.discountSource} />}
            </>,
          )}
          {renderEntryForm()}
        </div>

        {/* Items digitalized card */}
        <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
          {cardHeader(
            'Itens Digitalizados',
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {!isView && orderItems.length > 0 && (
                <button
                  onClick={handleReaplicarPolitica}
                  title="Reaplicar política de descontos do cliente em todos os itens"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999, border: 'none',
                    background: '#2563EB18', color: '#2563EB',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={10} />
                  Reaplicar Política
                </button>
              )}
              <span style={{
                fontSize: 10, fontWeight: 900, padding: '2px 8px', borderRadius: 999,
                background: `${G.textSec}18`, color: G.textSec,
              }}>{orderItems.length}</span>
            </div>,
          )}
          {renderItemsGrid()}

          {/* Footer totals */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${G.border}`, flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Tot. Bruto', value: fmtBRL(totalBruto) },
                { label: 'Tot. Líq.',  value: fmtBRL(totalLiquido) },
                { label: 'c/ Imp.',    value: fmtBRL(totalComImp) },
              ].map(f => (
                <div key={f.label} style={{ textAlign: 'center' }}>
                  <span style={{ ...labelStyle, display: 'block' }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: G.text }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, overflow: 'hidden' }}>

        {/* Catalog card */}
        <div style={{ ...cardStyle, flex: 1, minHeight: 0 }}>
          {cardHeader(
            'Catálogo da Indústria',
            <span style={{
              fontSize: 10, fontWeight: 700, color: G.textMuted,
            }}>
              {filteredCatalog.length}/{priceTableItems.length} produtos
            </span>,
          )}
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: G.textMuted, fontSize: 12 }}>Carregando...</div>
          ) : (
            renderCatalog()
          )}
        </div>

        {/* History card */}
        <div style={{ ...cardStyle, height: 220, flexShrink: 0 }}>
          {/* Amber header */}
          <div style={{
            padding: '8px 14px', background: '#F59E0B',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
              ★ Histórico de Compras do Cliente
            </span>
            {form.produto && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#FEF3C7', fontStyle: 'italic' }}>
                {form.nomeprod || form.produto}
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#FFFBEB' }}>
            {loadingHistory ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6, color: '#F59E0B' }}>
                <RotateCcw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>Buscando histórico...</span>
              </div>
            ) : productHistory.length > 0 ? (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#FEF3C7', zIndex: 1 }}>
                  <tr>
                    {['Data', 'Pedido', 'Unit. Líq.', 'Quantidade'].map(h => (
                      <th key={h} style={{
                        padding: '5px 10px', textAlign: h === 'Unit. Líq.' || h === 'Quantidade' ? 'right' : 'left',
                        fontSize: 9, fontWeight: 900, color: '#92400E',
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: '1px solid #FCD34D',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productHistory.map((h: any, i: number) => {
                    const dateStr = h.ped_data
                      ? (() => { const m = String(h.ped_data).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : h.ped_data; })()
                      : '—';
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#FEF9EE', borderBottom: '1px solid #FDE68A40' }}>
                        <td style={{ padding: '5px 10px', fontWeight: 700, color: '#78350F' }}>{dateStr}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 900, color: '#B45309' }}>{h.ped_pedido}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 900, color: '#065F46', textAlign: 'right' }}>
                          {fmtBRL(parseFloat(h.ite_puniliq) || 0)}
                        </td>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 900, color: G.text, textAlign: 'right' }}>
                          {fmtQuant(parseFloat(h.ite_quant) || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6, color: '#D1D5DB' }}>
                <AlertTriangle size={28} style={{ opacity: 0.25 }} />
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {form.produto ? 'Nenhum histórico encontrado' : 'Selecione um produto'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Duplicate dialog ── */}
      {dupDialog && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => {
            // Cancelar via overlay — reseta form pra liberar EnterAsTab
            setDupDialog(null);
            setForm(emptyForm());
            setConversao('');
            setTimeout(() => codigoRef.current?.focus(), 30);
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            style={{ background: G.card, borderRadius: 16, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: `1px solid ${G.border}` }}
          >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <AlertTriangle size={20} style={{ color: G.mustard }} />
                <span style={{ fontWeight: 900, fontSize: 15, color: G.text }}>Produto já lançado</span>
              </div>
              <p style={{ fontSize: 13, color: G.textSec, marginBottom: 8 }}>
                O produto <strong>{dupDialog.item.ite_produto}</strong> já está na lista com quantidade <strong>{fmtQuant(dupDialog.item.ite_quant)}</strong>.
              </p>
              <div style={{ marginBottom: 14 }}>
                <span style={labelStyle}>Aumentar em quanto?</span>
                <input
                  type="text"
                  autoFocus
                  value={usaDecimais
                    ? dupDialog.newQuant.toFixed(qtdDecimais).replace('.', ',')
                    : String(Math.trunc(dupDialog.newQuant))}
                  onChange={e => {
                    const v = parseFloat(e.target.value.replace(',', '.')) || 0;
                    setDupDialog(prev => prev ? { ...prev, newQuant: v } : prev);
                  }}
                  onFocus={e => e.currentTarget.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSumDuplicate(); }
                    else if (e.key === 'Escape') {
                      e.preventDefault();
                      setDupDialog(null);
                      setForm(emptyForm());
                      setConversao('');
                      setTimeout(() => codigoRef.current?.focus(), 30);
                    }
                  }}
                  style={{ ...einp, textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, fontSize: 15 }}
                />
              </div>
              <p style={{ fontSize: 13, color: G.textSec, marginBottom: 20 }}>
                Total ficará <strong>{fmtQuant(dupDialog.item.ite_quant + (dupDialog.newQuant || 0))}</strong>.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  // Cancelar — reseta form pra liberar EnterAsTab
                  setDupDialog(null);
                  setForm(emptyForm());
                  setConversao('');
                  setTimeout(() => codigoRef.current?.focus(), 30);
                }}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, color: G.textMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                {itemDuplicado && (
                  <button onClick={() => { doSaveItem({ ...form }); setDupDialog(null); }}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: G.textSec, color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                    Novo Item
                  </button>
                )}
                <button onClick={handleSumDuplicate}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: G.mustard, color: G.text, fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                  Sim, aumentar
                </button>
              </div>
            </motion.div>
          </motion.div>
      )}

      {/* ── Multiple warning dialog ── */}
      {multWarn && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMultWarn(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            style={{ background: G.card, borderRadius: 16, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: `1px solid ${G.border}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} style={{ color: '#D97600' }} />
              <span style={{ fontWeight: 900, fontSize: 15, color: G.text }}>Múltiplo de Embalagem</span>
            </div>
            <p style={{ fontSize: 13, color: G.textSec, marginBottom: 20 }}>{multWarn}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMultWarn(null)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${G.border}`, background: G.cardHi, color: G.textMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Corrigir
              </button>
              <button onClick={() => { setMultWarn(null); doSaveItem(form); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#D97600', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                Forçar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
