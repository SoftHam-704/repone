import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Cliente {
  cli_codigo: number;
  cli_nomred: string;
  cli_nome: string;
  cli_cidade: string;
  cli_uf: string;
  cli_fone1: string;
  cli_email: string;
}

const th: React.CSSProperties = {
  padding: '10px 14px', fontSize: 10, fontWeight: 800,
  color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  borderBottom: `1px solid ${G.border}`, textAlign: 'left',
  background: G.cardHi, whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '9px 14px', fontSize: 12, color: G.text,
  borderBottom: `1px solid ${G.border}`,
};

export default function ClientesSimplificadaReport() {
  const [data, setData]       = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    api.get('/reports/clientes/simplificada')
      .then(r => {
        if (r.data.success) setData(r.data.data);
        else setError(r.data.message || 'Erro ao carregar');
      })
      .catch(() => setError('Falha na comunicação com o servidor'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Loader2 size={22} style={{ color: G.mustard, animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13, color: G.textMuted, fontWeight: 600 }}>Carregando clientes...</span>
    </div>
  );

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <AlertCircle size={20} style={{ color: '#EF4444' }} />
      <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        padding: '10px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${G.border}`,
        background: G.cardHi, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 10px', borderRadius: 20,
            background: `${G.mustard}20`, border: `1px solid ${G.mustard}40`,
            fontSize: 11, fontWeight: 800, color: G.mustard,
          }}>
            {data.length} clientes ativos
          </span>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: `1px solid ${G.border}`, background: 'transparent',
            color: G.textSec, cursor: 'pointer',
          }}
        >
          <Printer size={13} />
          Imprimir
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Nome Fantasia</th>
              <th style={th}>Razão Social</th>
              <th style={th}>Cidade</th>
              <th style={th}>UF</th>
              <th style={th}>Telefone</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr key={c.cli_codigo} style={{ background: i % 2 === 0 ? 'transparent' : `${G.border}30` }}>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: G.mustard }}>
                  {c.cli_codigo}
                </td>
                <td style={{ ...td, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.cli_nomred || '—'}
                </td>
                <td style={{ ...td, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.cli_nome}
                </td>
                <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.cli_cidade || '—'}
                </td>
                <td style={{ ...td }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 4,
                    background: `${G.border}60`, fontSize: 10, fontWeight: 800,
                    color: G.textSec,
                  }}>
                    {c.cli_uf || '—'}
                  </span>
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: G.textSec }}>
                  {c.cli_fone1 || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Nenhum cliente ativo encontrado
          </div>
        )}
      </div>
    </div>
  );
}
