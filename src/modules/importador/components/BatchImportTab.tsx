import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, XCircle,
  AlertCircle, ChevronDown, ChevronRight, Loader2,
  Download, ArrowRight, PackageSearch,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';
import { usePedidoActions } from '@/shared/stores/usePedidoActions';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Industry {
  for_codigo: number;
  for_nomered: string;
}

interface ParsedGroup {
  cnpj: string;
  pedido_ind: string;
  data_excel: number;
  status: 'found' | 'not_found';
  cli_codigo: number | null;
  cli_nome: string | null;
  cli_nomred: string | null;
  itens: any[];
  nao_encontrados: { codigo: string; qtd: number }[];
  total_itens: number;
  itens_encontrados: number;
  itens_nao_encontrados: number;
  total_valor: number;
  selected?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Mapa de aliases por campo semântico — suporta variações de nomenclatura das indústrias
const COL_ALIASES: Record<string, string> = {
  // CNPJ
  'cnpj': 'cnpj', 'cpf': 'cnpj', 'cpfcnpj': 'cnpj', 'cnpjcpf': 'cnpj',
  'documento': 'cnpj', 'doc': 'cnpj',
  // Pedido / OC
  'pedido': 'pedido', 'nopedido': 'pedido', 'nrpedido': 'pedido', 'numpedido': 'pedido',
  'numeropedido': 'pedido', 'numero': 'pedido', 'oc': 'pedido', 'ordem': 'pedido',
  'ordendecompra': 'pedido', 'nf': 'pedido', 'nota': 'pedido', 'notafiscal': 'pedido',
  'pedidoind': 'pedido', 'pedidoindustria': 'pedido', 'ordemcompra': 'pedido',
  // Data
  'data': 'data', 'datapedido': 'data', 'dataemissao': 'data', 'dataoc': 'data',
  'datanf': 'data', 'dt': 'data', 'date': 'data',
  // Código do produto
  'codigo': 'item', 'cod': 'item', 'codprod': 'item', 'codproduto': 'item',
  'codigoproduto': 'item', 'codigoitem': 'item', 'coditem': 'item',
  'item': 'item', 'produto': 'item', 'ref': 'item', 'referencia': 'item',
  'sku': 'item', 'partnumber': 'item', 'pn': 'item', 'codoriginal': 'item',
  'codigooriginal': 'item',
  // Quantidade
  'quantidade': 'qtd', 'qtd': 'qtd', 'qtde': 'qtd', 'quant': 'qtd',
  'qty': 'qtd', 'qtdade': 'qtd', 'qde': 'qtd',
};

/** Remove acentos, espaços e caracteres especiais para comparação de headers */
function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-z0-9]/g, '');        // só letras e números
}

/** Detecta a linha de header e retorna mapa { campo → índice de coluna }.
 *  Varre as primeiras 6 linhas para achar a que contém cnpj + item. */
function detectColumns(raw: any[][]): {
  headerRowIdx: number;
  colMap: Partial<Record<'cnpj' | 'pedido' | 'data' | 'item' | 'qtd', number>>;
  error: string | null;
} {
  for (let ri = 0; ri < Math.min(6, raw.length); ri++) {
    const row = raw[ri] as any[];
    const found: Partial<Record<string, number>> = {};
    for (let ci = 0; ci < row.length; ci++) {
      const norm = normalizeHeader(row[ci]);
      const field = COL_ALIASES[norm];
      if (field && found[field] === undefined) found[field] = ci;
    }
    if (found['cnpj'] !== undefined && found['item'] !== undefined) {
      return { headerRowIdx: ri, colMap: found as any, error: null };
    }
  }
  return {
    headerRowIdx: 0,
    colMap: {},
    error: 'Colunas obrigatórias não encontradas (CNPJ e Código do produto). Verifique o arquivo.',
  };
}

const todayStr = new Date().toLocaleDateString('pt-BR');

// ─── Patral TXT Parser ────────────────────────────────────────────────────────

interface PatralRow { cnpj: string; pedido: string; data: number; item: string; qtd: number }

function parsePatralTxt(text: string): PatralRow[] | null {
  // CNPJ: "Cod.Cliente: 39699 (06329779000170)"
  const cnpjMatch = text.match(/\((\d{14})\)/);
  if (!cnpjMatch) return null;
  const cnpj = cnpjMatch[1];

  // Date reference for pedido label
  const dateMatch = text.match(/(\d{2}-\w{3}-\d{4})/);
  const pedido = dateMatch ? `PATRAL-${dateMatch[1]}` : 'PATRAL';

  // Parse code/qty blocks
  const rows: PatralRow[] = [];
  const lines = text.split('\n');
  let currentCode = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const codeMatch = trimmed.match(/^C[OÓ]DIGO:\s*(.+)/i);
    if (codeMatch) { currentCode = codeMatch[1].trim(); continue; }

    const qtdMatch = trimmed.match(/^QUANTIDADE:\s*(\d+)/i);
    if (qtdMatch && currentCode) {
      rows.push({ cnpj, pedido, data: 0, item: currentCode, qtd: parseInt(qtdMatch[1]) });
      currentCode = '';
    }
  }
  return rows.length > 0 ? rows : null;
}

// ─── GroupRow ─────────────────────────────────────────────────────────────────

function GroupRow({
  group, selected, onToggle,
}: { group: ParsedGroup; selected: boolean; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const found    = group.status === 'found';
  const hasUnmatched = group.itens_nao_encontrados > 0;

  return (
    <div style={{
      border: `1px solid ${found ? (hasUnmatched ? '#FEF3C7' : '#D1FAE5') : '#FEE2E2'}`,
      borderRadius: 10, overflow: 'hidden', marginBottom: 6,
    }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: found ? (hasUnmatched ? '#FFFBEB' : '#F0FDF4') : '#FFF5F5',
        cursor: 'pointer',
      }}
        onClick={() => found && onToggle()}
      >
        {/* Checkbox */}
        <div
          onClick={e => { e.stopPropagation(); found && onToggle(); }}
          style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${found ? '#10B981' : '#FCA5A5'}`,
            background: selected ? '#10B981' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: found ? 'pointer' : 'not-allowed', flexShrink: 0,
          }}
        >
          {selected && <CheckCircle2 size={12} color="#fff" />}
        </div>

        {/* Status icon */}
        {found
          ? <CheckCircle2 size={15} color={hasUnmatched ? '#D97706' : '#10B981'} style={{ flexShrink: 0 }} />
          : <XCircle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
        }

        {/* Client info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {found ? (group.cli_nomred || group.cli_nome) : group.cnpj}
          </div>
          <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>
            {group.cnpj} · OC {group.pedido_ind} · {todayStr}
          </div>
        </div>

        {/* Stats */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {found ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1E293B' }}>
                {group.itens_encontrados}/{group.total_itens} itens
              </div>
              <div style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>
                {fmt(group.total_valor)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>
              CNPJ não cadastrado
            </div>
          )}
        </div>

        {/* Expand */}
        {found && group.itens.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>

      {/* Expanded items */}
      {expanded && found && (
        <div style={{ padding: '8px 14px 10px', background: '#fff', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Itens encontrados ({group.itens.length})
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {group.itens.slice(0, 20).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 10, alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: 700, minWidth: 70 }}>{item.codigo}</span>
                <span style={{ flex: 1, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</span>
                <span style={{ color: '#64748B', minWidth: 28, textAlign: 'right' }}>×{item.quantidade}</span>
                <span style={{ color: '#10B981', fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{fmt(item.total)}</span>
              </div>
            ))}
            {group.itens.length > 20 && (
              <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>
                + {group.itens.length - 20} itens...
              </div>
            )}
          </div>
          {group.nao_encontrados.length > 0 && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#FFF5F5', borderRadius: 6, border: '1px solid #FEE2E2' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>
                Não encontrados ({group.nao_encontrados.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {group.nao_encontrados.slice(0, 10).map((nf, i) => (
                  <span key={i} style={{ fontFamily: 'monospace', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626' }}>
                    {nf.codigo}
                  </span>
                ))}
                {group.nao_encontrados.length > 10 && (
                  <span style={{ fontSize: 9, color: '#DC2626' }}>+{group.nao_encontrados.length - 10}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BatchImportTab() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState<'upload' | 'preview' | 'done'>('upload');
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [forCodigo, setForCodigo] = useState<number | null>(null);
  const [fileName, setFileName]   = useState('');
  const [groups, setGroups]       = useState<ParsedGroup[]>([]);
  const [loading, setLoading]     = useState(false);
  const [createdOrders, setCreatedOrders] = useState<string[]>([]);
  const [dragging, setDragging]   = useState(false);

  // Load industries on mount
  useEffect(() => {
    api.get('/suppliers?limit=200').then(r => {
      setIndustries(r.data.data || []);
    }).catch(() => {});
  }, []);

  // Parse file (Excel or Patral TXT)
  const parseFile = useCallback(async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    try {
      let rows: { cnpj: string; pedido: string; data: number; item: string; qtd: number }[] = [];

      if (file.name.toLowerCase().endsWith('.txt')) {
        // ── Patral TXT format ──────────────────────────────────────────────
        const text = await file.text();
        const patralRows = parsePatralTxt(text);
        if (!patralRows) {
          toast.error('Arquivo TXT não reconhecido como catálogo Patral. Verifique o formato.');
          setLoading(false);
          return;
        }
        rows = patralRows;
      } else {
        // ── Excel format ───────────────────────────────────────────────────
        const XLSX = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

        const { headerRowIdx, colMap, error: colError } = detectColumns(raw);
        if (colError) { toast.error(colError); setLoading(false); return; }
        if (colMap.pedido === undefined) {
          toast.error('Coluna de número do pedido não encontrada. Verifique o arquivo.');
          setLoading(false);
          return;
        }

        rows = raw.slice(headerRowIdx + 1)
          .filter((r: any[]) => r[colMap.cnpj!] && r[colMap.item!])
          .map((r: any[]) => ({
            cnpj:   String(r[colMap.cnpj!]).trim(),
            pedido: String(r[colMap.pedido!]).trim(),
            data:   colMap.data !== undefined ? (Number(r[colMap.data]) || 0) : 0,
            item:   String(r[colMap.item!]).trim(),
            qtd:    colMap.qtd !== undefined ? (Number(r[colMap.qtd]) || 1) : 1,
          }));

        if (rows.length === 0) {
          toast.error('Arquivo sem dados válidos. Verifique o formato.');
          setLoading(false);
          return;
        }
      }

      // Send to backend for matching
      const res = await api.post('/smart-importer/parse-batch', {
        for_codigo: forCodigo || null,
        rows,
      });

      if (res.data.success) {
        const parsed: ParsedGroup[] = res.data.groups.map((g: ParsedGroup) => ({
          ...g,
          selected: g.status === 'found' && g.itens_encontrados > 0,
        }));
        setGroups(parsed);
        setStep('preview');
      } else {
        toast.error(res.data.message || 'Erro ao processar arquivo.');
      }
    } catch (err: any) {
      toast.error('Erro ao ler o arquivo: ' + (err.message || 'formato inválido'));
    } finally {
      setLoading(false);
    }
  }, [forCodigo]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!forCodigo) {
      toast.error('Selecione uma indústria antes de enviar o arquivo.');
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const toggleGroup = (idx: number) => {
    setGroups(g => g.map((gr, i) => i === idx ? { ...gr, selected: !gr.selected } : gr));
  };

  const toggleAll = () => {
    const eligible = groups.filter(g => g.status === 'found' && g.itens_encontrados > 0);
    const allSelected = eligible.every(g => g.selected);
    setGroups(g => g.map(gr =>
      gr.status === 'found' && gr.itens_encontrados > 0 ? { ...gr, selected: !allSelected } : gr
    ));
  };

  const downloadNotFound = () => {
    const lines = ['CNPJ,Pedido,Codigo,Quantidade'];
    groups.forEach(g => {
      g.nao_encontrados?.forEach(nf => {
        lines.push(`${g.cnpj},${g.pedido_ind},${nf.codigo},${nf.qtd}`);
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'nao_encontrados.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    const selected = groups.filter(g => g.selected && g.status === 'found' && g.itens_encontrados > 0);
    if (selected.length === 0) { toast.error('Selecione ao menos um grupo para importar.'); return; }

    setLoading(true);
    try {
      const payload = selected.map(g => ({
        cli_codigo:   g.cli_codigo,
        pedido_ind:   g.pedido_ind,
        data_excel:   g.data_excel,
        industria_id: g.itens[0]?.industria_id || forCodigo,
        itens:        g.itens,
      }));

      const res = await api.post('/smart-importer/confirm-batch', {
        groups: payload,
        user_initials: user?.nome?.substring(0, 2).toUpperCase() || 'IMP',
      });

      if (res.data.success) {
        const orders: string[] = res.data.orders || [];
        setCreatedOrders(orders);
        setStep('done');
        toast.success(res.data.message);

        // Se criou apenas 1 pedido, abrir direto em edição
        if (orders.length === 1) {
          usePedidoActions.getState().setPendingOpen(orders[0]);
          setTimeout(() => navigate('/pedidos'), 1200);
        }
      } else {
        toast.error(res.data.message || 'Erro ao importar.');
      }
    } catch {
      toast.error('Erro de conexão ao confirmar importação.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setGroups([]);
    setFileName('');
    setCreatedOrders([]);
    setForCodigo(null);
  };

  const selectedCount  = groups.filter(g => g.selected).length;
  const totalNF        = groups.reduce((s, g) => s + (g.nao_encontrados?.length || 0), 0);
  const totalValor     = groups.filter(g => g.selected).reduce((s, g) => s + g.total_valor, 0);

  // ── STEP: UPLOAD ─────────────────────────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560, margin: '0 auto', paddingTop: 20 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', marginBottom: 4 }}>
          Importar por Arquivo da Indústria
        </div>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          Faça upload do Excel enviado pela indústria. O sistema identifica automaticamente cada filial e cria um pedido separado.
        </div>
      </div>

      {/* Industry select */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
          Indústria <span style={{ color: '#EF4444' }}>*</span>
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94A3B8', marginLeft: 6 }}>obrigatório para enviar o arquivo</span>
        </div>
        <select
          value={forCodigo || ''}
          onChange={e => setForCodigo(e.target.value ? Number(e.target.value) : null)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: `1px solid ${forCodigo ? '#10B981' : '#E2E8F0'}`, fontSize: 13, color: '#1E293B',
            background: '#F8FAFC', outline: 'none',
          }}
        >
          <option value="">— Selecione a indústria —</option>
          {industries.map(i => (
            <option key={i.for_codigo} value={i.for_codigo}>{i.for_nomered}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); if (forCodigo) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => forCodigo && fileRef.current?.click()}
        style={{
          border: `2px dashed ${!forCodigo ? '#E2E8F0' : dragging ? '#10B981' : '#CBD5E1'}`,
          borderRadius: 16, padding: '48px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          cursor: forCodigo ? 'pointer' : 'not-allowed',
          background: !forCodigo ? '#F1F5F9' : dragging ? '#F0FDF4' : '#F8FAFC',
          transition: 'all 0.2s',
          opacity: !forCodigo ? 0.6 : 1,
        }}
      >
        {loading ? (
          <Loader2 size={36} color="#10B981" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <UploadCloud size={36} color={!forCodigo ? '#CBD5E1' : dragging ? '#10B981' : '#94A3B8'} />
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: forCodigo ? '#1E293B' : '#94A3B8' }}>
            {loading ? 'Processando...' : !forCodigo ? 'Selecione uma indústria acima para continuar' : 'Arraste o arquivo aqui'}
          </div>
          {forCodigo && (
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              ou clique para selecionar · .xlsx / .xls / .txt (Patral)
            </div>
          )}
        </div>
        {forCodigo && (
          <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
            Formato esperado: CNPJ · Nº Pedido · Data · Código Item · Quantidade
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.txt" style={{ display: 'none' }} onChange={handleFileInput} />
    </div>
  );

  // ── STEP: PREVIEW ─────────────────────────────────────────────────────────────
  if (step === 'preview') return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0 14px',
        borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileSpreadsheet size={16} color="#2563EB" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{fileName}</span>
        </div>
        <div style={{ fontSize: 11, color: '#64748B' }}>
          {groups.length} grupos detectados
          · <span style={{ color: '#10B981', fontWeight: 700 }}>{groups.filter(g => g.status === 'found').length} encontrados</span>
          {groups.filter(g => g.status === 'not_found').length > 0 && (
            <> · <span style={{ color: '#EF4444', fontWeight: 700 }}>{groups.filter(g => g.status === 'not_found').length} não cadastrados</span></>
          )}
        </div>
        {totalNF > 0 && (
          <button onClick={downloadNotFound} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: '1px solid #FEE2E2', borderRadius: 6,
            padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#DC2626', cursor: 'pointer',
          }}>
            <Download size={11} /> {totalNF} não encontrados (.csv)
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{
            background: 'none', border: '1px solid #E2E8F0', borderRadius: 7,
            padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#64748B', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || selectedCount === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: selectedCount > 0 ? '#10B981' : '#E2E8F0',
              color: selectedCount > 0 ? '#fff' : '#94A3B8',
              border: 'none', borderRadius: 7, padding: '6px 16px',
              fontSize: 12, fontWeight: 800, cursor: selectedCount > 0 && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <ArrowRight size={13} />
            }
            Importar {selectedCount} {selectedCount === 1 ? 'pedido' : 'pedidos'} · {fmt(totalValor)}
          </button>
        </div>
      </div>

      {/* Select all */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 6px' }}>
        <button onClick={toggleAll} style={{
          background: 'none', border: 'none', fontSize: 11, fontWeight: 700,
          color: '#2563EB', cursor: 'pointer', padding: 0,
        }}>
          {groups.filter(g => g.status === 'found' && g.itens_encontrados > 0).every(g => g.selected)
            ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>
          ({groups.filter(g => g.status === 'found' && g.itens_encontrados > 0).length} elegíveis)
        </span>
      </div>

      {/* Groups list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {groups.map((g, i) => (
          <GroupRow
            key={`${g.cnpj}-${g.pedido_ind}`}
            group={g}
            selected={!!g.selected}
            onToggle={() => toggleGroup(i)}
          />
        ))}
      </div>
    </div>
  );

  // ── STEP: DONE ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 40 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 24, background: '#F0FDF4',
        border: '2px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckCircle2 size={36} color="#10B981" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#1E293B' }}>
          {createdOrders.length} {createdOrders.length === 1 ? 'pedido importado' : 'pedidos importados'}!
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
          Todos os pedidos foram criados com sucesso e estão disponíveis na fila.
        </div>
      </div>
      <div style={{
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 440, justifyContent: 'center',
      }}>
        {createdOrders.map(ord => (
          <span key={ord} style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 800,
            padding: '3px 8px', borderRadius: 5, background: '#fff',
            border: '1px solid #D1FAE5', color: '#065F46',
          }}>
            {ord}
          </span>
        ))}
      </div>
      <button onClick={reset} style={{
        background: '#10B981', color: '#fff', border: 'none',
        borderRadius: 8, padding: '9px 24px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
      }}>
        Importar outro arquivo
      </button>
    </div>
  );
}
