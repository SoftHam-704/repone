import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Package, Building2, User, RefreshCw, X,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Allocation {
  pedido: string; ped_numero: number; produto: string;
  xProd: string; qty_apply: number; valor_apply: number; vUnCom: number;
}
interface OrderPreview {
  pedido: string; ped_numero: number; ped_data: string;
  ped_totliq: number; total_faturado: number; valor_nf: number;
  will_complete: boolean; allocations: Allocation[];
}
interface ParseResult {
  nf: { nNF: string; serie: string; dhEmi: string; vNF: number; codPedidoInd: string };
  industry: { for_codigo: number; for_nome: string; for_cgc: string } | null;
  client:   { cli_codigo: number; cli_nome: string; cli_cnpj: string } | null;
  orders: OrderPreview[];
  unmatched_items: Array<{ cProd: string; xProd: string; qty_unmatched: number; reason: string }>;
  warnings: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const pct = (done: number, total: number) =>
  total > 0 ? Math.min(100, (done / total) * 100) : 0;

// ─── ProgressBar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
  </div>
);

// ─── OrderCard ────────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: OrderPreview }) {
  const [open, setOpen] = useState(false);
  const afterFat  = order.total_faturado + order.valor_nf;
  const pctBefore = pct(order.total_faturado, order.ped_totliq);
  const pctAfter  = pct(afterFat, order.ped_totliq);
  const color     = order.will_complete ? '#16a34a' : afterFat > 0 ? '#d97706' : '#6b7280';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer', background: '#f9fafb',
          borderLeft: `4px solid ${color}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {order.will_complete
            ? <CheckCircle2 size={18} color="#16a34a" />
            : <AlertTriangle size={18} color="#d97706" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
              Pedido #{order.ped_numero} — {order.pedido}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Emitido em {fmtDate(order.ped_data)} · Total {BRL(order.ped_totliq)}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color }}>+ {BRL(order.valor_nf)}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              {order.will_complete ? 'Faturamento completo' : `${pctAfter.toFixed(0)}% coberto`}
            </div>
          </div>
          {open ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{ padding: '6px 16px 0', background: '#f9fafb' }}>
        <div style={{ position: 'relative', height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', height: '100%', width: `${pctBefore}%`, background: '#9ca3af', borderRadius: 4 }} />
          <div style={{ position: 'absolute', left: `${pctBefore}%`, height: '100%', width: `${pctAfter - pctBefore}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', padding: '2px 0 8px' }}>
          <span>Já faturado: {BRL(order.total_faturado)}</span>
          <span>Saldo restante: {BRL(Math.max(0, order.ped_totliq - order.total_faturado - order.valor_nf))}</span>
        </div>
      </div>

      {/* Detalhe dos itens */}
      {open && (
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f3f4f6' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['Código', 'Produto', 'Qtd Baixada', 'Vl. Unit.', 'Vl. Total'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#374151', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.allocations.map((a, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f9fafb' }}>
                  <td style={{ padding: '6px 10px', color: '#6b7280', fontFamily: 'monospace' }}>{a.produto}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{a.xProd}</td>
                  <td style={{ padding: '6px 10px', color: '#111827', fontWeight: 600 }}>{a.qty_apply}</td>
                  <td style={{ padding: '6px 10px', color: '#6b7280' }}>{BRL(a.vUnCom)}</td>
                  <td style={{ padding: '6px 10px', color: '#16a34a', fontWeight: 700 }}>{BRL(a.valor_apply)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NfePage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragging, setDragging]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [applying, setApplying]   = useState(false);
  const [result, setResult]       = useState<ParseResult | null>(null);
  const [appliedMsg, setAppliedMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const processXml = useCallback(async (xml: string) => {
    setParsing(true);
    try {
      const res = await api.post('/nfe/parse', { xml });
      if (!res.data.success) { toast.error(res.data.message); return; }
      setResult(res.data.data);
      setStep('preview');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao processar XML.');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => processXml(e.target?.result as string);
    reader.readAsText(file, 'UTF-8');
  }, [processXml]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xml') || file.type === 'text/xml')) handleFile(file);
    else toast.error('Envie um arquivo .xml');
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  async function handleApply() {
    if (!result) return;
    setApplying(true);
    try {
      const res = await api.post('/nfe/apply', {
        nf:       result.nf,
        orders:   result.orders,
        industry: result.industry,
      });
      if (!res.data.success) { toast.error(res.data.message); return; }
      setAppliedMsg(res.data.message);
      setStep('done');
      toast.success(res.data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao aplicar baixa.');
    } finally {
      setApplying(false);
    }
  }

  function reset() { setStep('upload'); setResult(null); setAppliedMsg(''); }

  // ── Upload Step ─────────────────────────────────────────────────────────────
  if (step === 'upload') return (
    <div style={{ padding: 32, background: '#E8E1D4', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#28374A', margin: '0 0 6px' }}>Baixa de Pedidos via XML</h1>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 32 }}>
          Importe o XML da NF-e enviada pela indústria. O sistema identificará os pedidos e aplicará o faturamento automaticamente.
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#28374A' : '#c4b89a'}`,
            borderRadius: 16, padding: '60px 32px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(40,55,74,0.04)' : '#fff',
            transition: 'all .2s',
          }}
        >
          {parsing ? (
            <div style={{ color: '#28374A' }}>
              <RefreshCw size={36} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite', display: 'block' }} />
              <div style={{ fontWeight: 700 }}>Processando XML...</div>
            </div>
          ) : (
            <>
              <Upload size={40} style={{ color: '#c4b89a', margin: '0 auto 16px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#28374A', marginBottom: 6 }}>
                Arraste o XML aqui ou clique para selecionar
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>Arquivo .xml da NF-e (SEFAZ 4.0)</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xml,text/xml" onChange={onFileChange} style={{ display: 'none' }} />
      </div>
    </div>
  );

  // ── Done Step ───────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div style={{ padding: 32, background: '#E8E1D4', minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: '#fff', borderRadius: 16, padding: 48, boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 480 }}>
        <CheckCircle2 size={56} color="#16a34a" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Baixa aplicada com sucesso!</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>{appliedMsg}</p>
        <button onClick={reset} style={{
          background: '#28374A', color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>
          Processar outro XML
        </button>
      </div>
    </div>
  );

  // ── Preview Step ────────────────────────────────────────────────────────────
  if (!result) return null;
  const { nf, industry, client, orders, unmatched_items, warnings } = result;
  const totalAplicado = orders.reduce((s, o) => s + o.valor_nf, 0);
  const totalNF       = nf.vNF;
  const pctCoberto    = pct(totalAplicado, totalNF);

  return (
    <div style={{ padding: 24, background: '#E8E1D4', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#28374A', margin: 0 }}>
              Prévia da NF {nf.nNF} / Série {nf.serie}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
              Emissão: {fmtDate(nf.dhEmi)} · Total NF: {BRL(totalNF)}
            </p>
          </div>
          <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Info cards: indústria + cliente */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          {[
            { Icon: Building2, label: 'Indústria (emitente)', nome: industry?.for_nome, doc: industry?.for_cgc },
            { Icon: User,      label: 'Cliente (destinatário)', nome: client?.cli_nome, doc: client?.cli_cnpj },
          ].map(({ Icon, label, nome, doc }) => (
            <div key={label} style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color="#28374A" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{nome || '—'}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{doc}</div>
              </div>
            </div>
          ))}

          {/* Resumo cobertura */}
          <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Cobertura</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{BRL(totalAplicado)}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{pctCoberto.toFixed(0)}% da NF</span>
            </div>
            <ProgressBar value={pctCoberto} color={pctCoberto >= 99 ? '#16a34a' : '#d97706'} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{orders.length} pedido(s) afetado(s)</div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#92400e' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {w}
          </div>
        ))}

        {/* Pedidos */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            Pedidos a baixar ({orders.length})
          </div>
          {orders.map(o => <OrderCard key={o.pedido} order={o} />)}
        </div>

        {/* Itens não associados */}
        {unmatched_items.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <XCircle size={16} color="#dc2626" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                {unmatched_items.length} item(ns) não associado(s)
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Código', 'Produto', 'Qtd. não baixada', 'Motivo'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: '#991b1b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unmatched_items.map((u, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #fecaca' }}>
                    <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: '#111827' }}>{u.cProd}</td>
                    <td style={{ padding: '5px 8px', color: '#111827' }}>{u.xProd}</td>
                    <td style={{ padding: '5px 8px', color: '#dc2626', fontWeight: 700 }}>{u.qty_unmatched}</td>
                    <td style={{ padding: '5px 8px', color: '#6b7280' }}>{u.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={reset} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db',
            background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151',
          }}>
            Cancelar
          </button>
          {orders.length > 0 && (
            <button
              onClick={handleApply}
              disabled={applying}
              style={{
                padding: '10px 28px', borderRadius: 8, border: 'none',
                background: applying ? '#9ca3af' : '#28374A',
                color: '#fff', cursor: applying ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              {applying ? 'Aplicando...' : `Confirmar Baixa — ${orders.length} pedido(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
