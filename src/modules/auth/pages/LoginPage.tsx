import { motion } from 'framer-motion'
import { useState, useRef, useEffect, memo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/shared/lib/api'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import vinhetaVideo from '@/assets/videos/vinheta.mp4'
import logoIconV2 from '@/assets/images/salesmasters_logo_hd.png'

// Componentes Customizados (High Impact Reverted)
import { NeuralStream } from '../components/NeuralStream'
import { LoginBlade } from '../components/LoginBlade'
import { BackgroundPortal } from '../components/BackgroundPortal'

// ── Framer Motion variants — module-level so object refs are stable ───────────
const heroVariants = {
  hidden:   { opacity: 0, filter: 'blur(30px)' },
  visible:  { opacity: 1, filter: 'blur(0px)', transition: { duration: 1.5, staggerChildren: 0.15 } },
}
const wordVariants = {
  hidden:   { opacity: 0, y: 100 },
  visible:  { opacity: 1, y: 0, transition: { duration: 1.2 } },
}

// ── Marquee footer isolated so its fetch doesn't re-render LoginPage ──────────
const MarqueeFooter = memo(() => {
  const [companies, setCompanies] = useState<string[]>([])
  useEffect(() => {
    api.get('/auth/marquee-companies')
      .then(r => { if (r.data.success) setCompanies(r.data.data) })
      .catch(() => {})
  }, [])
  if (!companies.length) return null
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 3 }}
      className="fixed bottom-0 left-0 w-full z-50 bg-transparent py-4 overflow-hidden pointer-events-none"
      style={{ borderTop: '1px solid rgba(45,122,123,0.15)' }}
    >
      <div className="flex whitespace-nowrap animate-marquee">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex shrink-0 items-center">
            {companies.map((name, idx) => (
              <div key={`${i}-${idx}`} className="flex items-center">
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.2em', color: 'rgba(45,122,123,0.7)', textTransform: 'uppercase', margin: '0 2.5rem' }}>
                  {name}
                </span>
                <span style={{ color: 'rgba(45,122,123,0.3)', fontSize: '10px' }}>◆</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.footer>
  )
})

// ── Hero typographic — memoized so parent re-renders don't restart animation ──
const HeroTypographic = memo(() => (
  <div className="absolute inset-0 flex items-center z-40 pointer-events-none" style={{ paddingTop: '10vh' }}>
    <div className="pl-16 lg:pl-32 w-full">
      <motion.div
        variants={heroVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col"
        style={{ gap: 0 }}
      >
        <div className="overflow-hidden">
          <motion.h1 variants={wordVariants} className="text-[8vw] font-black text-white leading-[0.85] tracking-tighter uppercase">
            Venda<span className="text-[#2D7A7B]">.</span>
          </motion.h1>
        </div>
        <div className="overflow-hidden">
          <motion.h1 variants={wordVariants} className="text-[8vw] font-black text-white/30 leading-[0.85] tracking-tighter uppercase">
            Gerencie<span className="text-[#2D7A7B]">.</span>
          </motion.h1>
        </div>
        <div className="overflow-hidden">
          <motion.h1 variants={wordVariants} className="text-[8vw] font-black text-[#85B0B1] leading-[0.85] tracking-tighter uppercase">
            Cresça<span className="text-[#2D7A7B]">.</span>
          </motion.h1>
        </div>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="text-white/20 text-xl font-bold leading-relaxed tracking-[0.4em] uppercase italic mt-10 ml-2"
      >
        TECNOLOGIA E PERFORMANCE EM REPRESENTAÇÃO COMERCIAL
      </motion.p>
    </div>
  </div>
))

export default function LoginPage() {
  const [playingVinheta, setPlayingVinheta] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const navigate = useNavigate()
  const { login } = useAuthStore()

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const handleLogin = async (e: React.FormEvent, data: any) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/auth/login', {
        cnpj: data.cnpj,
        nome: data.nome,
        sobrenome: data.sobrenome,
        password: data.password
      })

      if (response.data.success) {
        login({
          user: response.data.user,
          tenantConfig: response.data.tenantConfig,
          token: response.data.token
        })
        toast.success(response.data.message || 'Login autorizado.')
        navigate('/dashboard')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      const message = error.response?.data?.message || 'Falha ao autenticar. Tente novamente.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const onVinhetaEnd = () => {
    setPlayingVinheta(false)
    setShowContent(true)
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#030712] selection:bg-teal-500/30 font-sans">
      
      {/* Camada 1: Background Distorcido */}
      {!playingVinheta && <BackgroundPortal videoSrc={vinhetaVideo} />}

      {/* Camada 2: Stream de IA */}
      {!playingVinheta && <NeuralStream />}

      {/* Camada 3: Overlay de Marca (Fixa no Canto) */}
      <div className="absolute top-8 left-8 z-50 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-36 h-36 flex items-center justify-center">
             <img 
               src={logoIconV2} 
               alt="SaleMasters V2" 
               className="w-full h-full object-contain filter drop-shadow-[0_0_40px_rgba(253,185,49,0.3)]" 
             />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white text-2xl font-black tracking-tighter uppercase leading-none">
              SaleMasters
            </span>
            <span className="text-sm font-black italic text-transparent bg-clip-text bg-gradient-to-r from-[#FDB931] via-[#D4AF37] to-[#8B7355] drop-shadow-[0_0_15px_rgba(253,185,49,0.5)] px-1 self-end mb-1">
              V2
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="flex items-center gap-2 mt-4"
          >
            <div className="h-[1px] w-6 bg-[#2D7A7B]" />
            <ShieldCheck className="w-3 h-4 text-[#2D7A7B]" />
            <span className="text-[13px] font-normal text-white/60 tracking-wide max-w-[380px] leading-relaxed italic">
              "Acreditamos que um trabalho não deve parecer trabalho, essa realização profissional floresce quando pessoas talentosas se reúnem para criar coisas incríveis."
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Camada 4: Hero Typographic */}
      {showContent && <HeroTypographic />}

      {/* Camada 5: Intro Video (Vinheta) */}
      {playingVinheta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030712]"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="relative w-full h-full"
            >
              <video 
                ref={videoRef}
                src={vinhetaVideo}
                className="w-full h-full object-cover"
                autoPlay
                muted
                onEnded={onVinhetaEnd}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            </motion.div>
          </motion.div>
        )}

      {/* Camada 6: A Lâmina de Login (Restored & Updated) */}
      {showContent && <LoginBlade onLogin={handleLogin} loading={loading} />}

      {/* Camada 7: Footer Marquee — isolated to prevent parent re-renders */}
      {!playingVinheta && <MarqueeFooter />}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 120s linear infinite;
          width: max-content;
          display: flex;
        }
      `}} />
    </div>
  )
}
