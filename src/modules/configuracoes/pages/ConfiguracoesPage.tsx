import { useState, useEffect, useRef } from 'react';
import { Save, Search, Image } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

interface EmpresaData {
  emp_situacao: string;
  emp_nome: string;
  emp_endereco: string;
  emp_bairro: string;
  emp_cidade: string;
  emp_uf: string;
  emp_cep: string;
  emp_cnpj: string;
  emp_inscricao: string;
  emp_fones: string;
  emp_logotipo: string;
  emp_mapas_modo_vendedor: '1x1' | '1xN';
  emp_carteira_por_vendedor: boolean;
  // Dados Fiscais — NFS-e
  emp_im: string;
  emp_regime: string;
  emp_ibge: string;
  emp_nfse_ambiente: string;
  emp_nfse_proximo_numero: number | string;
  emp_nfse_serie: string;
  emp_ctribnac: string;
  emp_cnbs: string;
  emp_item_lc116: string;
  emp_ctribmun: string;
  emp_cnae: string;
  emp_iss_pct: number | string;
}

const inp: React.CSSProperties = {
  width: '100%', border: `1px solid ${G.border}`, borderRadius: 8,
  padding: '8px 12px', fontSize: 13, background: G.bg, color: G.text,
  boxSizing: 'border-box', outline: 'none',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: G.textSec,
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>;
}

export default function ConfiguracoesPage() {
  const [data, setData]     = useState<Partial<EmpresaData>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/empresa').then(r => {
      if (r.data.data) setData(r.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const set = (k: keyof EmpresaData, v: string) =>
    setData(prev => ({ ...prev, [k]: v }));

  // ── Consulta CNPJ na Receita Federal ─────────────────────────────────────────
  const consultarCNPJ = async () => {
    const cnpj = data.emp_cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) return;
    try {
      const res = await api.get(`/aux/cnpj/${cnpj}`);
      if (!res.data.success) throw new Error(res.data.message);
      const r = res.data.data;
      setData(prev => ({
        ...prev,
        emp_nome:     r.razao_social || prev.emp_nome,
        emp_endereco: r.logradouro   || prev.emp_endereco,
        emp_bairro:   r.bairro       || prev.emp_bairro,
        emp_cidade:   r.municipio    || prev.emp_cidade,
        emp_uf:       r.uf           || prev.emp_uf,
        emp_cep:      (r.cep || '').replace(/\D/g, '') || prev.emp_cep,
      }));
    } catch (e: any) { setMsg({ type: 'err', text: e.message || 'CNPJ não encontrado na Receita Federal.' }); }
  };

  // ── Upload de logotipo ────────────────────────────────────────────────────────
  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('emp_logotipo', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Salvar ────────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put('/empresa', data);
      setMsg({ type: 'ok', text: 'Configurações salvas com sucesso!' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Erro ao salvar.' });
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: G.textMuted }}>
      Carregando...
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: G.text }}>⚙ Configurações do Sistema</div>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${G.border}`, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

        {/* Tab: Dados da Empresa */}
        <div style={{ borderBottom: `2px solid ${G.text}`, paddingBottom: 8, marginBottom: 28, fontSize: 12, fontWeight: 800, color: G.text, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dados da Empresa
        </div>

        {/* CNPJ */}
        <Field label="CNPJ">
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inp} value={data.emp_cnpj || ''} onChange={e => set('emp_cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            <button onClick={consultarCNPJ} title="Consultar Receita Federal"
              style={{ width: 40, height: 38, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Search size={15} color={G.textSec} />
            </button>
          </div>
        </Field>

        <Row>
          <Field label="Situação">
            <select style={{ ...inp, cursor: 'pointer' }} value={data.emp_situacao || 'A'} onChange={e => set('emp_situacao', e.target.value)}>
              <option value="A">Ativo</option>
              <option value="I">Inativo</option>
            </select>
          </Field>
          <Field label="Nome da Empresa *">
            <input style={inp} value={data.emp_nome || ''} onChange={e => set('emp_nome', e.target.value)} placeholder="Razão social" />
          </Field>
        </Row>

        <Field label="Endereço">
          <input style={inp} value={data.emp_endereco || ''} onChange={e => set('emp_endereco', e.target.value)} placeholder="Logradouro, número" />
        </Field>

        <Row>
          <Field label="Bairro">
            <input style={inp} value={data.emp_bairro || ''} onChange={e => set('emp_bairro', e.target.value)} />
          </Field>
          <Field label="Cidade">
            <input style={inp} value={data.emp_cidade || ''} onChange={e => set('emp_cidade', e.target.value)} />
          </Field>
        </Row>

        <Row>
          <Field label="UF">
            <input style={{ ...inp, maxWidth: 80 }} value={data.emp_uf || ''} maxLength={2} onChange={e => set('emp_uf', e.target.value.toUpperCase())} />
          </Field>
          <Field label="CEP">
            <input style={inp} value={data.emp_cep || ''} onChange={e => set('emp_cep', e.target.value)} placeholder="00000-000" />
          </Field>
        </Row>

        <Row>
          <Field label="Inscrição Estadual">
            <input style={inp} value={data.emp_inscricao || ''} onChange={e => set('emp_inscricao', e.target.value)} placeholder="Inscrição estadual" />
          </Field>
          <Field label="Telefones">
            <input style={inp} value={data.emp_fones || ''} onChange={e => set('emp_fones', e.target.value)} placeholder="(00) 0000-0000" />
          </Field>
        </Row>

        {/* Logotipo */}
        <Field label="Logotipo">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inp, fontSize: 11, color: G.textMuted }} readOnly
                  value={data.emp_logotipo ? (data.emp_logotipo.startsWith('data:') ? 'IMAGEM CARREGADA (Base64)' : data.emp_logotipo) : ''} />
                <button onClick={() => fileRef.current?.click()} title="Selecionar imagem"
                  style={{ width: 40, height: 38, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Image size={15} color={G.textSec} />
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
            </div>
            {data.emp_logotipo && (
              <img src={data.emp_logotipo} alt="Logo" style={{ height: 60, borderRadius: 8, border: `1px solid ${G.border}`, objectFit: 'contain', background: '#fff', padding: 4 }} />
            )}
          </div>
        </Field>

        {/* Modo de vendedor nos mapas estatísticos */}
        <Field label="Atendimento por vendedor (mapas estatísticos)">
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { v: '1x1', t: '1 vendedor por cliente', d: 'O cliente tem um titular único (campo Vendedor no cadastro do cliente).' },
              { v: '1xN', t: 'Vários vendedores por cliente', d: 'Cada vendedor atende indústrias específicas (configuradas em Vendedor × Indústrias).' },
            ] as const).map(opt => {
              const active = (data.emp_mapas_modo_vendedor || '1x1') === opt.v;
              return (
                <button key={opt.v} type="button" onClick={() => set('emp_mapas_modo_vendedor', opt.v)}
                  style={{
                    flex: 1, textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${active ? G.mustard : G.border}`,
                    background: active ? `${G.mustard}18` : G.bg,
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: G.text }}>{opt.t}</div>
                  <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2, lineHeight: 1.4 }}>{opt.d}</div>
                </button>
              );
            })}
          </div>
          {(data.emp_mapas_modo_vendedor || '1x1') === '1xN' && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 11, color: '#9A3412', lineHeight: 1.5 }}>
              <strong>Atenção:</strong> no modo "vários vendedores", o filtro de vendedor dos mapas usa a tabela <strong>Vendedor × Indústrias</strong> (mesma do controle de acesso). Cadastre as indústrias de cada vendedor lá, senão os mapas sairão vazios ao filtrar por vendedor.
            </div>
          )}
        </Field>

        {/* Visibilidade da carteira — quem cada vendedor/promotor enxerga */}
        <Field label="Visibilidade da carteira (vendedores e promotores)">
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { v: true,  t: 'Cada um vê a sua carteira', d: 'O vendedor/promotor enxerga apenas os clientes da própria carteira (titular).' },
              { v: false, t: 'Todos atendem todos',       d: 'Todos enxergam e atendem todos os clientes da empresa, sem divisão de carteira (ex.: equipe compartilhada).' },
            ] as const).map(opt => {
              const current = data.emp_carteira_por_vendedor !== false; // default = true
              const active = current === opt.v;
              return (
                <button key={String(opt.v)} type="button" onClick={() => setData(prev => ({ ...prev, emp_carteira_por_vendedor: opt.v }))}
                  style={{
                    flex: 1, textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${active ? G.mustard : G.border}`,
                    background: active ? `${G.mustard}18` : G.bg,
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: G.text }}>{opt.t}</div>
                  <div style={{ fontSize: 11, color: G.textMuted, marginTop: 2, lineHeight: 1.4 }}>{opt.d}</div>
                </button>
              );
            })}
          </div>
          {data.emp_carteira_por_vendedor === false && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 11, color: '#9A3412', lineHeight: 1.5 }}>
              <strong>Todos atendem todos:</strong> qualquer vendedor ou promotor vê e atende qualquer cliente. Use quando a equipe é compartilhada (sem titular fixo) — como na damarep.
            </div>
          )}
        </Field>

        {/* ─── Dados Fiscais — NFS-e ──────────────────────────────────────── */}
        <div style={{ borderBottom: `2px solid ${G.text}`, paddingBottom: 8, margin: '36px 0 18px', fontSize: 12, fontWeight: 800, color: G.text, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dados Fiscais — NFS-e
        </div>
        <div style={{ marginBottom: 18, padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 11, color: '#1E40AF', lineHeight: 1.5 }}>
          Necessário para emitir a NFS-e de comissão. Os códigos já vêm preenchidos para <strong>representação comercial</strong> — ajuste se o seu serviço for outro.
        </div>

        {/* Bloco A — Prestador */}
        <Row>
          <Field label="Inscrição Municipal">
            <input style={inp} value={data.emp_im || ''} onChange={e => set('emp_im', e.target.value)} placeholder="Inscrição municipal" />
          </Field>
          <Field label="Regime Tributário">
            <select style={{ ...inp, cursor: 'pointer' }} value={data.emp_regime || 'SIMPLES_MEEPP'} onChange={e => set('emp_regime', e.target.value)}>
              <option value="SIMPLES_MEEPP">Simples Nacional — ME/EPP</option>
              <option value="SIMPLES_MEI">Simples Nacional — MEI</option>
              <option value="PRESUMIDO">Lucro Presumido</option>
              <option value="REAL">Lucro Real</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Ambiente">
            <select style={{ ...inp, cursor: 'pointer' }} value={data.emp_nfse_ambiente || 'HOMOLOGACAO'} onChange={e => set('emp_nfse_ambiente', e.target.value)}>
              <option value="HOMOLOGACAO">Homologação (teste)</option>
              <option value="PRODUCAO">Produção (valor fiscal)</option>
            </select>
          </Field>
          <Field label="Código IBGE do Município">
            <input style={inp} value={data.emp_ibge || ''} onChange={e => set('emp_ibge', e.target.value)} placeholder="ex.: 5002704 (auto pela cidade — em breve)" />
          </Field>
        </Row>

        {/* Bloco B — Numeração */}
        <Row>
          <Field label="Próximo Número da NFS-e">
            <input style={inp} type="number" value={String(data.emp_nfse_proximo_numero ?? '')} onChange={e => set('emp_nfse_proximo_numero', e.target.value)} placeholder="continua a sua sequência (ex.: 442)" />
          </Field>
          <Field label="Série">
            <input style={{ ...inp, maxWidth: 100 }} value={data.emp_nfse_serie || ''} onChange={e => set('emp_nfse_serie', e.target.value)} placeholder="1" />
          </Field>
        </Row>

        {/* Bloco C — Códigos do serviço */}
        <Row>
          <Field label="Item da Lista (LC 116)">
            <input style={inp} value={data.emp_item_lc116 || ''} onChange={e => set('emp_item_lc116', e.target.value)} placeholder="ex.: 10.09.01" />
          </Field>
          <Field label="Cód. Tributação Nacional (cTribNac)">
            <input style={inp} value={data.emp_ctribnac || ''} onChange={e => set('emp_ctribnac', e.target.value)} placeholder="ex.: 100901" />
          </Field>
        </Row>
        <Row>
          <Field label="Código NBS (cNBS)">
            <input style={inp} value={data.emp_cnbs || ''} onChange={e => set('emp_cnbs', e.target.value)} placeholder="ex.: 102010000" />
          </Field>
          <Field label="Cód. Trib. Municipal — opcional">
            <input style={inp} value={data.emp_ctribmun || ''} onChange={e => set('emp_ctribmun', e.target.value)} placeholder="3 dígitos" />
          </Field>
        </Row>
        <Row>
          <Field label="CNAE / Atividade Municipal — opcional">
            <input style={inp} value={data.emp_cnae || ''} onChange={e => set('emp_cnae', e.target.value)} placeholder="ex.: 620910000" />
          </Field>
          <Field label="Alíquota ISS % (fora do Simples)">
            <input style={inp} type="number" value={String(data.emp_iss_pct ?? '')} onChange={e => set('emp_iss_pct', e.target.value)} placeholder="0" />
          </Field>
        </Row>
        <div style={{ marginBottom: 22, padding: '8px 12px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 11, color: '#9A3412', lineHeight: 1.5 }}>
          <strong>Certificado Digital A1:</strong> o upload do certificado (.pfx) e a resolução automática de IBGE/provedor entram na próxima etapa.
        </div>

        {/* Feedback */}
        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: msg.type === 'ok' ? '#e8f5e9' : '#fdecea',
            color: msg.type === 'ok' ? '#2e7d32' : '#c62828',
            border: `1px solid ${msg.type === 'ok' ? '#a5d6a7' : '#ef9a9a'}` }}>
            {msg.text}
          </div>
        )}

        {/* Botão salvar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={save} disabled={saving}
            style={{ background: saving ? G.border : G.mustard, border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', color: G.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    </div>
  );
}
