import React, { useState, useEffect } from 'react';
import { Mail, X, Send, Paperclip, Loader2, Users, FileText, AlertCircle, CheckCircle, Building2, User, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import OrderPdfReport from './OrderPdfReport';
import { generateOrderExcelData } from '@/shared/utils/exportOrderToExcel';
import G from '@/styles/theme.module.scss';
import { useAuthStore } from '@/shared/stores/useAuthStore';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

const COLORS = {
  primary: '#1E40AF',
  primaryLight: '#3B82F6',
  primaryDark: '#1E3A8A',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  border: '#E2E8F0',
  text: '#1E293B',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

interface SendEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any;
}

const SendEmailDialog: React.FC<SendEmailDialogProps> = ({ isOpen, onClose, orderData }) => {
  const authUser = useAuthStore(state => state.user);
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [attachExcel, setAttachExcel] = useState(false);
  const [recipients, setRecipients] = useState({
    cliente:   { enabled: true,  email: '' },
    industria: { enabled: true,  email: '' },
    escritorio:{ enabled: false, email: '' },
  });
  const [emailData, setEmailData] = useState({ assunto: '', anexos: '', texto: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [smtpInfo, setSmtpInfo] = useState({ host: '...', user: '...' });

  const isEligibleForIndustryEmail = ['P', 'A', 'F', 'G', 'B'].includes(orderData?.order?.ped_situacao);

  const token = localStorage.getItem('sm_token');
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      try {
        const userId = authUser?.id ?? 1;

        const [resParams, resCompany] = await Promise.all([
          fetch(`${API_BASE}/parametros/${userId}`, { headers: authHeaders }),
          fetch(`${API_BASE}/config/company`, { headers: authHeaders }),
        ]);
        const dataParams  = await resParams.json();
        const dataCompany = await resCompany.json();

        if (dataParams.success && dataParams.data) {
          const emailUser = dataParams.data.par_emailuser || dataParams.data.par_email || '';
          setSmtpInfo({ host: dataParams.data.par_emailserver || '...', user: emailUser });
          const officeEmail = dataParams.data.par_emailalternativo || dataParams.data.par_email || dataParams.data.par_emailuser || '';
          setRecipients(prev => ({
            ...prev,
            escritorio: { ...prev.escritorio, email: officeEmail, enabled: !!officeEmail },
          }));
        }
        if (dataCompany.success) setCompanyData(dataCompany.config || dataCompany.data);
      } catch (e) {
        console.error('[SendEmailDialog] fetchData error:', e);
      }
    };
    fetchData();
  }, [isOpen]);

  useEffect(() => {
    if (!orderData || !isOpen) return;
    setLogs([]);
    const order = orderData.order;
    const isEligible = ['P', 'A', 'F', 'G', 'B'].includes(order?.ped_situacao);
    const industryEmail = order?.for_email || order?.cli_emailcomprador || '';

    setRecipients(prev => ({
      ...prev,
      cliente:   { ...prev.cliente,   email: order?.cli_email || order?.cli_emailnfe || '' },
      industria: { enabled: !!industryEmail && isEligible, email: industryEmail },
    }));

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    const userName = authUser ? `${authUser.nome || ''} ${authUser.sobrenome || ''}`.trim() : 'USUÁRIO';
    const clientOrderNum = order?.ped_pedcli || order?.ped_pedindu || order?.ped_pedindustria || '';

    setEmailData({
      assunto: `Ref. pedido nº ${order?.ped_pedido}${clientOrderNum ? ` (Cli: ${clientOrderNum})` : ''} do cliente: ${order?.cli_nomred || order?.cli_nome}`,
      anexos:  `${order?.ped_pedido}-${(order?.cli_nomred || order?.cli_nome || 'CLIENTE').replace(/[/\\?%*:|"<>]/g, '-').trim()}.pdf`,
      texto:
        `Pedido nº...............: ${order?.ped_pedido}\n` +
        (clientOrderNum ? `Ped. Cliente nº.........: ${clientOrderNum}\n` : '') +
        `Data do lançamento......: ${dateStr}\n` +
        `Cliente.................: ${order?.cli_nome}\n` +
        `Cidade..................: ${order?.cli_cidade || ''} - ${order?.cli_uf || ''}\n\n` +
        `Enviado por.............: ${userName} ${dateStr} ${timeStr}\n\n` +
        `ATENÇÃO: Nossa numeração de pedido é unívoca, portanto caso receba mais de uma mensagem com o\n` +
        `mesmo número de pedido, favor desconsiderar as repetições.\n\n` +
        `Favor responder confirmando o recebimento desta mensagem, que obrigatoriamente deverá conter\n` +
        `um pedido em anexo.`,
    });
  }, [orderData, isOpen]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleSend = async () => {
    if (!orderData) { toast.error('Dados do pedido não carregados.'); return; }
    setLoading(true);
    setLogs([]);
    addLog('Iniciando processo de envio...');
    try {
      addLog('Gerando PDF em alta fidelidade...');
      const model = localStorage.getItem('printModel') || '1';
      const pdfBlob = await pdf(
        <OrderPdfReport model={model} order={orderData.order} items={orderData.items} companyData={companyData} />
      ).toBlob();
      addLog('PDF gerado com sucesso.');

      const finalAttachments: any[] = [];
      const pdfBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });
      finalAttachments.push({ filename: emailData.anexos, content: pdfBase64, contentType: 'application/pdf' });

      if (attachExcel) {
        addLog('Gerando Excel complementar...');
        const excelBuffer = await generateOrderExcelData(orderData.order, orderData.items);
        const excelBase64 = btoa(String.fromCharCode(...new Uint8Array(excelBuffer as unknown as ArrayBuffer)));
        finalAttachments.push({
          filename: `Pedido_${orderData.order.ped_pedido}.xlsx`,
          content: excelBase64,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        addLog('Excel incluído nos anexos.');
      }

      addLog('Conectando ao servidor SMTP...');
      const to: string[] = [];
      const cc: string[] = [];
      if (recipients.cliente.enabled   && recipients.cliente.email)    to.push(recipients.cliente.email);
      if (recipients.industria.enabled  && recipients.industria.email)  to.push(recipients.industria.email);
      if (recipients.escritorio.enabled && recipients.escritorio.email) cc.push(recipients.escritorio.email);

      if (to.length === 0 && cc.length === 0) throw new Error('Selecione ao menos um destinatário válido.');

      const userId = authUser?.id ?? 1;

      addLog('Enviando e-mail...');
      const response = await fetch(`${API_BASE}/email/send-order`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ recipients: to, cc, subject: emailData.assunto, text: emailData.texto, userId, attachments: finalAttachments }),
      });
      const result = await response.json();
      if (result.success) {
        addLog('✅ E-mail enviado com sucesso!');
        toast.success('E-mail enviado com sucesso!');
        setTimeout(() => onClose(), 1500);
      } else {
        throw new Error(result.message || 'Falha ao enviar e-mail');
      }
    } catch (error: any) {
      addLog(`❌ Erro: ${error.message}`);
      toast.error(`Erro ao enviar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const destRow = (key: 'cliente' | 'industria' | 'escritorio', label: string, icon: React.ReactNode, disabled?: boolean) => (
    <div
      key={key}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: 16,
        borderRadius: 12, border: `1px solid ${recipients[key].enabled ? COLORS.primaryLight : COLORS.border}`,
        background: recipients[key].enabled ? `${COLORS.primary}08` : COLORS.surface,
        transition: 'all 0.2s ease',
        boxShadow: recipients[key].enabled ? '0 2px 8px rgba(30,64,175,0.08)' : 'none',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: recipients[key].enabled ? `${COLORS.primary}15` : `${COLORS.textMuted}15`,
        color: recipients[key].enabled ? COLORS.primary : COLORS.textMuted,
        transition: 'all 0.2s',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <input
            type="checkbox"
            checked={recipients[key].enabled}
            disabled={disabled}
            onChange={(e) => setRecipients(p => ({ ...p, [key]: { ...p[key], enabled: e.target.checked } }))}
            style={{ width: 18, height: 18, cursor: disabled ? 'not-allowed' : 'pointer', accentColor: COLORS.primary }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: recipients[key].enabled ? COLORS.text : COLORS.textMuted }}>
            {label}
          </span>
        </label>
        <input
          type="email"
          value={recipients[key].email}
          disabled={disabled || !recipients[key].enabled}
          onChange={(e) => setRecipients(p => ({ ...p, [key]: { ...p[key], email: e.target.value } }))}
          placeholder="não configurado..."
          style={{
            flex: 1, border: 'none', borderBottom: `1.5px solid ${recipients[key].enabled ? COLORS.primary : COLORS.border}`,
            outline: 'none', fontSize: 13, fontWeight: 500, padding: '4px 0', background: 'transparent',
            color: recipients[key].enabled ? COLORS.primaryDark : COLORS.textMuted,
            transition: 'border-color 0.2s',
          }}
        />
      </div>
    </div>
  );

  const StepBadge = ({ num, label, active }: { num: number; label: string; active: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? COLORS.primary : `${COLORS.textMuted}20`,
        color: active ? '#fff' : COLORS.textMuted, fontSize: 11, fontWeight: 700,
      }}>
        {num}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: active ? COLORS.text : COLORS.textMuted }}>{label}</span>
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#F8FAFC', borderRadius: 32, width: 900, maxWidth: '95vw', maxHeight: '95vh', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', padding: '24px 28px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '30px 30px' }} />
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%', filter: 'blur(30px)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
            <div style={{ padding: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)' }}>
              <Mail style={{ width: 20, height: 20, color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>Envio de Pedido</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: 'rgba(219,234,254,0.9)', fontWeight: 500 }}>Pedido #{orderData?.order?.ped_pedido}</span>
                <span style={{ width: 4, height: 4, background: 'rgba(147,197,253,0.5)', borderRadius: '50%' }} />
                <span style={{ fontSize: 13, color: 'rgba(219,234,254,0.9)', fontWeight: 500 }}>{orderData?.order?.cli_nomred}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left pane */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>

              {/* Destinatários */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Users style={{ width: 16, height: 16, color: '#2563EB' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#64748B' }}>Destinatários</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {destRow('cliente', 'Cliente', <User size={18} />)}
                  {destRow('industria', 'Indústria', <Building2 size={18} />, !isEligibleForIndustryEmail)}
                  {destRow('escritorio', 'Escritório', <Building2 size={18} />)}
                </div>
              </div>

              {/* Assunto */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <FileText style={{ width: 16, height: 16, color: '#2563EB' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#64748B' }}>Assunto do e-mail</span>
                </div>
                <input
                  value={emailData.assunto}
                  onChange={(e) => setEmailData(p => ({ ...p, assunto: e.target.value }))}
                  style={{
                    width: '100%', height: 48, border: '1px solid #E2E8F0', borderRadius: 12,
                    padding: '0 16px', fontSize: 14, fontWeight: 600, color: '#1E293B',
                    background: 'rgba(248,250,252,0.5)', outline: 'none', boxSizing: 'border-box',
                  }}
                  placeholder="Digite o assunto do e-mail..."
                />
              </div>

              {/* Anexos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Paperclip style={{ width: 16, height: 16, color: '#2563EB' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#64748B' }}>Anexos de Envio</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px', height: 44, background: '#FFFBEB', border: '2px solid #FDE68A', borderRadius: 999, fontSize: 12, fontWeight: 800, color: '#92400E' }}>
                    <Paperclip style={{ width: 18, height: 18, color: '#D97706' }} /> PDF
                  </div>
                  <div
                    onClick={() => setAttachExcel(!attachExcel)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px', height: 44,
                      borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s',
                      background: attachExcel ? '#2563EB' : '#FFFBEB',
                      border: attachExcel ? '2px solid #1D4ED8' : '2px solid #FDE68A',
                      color: attachExcel ? '#fff' : '#92400E',
                    }}
                  >
                    <Paperclip style={{ width: 18, height: 18 }} /> EXCEL
                  </div>
                </div>
              </div>

              {/* Corpo */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 160, background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '10px 20px', background: 'rgba(241,245,249,0.5)', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#475569' }}>Corpo do E-mail</span>
                  <FileText style={{ width: 16, height: 16, color: '#94A3B8' }} />
                </div>
                <textarea
                  value={emailData.texto}
                  onChange={(e) => setEmailData(p => ({ ...p, texto: e.target.value }))}
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none',
                    background: 'transparent', fontFamily: 'monospace', fontSize: 12,
                    lineHeight: 1.6, padding: 20, color: '#334155', minHeight: 160,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right pane — Monitor */}
          <div style={{ width: 280, background: '#0F172A', padding: 28, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1E293B' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 10, background: 'rgba(59,130,246,0.1)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Clock style={{ width: 18, height: 18, color: '#60A5FA' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 3 }}>Monitor</span>
              </div>
              {loading && <Loader2 style={{ width: 18, height: 18, color: '#60A5FA', animation: 'spin 1s linear infinite' }} />}
            </div>

            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', padding: 16, overflowY: 'auto', minHeight: 0 }}>
              {logs.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, opacity: 0.5 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px dashed #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send style={{ width: 20, height: 20, color: '#334155' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569', fontWeight: 500 }}>Aguardando comando...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {logs.map((log, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{
                        marginTop: 6, width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: log.includes('✅') ? '#10B981' : log.includes('❌') ? '#F43F5E' : '#3B82F6',
                        boxShadow: log.includes('✅') ? '0 0 8px rgba(16,185,129,0.5)' : log.includes('❌') ? '0 0 8px rgba(244,63,94,0.5)' : '0 0 8px rgba(59,130,246,0.5)',
                      }} />
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#CBD5E1', lineHeight: 1.5 }}>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SMTP Info */}
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 3 }}>Servidor SMTP</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: smtpInfo.host !== '...' ? '#10B981' : '#F43F5E' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                      {smtpInfo.host !== '...' ? 'Configurado' : 'Pendente'}
                    </span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 11, color: '#EFF6FF', fontFamily: 'monospace', fontWeight: 700, wordBreak: 'break-all' }}>{smtpInfo.host}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 3, display: 'block', marginBottom: 6 }}>E-mail de Envio</span>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 11, color: '#EFF6FF', fontFamily: 'monospace', fontWeight: 700, wordBreak: 'break-all' }}>{smtpInfo.user}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ height: 48, padding: '0 28px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#64748B' }}
          >
            CANCELAR
          </button>
          <button
            onClick={handleSend}
            disabled={loading}
            style={{
              height: 48, padding: '0 36px', border: 'none', borderRadius: 16, cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#93C5FD' : '#1E40AF', color: '#fff', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 20px rgba(30,64,175,0.25)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 18, height: 18 }} />}
            ENVIAR E-MAIL AGORA
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SendEmailDialog;
