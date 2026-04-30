import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Printer } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface Transportadora {
  tra_codigo: number;
  tra_nome: string;
  tra_endereco: string;
  tra_bairro: string;
  tra_cidade: string;
  tra_uf: string;
  tra_cep: string;
  tra_fone: string;
  tra_contato: string;
  tra_cgc: string;
  tra_inscricao: string;
  tra_email: string;
}

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

function FichaTransportadora({ tra }: { tra: Transportadora }) {
  return (
    <div style={{
      borderBottom: `2px solid ${G.border}`,
      padding: '14px 20px',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0' }}>
        <Campo label="Código"   value={String(tra.tra_codigo)} />
        <Campo label="Nome"     value={tra.tra_nome} />
        <Campo label="Endereço" value={tra.tra_endereco} />
        <Campo label="Bairro"   value={tra.tra_bairro} />

        <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
          <Campo label="Cidade" value={tra.tra_cidade} half />
          <Campo label="Cep"    value={tra.tra_cep}    half />
          <Campo label="UF"     value={tra.tra_uf}     half />
        </div>

        <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
          <Campo label="Telefone" value={tra.tra_fone}    half />
          <Campo label="Contato"  value={tra.tra_contato} half />
        </div>

        <Campo label="Email" value={tra.tra_email} />

        <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
          <Campo label="CNPJ"           value={tra.tra_cgc}       half />
          <Campo label="Inscrição est." value={tra.tra_inscricao}  half />
        </div>
      </div>
    </div>
  );
}

export default function TransportadorasReport() {
  const [data, setData]       = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.get('/reports/transportadoras')
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
      <span style={{ fontSize: 13, color: G.textMuted, fontWeight: 600 }}>Carregando transportadoras...</span>
    </div>
  );

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <AlertCircle size={20} style={{ color: '#EF4444' }} />
      <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{error}</span>
    </div>
  );

  const filtered = data.filter(t =>
    !search
    || t.tra_nome?.toLowerCase().includes(search.toLowerCase())
    || String(t.tra_codigo).includes(search)
    || t.tra_cidade?.toLowerCase().includes(search.toLowerCase())
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
          placeholder="Pesquisar transportadora..."
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
          {filtered.length} transportadoras
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

      {/* Cabeçalho */}
      <div style={{
        padding: '12px 20px', textAlign: 'center',
        borderBottom: `2px solid ${G.border}`,
        background: G.card, flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: G.text, letterSpacing: 0.2 }}>
          Relação de transportadoras
        </div>
      </div>

      {/* Fichas */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(tra => (
          <FichaTransportadora key={tra.tra_codigo} tra={tra} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: G.textMuted, fontSize: 13 }}>
            Nenhuma transportadora encontrada
          </div>
        )}
      </div>
    </div>
  );
}
