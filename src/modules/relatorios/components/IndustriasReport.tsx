import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Industria {
  for_codigo: number;
  for_nome: string;
  for_nomered: string;
  for_endereco: string;
  for_bairro: string;
  for_cidade: string;
  for_uf: string;
  for_cep: string;
  for_fone: string;
  for_fone2: string;
  for_cgc: string;
  for_inscricao: string;
  for_email: string;
  for_homepage: string;
}

// ─── Linha de campo ───────────────────────────────────────────────────────────
function Campo({ label, value, half }: { label: string; value?: string; half?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      flex: half ? '0 0 48%' : '1 1 100%',
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: G.text,
        whiteSpace: 'nowrap', flexShrink: 0,
        minWidth: 88,
      }}>
        {label}:
      </span>
      <span style={{
        fontSize: 11, color: G.textSec, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── Ficha de cada indústria ──────────────────────────────────────────────────
function FichaIndustria({ ind }: { ind: Industria }) {
  return (
    <div style={{
      borderBottom: `2px solid ${G.border}`,
      padding: '14px 20px',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0' }}>
        <Campo label="Código"  value={String(ind.for_codigo)} />
        <Campo label="Nome"    value={ind.for_nome} />
        {ind.for_nomered && ind.for_nomered !== ind.for_nome && (
          <Campo label="Fantasia" value={ind.for_nomered} />
        )}
        <Campo label="Endereço" value={ind.for_endereco} />
        <Campo label="Bairro"   value={ind.for_bairro} />

        {/* Cidade + CEP + UF na mesma linha */}
        <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
          <Campo label="Cidade" value={ind.for_cidade} half />
          <Campo label="Cep"    value={ind.for_cep}    half />
          <Campo label="UF"     value={ind.for_uf}     half />
        </div>

        {/* Telefone + Tel2 */}
        <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
          <Campo label="Telefone" value={ind.for_fone}  half />
          <Campo label="Celular"  value={ind.for_fone2} half />
        </div>

        {/* CNPJ + IE */}
        <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
          <Campo label="CNPJ"           value={ind.for_cgc}       half />
          <Campo label="Inscrição est." value={ind.for_inscricao}  half />
        </div>

        <Campo label="E-Mail"    value={ind.for_email} />
        <Campo label="Home page" value={ind.for_homepage} />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function IndustriasReport() {
  const [data, setData]       = useState<Industria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.get('/reports/industrias')
      .then(r => {
        if (r.data.success) setData(r.data.data);
        else setError(r.data.message);
      })
      .catch(() => setError('Falha na comunicação'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Loader2 size={22} style={{ color: G.mustard, animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 13, color: G.textMuted, fontWeight: 600 }}>Carregando indústrias...</span>
    </div>
  );

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <AlertCircle size={20} style={{ color: '#EF4444' }} />
      <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</span>
    </div>
  );

  const filtered = data.filter(i =>
    !search
    || i.for_nome?.toLowerCase().includes(search.toLowerCase())
    || i.for_nomered?.toLowerCase().includes(search.toLowerCase())
    || String(i.for_codigo).includes(search)
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        padding: '10px 20px', borderBottom: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        background: G.cardHi,
      }}>
        <input
          placeholder="Pesquisar indústria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, maxWidth: 260, padding: '6px 10px', borderRadius: 8, fontSize: 12,
            border: `1px solid ${G.border}`, background: G.bg, color: G.text, outline: 'none',
          }}
        />
        <span style={{
          padding: '2px 10px', borderRadius: 20,
          background: `${G.mustard}20`, border: `1px solid ${G.mustard}40`,
          fontSize: 11, fontWeight: 800, color: G.mustard,
        }}>
          {filtered.length} indústrias
        </span>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            border: `1px solid ${G.border}`, background: 'transparent',
            color: G.textSec, cursor: 'pointer', marginLeft: 'auto',
          }}
        >
          <Printer size={13} />
          Imprimir
        </button>
      </div>

      {/* Cabeçalho do relatório */}
      <div style={{
        padding: '12px 20px', textAlign: 'center',
        borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: G.text, letterSpacing: 0.2 }}>
          Relação de indústrias cadastradas
        </div>
      </div>

      {/* Fichas */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(ind => (
          <FichaIndustria key={ind.for_codigo} ind={ind} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Nenhuma indústria encontrada
          </div>
        )}
      </div>
    </div>
  );
}
