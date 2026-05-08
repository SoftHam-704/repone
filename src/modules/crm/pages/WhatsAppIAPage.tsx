import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, RefreshCcw, QrCode, ShieldCheck,
  AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff,
  Smartphone, Info, Clock, Users, BrainCircuit, ChevronDown,
} from 'lucide-react'
import { api } from '@/shared/lib/api'

interface Instance {
  instance: { instanceName: string; status: string }
}

type PageStatus = 'CHECKING' | 'DISCONNECTED' | 'CONNECTED' | 'QR_READY'

const NAVY  = '#28374A'
const GREEN = '#25D366'

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
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all border border-white/15"
      >
        <MessageSquare size={13} style={{ color: GREEN }} />
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
            const ok     = ['open','connected'].includes(inst.instance?.status)
            return (
              <button
                key={name}
                onClick={() => { onChange(name); setOpen(false) }}
                className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${selected === name ? 'bg-green-50/40' : ''}`}
              >
                <span className="text-xs font-bold text-slate-700">{name}</span>
                <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-slate-300'}`} />
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default function WhatsAppIAPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [status,    setStatus]    = useState<PageStatus>('CHECKING')
  const [qrCode,    setQrCode]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)

  const loadInstances = () => {
    setErrorMsg(null)
    api.get('/crm/whatsapp/instances')
      .then(r => {
        if (r.data.success) {
          const list: Instance[] = r.data.data ?? []
          setInstances(list)
          setSelected(prev => {
            if (prev && list.find(i => i.instance?.instanceName === prev)) return prev
            const open = list.find(i => ['open','connected'].includes(i.instance?.status))
            return (open ?? list[0])?.instance?.instanceName ?? null
          })
        }
      })
      .catch(() => setErrorMsg('Não foi possível conectar à Evolution API.'))
  }

  useEffect(() => {
    if (!selected) { setStatus('DISCONNECTED'); return }
    const inst = instances.find(i => i.instance?.instanceName === selected)
    if (!inst) return
    const s = inst.instance?.status
    if (s === 'open' || s === 'connected') { setStatus('CONNECTED'); setQrCode(null) }
    else setStatus(prev => prev === 'QR_READY' ? 'QR_READY' : 'DISCONNECTED')
  }, [selected, instances])

  const handleConnect = () => {
    setErrorMsg(null); setLoading(true); setStatus('CHECKING'); setQrCode(null)
    const endpoint = selected ? `/crm/whatsapp/connect/${selected}` : `/crm/whatsapp/connect-auto`
    api.get(endpoint)
      .then(r => {
        if (r.data.status === 'CONNECTED') {
          setStatus('CONNECTED'); setQrCode(null)
        } else if (r.data.status === 'QR_CODE' && r.data.qrcode) {
          setStatus('QR_READY'); setQrCode(r.data.qrcode)
        } else {
          setStatus('DISCONNECTED')
          setErrorMsg(r.data.message || 'QR não gerado. Aguarde e tente novamente.')
        }
      })
      .catch((e: any) => {
        setStatus('DISCONNECTED')
        setErrorMsg(e?.response?.data?.message || 'Erro de conexão com a Evolution API.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadInstances() }, [])

  const isConnected = status === 'CONNECTED'

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans" style={{ background: '#E8E1D4' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative shrink-0 overflow-hidden" style={{ background: NAVY, paddingBottom: 52 }}>
        {/* Green top line */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: GREEN }} />
        {/* Subtle radial glows */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(ellipse 60% 80% at 80% 50%, ${GREEN}08 0%, transparent 70%),
                            radial-gradient(ellipse 40% 60% at 10% 80%, #128C7E08 0%, transparent 70%)`,
        }} />

        {/* Nav row */}
        <div className="relative z-10 px-8 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: GREEN }}>
              <MessageSquare size={22} />
            </div>
            <div>
              <h1 className="text-white text-xl font-black tracking-tight leading-none">
                WhatsApp <span style={{ color: GREEN }}>IA</span>
              </h1>
              <p className="text-white/35 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">
                Atendimento inteligente 24/7
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <InstanceSelector instances={instances} selected={selected} onChange={setSelected} />
            <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              isConnected
                ? 'border-green-500/30 text-green-400 bg-green-500/10'
                : 'border-white/10 text-white/35 bg-white/5'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-white/25'}`} />
              {isConnected ? 'Conectado' : status === 'CHECKING' ? 'Verificando...' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 px-8 pt-8 flex items-end justify-between">
          <AnimatePresence mode="wait">
            {isConnected ? (
              <motion.div key="c" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Status atual</p>
                <p className="text-white text-4xl font-black tracking-tighter leading-none">
                  IA em <span style={{ color: GREEN }}>operação</span>
                </p>
                <p className="text-white/35 text-sm font-medium mt-3 max-w-md">
                  O assistente está monitorando e respondendo mensagens em tempo real.
                </p>
              </motion.div>
            ) : (
              <motion.div key="d" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Próximo passo</p>
                <p className="text-white text-4xl font-black tracking-tighter leading-none">
                  Conecte seu <span style={{ color: GREEN }}>WhatsApp</span>
                </p>
                <p className="text-white/35 text-sm font-medium mt-3 max-w-md">
                  Escaneie o QR Code com o celular para ativar o assistente de IA.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <Smartphone size={100} className="hidden lg:block opacity-[0.04] text-white" strokeWidth={0.8} />
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-10" style={{ marginTop: -44, position: 'relative', zIndex: 10 }}>
        <div className="max-w-5xl mx-auto">

          {/* ── Main 2-col grid (floats over hero) ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* Action card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-white rounded-3xl p-8 flex flex-col gap-6 shadow-[0_20px_50px_rgba(40,55,74,0.12)] border border-black/5"
            >
              {/* Icon row */}
              <div className="flex items-center justify-between">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-700 ${isConnected ? 'bg-green-50' : 'bg-slate-50'}`}>
                  {status === 'CHECKING'
                    ? <Loader2 size={32} className="animate-spin text-slate-200" />
                    : isConnected
                      ? <Wifi size={32} style={{ color: GREEN }} />
                      : <WifiOff size={32} className="text-slate-250" style={{ color: '#cbd5e1' }} />
                  }
                </div>
                {isConnected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                    style={{ background: '#f0fdf4', color: '#16a34a' }}
                  >
                    <CheckCircle2 size={11} />
                    Ativo
                  </motion.div>
                )}
              </div>

              {/* Title + desc */}
              <div>
                <h2 className="text-lg font-black tracking-tight mb-1.5" style={{ color: NAVY }}>
                  {isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
                </h2>
                <p className="text-sm text-slate-400 font-medium leading-relaxed">
                  {isConnected
                    ? 'A IA está respondendo mensagens automaticamente no WhatsApp da empresa.'
                    : status === 'QR_READY'
                    ? 'Escaneie o código ao lado com o WhatsApp do celular.'
                    : 'Gere um QR Code para vincular o WhatsApp ao assistente de IA.'}
                </p>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Status chip */}
              <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                isConnected
                  ? 'bg-green-50 border-green-100'
                  : status === 'QR_READY'
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-slate-50 border-slate-100'
              }`}>
                {isConnected
                  ? <CheckCircle2 size={17} className="text-green-500 shrink-0 mt-0.5" />
                  : status === 'QR_READY'
                  ? <QrCode size={17} className="text-amber-500 shrink-0 mt-0.5" />
                  : <AlertCircle size={17} className="text-slate-300 shrink-0 mt-0.5" />
                }
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: NAVY }}>
                    {isConnected ? 'Operação segura' : status === 'QR_READY' ? 'QR Code pronto' : 'Aguardando conexão'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {isConnected
                      ? 'Canal ativo e criptografado, respondendo em tempo real.'
                      : status === 'QR_READY'
                      ? 'Leia o código com a câmera do seu celular.'
                      : 'Clique no botão abaixo para gerar o QR Code.'}
                  </p>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl overflow-hidden"
                  >
                    <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-0.5">Erro</p>
                      <p className="text-[11px] text-red-600 font-medium leading-snug">{errorMsg}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              <motion.button
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                onClick={isConnected ? loadInstances : handleConnect}
                disabled={loading}
                className="w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.18em] flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
                style={{
                  background: loading ? '#94a3b8' : isConnected ? NAVY : GREEN,
                  boxShadow: loading ? 'none' : isConnected ? `0 8px 20px ${NAVY}30` : `0 8px 24px ${GREEN}45`,
                }}
              >
                {loading
                  ? <><Loader2 className="animate-spin" size={17} /> Aguardando Evolution API...</>
                  : <><RefreshCcw size={17} /> {isConnected ? 'Atualizar Painel' : 'Gerar QR Code'}</>
                }
              </motion.button>
            </motion.div>

            {/* QR Scanner card — dark */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="lg:col-span-3 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(40,55,74,0.18)] border border-black/10"
              style={{ background: NAVY }}
            >
              {/* Card header */}
              <div className="px-8 pt-8 pb-5 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GREEN}20` }}>
                    <QrCode size={20} style={{ color: GREEN }} />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm">Pareamento do Dispositivo</p>
                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-0.5">WhatsApp Multi-Device</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10 text-white/35">
                  <ShieldCheck size={11} />
                  Criptografado
                </div>
              </div>

              {/* QR area */}
              <div className="flex items-center justify-center px-8 py-10 min-h-[300px] relative">
                <AnimatePresence mode="wait">
                  {isConnected ? (
                    <motion.div
                      key="ok"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.85, opacity: 0 }}
                      className="text-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.15, 1] }}
                        transition={{ duration: 0.45 }}
                        className="w-24 h-24 rounded-[28px] flex items-center justify-center mx-auto mb-5 text-white"
                        style={{ background: GREEN, boxShadow: `0 20px 50px ${GREEN}50` }}
                      >
                        <CheckCircle2 size={48} />
                      </motion.div>
                      <h4 className="text-white text-2xl font-black tracking-tight">Sincronizado!</h4>
                      <p className="text-white/35 text-sm font-medium mt-2">
                        {selected
                          ? <><span className="text-white/60 font-bold">{selected}</span> — pronto para disparos automáticos</>
                          : 'Canal pronto para disparos automáticos'}
                      </p>
                    </motion.div>
                  ) : status === 'QR_READY' && qrCode ? (
                    <motion.div
                      key="qr"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="flex flex-col items-center"
                    >
                      <div className="relative">
                        {/* Glow */}
                        <div className="absolute -inset-6 rounded-3xl blur-2xl opacity-15" style={{ background: GREEN }} />
                        {/* Frame */}
                        <div className="relative bg-white rounded-3xl p-5 overflow-hidden shadow-2xl">
                          <img src={qrCode} alt="QR Code WhatsApp" className="w-[220px] h-[220px] object-contain" />
                          {/* Scan line */}
                          <div className="absolute inset-x-4 h-0.5 opacity-70 pointer-events-none" style={{
                            background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
                            animation: 'scan 2.2s ease-in-out infinite',
                          }} />
                          {/* Corner marks */}
                          {(['tl','tr','bl','br'] as const).map(corner => (
                            <div
                              key={corner}
                              className="absolute w-6 h-6"
                              style={{
                                top:    corner.startsWith('t') ? 12 : 'auto',
                                bottom: corner.startsWith('b') ? 12 : 'auto',
                                left:   corner.endsWith('l')  ? 12 : 'auto',
                                right:  corner.endsWith('r')  ? 12 : 'auto',
                                borderTop:    corner.startsWith('t') ? `2px solid ${GREEN}` : 'none',
                                borderBottom: corner.startsWith('b') ? `2px solid ${GREEN}` : 'none',
                                borderLeft:   corner.endsWith('l')   ? `2px solid ${GREEN}` : 'none',
                                borderRight:  corner.endsWith('r')   ? `2px solid ${GREEN}` : 'none',
                                borderRadius: corner === 'tl' ? '4px 0 0 0' : corner === 'tr' ? '0 4px 0 0' : corner === 'bl' ? '0 0 0 4px' : '0 0 4px 0',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-white/35 text-[11px] font-bold uppercase tracking-[0.25em] mt-5">
                        Aponte a câmera do celular
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {loading
                          ? <Loader2 size={32} className="animate-spin text-white/20" />
                          : <Smartphone size={36} className="text-white/15" />
                        }
                      </div>
                      <p className="text-white/25 text-[11px] font-black uppercase tracking-[0.3em]">
                        {loading ? 'Gerando QR Code...' : 'Canal em Standby'}
                      </p>
                      {!loading && (
                        <p className="text-white/15 text-[10px] font-medium mt-2">
                          Clique em "Gerar QR Code" para iniciar
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Steps */}
              {!isConnected && (
                <div className="px-8 pb-8 grid grid-cols-3 gap-3">
                  {[
                    { n: 1, text: 'Abra o WhatsApp no celular' },
                    { n: 2, text: 'Toque em ⋮ → "Aparelhos Conectados"' },
                    { n: 3, text: 'Aponte a câmera para o QR Code' },
                  ].map(s => (
                    <div key={s.n} className="flex gap-2.5 items-start p-3.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: `${GREEN}25`, color: GREEN }}>
                        {s.n}
                      </div>
                      <span className="text-[10px] font-medium text-white/35 leading-tight">{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Feature strip ──────────────────────────────────────────────────── */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Clock size={19} />,        label: 'Atendimento 24/7',      desc: 'Responde a qualquer hora, sem interrupções.' },
              { icon: <BrainCircuit size={19} />, label: 'Contexto real',          desc: 'Usa dados reais de clientes, pedidos e metas.' },
              { icon: <Users size={19} />,         label: 'Escala ilimitada',      desc: 'Atende centenas de clientes simultaneamente.' },
              { icon: <ShieldCheck size={19} />,   label: 'Criptografia total',    desc: 'Protocolo WhatsApp Multi-Device ponta a ponta.' },
            ].map(f => (
              <div
                key={f.label}
                className="bg-white rounded-2xl p-5 flex gap-3.5 items-start border border-black/5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-2 rounded-xl shrink-0" style={{ background: `${GREEN}15`, color: GREEN }}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: NAVY }}>{f.label}</p>
                  <p className="text-[11px] text-slate-400 font-medium leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── How it works ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 bg-white rounded-3xl overflow-hidden border border-black/5 shadow-sm"
          >
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${GREEN}, #128C7E, ${NAVY})` }} />

            <div className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl" style={{ background: `${GREEN}15`, color: GREEN }}>
                  <Info size={19} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight" style={{ color: NAVY }}>
                    Como o <span style={{ color: GREEN }}>WhatsApp IA</span> funciona?
                  </h3>
                  <p className="text-slate-400 text-xs font-medium mt-0.5">
                    Da mensagem do cliente à resposta — em segundos
                  </p>
                </div>
              </div>

              <div className="relative grid md:grid-cols-4 gap-2">
                {/* Connector line */}
                <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px" style={{ background: 'linear-gradient(90deg, #e2e8f0, #e2e8f0)' }} />

                {[
                  { n: '01', title: 'Mensagem recebida',  desc: 'Cliente envia mensagem via WhatsApp. O sistema intercepta em milissegundos.', bg: GREEN },
                  { n: '02', title: 'IA analisa contexto', desc: 'O assistente consulta histórico, pedidos e perfil do cliente em tempo real.',  bg: '#128C7E' },
                  { n: '03', title: 'Resposta gerada',     desc: 'Resposta personalizada criada com base nos dados reais do negócio.',           bg: '#1e6f5c' },
                  { n: '04', title: 'Entrega imediata',    desc: 'Mensagem enviada ao cliente sem intervenção humana, 24h por dia.',             bg: NAVY },
                ].map(s => (
                  <div key={s.n} className="flex flex-col items-center text-center p-5 relative z-10">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black mb-4 shadow-lg"
                      style={{ background: s.bg, boxShadow: `0 8px 20px ${s.bg}40` }}
                    >
                      {s.n}
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: NAVY }}>{s.title}</p>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c8c1b4; border-radius: 20px; }
        @keyframes scan {
          0%   { top: 20px; }
          50%  { top: calc(100% - 20px); }
          100% { top: 20px; }
        }
      `}} />
    </div>
  )
}
