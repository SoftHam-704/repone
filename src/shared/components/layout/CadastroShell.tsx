import { Search, Plus, Save, Loader2, ArrowLeft } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { TabsBar } from './TabsBar';

// ─── Design tokens (Areia + Navy) ────────────────────────────────────────────
export const G = {
  bg:        '#E8E1D4',
  card:      '#F2ECE2',
  cardHi:    '#F8F4EE',
  border:    '#D3C7AD',
  text:      '#28374A',
  textSec:   '#3D5265',
  textMuted: '#5E7282',
  mustard:   '#FFD200',
  success:   '#16A34A',
  danger:    '#C0392B',
} as const;

export const inp = {
  background: G.card,
  border: `1px solid ${G.border}`,
  color: G.text,
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  outline: 'none',
  width: '100%',
} as const;

export const label = {
  fontSize: 11,
  fontWeight: 700,
  color: G.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 4,
  display: 'block',
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      background: active ? '#16A34A18' : '#C0392B18',
      color: active ? G.success : G.danger,
      border: `1px solid ${active ? '#16A34A33' : '#C0392B33'}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? G.success : G.danger }} />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

// ─── Shell Props ──────────────────────────────────────────────────────────────
interface CadastroShellProps {
  title: string;
  total?: number;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  onNew: () => void;
  newLabel?: string;
  loading?: boolean;
  toolbar?: React.ReactNode;

  // PageControl — quando fornecido, ativa o modo abas Lista / Cadastro
  activeTab?: 'lista' | 'cadastro';
  formTitle?: string;       // título da aba Cadastro (ex: "Novo Grupo" / "Editar Grupo")
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  form?: React.ReactNode;   // conteúdo do formulário

  children: React.ReactNode; // conteúdo da lista
}

// ─── Shell ────────────────────────────────────────────────────────────────────
export function CadastroShell({
  title, total, search, onSearch, searchPlaceholder = 'Pesquisar...',
  onNew, newLabel = 'Novo', loading, toolbar,
  activeTab, formTitle, onSave, onCancel, saving, form,
  children,
}: CadastroShellProps) {

  const isPageControl = activeTab !== undefined;
  const showForm = isPageControl && activeTab === 'cadastro';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: G.bg }}>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Sticky wrapper: Header ───────────────────────────── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, flexShrink: 0 }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          background: G.bg, borderBottom: `1px solid ${G.border}`,
          padding: '14px 24px', display: 'flex', alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: G.text, letterSpacing: -0.5, margin: 0 }}>
              {title}
              {!showForm && total !== undefined && (
                <span style={{ fontSize: 12, fontWeight: 700, color: G.textMuted, marginLeft: 8 }}>
                  {total.toLocaleString('pt-BR')} registros
                </span>
              )}
            </h1>
          </div>

          {!showForm && toolbar}

          {/* Busca — só na lista */}
          {!showForm && (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted, pointerEvents: 'none' }} />
              <input
                value={search} onChange={e => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                style={{ ...inp, width: 240, paddingLeft: 32, fontSize: 13 }}
              />
            </div>
          )}

          {/* Botão Novo — só na lista */}
          {!showForm && (
            <button onClick={onNew} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: G.mustard, color: G.text,
              border: 'none', borderRadius: 10, padding: '8px 16px',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>
              <Plus size={15} strokeWidth={3} />
              {newLabel}
            </button>
          )}
        </div>

        {/* ── PageControl — abas Lista / Cadastro ────────────────────────── */}
        {isPageControl && (
          <div style={{
            background: '#fff',
            borderBottom: `1px solid ${G.border}`,
            display: 'flex',
            padding: '0 24px',
            flexShrink: 0,
          }}>
            <button
              onClick={onCancel}
              style={{
                padding: '12px 20px',
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                color: activeTab === 'lista' ? G.text : G.textMuted,
                background: 'none', border: 'none',
                borderBottom: `2px solid ${activeTab === 'lista' ? G.mustard : 'transparent'}`,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Lista
            </button>
          </div>
        )}
        </div>{/* ── /sticky wrapper ──────────────────────────────────────────── */}

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading && !showForm ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <Loader2 size={24} style={{ color: G.textMuted, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : showForm ? (
            <div style={{ maxWidth: 1100 }}>
              {form}

              {/* ── Botões de ação do formulário ──────────────────────────── */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                marginTop: 24, paddingTop: 16,
                borderTop: `1px solid ${G.border}`,
              }}>
                <button onClick={onCancel} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 10,
                  border: `1px solid ${G.border}`, background: 'transparent',
                  color: G.textSec, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                  <ArrowLeft size={13} /> Cancelar
                </button>
                <button onClick={onSave} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 10, border: 'none',
                  background: saving ? G.border : G.mustard,
                  color: G.text, fontSize: 13, fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                  {saving
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                    : <><Save size={13} /> Salvar</>}
                </button>
              </div>
            </div>
          ) : children}
        </div>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: ${G.textMuted}; font-weight: 600; opacity: 1; }
        select option { background: ${G.card}; color: ${G.text}; }
      `}</style>
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────
export function CadastroTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: G.card, borderRadius: 16, border: `1px solid ${G.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(40,55,74,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{ padding: '10px 16px', textAlign: align, fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, borderBottom: `1px solid ${G.border}`, background: G.cardHi }}>
      {children}
    </th>
  );
}

export function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td style={{ padding: '11px 16px', textAlign: align, fontSize: 13, color: G.text }}>
      {children}
    </td>
  );
}

export function TrHover({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: `1px solid ${G.border}`, cursor: onClick ? 'pointer' : 'default', transition: 'background .12s', ...style }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = G.cardHi; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = style?.background as string || 'transparent'; }}>
      {children}
    </tr>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${G.border}` }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

export function Field({ label: labelText, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={label}>{labelText}</span>
      {children}
    </div>
  );
}
