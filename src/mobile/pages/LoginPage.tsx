import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eraser, AlertCircle, Save } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useAuthStore } from '@/shared/stores/useAuthStore';

const SAVED_KEY = 'repone_mob_credentials';

interface Saved { cnpj: string; nome: string; sobrenome: string; }

const loadSaved = (): Saved | null => {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); }
  catch { return null; }
};

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
};

export default function LoginPage() {
  const saved = loadSaved();
  const [cnpj,      setCnpj]      = useState(saved?.cnpj      || '');
  const [nome,      setNome]      = useState(saved?.nome      || '');
  const [sobrenome, setSobrenome] = useState(saved?.sobrenome || '');
  const [password,  setPassword]  = useState('');
  const [lembrar,   setLembrar]   = useState(!!saved);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleLimpar = () => {
    setCnpj(''); setNome(''); setSobrenome(''); setPassword('');
    setLembrar(false); setError('');
    localStorage.removeItem(SAVED_KEY);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) { setError('CNPJ deve ter 14 dígitos'); return; }
    if (!nome.trim())             { setError('Informe o nome'); return; }
    if (!sobrenome.trim())        { setError('Informe o sobrenome'); return; }
    if (!password)                { setError('Informe a senha'); return; }

    setLoading(true);
    try {
      const r = await api.post('/auth/login', {
        cnpj: cleanCNPJ, nome: nome.trim(), sobrenome: sobrenome.trim(), password,
      });
      if (r.data.success) {
        if (lembrar) {
          localStorage.setItem(SAVED_KEY, JSON.stringify({ cnpj, nome: nome.trim().toUpperCase(), sobrenome: sobrenome.trim().toUpperCase() }));
        } else {
          localStorage.removeItem(SAVED_KEY);
        }
        login({ user: r.data.user, token: r.data.token, tenantConfig: r.data.tenantConfig });
        navigate('/mobile/home', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'CNPJ, nome ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100dvh' as any,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--navy)', position: 'relative', overflow: 'hidden',
    },
    glow1: {
      position: 'absolute', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none',
      width: 400, height: 400, background: 'rgba(255,210,0,0.08)', top: -120, left: -120,
    },
    glow2: {
      position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none',
      width: 350, height: 350, background: 'rgba(255,210,0,0.05)', bottom: -80, right: -80,
    },
    logoBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, zIndex: 1 },
    brand: { fontSize: 28, fontWeight: 900, color: '#FFF', marginTop: 16, letterSpacing: -0.5 },
    version: {
      fontSize: 10, color: 'var(--mustard)', marginTop: 6,
      letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 700,
      background: 'rgba(255,210,0,0.12)', padding: '4px 12px', borderRadius: 20,
    },
    form: {
      width: '100%', maxWidth: 400, zIndex: 1,
      background: 'var(--sand-bg)', borderRadius: 24,
      padding: '32px 28px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    savedBadge: {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '11px 14px', background: 'rgba(255,210,0,0.12)',
      border: '1px solid rgba(255,210,0,0.3)', borderRadius: 10,
      color: 'var(--mustard)', fontSize: 12, fontWeight: 600, marginBottom: 20,
    },
    errorBox: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '13px 14px', background: '#fef2f2',
      border: '1px solid #fecaca', borderRadius: 10,
      color: '#dc2626', fontSize: 14, marginBottom: 20,
    },
    field: { marginBottom: 16 },
    label: {
      display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--navy-muted)',
      letterSpacing: 0.8, marginBottom: 7, textTransform: 'uppercase' as const,
    },
    inp: {
      width: '100%', padding: '13px 14px', borderRadius: 10, fontSize: 15,
      border: '1.5px solid var(--border)', background: '#FFF',
      color: 'var(--navy)', outline: 'none', boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
    },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    rememberRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer' },
    checkBox: {
      width: 22, height: 22, borderRadius: 6,
      border: `2px solid var(--border)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      background: '#FFF', transition: 'all 0.2s',
    },
    buttons: { display: 'flex', gap: 12 },
    btnClear: {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '13px 18px', borderRadius: 10, border: '1.5px solid var(--border)',
      background: 'transparent', color: 'var(--navy-muted)', fontSize: 12,
      fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' as const,
      letterSpacing: 0.5, fontFamily: 'inherit',
    },
    btnSubmit: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '15px 20px', borderRadius: 10, border: 'none',
      background: 'var(--mustard)', color: 'var(--navy)',
      fontSize: 14, fontWeight: 800, cursor: 'pointer',
      textTransform: 'uppercase' as const, letterSpacing: 0.5,
      boxShadow: '0 4px 15px rgba(255,210,0,0.35)', fontFamily: 'inherit',
    },
  };

  return (
    <div style={s.page}>
      <div style={s.glow1} />
      <div style={s.glow2} />

      {/* Logo */}
      <div style={s.logoBox}>
        <svg width="64" height="72" viewBox="0 0 64 72" fill="none">
          <path d="M32 2L60 18V54L32 70L4 54V18L32 2Z" fill="var(--navy)" stroke="var(--mustard)" strokeWidth="3"/>
          <rect x="18" y="38" width="8" height="16" rx="2" fill="var(--mustard)"/>
          <rect x="28" y="28" width="8" height="26" rx="2" fill="var(--mustard)" opacity="0.8"/>
          <rect x="38" y="20" width="8" height="34" rx="2" fill="var(--mustard)" opacity="0.6"/>
        </svg>
        <span style={s.brand}>RepOne</span>
        <span style={s.version}>V2 · Commercial</span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={s.form}>
        {saved && (
          <div style={s.savedBadge}>
            <Save size={13} />
            Credenciais carregadas automaticamente
          </div>
        )}

        {error && (
          <div style={s.errorBox}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div style={s.field}>
          <label style={s.label}>CNPJ da Empresa</label>
          <input
            style={s.inp} value={cnpj} inputMode="numeric" autoComplete="off"
            placeholder="00.000.000/0000-00"
            onChange={e => { const f = formatCNPJ(e.target.value); if (f.length <= 18) setCnpj(f); }}
          />
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Nome</label>
            <input style={s.inp} value={nome} placeholder="Seu nome" autoComplete="given-name"
              onChange={e => setNome(e.target.value.toUpperCase())} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Sobrenome</label>
            <input style={s.inp} value={sobrenome} placeholder="Sobrenome" autoComplete="family-name"
              onChange={e => setSobrenome(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Senha de Acesso</label>
          <input style={s.inp} type="password" value={password} placeholder="••••••••"
            autoComplete="current-password" onChange={e => setPassword(e.target.value)} />
        </div>

        <label style={s.rememberRow}>
          <div style={{
            ...s.checkBox,
            background: lembrar ? 'var(--mustard)' : '#FFF',
            borderColor: lembrar ? 'var(--mustard)' : 'var(--border)',
          }}>
            {lembrar && <span style={{ color: 'var(--navy)', fontSize: 14, fontWeight: 900 }}>✓</span>}
          </div>
          <input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)}
            style={{ display: 'none' }} />
          <span style={{ fontSize: 13, color: 'var(--navy-muted)' }}>Lembrar CNPJ, Nome e Sobrenome</span>
        </label>

        <div style={s.buttons}>
          <button type="button" style={s.btnClear} onClick={handleLimpar}>
            <Eraser size={14} /> LIMPAR
          </button>
          <button type="submit" style={{ ...s.btnSubmit, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'ENTRANDO...' : <><LogIn size={17} /> ENTRAR NO SISTEMA</>}
          </button>
        </div>
      </form>

      <p style={{ position: 'absolute', bottom: 20, fontSize: 11, color: 'rgba(255,255,255,0.3)', zIndex: 1 }}>
        © 2026 RepOne. Todos os direitos reservados.
      </p>
    </div>
  );
}
