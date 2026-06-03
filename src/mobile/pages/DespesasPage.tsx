// src/mobile/pages/DespesasPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Loader2, Camera, Trash2, Receipt } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { DESPESA_CATEGORIAS } from '@/shared/lib/despesasCategorias';
import { resizeImage } from '../lib/imagem';
import { MobileHeader } from '../components/MobileHeader';

interface Despesa {
  desp_id: number;
  desp_data: string;
  desp_categoria: string;
  desp_valor: number | string;
  desp_descricao?: string;
  desp_km?: number | null;
  desp_comprovante?: string | null;
}

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const inputSt: React.CSSProperties = {
  borderRadius: 10, fontSize: 14, border: '1px solid var(--border)',
  background: '#fff', color: 'var(--navy)', padding: '11px 12px',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const lblSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: 'var(--navy-muted)',
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, display: 'block',
};

export default function DespesasPage() {
  const [rows, setRows] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [data, setData] = useState(hoje());
  const [categoria, setCategoria] = useState<string>(DESPESA_CATEGORIAS[0]);
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [km, setKm] = useState('');
  const [foto, setFoto] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/despesas');
      setRows(r.data?.data || []);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalMes = rows
    .filter(d => String(d.desp_data).slice(0, 7) === hoje().slice(0, 7))
    .reduce((s, d) => s + Number(d.desp_valor), 0);

  function resetForm() {
    setData(hoje()); setCategoria(DESPESA_CATEGORIAS[0]); setValor('');
    setDescricao(''); setKm(''); setFoto(null); setErr('');
  }

  async function salvar() {
    setErr('');
    if (!valor.trim()) { setErr('Informe o valor.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('desp_data', data);
      fd.append('desp_categoria', categoria);
      fd.append('desp_valor', valor.trim());
      if (descricao.trim()) fd.append('desp_descricao', descricao.trim());
      if (km.trim()) fd.append('desp_km', km.trim());
      if (foto) {
        const blob = await resizeImage(foto);
        fd.append('comprovante', blob, 'comprovante.jpg');
      }
      const res = await fetch('/api/despesas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || `Erro ${res.status}`);
      }
      setModal(false); resetForm(); await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar.');
    } finally { setSaving(false); }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir esta despesa?')) return;
    try { await api.delete(`/despesas/${id}`); await load(); } catch { /* */ }
  }

  return (
    <>
      <MobileHeader
        title="Despesas"
        helpItems={[{ icon: '🧾', title: 'O que é', text: 'Lance aqui suas despesas de viagem (combustível, alimentação, manutenção…) com foto do comprovante. O gestor acompanha pelo sistema.' }]}
      />

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ background: 'var(--navy)', borderRadius: 14, padding: '14px 16px', color: '#fff' }}>
          <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total no mês</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{fmtBRL(totalMes)}</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Loader2 size={24} style={{ color: 'var(--navy)', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--navy-muted)' }}>
            <Receipt size={34} style={{ opacity: 0.4, marginBottom: 10 }} />
            <p style={{ fontWeight: 700, color: 'var(--navy)' }}>Nenhuma despesa lançada</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Toque em "+ Nova" para começar.</p>
          </div>
        ) : rows.map(d => (
          <div key={d.desp_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>{d.desp_categoria}</div>
              <div style={{ fontSize: 12, color: 'var(--navy-muted)', marginTop: 2 }}>
                {new Date(d.desp_data + 'T00:00:00').toLocaleDateString('pt-BR')}
                {d.desp_descricao ? ` · ${d.desp_descricao}` : ''}
              </div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--navy)' }}>{fmtBRL(d.desp_valor)}</div>
            <button onClick={() => excluir(d.desp_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, display: 'flex' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => { resetForm(); setModal(true); }}
        style={{ position: 'fixed', right: 18, bottom: 80, width: 54, height: 54, borderRadius: '50%', background: 'var(--mustard)', border: 'none', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', cursor: 'pointer', zIndex: 90 }}
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--sand-bg)', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>Nova despesa</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-muted)', display: 'flex' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lblSt}>Categoria</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputSt}>
                  {DESPESA_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={lblSt}>Valor (R$)</label>
                  <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" style={inputSt} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lblSt}>Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputSt} />
                </div>
              </div>
              {categoria === 'Combustível' && (
                <div>
                  <label style={lblSt}>KM / Odômetro (opcional)</label>
                  <input value={km} onChange={e => setKm(e.target.value)} inputMode="numeric" placeholder="ex.: 84520" style={inputSt} />
                </div>
              )}
              <div>
                <label style={lblSt}>Descrição (opcional)</label>
                <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="ex.: posto BR rodovia" style={inputSt} />
              </div>
              <div>
                <label style={lblSt}>Comprovante</label>
                <label style={{ ...inputSt, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: foto ? 'var(--navy)' : 'var(--navy-muted)' }}>
                  <Camera size={18} />
                  {foto ? foto.name : 'Tirar foto / escolher imagem'}
                  <input type="file" accept="image/*" capture="environment" onChange={e => setFoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                </label>
              </div>

              {err && <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>{err}</div>}

              <button onClick={salvar} disabled={saving} style={{ width: '100%', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Salvar despesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
