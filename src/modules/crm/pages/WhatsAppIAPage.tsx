import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare, RefreshCcw, QrCode, ShieldCheck,
  AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff,
  Smartphone, Bot, Info, Zap, Clock, Users, BarChart3,
  BrainCircuit, ChevronDown,
} from 'lucide-react'
import { api } from '@/shared/lib/api'

interface Instance {
  instance: { instanceName: string; status: string }
}

type PageStatus = 'CHECKING' | 'DISCONNECTED' | 'CONNECTED' | 'QR_READY'

// ─── Seletor de instâncias ────────────────────────────────────────────────────
function InstanceSelector({
  instances, selected, onChange,
}: {
  instances: Instance[]
  selected: string | null
  onChange: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (instances.length <= 1) return null

  const cur = instances.find(i => i.instance?.instanceName === selected)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:border-emerald-300 transition-all shadow-sm"
      >
        <MessageSquare size={14} className="text-emerald-500" />
        {cur?.instance?.instanceName ?? 'Selecionar instância'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden"
          >
            {instances.map(inst => {
              const name   = inst.instance?.instanceName
              const status = inst.instance?.status
              const ok     = status === 'open' || status === 'connected'
              return (
                <button
                  key={name}
                  onClick={() => { onChange(name); setOpen(false) }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${selected === name ? 'bg-emerald-50/50' : ''}`}
                >
                  <span className="text-xs font-bold text-slate-700">{name}</span>
                  <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </button>
              )
            })}
          </motion.div>
        )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppIAPage() {
  const [instances,  setInstances]  = useState<Instance[]>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [status,     setStatus]     = useState<PageStatus>('CHECKING')
  const [qrCode,     setQrCode]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

  const loadInstances = () => {
    setErrorMsg(null)
    api.get('/crm/whatsapp/instances')
      .then(r => {
        if (r.data.success) {
          const list: Instance[] = r.data.data ?? []
          setInstances(list)
          setSelected(prev => {
            if (prev && list.find(i => i.instance?.instanceName === prev)) return prev
            const open = list.find(i => i.instance?.status === 'open' || i.instance?.status === 'connected')
            return (open ?? list[0])?.instance?.instanceName ?? null
          })
        }
      })
      .catch(() => setErrorMsg('Não foi possível conectar à Evolution API. Verifique a configuração.'))
  }

  useEffect(() => {
    if (!selected) { setStatus('DISCONNECTED'); return }
    const inst = instances.find(i => i.instance?.instanceName === selected)
    if (!inst) return
    const s = inst.instance?.status
    if (s === 'open' || s === 'connected') {
      setStatus('CONNECTED')
      setQrCode(null)
    } else {
      // Não apaga QR se já está mostrando — loadInstances pode chegar tarde
      setStatus(prev => prev === 'QR_READY' ? 'QR_READY' : 'DISCONNECTED')
    }
  }, [selected, instances])

  const handleConnect = () => {
    setErrorMsg(null)
    setLoading(true)
    setStatus('CHECKING')
    setQrCode(null)

    // Usa instância selecionada ou solicita ao backend que use a do tenant
    const endpoint = selected
      ? `/crm/whatsapp/connect/${selected}`
      : `/crm/whatsapp/connect-auto`

    api.get(endpoint)
      .then(r => {
        if (r.data.status === 'CONNECTED') {
          setStatus('CONNECTED')
          setQrCode(null)
        } else if (r.data.status === 'QR_CODE' && r.data.qrcode) {
          setStatus('QR_READY')
          setQrCode(r.data.qrcode)
        } else {
          setStatus('DISCONNECTED')
          setErrorMsg(r.data.message || 'QR não gerado. Aguarde alguns segundos e tente novamente.')
        }
      })
      .catch((e: any) => {
        setStatus('DISCONNECTED')
        const msg = e?.response?.data?.message || e?.message || 'Erro de conexão com a Evolution API.'
        setErrorMsg(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadInstances() }, [])

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden font-sans relative">
      {/* ── Ambient blobs ──────────────────────────────────────────────────── */}
      <div className="absolute top-[-150px] right-[-150px] w-[500px] h-[500px] bg-emerald-400/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-blue-400/5 blur-[120px] rounded-full pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-xl h-[85px] px-8 flex items-center justify-between shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative z-20 border-b border-slate-100">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-slate-900 text-2xl font-black tracking-tighter flex items-center gap-2">
              WhatsApp{' '}
              <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                Nexus IA
              </span>
            </h1>
            <p className="text-slate-400 text-[9px] font-black flex items-center gap-2 uppercase tracking-[0.3em] mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              SalesMasters Smart Automation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <InstanceSelector instances={instances} selected={selected} onChange={setSelected} />

          {selected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-5 bg-emerald-50/50 border border-emerald-100 p-2 pr-5 rounded-[24px] backdrop-blur-md"
            >
              <div className="bg-white text-emerald-600 px-4 py-2.5 rounded-[20px] flex flex-col justify-center shadow-sm border border-emerald-100/50">
                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Instância</p>
                <p className="text-[11px] font-black tracking-tight truncate max-w-[150px]">{selected}</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    {status === 'CONNECTED' ? 'Ativo' : 'Pausado'}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5 tracking-tighter italic">Evolution API v2</p>
              </div>
            </motion.div>
          )}
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 z-10">
        <div className="max-w-5xl mx-auto">

          {/* ── Main grid: status + scanner ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

            {/* Status card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-5 bg-white rounded-[45px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group"
            >
              <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center mb-8 transition-all duration-700 ${
                status === 'CONNECTED'
                  ? 'bg-emerald-50 text-emerald-500 shadow-inner'
                  : 'bg-slate-50 text-slate-300 shadow-inner'
              }`}>
                {status === 'CHECKING'
                  ? <Loader2 size={56} className="animate-spin text-slate-300" />
                  : status === 'CONNECTED'
                    ? <Wifi size={56} className="animate-pulse" />
                    : <WifiOff size={56} />
                }
              </div>

              <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4 leading-none">
                {status === 'CONNECTED' ? 'Conexão Estável' : 'WhatsApp Pendente'}
              </h2>
              <p className="text-slate-500 text-sm font-medium max-w-[280px] mb-10 leading-relaxed">
                {status === 'CONNECTED'
                  ? 'A inteligência artificial está operando seus canais de atendimento agora.'
                  : 'Aponte a câmera para o código ao lado para sincronizar o cérebro da IA.'}
              </p>

              <div className="w-full space-y-4 mb-10">
                <div className={`rounded-[28px] p-5 text-left flex items-start gap-4 border transition-all ${
                  status === 'CONNECTED' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'
                }`}>
                  <div className={`p-2.5 rounded-xl ${status === 'CONNECTED' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                    {status === 'CONNECTED' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.1em] mb-1">
                      {status === 'CONNECTED' ? 'Operação Segura' : 'Aguardando Sinc'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      {status === 'CONNECTED'
                        ? 'Canal ativo e respondendo mensagens em tempo real.'
                        : 'A IA requer um canal de saída ativo para responder.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagem de erro */}
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full rounded-[20px] p-4 flex items-start gap-3 mb-2"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-0.5">Falha na conexão</p>
                    <p className="text-[11px] text-red-600 font-semibold leading-snug">{errorMsg}</p>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: loading ? 1 : 1.02, boxShadow: loading ? 'none' : '0 10px 25px -5px rgba(16,185,129,0.4)' }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                onClick={status === 'CONNECTED' ? loadInstances : handleConnect}
                disabled={loading}
                className="w-full h-16 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><Loader2 className="animate-spin" size={20} /> Aguardando Evolution API...</>
                  : <><RefreshCcw size={20} /> {status === 'CONNECTED' ? 'Recarregar Painel' : 'Gerar Novo QrCode'}</>
                }
              </motion.button>
            </motion.div>

            {/* Scanner card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-7 bg-white rounded-[45px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-50 text-emerald-500 rounded-2xl flex items-center justify-center border border-slate-100">
                    <QrCode size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-[0.15em]">
                      Pareamento Multi-Dispositivo
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-widest">
                        Evolution v2
                      </span>
                      <div className="w-1 h-1 bg-slate-300 rounded-full" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        Encriptação ponta-a-ponta
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR area */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] bg-slate-50/80 rounded-[40px] border border-slate-100 relative group">
                {status === 'CONNECTED' ? (
                  <div className="text-center p-8">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-24 h-24 bg-emerald-500 text-white rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20"
                    >
                      <CheckCircle2 size={48} />
                    </motion.div>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">Sincronizado!</h4>
                    <p className="text-slate-400 text-sm font-bold mt-2">O canal de saída está pronto para disparos</p>
                  </div>
                ) : status === 'QR_READY' && qrCode ? (
                  <div className="relative p-10 bg-white rounded-[45px] shadow-2xl shadow-slate-200/50 border border-slate-100 group-hover:scale-[1.03] transition-transform duration-700">
                    <img src={qrCode} alt="QR Code WhatsApp" className="w-[280px] h-[280px] object-contain" />
                    {/* scanner line */}
                    <div className="absolute left-8 right-8 top-8 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-40 z-10 pointer-events-none animate-[scan_4s_linear_infinite]" />
                  </div>
                ) : (
                  <div className="text-center p-12 opacity-60">
                    <div className="w-24 h-24 bg-white rounded-[32px] shadow-sm flex items-center justify-center mx-auto mb-6 border border-slate-200/50">
                      <Smartphone size={40} className="text-slate-200" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Canal em Standby</p>
                    <p className="text-[10px] font-bold text-slate-300 mt-2 italic">
                      {loading ? 'Carregando...' : 'Clique em "Gerar Novo QrCode" para iniciar'}
                    </p>
                  </div>
                )}
              </div>

              {/* Steps */}
              <div className="mt-8 flex justify-between gap-4">
                {(['Abra o WhatsApp e toque em Menu', 'Selecione "Aparelhos Conectados"', 'Aponte a câmera para o QR Code'] as const).map((step, i) => (
                  <div key={i} className="flex-1 flex gap-3 items-start p-4 bg-white rounded-[24px] border border-slate-50 shadow-sm transition-all hover:border-emerald-100">
                    <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border border-emerald-100/50">
                      {i + 1}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 leading-tight">{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Feature cards ─────────────────────────────────────────────────── */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldCheck size={28} />,
                title: 'Neural Guard',
                desc: 'Filtra e qualifica cada lead de acordo com as metas e regras comerciais configuradas.',
                colorClass: 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white',
                hoverBorder: 'hover:border-blue-200',
              },
              {
                icon: <Bot size={28} />,
                title: 'Deep Logic',
                desc: 'Respostas contextuais baseadas em dados históricos de clientes e pedidos do SalesMasters.',
                colorClass: 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white',
                hoverBorder: 'hover:border-emerald-200',
              },
              {
                icon: <Smartphone size={28} />,
                title: 'Cloud Edge',
                desc: 'Motor Evolution ultra-veloz rodando em infraestrutura elástica com alta disponibilidade.',
                colorClass: 'bg-teal-50 text-teal-500 group-hover:bg-teal-500 group-hover:text-white',
                hoverBorder: 'hover:border-teal-200',
              },
            ].map(f => (
              <div key={f.title} className={`bg-white p-7 rounded-[40px] border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] flex flex-col gap-6 group ${f.hoverBorder} transition-all`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${f.colorClass}`}>
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2">{f.title}</h4>
                  <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Seção explicativa ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 bg-white rounded-[45px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden"
          >
            {/* accent bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />

            <div className="flex items-start gap-5 mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100/50">
                <Info size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">
                  O que é o WhatsApp{' '}
                  <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                    Nexus IA
                  </span>?
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  O módulo de inteligência artificial integrado ao WhatsApp da sua empresa
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-[28px] p-7 mb-8 border border-slate-100">
              <p className="text-[13px] text-slate-600 font-medium leading-[1.8]">
                O <strong className="text-slate-800">WhatsApp Nexus IA</strong> é um módulo avançado que conecta o WhatsApp da sua empresa diretamente
                ao cérebro de inteligência artificial do SalesMasters. Uma vez conectado através do QR Code acima, o sistema passa a{' '}
                <strong className="text-emerald-600">monitorar, interpretar e responder automaticamente</strong> as mensagens recebidas no WhatsApp,
                utilizando o contexto do seu negócio — dados de clientes, histórico de pedidos, produtos e metas comerciais — para gerar
                respostas inteligentes, precisas e personalizadas.
              </p>
              <p className="text-[13px] text-slate-600 font-medium leading-[1.8] mt-4">
                O objetivo principal é <strong className="text-slate-800">eliminar o tempo de espera do cliente</strong> e garantir que cada lead receba
                uma resposta qualificada em segundos, 24 horas por dia, 7 dias por semana — mesmo quando sua equipe comercial não estiver disponível.
                Isso aumenta drasticamente a taxa de conversão e a satisfação do cliente.
              </p>
            </div>

            {/* Benefits grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                {
                  icon: <Clock size={18} />, color: 'bg-emerald-500',
                  bg: 'from-emerald-50/50', border: 'border-emerald-100/50',
                  title: 'Atendimento 24/7',
                  desc: 'A IA nunca dorme. Responde instantaneamente a qualquer hora do dia ou da noite, finais de semana e feriados incluídos.',
                },
                {
                  icon: <BrainCircuit size={18} />, color: 'bg-blue-500',
                  bg: 'from-blue-50/50', border: 'border-blue-100/50',
                  title: 'Qualificação Inteligente',
                  desc: 'Cada mensagem é analisada em contexto. A IA identifica a intenção do cliente e direciona a conversa para a conversão.',
                },
                {
                  icon: <BarChart3 size={18} />, color: 'bg-teal-500',
                  bg: 'from-teal-50/50', border: 'border-teal-100/50',
                  title: 'Dados em Tempo Real',
                  desc: 'A IA consulta o banco de dados do SalesMasters para fornecer informações atualizadas sobre preços, estoque e status de pedidos.',
                },
                {
                  icon: <Users size={18} />, color: 'bg-amber-500',
                  bg: 'from-amber-50/50', border: 'border-amber-100/50',
                  title: 'Escalabilidade Total',
                  desc: 'Atenda centenas de clientes simultaneamente sem precisar contratar mais atendentes. Sem fila, sem espera.',
                },
              ].map(b => (
                <div key={b.title} className={`flex items-start gap-4 p-5 bg-gradient-to-br ${b.bg} to-transparent rounded-[20px] border ${b.border}`}>
                  <div className={`p-2.5 ${b.color} text-white rounded-xl shrink-0`}>
                    {b.icon}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-1">{b.title}</h4>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <Zap size={16} className="text-amber-500 shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                <strong className="text-slate-500">Tecnologia:</strong> Este módulo utiliza a Evolution API v2 com encriptação ponta-a-ponta,
                processamento via IA generativa e infraestrutura cloud elástica para máxima performance e segurança dos dados.
              </p>
            </div>
          </motion.div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        @keyframes scan {
          0%   { top: 40px; }
          50%  { top: 320px; }
          100% { top: 40px; }
        }
      `}} />
    </div>
  )
}
