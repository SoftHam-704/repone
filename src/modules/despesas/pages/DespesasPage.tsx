// src/modules/despesas/pages/DespesasPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Download } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { DESPESA_CATEGORIAS } from '@/shared/lib/despesasCategorias';
import { CadastroShell, G } from '@/shared/components/layout/CadastroShell';

interface Despesa {
  desp_id: number;
  desp_vendedor: number;
  vendedor_nome?: string;
  desp_data: string;
  desp_categoria: string;
  desp_valor: number | string;
  desp_descricao?: string;
  desp_comprovante?: string | null;
}

const fmtBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DespesasPage() {
  const [rows, setRows] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params: any = {};
        if (categoria) params.categoria = categoria;
        if (de) params.de = de;
        if (ate) params.ate = ate;
        const r = await api.get('/despesas', { params });
        if (alive) setRows(r.data?.data || []);
      } catch { /* */ } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [categoria, de, ate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(d =>
      String(d.vendedor_nome || d.desp_vendedor).toLowerCase().includes(q) ||
      (d.desp_descricao || '').toLowerCase().includes(q));
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((s, d) => s + Number(d.desp_valor), 0), [filtered]);
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(d => m.set(d.desp_categoria, (m.get(d.desp_categoria) || 0) + Number(d.desp_valor)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function exportCSV() {
    // Sanitiza contra CSV-injection no Excel (descrição/vendedor vêm de input do REP).
    const safe = (v: any) => {
      const s = String(v ?? '').replace(/;/g, ',');
      return /^[=+\-@]/.test(s) ? `'${s}` : s;
    };
    const head = ['Data', 'Vendedor', 'Categoria', 'Valor', 'Descrição'];
    const lines = filtered.map(d => [
      new Date(d.desp_data + 'T00:00:00').toLocaleDateString('pt-BR'),
      safe(d.vendedor_nome || d.desp_vendedor),
      d.desp_categoria,
      String(Number(d.desp_valor).toFixed(2)).replace('.', ','),
      safe(d.desp_descricao || ''),
    ].join(';'));
    const csv = [head.join(';'), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'despesas.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 100);
  }

  function abrirComprovante(arq: string) {
    fetch(`/api/despesas/comprovante/${arq}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
    })
      .then(r => r.blob())
      .then(b => {
        const url = URL.createObjectURL(b);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      });
  }

  const selSt: React.CSSProperties = {
    border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 13, color: G.text, background: '#fff', outline: 'none',
  };

  const toolbar = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={categoria} onChange={e => setCategoria(e.target.value)} style={selSt}>
        <option value="">Todas as categorias</option>
        {DESPESA_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input type="date" value={de} onChange={e => setDe(e.target.value)} style={selSt} />
      <span style={{ color: G.textMuted, fontSize: 13 }}>até</span>
      <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={selSt} />
      <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, background: G.text, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
        <Download size={15} /> Exportar CSV
      </button>
    </div>
  );

  return (
    <CadastroShell
      title="Despesas de Viagem"
      total={filtered.length}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Buscar por vendedor ou descrição..."
      loading={loading}
      toolbar={toolbar}
    >
      {/* Totais */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ background: G.text, color: '#fff', borderRadius: 12, padding: '12px 18px' }}>
          <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase' }}>Total no período</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{fmtBRL(total)}</div>
        </div>
        {porCategoria.map(([cat, val]) => (
          <div key={cat} style={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: G.textMuted, textTransform: 'uppercase' }}>{cat}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: G.text }}>{fmtBRL(val)}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: G.bg, color: G.textSec, textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>Data</th>
              <th style={{ padding: '10px 12px' }}>Vendedor</th>
              <th style={{ padding: '10px 12px' }}>Categoria</th>
              <th style={{ padding: '10px 12px' }}>Descrição</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Comprov.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: G.textMuted }}>Nenhuma despesa no período.</td></tr>
            ) : filtered.map(d => (
              <tr key={d.desp_id} style={{ borderTop: `1px solid ${G.border}` }}>
                <td style={{ padding: '10px 12px' }}>{new Date(d.desp_data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '10px 12px' }}>{d.vendedor_nome || d.desp_vendedor}</td>
                <td style={{ padding: '10px 12px' }}>{d.desp_categoria}</td>
                <td style={{ padding: '10px 12px', color: G.textSec }}>{d.desp_descricao || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: G.text }}>{fmtBRL(d.desp_valor)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {d.desp_comprovante
                    ? <button onClick={() => abrirComprovante(d.desp_comprovante!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mustard }}><ImageIcon size={17} /></button>
                    : <span style={{ color: G.textMuted }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CadastroShell>
  );
}
