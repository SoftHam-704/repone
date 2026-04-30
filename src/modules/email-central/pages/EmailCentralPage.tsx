import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, RefreshCw, Archive, Reply,
  Search, CheckCircle,
  Tag, Building2, Package, Wrench, MessageSquareWarning,
  X, Send, Inbox, Sparkles, Trash2, MailOpen, MailCheck,
  Paperclip, FileText, FileImage, FileSpreadsheet, File, Download,
  ChevronRight, Filter, SlidersHorizontal, Users, Clock,
} from 'lucide-react';
import { api } from '@/shared/lib/api';

// ─── Design tokens (mesmos do sistema) ───────────────────────────────────────
const G = {
  bg:        '#E8E1D4',
  card:      '#F2ECE2',
  cardHi:    '#F8F4EE',
  border:    '#D3C7AD',
  text:      '#28374A',
  textSec:   '#3D5265',
  textMuted: '#5E7682',
  mustard:   '#FFD200',
  success:   '#16A34A',
  danger:    '#C0392B',
  warning:   '#D97706',
  blue:      '#2563EB',
  purple:    '#6D4C8E',
} as const;

// Shadow token do design system
const S = {
  card: '0 4px 20px -4px rgba(40, 55, 74, 0.08), 0 1px 6px -1px rgba(40, 55, 74, 0.05)',
  hover: '0 8px 30px -4px rgba(40, 55, 74, 0.12), 0 2px 10px -2px rgba(40, 55, 74, 0.08)',
} as const;

// ─── Helpers de tipo ──────────────────────────────────────────────────────────
const TIPO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  cotacao:    { label: 'Cotação',    color: '#D97706', icon: Package },
  pedido:     { label: 'Pedido',     color: '#16A34A', icon: CheckCircle },
  lead:       { label: 'Lead',       color: '#2563EB', icon: Tag },
  suporte:    { label: 'Suporte',    color: '#6D4C8E', icon: Wrench },
  reclamacao: { label: 'Reclamação', color: '#C0392B', icon: MessageSquareWarning },
  outro:      { label: 'Outro',      color: '#5E7682', icon: Mail },
};

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  novo:        { label: 'Novo',        color: '#2563EB' },
  lido:        { label: 'Lido',        color: '#5E7682' },
  respondido:  { label: 'Respondido',  color: '#16A34A' },
  arquivado:   { label: 'Arquivado',   color: '#D3C7AD' },
  convertido:  { label: 'Convertido',  color: '#6D4C8E' },
};

function fmtHora(dt: string | null) {
  if (!dt) return '';
  const d = new Date(dt);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EmailCentralPage() {
  const [leads,        setLeads]        = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [selected,     setSelected]     = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo,   setFiltroTipo]   = useState('');
  const [busca,        setBusca]        = useState('');
  const [respModal,    setRespModal]    = useState(false);
  const [respTexto,    setRespTexto]    = useState('');
  const [enviando,     setEnviando]     = useState(false);
  const [configAtivo,  setConfigAtivo]  = useState<boolean | null>(null);
  const [configEmail,  setConfigEmail]  = useState('');
  const [syncMsg,      setSyncMsg]      = useState('');
  const [view,         setView]         = useState<'leads' | 'inbox'>('leads');
  const [rawEmails,    setRawEmails]    = useState<any[]>([]);
  const [rawLoading,   setRawLoading]   = useState(false);
  const [rawSelected,  setRawSelected]  = useState<any>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroTipo)   params.append('tipo',   filtroTipo);
      if (busca)        params.append('q',      busca);
      const r = await api.get(`/email-central/leads?${params}`);
      if (r.data.success) { setLeads(r.data.data); setTotal(r.data.total); }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [filtroEstado, filtroTipo, busca]);

  const fetchConfig = useCallback(async () => {
    try {
      const r = await api.get('/email-central/config');
      setConfigAtivo(r.data.data?.par_email_central_ativo ?? false);
      setConfigEmail(r.data.data?.par_email || '');
    } catch { setConfigAtivo(false); }
  }, []);

  // Poll após sync: tenta 6x a cada 3s para pegar emails que chegaram via background
  const pollLeads = useCallback((tentativas = 6) => {
    if (tentativas <= 0) { setSyncing(false); setSyncMsg(''); return; }
    setTimeout(async () => {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      try {
        const r = await api.get(`/email-central/leads?${params}`);
        if (r.data.success) {
          setLeads(r.data.data);
          setTotal(r.data.total);
          if (r.data.total > 0 || tentativas === 1) {
            setSyncing(false);
            setSyncMsg(r.data.total > 0 ? `${r.data.total} email(s) encontrado(s)` : 'Nenhum email relevante encontrado');
            setTimeout(() => setSyncMsg(''), 4000);
            return;
          }
        }
      } catch { /* silencioso */ }
      setSyncMsg(`Processando... (${7 - tentativas}/6)`);
      pollLeads(tentativas - 1);
    }, 3000);
  }, []);

  const toggleLido = async (email: any) => {
    const novoLido = !email.lido;
    try {
      await api.patch(`/email-central/inbox-raw/${email.uid}/flags`, { seen: novoLido });
      setRawEmails(prev => prev.map(e => e.uid === email.uid ? { ...e, lido: novoLido } : e));
      if (rawSelected?.uid === email.uid) setRawSelected((s: any) => ({ ...s, lido: novoLido }));
    } catch { /* silencioso */ }
  };

  const deletarEmail = async (email: any) => {
    if (!confirm(`Excluir "${email.assunto}" do servidor? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/email-central/inbox-raw/${email.uid}`);
      setRawEmails(prev => prev.filter(e => e.uid !== email.uid));
      if (rawSelected?.uid === email.uid) setRawSelected(null);
    } catch (e: any) {
      alert('Erro ao excluir: ' + e?.response?.data?.message);
    }
  };

  const fetchRawInbox = useCallback(async () => {
    setRawLoading(true);
    setRawSelected(null);
    try {
      const r = await api.get('/email-central/inbox-raw?limit=50');
      if (r.data.success) setRawEmails(r.data.data);
    } catch { /* silencioso */ }
    finally { setRawLoading(false); }
  }, []);

  const handleSwitchView = (v: 'leads' | 'inbox') => {
    setView(v);
    if (v === 'inbox' && rawEmails.length === 0) fetchRawInbox();
  };

  const handleSync = async () => {
    if (view === 'inbox') { fetchRawInbox(); return; }
    setSyncing(true);
    setSyncMsg('Conectando ao servidor IMAP...');
    try {
      await api.post('/email-central/sync');
      setSyncMsg('Classificando emails com IRIS...');
      pollLeads(6);
    } catch { setSyncing(false); setSyncMsg(''); }
  };

  const abrirLead = async (lead: any) => {
    try {
      const r = await api.get(`/email-central/leads/${lead.id}`);
      if (r.data.success) {
        setSelected(r.data.data);
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, estado: r.data.data.estado } : l));
      }
    } catch { setSelected(lead); }
  };

  const arquivar = async (id: number) => {
    await api.patch(`/email-central/leads/${id}/estado`, { estado: 'arquivado' });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, estado: 'arquivado' } : l));
    if (selected?.id === id) setSelected((s: any) => ({ ...s, estado: 'arquivado' }));
  };

  const enviarResposta = async () => {
    if (!selected || !respTexto.trim()) return;
    setEnviando(true);
    try {
      await api.post(`/email-central/leads/${selected.id}/responder`, {
        assunto: `Re: ${selected.assunto}`,
        corpo:   respTexto,
      });
      setRespModal(false);
      setRespTexto('');
      setSelected((s: any) => ({ ...s, estado: 'respondido' }));
      setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, estado: 'respondido' } : l));
    } catch (e: any) {
      alert('Erro ao enviar: ' + e?.response?.data?.message);
    } finally { setEnviando(false); }
  };

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    fetchConfig();
    // Sync silencioso na abertura da página
    api.post('/email-central/sync').then(() => {
      setTimeout(() => fetchLeads(), 8000);
    }).catch(() => {});
  }, [fetchConfig, fetchLeads]);

  const tipoConf   = (t: string) => TIPO_CONFIG[t]  || TIPO_CONFIG.outro;
  const estadoConf = (e: string) => ESTADO_CONFIG[e] || ESTADO_CONFIG.lido;

  function fmtBytes(bytes: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function iconAnexo(contentType: string) {
    if (contentType.startsWith('image/'))       return FileImage;
    if (contentType.includes('pdf'))            return FileText;
    if (contentType.includes('sheet') || contentType.includes('excel') || contentType.includes('csv')) return FileSpreadsheet;
    if (contentType.includes('word') || contentType.includes('document')) return FileText;
    return File;
  }

  function downloadAnexo(email: any, idx: number) {
    const anx = email.anexos[idx];
    api.get(`/email-central/inbox-raw/${email.uid}/attachment/${idx}`, {
      responseType: 'arraybuffer',
    })
      .then(r => {
        const mimeType = anx?.contentType?.split(';')[0] || 'application/octet-stream';
        const blob     = new Blob([r.data], { type: mimeType });
        const blobUrl  = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = blobUrl;
        a.download     = anx?.filename || 'anexo';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      })
      .catch((e: any) => alert('Erro ao baixar anexo: ' + (e.response?.data?.message || e.message)));
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: G.bg, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0"
          style={{ borderBottom: `1px solid ${G.border}`, background: G.card }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: G.mustard }}>
                  <Mail size={18} style={{ color: G.text }} />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight" style={{ color: G.text }}>Central de Emails</h1>
                  {configEmail && (
                    <span className="flex items-center gap-1.5 text-xs mt-0.5 font-medium"
                      style={{ color: G.textMuted }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: G.success }} />
                      {configEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {syncMsg && (
                <span className="text-xs font-medium animate-pulse" style={{ color: G.textMuted }}>{syncMsg}</span>
              )}
              {configAtivo === false && !syncMsg && (
                <span className="text-xs px-3 py-1.5 rounded-lg font-bold"
                  style={{ background: `${G.warning}15`, color: G.warning }}>
                  Central desativada
                </span>
              )}
              <button onClick={handleSync} disabled={syncing || rawLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
                style={{ background: G.mustard, color: G.text, boxShadow: S.card }}>
                <RefreshCw size={14} className={(syncing || rawLoading) ? 'animate-spin' : ''} />
                {(syncing || rawLoading) ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </div>
          </div>

          {/* Tabs com indicadores */}
          <div className="flex items-center gap-1 pb-0">
            {([
              { key: 'leads',  label: 'Leads IRIS',      icon: Sparkles, count: total },
              { key: 'inbox',  label: 'Caixa de Entrada', icon: Inbox,   count: rawEmails.length },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => handleSwitchView(tab.key)}
                className="relative flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition-all duration-200"
                style={{
                  color:          view === tab.key ? G.text : G.textMuted,
                  background:     view === tab.key ? G.bg : 'transparent',
                }}>
                <tab.icon size={15} />
                {tab.label}
                {tab.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ 
                      background: view === tab.key ? G.mustard : `${G.border}50`,
                      color: view === tab.key ? G.text : G.textMuted 
                    }}>
                    {tab.count}
                  </span>
                )}
                {view === tab.key && (
                  <motion.div layoutId="tab-indicator" 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: G.mustard }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden p-4 gap-4">

          {/* ─── ABA: CAIXA DE ENTRADA RAW ──────────────────────────────── */}
          {view === 'inbox' && (
            <>
              {/* Lista raw com card */}
              <div className="flex flex-col overflow-hidden rounded-2xl" 
                style={{ width: 340, flexShrink: 0, background: G.card, boxShadow: S.card }}>
                {/* Header da lista */}
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `1px solid ${G.border}` }}>
                  <div className="flex items-center gap-2">
                    <Inbox size={14} style={{ color: G.textMuted }} />
                    <span className="text-xs font-semibold" style={{ color: G.text }}>
                      {rawEmails.length} mensagens
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                      style={{ color: G.textMuted }}>
                      <Filter size={12} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {rawLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                      <RefreshCw size={20} className="animate-spin" style={{ color: G.textMuted }} />
                      <p className="text-xs" style={{ color: G.textMuted }}>Conectando ao IMAP...</p>
                    </div>
                  ) : rawEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                      <Inbox size={32} style={{ color: G.border }} />
                      <p className="text-sm" style={{ color: G.textMuted }}>Caixa vazia</p>
                    </div>
                  ) : rawEmails.map((email, i) => (
                    <button key={`${email.uid}-${i}`} onClick={() => setRawSelected(email)}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-black/5"
                      style={{
                        background:   rawSelected?.uid === email.uid ? `${G.mustard}15` : 'transparent',
                        borderBottom: `1px solid ${G.border}`,
                      }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: email.lido ? `${G.border}30` : `${G.blue}15` }}>
                        <Mail size={15} style={{ color: email.lido ? G.textMuted : G.blue }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold truncate"
                            style={{ color: email.lido ? G.textSec : G.text }}>
                            {email.de_nome || email.de || '—'}
                          </span>
                          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: G.textMuted }}>
                            {fmtHora(email.recebido_em)}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-1" style={{ color: email.lido ? G.textMuted : G.textSec }}>
                          {email.assunto}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {!email.lido && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                              style={{ background: `${G.blue}20`, color: G.blue }}>
                              Novo
                            </span>
                          )}
                          {email.anexos?.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: G.textMuted }}>
                              <Paperclip size={10} />
                              {email.anexos.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalhe raw */}
              <div className="flex-1 overflow-hidden rounded-2xl" 
                style={{ background: G.card, boxShadow: S.card }}>
                <AnimatePresence mode="wait">
                  {rawSelected ? (
                    <motion.div key={rawSelected.uid}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col h-full">
                      {/* Cabeçalho + Toolbar */}
                      <div className="px-5 py-4 flex-shrink-0"
                        style={{ borderBottom: `1px solid ${G.border}` }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold truncate" style={{ color: G.text }}>
                              {rawSelected.assunto}
                            </h2>
                            <p className="text-xs mt-2" style={{ color: G.textMuted }}>
                              <span style={{ color: G.textSec }}>{rawSelected.de_nome || rawSelected.de}</span>
                              {rawSelected.de_nome && (
                                <span style={{ color: G.textMuted }}> &lt;{rawSelected.de}&gt;</span>
                              )}
                            </p>
                            {rawSelected.recebido_em && (
                              <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: G.textMuted }}>
                                <Clock size={10} />
                                {new Date(rawSelected.recebido_em).toLocaleString('pt-BR')}
                              </p>
                            )}
                          </div>
                          {/* Ações */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => toggleLido(rawSelected)}
                              title={rawSelected.lido ? 'Marcar como não lido' : 'Marcar como lido'}
                              className="p-2.5 rounded-xl transition-all hover:scale-105"
                              style={{ background: G.cardHi, border: `1px solid ${G.border}`, boxShadow: S.card }}>
                              {rawSelected.lido
                                ? <MailOpen size={15} style={{ color: G.textMuted }} />
                                : <MailCheck size={15} style={{ color: G.blue }} />}
                            </button>
                            <button
                              onClick={() => { setRespModal(true); setSelected(rawSelected); }}
                              title="Responder"
                              className="p-2.5 rounded-xl transition-all hover:scale-105"
                              style={{ background: G.mustard, boxShadow: S.card }}>
                              <Reply size={15} style={{ color: G.text }} />
                            </button>
                            <button
                              onClick={() => deletarEmail(rawSelected)}
                              title="Excluir"
                              className="p-2.5 rounded-xl transition-all hover:scale-105"
                              style={{ background: `${G.danger}10`, border: `1px solid ${G.danger}30` }}>
                              <Trash2 size={15} style={{ color: G.danger }} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Chips de anexos */}
                      {rawSelected.anexos?.length > 0 && (
                        <div className="px-5 py-3 flex items-center gap-2 flex-wrap flex-shrink-0"
                          style={{ borderBottom: `1px solid ${G.border}`, background: `${G.border}10` }}>
                          <Paperclip size={12} style={{ color: G.textMuted }} />
                          {rawSelected.anexos.map((anx: any) => {
                            const IconAnx = iconAnexo(anx.contentType);
                            return (
                              <button key={anx.index}
                                onClick={() => downloadAnexo(rawSelected, anx.index)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
                                style={{ background: G.card, border: `1px solid ${G.border}`, color: G.textSec, boxShadow: S.card }}>
                                <IconAnx size={12} style={{ color: G.blue }} />
                                <span className="max-w-[140px] truncate">{anx.filename}</span>
                                {anx.size > 0 && (
                                  <span className="text-[10px]" style={{ color: G.textMuted }}>{fmtBytes(anx.size)}</span>
                                )}
                                <Download size={10} style={{ color: G.textMuted }} />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Corpo */}
                      <div className="flex-1 overflow-hidden">
                        {rawSelected.html ? (
                          <iframe
                            srcDoc={rawSelected.html}
                            sandbox="allow-same-origin"
                            className="w-full h-full border-0"
                            style={{ background: '#fff' }}
                            title="email-content"
                          />
                        ) : (
                          <div className="h-full overflow-y-auto p-5">
                            <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: G.textSec, fontFamily: 'inherit' }}>
                              {rawSelected.texto || rawSelected.preview || '(sem conteúdo disponível)'}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty-raw" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: `${G.border}30` }}>
                        <Inbox size={28} style={{ color: G.border }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: G.textMuted }}>
                        Selecione um email
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* ─── ABA: LEADS IRIS ─────────────────────────────────────────── */}
          {view === 'leads' && <>
          {/* Lista com card */}
          <div className="flex flex-col overflow-hidden rounded-2xl" 
            style={{ width: 340, flexShrink: 0, background: G.card, boxShadow: S.card }}>
            {/* Filtros */}
            <div className="p-3 space-y-2 flex-shrink-0" style={{ borderBottom: `1px solid ${G.border}` }}>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: G.cardHi, border: `1px solid ${G.border}` }}>
                <Search size={14} style={{ color: G.textMuted }} />
                <input value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: G.text }} />
              </div>
              <div className="flex gap-2">
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                  className="flex-1 text-xs px-2 py-2 rounded-lg outline-none transition-colors"
                  style={{ background: G.cardHi, border: `1px solid ${G.border}`, color: G.text }}>
                  <option value="">Estado</option>
                  {Object.entries(ESTADO_CONFIG).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                  className="flex-1 text-xs px-2 py-2 rounded-lg outline-none transition-colors"
                  style={{ background: G.cardHi, border: `1px solid ${G.border}`, color: G.text }}>
                  <option value="">Tipo</option>
                  {Object.entries(TIPO_CONFIG).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw size={20} className="animate-spin" style={{ color: G.textMuted }} />
                </div>
              ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <Mail size={32} style={{ color: G.border }} />
                  <p className="text-sm" style={{ color: G.textMuted }}>Nenhum lead encontrado</p>
                </div>
              ) : leads.map(lead => {
                const tc = tipoConf(lead.tipo);
                const ec = estadoConf(lead.estado);
                const Icon = tc.icon;
                const isNovo = lead.estado === 'novo';
                const isSel  = selected?.id === lead.id;
                return (
                  <button key={lead.id} onClick={() => abrirLead(lead)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-black/5"
                    style={{
                      background:    isSel ? `${G.mustard}15` : 'transparent',
                      borderBottom:  `1px solid ${G.border}`,
                    }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${tc.color}15` }}>
                      <Icon size={15} style={{ color: tc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate"
                          style={{ color: isNovo ? G.text : G.textSec }}>
                          {lead.de_nome || lead.de || '—'}
                        </span>
                        <span className="text-[10px] font-mono flex-shrink-0" style={{ color: G.textMuted }}>
                          {fmtHora(lead.recebido_em)}
                        </span>
                      </div>
                      <p className="text-xs truncate mt-1" style={{ color: isNovo ? G.textSec : G.textMuted }}>
                        {lead.assunto}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: `${tc.color}20`, color: tc.color }}>
                          {tc.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: `${ec.color}20`, color: ec.color }}>
                          {ec.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel de detalhes com card */}
          <div className="flex-1 overflow-hidden rounded-2xl" 
            style={{ background: G.card, boxShadow: S.card }}>
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div key={selected.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="h-full flex flex-col">

                  {/* Cabeçalho do email */}
                  <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${G.border}` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold truncate" style={{ color: G.text }}>
                          {selected.assunto}
                        </h2>
                        <p className="text-xs mt-2" style={{ color: G.textMuted }}>
                          <span style={{ color: G.textSec }}>{selected.de_nome || selected.de}</span>
                          {' '}&lt;{selected.de}&gt;
                        </p>
                        {selected.recebido_em && (
                          <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: G.textMuted }}>
                            <Clock size={10} />
                            {new Date(selected.recebido_em).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setRespModal(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
                          style={{ background: G.mustard, color: G.text, boxShadow: S.card }}>
                          <Reply size={12} /> Responder
                        </button>
                        <button onClick={() => arquivar(selected.id)}
                          className="p-2 rounded-xl transition-all hover:scale-105"
                          style={{ background: G.cardHi, border: `1px solid ${G.border}` }}
                          title="Arquivar">
                          <Archive size={14} style={{ color: G.textMuted }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                    {/* Resumo IRIS */}
                    {selected.resumo_ia && (
                      <div className="rounded-2xl p-4" style={{ background: `${G.mustard}12`, border: `1px solid ${G.mustard}40` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: G.mustard }}>
                            <Sparkles size={12} style={{ color: G.text }} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: G.text }}>
                            Resumo IRIS
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: G.textSec }}>{selected.resumo_ia}</p>
                      </div>
                    )}

                    {/* Dados extraídos */}
                    {selected.dados_extraidos && Object.keys(selected.dados_extraidos).length > 0 && (
                      <div className="rounded-2xl p-4" style={{ background: G.cardHi, border: `1px solid ${G.border}`, boxShadow: S.card }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: G.textMuted }}>
                          Dados Extraídos
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(selected.dados_extraidos as Record<string, string>).map(([k, v]) => v ? (
                            <div key={k}>
                              <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: G.textMuted }}>
                                {k.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs font-semibold mt-0.5" style={{ color: G.text }}>{v}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )}

                    {/* Cliente vinculado */}
                    {selected.cliente_nome && (
                      <div className="flex items-center gap-3 rounded-2xl p-4"
                        style={{ background: `${G.success}10`, border: `1px solid ${G.success}30` }}>
                        <Building2 size={18} style={{ color: G.success }} />
                        <div>
                          <p className="text-xs font-bold" style={{ color: G.text }}>
                            {selected.cliente_fantasia || selected.cliente_nome}
                          </p>
                          <p className="text-[10px]" style={{ color: G.textMuted }}>Cliente vinculado</p>
                        </div>
                      </div>
                    )}

                    {/* Corpo do email */}
                    <div className="rounded-2xl p-4" style={{ background: G.card, border: `1px solid ${G.border}`, boxShadow: S.card }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: G.textMuted }}>
                        Conteúdo
                      </p>
                      <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: G.textSec, fontFamily: 'inherit' }}>
                        {selected.corpo_preview || '(sem conteúdo disponível)'}
                      </pre>
                    </div>

                    {/* Respostas enviadas */}
                    {selected.respostas?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: G.textMuted }}>
                          <MessageSquareWarning size={12} />
                          Respostas Enviadas
                        </p>
                        {selected.respostas.map((r: any) => (
                          <div key={r.id} className="rounded-2xl p-4 mb-2"
                            style={{ background: `${G.blue}10`, border: `1px solid ${G.blue}25` }}>
                            <p className="text-[10px]" style={{ color: G.textMuted }}>
                              {new Date(r.enviado_em).toLocaleString('pt-BR')}
                            </p>
                            <pre className="text-xs whitespace-pre-wrap mt-2 leading-relaxed" style={{ color: G.textSec, fontFamily: 'inherit' }}>
                              {r.corpo}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: `${G.border}30` }}>
                    <Mail size={28} style={{ color: G.border }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: G.textMuted }}>
                    Selecione um lead
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </>}
        </div>
      </div>

      {/* Modal de resposta */}
      <AnimatePresence>
        {respModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(40, 55, 74, 0.5)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{ background: G.card, boxShadow: S.hover }}
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: `1px solid ${G.border}`, background: G.cardHi }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: G.mustard }}>
                    <Reply size={14} style={{ color: G.text }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: G.text }}>
                    Nova Resposta
                  </h3>
                </div>
                <button onClick={() => setRespModal(false)}
                  className="p-2 rounded-lg transition-colors hover:bg-black/10">
                  <X size={16} style={{ color: G.textMuted }} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs" style={{ color: G.textMuted }}>
                  <span style={{ color: G.text }}>Para:</span> 
                  {selected?.de_nome || ''} &lt;{selected?.de}&gt;
                </div>
                
                <textarea value={respTexto} onChange={e => setRespTexto(e.target.value)}
                  rows={10} placeholder="Digite sua resposta..."
                  className="w-full rounded-xl p-4 text-sm outline-none resize-none leading-relaxed"
                  style={{ background: G.bg, border: `1px solid ${G.border}`, color: G.text }} 
                  autoFocus />
                
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setRespModal(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:bg-black/5"
                    style={{ color: G.textMuted }}>
                    Cancelar
                  </button>
                  <button onClick={enviarResposta} disabled={enviando || !respTexto.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ background: G.mustard, color: G.text, boxShadow: S.card }}>
                    <Send size={12} />
                    {enviando ? 'Enviando...' : 'Enviar Resposta'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
