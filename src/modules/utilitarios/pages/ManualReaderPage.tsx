import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Download, Search, BookOpen, X } from 'lucide-react'
// Fonte única: o MESMO markdown que gera o PDF (docs/manual-repone.md).
import manualMd from '../../../../docs/manual-repone.md?raw'

const G = {
  bg: '#E8E1D4', card: '#FFFFFF', border: '#D6CDB8', text: '#28374A',
  muted: '#7A8899', navy: '#1E2D3D', gold: '#C8A24B', green: '#059669',
}
const MANUAL_PDF = 'https://softham.com.br/repone/manual-repone.pdf'

function slug(t: string) {
  return String(t).toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function textFromNode(node: any): string {
  if (!node) return ''
  if (node.value) return node.value
  if (node.children) return node.children.map(textFromNode).join('')
  return ''
}

const Hx = (props: any) =>
  createElement(props.node.tagName, { id: slug(textFromNode(props.node)), style: { scrollMarginTop: 86 } }, props.children)

interface Head { level: number; text: string; id: string }

export default function ManualReaderPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState('')

  // Remove o sumário interno do .md (a barra lateral já é o índice) e o bloco de título do topo.
  const md = useMemo(() => {
    let m = manualMd
    const corte = m.indexOf('\n---\n')
    if (corte > 0) m = m.slice(corte + 5)
    // tira a seção "## Sumário ... " até o próximo "---"
    m = m.replace(/##\s+Sum[áa]rio[\s\S]*?\n---\n/, '')
    return m
  }, [])

  const headings = useMemo(() => {
    const out: Head[] = []
    let inCode = false
    for (const line of md.split('\n')) {
      if (line.trim().startsWith('```')) { inCode = !inCode; continue }
      if (inCode) continue
      const m = line.match(/^(#{2,3})\s+(.+?)\s*$/)
      if (m) { const text = m[2].replace(/`/g, ''); out.push({ level: m[1].length, text, id: slug(text) }) }
    }
    return out
  }, [md])

  const filtered = useMemo(
    () => (!query.trim() ? headings : headings.filter(h => norm(h.text).includes(norm(query)))),
    [headings, query]
  )

  // scroll-spy: destaca no índice a seção visível
  useEffect(() => {
    const els = headings.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      entries => {
        const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActiveId((vis[0].target as HTMLElement).id)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [headings])

  const go = (id: string) => {
    const el = document.getElementById(id)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#${id}`) }
  }

  return (
    <div style={{ background: G.bg, minHeight: '100%' }}>
      <style>{markdownCss}</style>

      {/* Hero */}
      <div style={{ background: G.navy, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/utilitarios/tutoriais')} title="Voltar"
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: 'rgba(255,255,255,.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} />
          </button>
          <BookOpen size={22} color={G.gold} />
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#fff' }}>Manual do Usuário — RepOne</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>Leitura online · sempre na versão atual</p>
          </div>
        </div>
        <a href={MANUAL_PDF} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: G.gold, color: G.navy, borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          <Download size={15} /> Baixar PDF
        </a>
      </div>

      {/* Corpo: índice + conteúdo */}
      <div style={{ display: 'grid', gridTemplateColumns: '288px 1fr', alignItems: 'start', gap: 0 }}>
        {/* Índice lateral */}
        <aside style={{ position: 'sticky', top: 0, alignSelf: 'start', height: 'calc(100vh - 0px)', overflowY: 'auto', borderRight: `1px solid ${G.border}`, background: G.card, padding: '16px 12px' }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: G.muted }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar no manual…"
              style={{ width: '100%', padding: '8px 30px 8px 30px', border: `1px solid ${G.border}`, borderRadius: 8, fontSize: 13, color: G.text, background: G.bg }} />
            {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: G.muted }}><X size={14} /></button>}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.length === 0 && <div style={{ fontSize: 12, color: G.muted, padding: 8 }}>Nada encontrado.</div>}
            {filtered.map(h => {
              const active = h.id === activeId
              return (
                <button key={h.id} onClick={() => go(h.id)}
                  style={{
                    textAlign: 'left', background: active ? `${G.navy}0d` : 'transparent', border: 'none', cursor: 'pointer',
                    padding: h.level === 3 ? '5px 10px 5px 22px' : '7px 10px', borderRadius: 7,
                    fontSize: h.level === 3 ? 12 : 12.5, fontWeight: h.level === 3 ? 400 : 600,
                    color: active ? G.navy : (h.level === 3 ? G.muted : G.text),
                    borderLeft: active ? `3px solid ${G.gold}` : '3px solid transparent',
                  }}>
                  {h.text}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Conteúdo */}
        <main style={{ padding: '26px 36px 80px', maxWidth: 900 }}>
          <div className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ h1: Hx, h2: Hx, h3: Hx, h4: Hx }}>
              {md}
            </ReactMarkdown>
          </div>
        </main>
      </div>
    </div>
  )
}

const markdownCss = `
.md-body{ color:#28374A; font-size:15px; line-height:1.7; }
.md-body h1{ font-size:26px; color:#1E2D3D; border-bottom:2px solid #C8A24B; padding-bottom:8px; margin:0 0 18px; }
.md-body h2{ font-size:21px; color:#1E2D3D; margin:34px 0 12px; padding-top:18px; border-top:1px solid #E3DCCB; }
.md-body h3{ font-size:17px; color:#28374A; margin:22px 0 8px; }
.md-body h4{ font-size:14px; color:#7A8899; margin:16px 0 6px; text-transform:uppercase; letter-spacing:.03em; }
.md-body p{ margin:10px 0; }
.md-body a{ color:#1F5C8B; text-decoration:none; border-bottom:1px solid rgba(31,92,139,.3); }
.md-body a:hover{ border-bottom-color:#1F5C8B; }
.md-body ul,.md-body ol{ margin:10px 0; padding-left:24px; }
.md-body li{ margin:4px 0; }
.md-body strong{ color:#1E2D3D; }
.md-body code{ background:#F6F3EC; border:1px solid #E3DCCB; border-radius:4px; padding:1px 6px; font-family:Consolas,monospace; font-size:13px; color:#9A3B2F; }
.md-body pre{ background:#1E2D3D; color:#EAF0F6; padding:14px 16px; border-radius:10px; overflow:auto; font-size:13px; line-height:1.5; }
.md-body pre code{ background:none; border:none; color:inherit; padding:0; }
.md-body blockquote{ margin:14px 0; padding:10px 16px; background:#FBF6E9; border-left:4px solid #C8A24B; border-radius:0 8px 8px 0; color:#5b4a23; }
.md-body blockquote p{ margin:4px 0; }
.md-body table{ width:100%; border-collapse:collapse; margin:16px 0; font-size:13.5px; display:block; overflow-x:auto; }
.md-body th{ background:#1E2D3D; color:#fff; text-align:left; padding:9px 11px; font-weight:600; white-space:nowrap; }
.md-body td{ border:1px solid #E3DCCB; padding:8px 11px; vertical-align:top; }
.md-body tr:nth-child(even) td{ background:#FAF8F2; }
.md-body hr{ border:none; border-top:1px solid #E3DCCB; margin:26px 0; }
.md-body img{ max-width:100%; border-radius:8px; }
@media (max-width: 880px){
  .md-body table{ font-size:12.5px; }
}
`
