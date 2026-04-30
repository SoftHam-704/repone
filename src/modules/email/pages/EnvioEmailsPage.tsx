import { useState, useEffect } from 'react';
import {
  Mail, Users, Target, Cake, Building2, Search, Send,
  X, CheckCircle2, Loader2, Paperclip, FileText,
  CheckSquare, Square, Zap, Eye, EyeOff, UserCheck,
} from 'lucide-react';
import { G } from '@/shared/components/layout/CadastroShell';
import { api } from '@/shared/lib/api';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type FilterTab = 'composicao' | 'contatos' | 'atuacao' | 'aniversariantes' | 'industria' | 'prospeccao';

interface Cliente {
  cli_codigo: number;
  cli_nome: string;
  cli_fantasia?: string;
  cli_email: string;
  cli_cidade?: string;
  cli_uf?: string;
}

interface AtuacaoOption { atu_codigo: number; atu_nome: string; }
interface IndustriaOption { ind_codigo: number; ind_nome: string; }

interface AttachmentFile {
  filename: string;
  content: string;  // base64
  contentType: string;
  name: string;     // display name
  size: number;
}

interface SendProgress {
  sending: boolean;
  current: number;
  total: number;
  logs: string[];
}

// ─── DESIGN ──────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  height: 36, borderRadius: 8, border: `1px solid ${G.border}`,
  background: G.card, color: G.text, fontSize: 13, padding: '0 10px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: G.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};

const card: React.CSSProperties = {
  background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden',
};

const cardHead: React.CSSProperties = {
  padding: '12px 16px', borderBottom: `1px solid ${G.border}`,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: G.cardHi,
};

const TABS: { id: FilterTab; label: string; icon: any }[] = [
  { id: 'composicao',    label: 'Composição',      icon: Mail       },
  { id: 'contatos',      label: 'Destinatários',   icon: Users      },
  { id: 'atuacao',       label: 'Área Atuação',    icon: Target     },
  { id: 'aniversariantes', label: 'Aniversários',  icon: Cake       },
  { id: 'industria',     label: 'Por Indústria',   icon: Building2  },
  { id: 'prospeccao',    label: 'Prospecção',       icon: Search     },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<AttachmentFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        filename: file.name,
        name: file.name,
        content: result.split(',')[1],
        contentType: file.type,
        size: file.size,
      });
    };
    reader.onerror = reject;
  });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function EnvioEmailsPage() {
  const [activeTab, setActiveTab]       = useState<FilterTab>('composicao');

  // Composição
  const [subject, setSubject]           = useState('');
  const [message, setMessage]           = useState('');
  const [attachments, setAttachments]   = useState<AttachmentFile[]>([]);
  const [isMassSend, setIsMassSend]     = useState(false);
  const [confirmedRecipients, setConfirmedRecipients] = useState<Cliente[]>([]);

  // Filtros
  const [clients, setClients]           = useState<Cliente[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery]   = useState('');

  // Área de Atuação
  const [atuacaoOptions, setAtuacaoOptions] = useState<AtuacaoOption[]>([]);
  const [selectedAtuacao, setSelectedAtuacao] = useState<number[]>([]);
  const [atuacaoSearch, setAtuacaoSearch] = useState('');

  // Aniversários
  const todayISO = new Date().toISOString().split('T')[0];
  const firstOfMonth = todayISO.substring(0, 8) + '01';
  const lastOfMonth  = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  })();
  const [birthdayRange, setBirthdayRange] = useState({ start: firstOfMonth, end: lastOfMonth });

  // Indústria
  const [industriaOptions, setIndustriaOptions] = useState<IndustriaOption[]>([]);
  const [selectedIndustria, setSelectedIndustria] = useState('');

  // Envio
  const [sendProgress, setSendProgress] = useState<SendProgress>({ sending: false, current: 0, total: 0, logs: [] });

  // ─── Load aux data ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/email/filter-options/atuacao').then(r => setAtuacaoOptions(r.data.data || [])).catch(() => {}),
      api.get('/email/filter-options/industrias').then(r => setIndustriaOptions(r.data.data || [])).catch(() => {}),
    ]);
  }, []);

  // ─── Fetch filtered clients ───────────────────────────────────────────────
  const fetchClients = async () => {
    setLoadingClients(true);
    setClients([]);
    setSelectedClients(new Set());
    try {
      const params = new URLSearchParams({ filterType: activeTab });
      if (['contatos', 'industria', 'prospeccao'].includes(activeTab) && searchQuery) params.set('search', searchQuery);
      if (activeTab === 'atuacao' && selectedAtuacao.length) params.set('atuacao_ids', selectedAtuacao.join(','));
      if (activeTab === 'aniversariantes') {
        if (birthdayRange.start) params.set('dt_start', birthdayRange.start);
        if (birthdayRange.end)   params.set('dt_end',   birthdayRange.end);
      }
      if ((activeTab === 'industria' || activeTab === 'prospeccao') && selectedIndustria) {
        params.set('industria_id', selectedIndustria);
      }
      const res = await api.get(`/email/filter-clients?${params.toString()}`);
      setClients(res.data.data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingClients(false);
    }
  };

  // ─── Selection helpers ────────────────────────────────────────────────────
  const toggleClient = (id: number) => {
    const next = new Set(selectedClients);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedClients(next);
  };

  const toggleAll = () => {
    setSelectedClients(
      selectedClients.size === clients.length
        ? new Set()
        : new Set(clients.map(c => c.cli_codigo))
    );
  };

  const confirmSelection = () => {
    const sel = clients.filter(c => selectedClients.has(c.cli_codigo));
    if (!sel.length) return;
    setConfirmedRecipients(sel);
    setActiveTab('composicao');
  };

  // ─── Attachments ─────────────────────────────────────────────────────────
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const processed = await Promise.all(files.map(fileToBase64));
    setAttachments(prev => [...prev, ...processed]);
    e.target.value = '';
  };

  // ─── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!confirmedRecipients.length) return;
    if (!subject.trim() || !message.trim()) return;

    const total = confirmedRecipients.length;
    setSendProgress({ sending: true, current: 0, total, logs: ['Preparando envio...'] });

    try {
      const batchSize = isMassSend ? 10 : total;

      for (let i = 0; i < confirmedRecipients.length; i += batchSize) {
        const batch    = confirmedRecipients.slice(i, i + batchSize);
        const toList   = batch[0].cli_email ? [batch[0].cli_email] : [];
        const bccList  = batch.slice(1).map(c => c.cli_email).filter(Boolean);
        const batchNum = Math.floor(i / batchSize) + 1;

        setSendProgress(prev => ({
          ...prev,
          logs: [...prev.logs, `Enviando lote ${batchNum} (${batch.length} destinatários)...`],
        }));

        const res = await api.post('/email/send-bulk', {
          recipients: toList,
          bccRecipients: bccList,
          subject: subject.trim(),
          message: message.trim(),
          attachments,
          isMass: isMassSend,
        });

        const ok = res.data.success;
        setSendProgress(prev => ({
          ...prev,
          current: Math.min(prev.current + batch.length, total),
          logs: [...prev.logs, `${ok ? '✅' : '❌'} Lote ${batchNum}: ${res.data.message}`],
        }));

        if (isMassSend && i + batchSize < confirmedRecipients.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      setSendProgress(prev => ({ ...prev, logs: [...prev.logs, '✅ Processo de envio finalizado!'] }));
    } catch (e: any) {
      setSendProgress(prev => ({ ...prev, logs: [...prev.logs, `❌ Erro: ${e.response?.data?.message || e.message}`] }));
    } finally {
      setSendProgress(prev => ({ ...prev, sending: false }));
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: G.bg }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: `1px solid ${G.border}`,
        background: G.card, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: '#DBEAFE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Mail size={16} color="#2563EB" />
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: 15, color: G.text, lineHeight: 1.2 }}>Central de E-mails</p>
          <p style={{ fontSize: 11, color: G.textMuted, marginTop: 1 }}>Marketing e Comunicação Direta</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>SMTP Ativo</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        padding: '10px 24px', borderBottom: `1px solid ${G.border}`,
        display: 'flex', gap: 4, background: G.bg, overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9, border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: active ? G.text : 'transparent',
                color: active ? '#fff' : G.textSec,
              }}
            >
              <Icon size={13} />
              {tab.label}
              {tab.id !== 'composicao' && active && confirmedRecipients.length > 0 && (
                <span style={{
                  background: '#10B981', color: '#fff',
                  fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10,
                }}>
                  {confirmedRecipients.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {activeTab === 'composicao'
          ? <ComposicaoTab
              subject={subject} setSubject={setSubject}
              message={message} setMessage={setMessage}
              attachments={attachments} setAttachments={setAttachments}
              handleFiles={handleFiles}
              isMassSend={isMassSend} setIsMassSend={setIsMassSend}
              confirmedRecipients={confirmedRecipients}
              setConfirmedRecipients={setConfirmedRecipients}
              sendProgress={sendProgress}
              handleSend={handleSend}
            />
          : <FilterTab
              activeTab={activeTab}
              clients={clients}
              loadingClients={loadingClients}
              selectedClients={selectedClients}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              atuacaoOptions={atuacaoOptions}
              selectedAtuacao={selectedAtuacao} setSelectedAtuacao={setSelectedAtuacao}
              atuacaoSearch={atuacaoSearch} setAtuacaoSearch={setAtuacaoSearch}
              birthdayRange={birthdayRange} setBirthdayRange={setBirthdayRange}
              industriaOptions={industriaOptions}
              selectedIndustria={selectedIndustria} setSelectedIndustria={setSelectedIndustria}
              fetchClients={fetchClients}
              toggleClient={toggleClient}
              toggleAll={toggleAll}
              confirmSelection={confirmSelection}
            />
        }
      </div>
    </div>
  );
}

// ─── ABA COMPOSIÇÃO ───────────────────────────────────────────────────────────

interface ComposicaoProps {
  subject: string; setSubject: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  attachments: AttachmentFile[]; setAttachments: (v: AttachmentFile[]) => void;
  handleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isMassSend: boolean; setIsMassSend: (v: boolean) => void;
  confirmedRecipients: Cliente[]; setConfirmedRecipients: (v: Cliente[]) => void;
  sendProgress: SendProgress;
  handleSend: () => void;
}

function ComposicaoTab({
  subject, setSubject, message, setMessage,
  attachments, setAttachments, handleFiles,
  isMassSend, setIsMassSend,
  confirmedRecipients, setConfirmedRecipients,
  sendProgress, handleSend,
}: ComposicaoProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>

      {/* I — Destinatários */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={14} color="#10B981" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>I — Destinatários Confirmados</span>
          </div>
          {confirmedRecipients.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 700, background: '#DBEAFE', padding: '2px 8px', borderRadius: 8 }}>
                <Eye size={10} style={{ display: 'inline', marginRight: 3 }} />
                Para: {confirmedRecipients[0]?.cli_email}
              </span>
              {confirmedRecipients.length > 1 && (
                <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700, background: '#FEF3C7', padding: '2px 8px', borderRadius: 8 }}>
                  <EyeOff size={10} style={{ display: 'inline', marginRight: 3 }} />
                  BCC: {confirmedRecipients.length - 1} em cópia oculta
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ padding: 16 }}>
          {confirmedRecipients.length === 0 ? (
            <div style={{ textAlign: 'center', color: G.textMuted, padding: '20px 0', fontSize: 13 }}>
              <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p>Nenhum destinatário selecionado</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Use as abas acima para filtrar e selecionar os clientes</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
              {confirmedRecipients.map((client, i) => (
                <div key={client.cli_codigo} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                  background: i === 0 ? '#D1FAE5' : G.bg,
                  color: i === 0 ? '#065F46' : G.textSec,
                  border: `1px solid ${i === 0 ? '#A7F3D0' : G.border}`,
                }}>
                  {i === 0 ? <Eye size={10} /> : <EyeOff size={10} style={{ opacity: 0.5 }} />}
                  <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.cli_nome}
                  </span>
                  <button
                    onClick={() => setConfirmedRecipients(confirmedRecipients.filter(c => c.cli_codigo !== client.cli_codigo))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.textMuted, lineHeight: 1 }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* II — Conteúdo */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={14} color="#2563EB" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>II — Conteúdo do E-mail</span>
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={lbl}>Assunto</span>
            <input style={inp} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Digite o assunto do e-mail..." />
          </div>
          <div>
            <span style={lbl}>Mensagem</span>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              placeholder="Escreva o conteúdo do e-mail aqui..."
              style={{
                ...inp, height: 'auto', padding: '8px 10px',
                resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      </div>

      {/* III — Anexos */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Paperclip size={14} color="#D97706" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>III — Anexos</span>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <label style={{
            display: 'block', border: `2px dashed ${G.border}`, borderRadius: 10,
            padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
            background: G.bg, position: 'relative',
          }}>
            <input type="file" multiple onChange={handleFiles}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
            <Paperclip size={22} style={{ margin: '0 auto 6px', color: G.textMuted }} />
            <p style={{ fontSize: 12, color: G.textMuted }}>Clique ou arraste arquivos aqui</p>
          </label>
          {attachments.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {attachments.map((att, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: 8,
                  background: '#DBEAFE', border: '1px solid #BFDBFE',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <FileText size={14} color="#2563EB" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#6B7280', flexShrink: 0 }}>{fmtSize(att.size)}</span>
                  </div>
                  <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* IV — Controle de Envio */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="#EF4444" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>IV — Controle de Envio</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={isMassSend} onChange={e => setIsMassSend(e.target.checked)} />
            <span style={{ fontSize: 11, fontWeight: 700, color: G.textSec }}>
              Envio em massa <span style={{ color: '#EF4444', fontWeight: 400 }}>(lotes de 10)</span>
            </span>
          </label>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Console */}
          <div style={{
            height: 120, background: '#0A1120', borderRadius: 10, padding: '10px 14px',
            fontFamily: 'monospace', fontSize: 11, color: '#6EE7B7',
            overflowY: 'auto', border: '1px solid #1E293B',
          }}>
            {sendProgress.logs.length === 0
              ? <span style={{ color: '#475569', fontStyle: 'italic' }}>&gt; Aguardando início do processo...</span>
              : sendProgress.logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 3 }}>&gt; {log}</div>
              ))
            }
            {sendProgress.sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processando ({sendProgress.current}/{sendProgress.total})</span>
              </div>
            )}
          </div>

          {/* Botão enviar */}
          <button
            onClick={handleSend}
            disabled={sendProgress.sending || confirmedRecipients.length === 0 || !subject.trim() || !message.trim()}
            style={{
              height: 44, borderRadius: 10, border: 'none',
              background: (sendProgress.sending || confirmedRecipients.length === 0 || !subject.trim() || !message.trim())
                ? G.border : '#10B981',
              color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {sendProgress.sending
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
              : <><Send size={15} /> Iniciar Envio ({confirmedRecipients.length} destinatário{confirmedRecipients.length !== 1 ? 's' : ''})</>
            }
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── ABA DE FILTROS ───────────────────────────────────────────────────────────

interface FilterTabProps {
  activeTab: FilterTab;
  clients: Cliente[];
  loadingClients: boolean;
  selectedClients: Set<number>;
  searchQuery: string; setSearchQuery: (v: string) => void;
  atuacaoOptions: AtuacaoOption[];
  selectedAtuacao: number[]; setSelectedAtuacao: (v: number[]) => void;
  atuacaoSearch: string; setAtuacaoSearch: (v: string) => void;
  birthdayRange: { start: string; end: string };
  setBirthdayRange: (v: { start: string; end: string }) => void;
  industriaOptions: IndustriaOption[];
  selectedIndustria: string; setSelectedIndustria: (v: string) => void;
  fetchClients: () => void;
  toggleClient: (id: number) => void;
  toggleAll: () => void;
  confirmSelection: () => void;
}

function FilterTab({
  activeTab, clients, loadingClients, selectedClients,
  searchQuery, setSearchQuery,
  atuacaoOptions, selectedAtuacao, setSelectedAtuacao, atuacaoSearch, setAtuacaoSearch,
  birthdayRange, setBirthdayRange,
  industriaOptions, selectedIndustria, setSelectedIndustria,
  fetchClients, toggleClient, toggleAll, confirmSelection,
}: FilterTabProps) {

  const renderFilters = () => {
    if (activeTab === 'contatos') {
      return (
        <div>
          <span style={lbl}>Pesquisar Contatos</span>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
            <input
              style={{ ...inp, paddingLeft: 30 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchClients()}
              placeholder="Busque por nome, e-mail, cidade..."
            />
          </div>
        </div>
      );
    }

    if (activeTab === 'atuacao') {
      return (
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={lbl}>Áreas de Atuação (selecione múltiplas)</span>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
              <input
                style={{ ...inp, width: 180, paddingLeft: 26, height: 28, fontSize: 12 }}
                value={atuacaoSearch} onChange={e => setAtuacaoSearch(e.target.value)}
                placeholder="Filtrar áreas..."
              />
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            maxHeight: 200, overflowY: 'auto', padding: 4,
            background: G.bg, borderRadius: 8, border: `1px solid ${G.border}`,
          }}>
            {atuacaoOptions
              .filter(o => o.atu_nome.toLowerCase().includes(atuacaoSearch.toLowerCase()))
              .map(opt => {
                const sel = selectedAtuacao.includes(opt.atu_codigo);
                return (
                  <button
                    key={opt.atu_codigo}
                    onClick={() => setSelectedAtuacao(
                      sel ? selectedAtuacao.filter(id => id !== opt.atu_codigo) : [...selectedAtuacao, opt.atu_codigo]
                    )}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', textAlign: 'left', border: 'none',
                      background: sel ? '#2563EB' : G.card, color: sel ? '#fff' : G.textSec,
                    }}
                  >
                    {sel ? <CheckSquare size={12} /> : <Square size={12} style={{ opacity: 0.4 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.atu_nome}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      );
    }

    if (activeTab === 'aniversariantes') {
      return (
        <div style={{ display: 'flex', gap: 12 }}>
          <div>
            <span style={lbl}>Data Início</span>
            <input type="date" style={{ ...inp, width: 160 }}
              value={birthdayRange.start} onChange={e => setBirthdayRange({ ...birthdayRange, start: e.target.value })} />
          </div>
          <div>
            <span style={lbl}>Data Fim</span>
            <input type="date" style={{ ...inp, width: 160 }}
              value={birthdayRange.end} onChange={e => setBirthdayRange({ ...birthdayRange, end: e.target.value })} />
          </div>
        </div>
      );
    }

    if (activeTab === 'industria' || activeTab === 'prospeccao') {
      return (
        <>
          <div style={{ flex: '0 0 240px' }}>
            <span style={lbl}>Indústria de Referência</span>
            <select
              style={{ ...inp, height: 36 }}
              value={selectedIndustria}
              onChange={e => setSelectedIndustria(e.target.value)}
            >
              <option value="">Selecione uma indústria...</option>
              {industriaOptions.map(ind => (
                <option key={ind.ind_codigo} value={String(ind.ind_codigo)}>{ind.ind_nome}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <span style={lbl}>Filtrar por nome (opcional)</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.textMuted }} />
              <input
                style={{ ...inp, paddingLeft: 30 }}
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchClients()}
                placeholder="Busque cliente..."
              />
            </div>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900, margin: '0 auto' }}>

      {/* Filtro */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={14} color="#2563EB" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>
              I — {activeTab === 'contatos' && 'Buscar Destinatários'}
              {activeTab === 'atuacao' && 'Filtrar por Área de Atuação'}
              {activeTab === 'aniversariantes' && 'Filtrar por Aniversário'}
              {activeTab === 'industria' && 'Filtrar por Indústria'}
              {activeTab === 'prospeccao' && 'Filtrar por Prospecção'}
            </span>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {renderFilters()}
            <button
              onClick={fetchClients}
              disabled={loadingClients}
              style={{
                height: 36, padding: '0 20px', borderRadius: 8, border: 'none',
                background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 12,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              }}
            >
              {loadingClients ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={14} color="#2563EB" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>II — Resultados encontrados</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={toggleAll}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                border: `1px solid ${G.border}`, background: G.card, color: G.textSec, cursor: 'pointer',
              }}
            >
              {selectedClients.size === clients.length && clients.length > 0
                ? <CheckSquare size={13} color="#2563EB" />
                : <Square size={13} />
              }
              Marcar Todos
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>
              {selectedClients.size} selecionados
            </span>
            <span style={{ fontSize: 11, color: G.textMuted }}>Total: {clients.length}</span>
          </div>
        </div>

        {/* Table */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 2fr 1fr',
            background: G.cardHi, borderBottom: `1px solid ${G.border}`,
            padding: '8px 16px', position: 'sticky', top: 0, zIndex: 1,
          }}>
            {['', 'Nome / Razão Social', 'E-mail', 'Cidade/UF'].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 800, color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {loadingClients ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10, color: G.textMuted }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#2563EB' }} />
              <span style={{ fontSize: 13 }}>Consultando base de dados...</span>
            </div>
          ) : clients.length === 0 ? (
            <div style={{ textAlign: 'center', color: G.textMuted, padding: '40px 0', fontSize: 13 }}>
              <Target size={36} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p>Use os filtros acima para listar clientes</p>
            </div>
          ) : (
            clients.map(client => {
              const sel = selectedClients.has(client.cli_codigo);
              return (
                <div
                  key={client.cli_codigo}
                  onClick={() => toggleClient(client.cli_codigo)}
                  style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 2fr 1fr',
                    padding: '8px 16px', borderBottom: `1px solid ${G.border}`,
                    cursor: 'pointer', alignItems: 'center',
                    background: sel ? '#EFF6FF' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {sel ? <CheckSquare size={15} color="#2563EB" /> : <Square size={15} style={{ color: G.border }} />}
                  </div>
                  <div style={{ overflow: 'hidden', paddingRight: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.cli_nome}
                    </p>
                    {client.cli_fantasia && (
                      <p style={{ fontSize: 11, color: G.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {client.cli_fantasia}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    <Mail size={11} style={{ color: G.textMuted, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: client.cli_email ? G.textSec : '#EF4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.cli_email || 'SEM E-MAIL'}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: G.text }}>{client.cli_cidade}</p>
                    <p style={{ fontSize: 11, color: G.textMuted }}>{client.cli_uf}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Confirm */}
        {clients.length > 0 && (
          <div style={{
            padding: '12px 16px', borderTop: `1px solid ${G.border}`,
            background: G.cardHi, display: 'flex', justifyContent: 'flex-end',
          }}>
            <button
              onClick={confirmSelection}
              disabled={selectedClients.size === 0}
              style={{
                height: 38, padding: '0 20px', borderRadius: 9, border: 'none',
                background: selectedClients.size ? '#10B981' : G.border,
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              <CheckCircle2 size={14} />
              Confirmar {selectedClients.size} selecionados e ir para Composição
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
