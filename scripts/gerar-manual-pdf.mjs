// ─────────────────────────────────────────────────────────────────────────────
// Gera o Manual do RepOne em PDF (markdown -> HTML -> Chromium/Playwright -> PDF).
// 100% local, sem serviços de terceiros. Identidade SoftHam (capa + cabeçalho).
//
//   node scripts/gerar-manual-pdf.mjs        (ou:  npm run manual:pdf)
//
// Saída: docs/manual-repone.pdf  → suba para softham.com.br/repone/manual-repone.pdf
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MD_PATH = join(ROOT, 'docs', 'manual-repone.md')
const OUT_PATH = join(ROOT, 'docs', 'manual-repone.pdf')

// Slug igual ao do GitHub — pra casar com o Sumário interno do manual ([x](#ancora)).
function slug(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}
function textFromNode(node) {
  if (!node) return ''
  if (node.value) return node.value
  if (node.children) return node.children.map(textFromNode).join('')
  return ''
}
const dataUri = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`

function main() {
  let md = readFileSync(MD_PATH, 'utf8')

  // versão/data do manual (linha 3: "Versão 2.0 · Atualizado em ...")
  const versao = (md.match(/Vers[aã]o\s+([\d.]+)/i) || [, '2.0'])[1]
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  // remove o bloco de título do topo (até o primeiro '---') — a capa substitui isso
  const corte = md.indexOf('\n---\n')
  if (corte > 0) md = md.slice(corte + 5)

  const headingId = (props) => h(props.node.tagName, { id: slug(textFromNode(props.node)) }, props.children)
  const body = renderToStaticMarkup(
    h(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      components: { h1: headingId, h2: headingId, h3: headingId, h4: headingId },
    }, md)
  )

  const logo = dataUri(join(__dirname, 'assets', 'softham-logo.png'), 'image/png')
  const html = template({ body, logo, versao, hoje })
  return { html, logo, versao }
}

function template({ body, logo, versao, hoje }) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  :root{ --navy:#1E2D3D; --ink:#28374A; --muted:#6B7785; --gold:#C8A24B; --line:#E3DCCB; --soft:#F6F3EC; }
  *{ box-sizing:border-box; }
  body{ font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.6; margin:0; }
  /* ── Capa ── */
  .cover{ height:247mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;
          background:linear-gradient(160deg,#16222F 0%,#1E2D3D 55%,#243446 100%); color:#fff; page-break-after:always; position:relative; }
  .cover-bg{ position:absolute; inset:0; background:radial-gradient(circle at 70% 18%, rgba(200,162,75,.18), transparent 45%); }
  .cover img{ width:150px; margin-bottom:30px; filter:drop-shadow(0 6px 20px rgba(0,0,0,.4)); position:relative; }
  .cover .kicker{ letter-spacing:.42em; font-size:10pt; color:var(--gold); text-transform:uppercase; margin-bottom:14px; position:relative; }
  .cover h1{ font-size:40pt; font-weight:800; margin:0 0 8px; letter-spacing:-.5px; position:relative; color:#fff; text-shadow:0 2px 16px rgba(0,0,0,.5); }
  .cover h1 .one{ color:var(--gold); }
  .cover h2{ font-size:14pt; font-weight:400; color:rgba(255,255,255,.78); margin:0 0 40px; position:relative; }
  .cover .rule{ width:64px; height:3px; background:var(--gold); margin:0 auto 18px; border-radius:2px; position:relative; }
  .cover .meta{ font-size:10pt; color:rgba(255,255,255,.62); position:relative; }
  .cover .casa{ position:absolute; bottom:26mm; font-size:9pt; letter-spacing:.28em; color:rgba(255,255,255,.5); text-transform:uppercase; }
  /* ── Conteúdo ── */
  .content{ padding:4mm 2mm; }
  h1,h2,h3,h4{ color:var(--navy); line-height:1.3; }
  h1{ font-size:21pt; border-bottom:2px solid var(--gold); padding-bottom:6px; margin:0 0 14px; }
  h2{ font-size:16pt; margin:26px 0 10px; padding-top:6px; border-top:1px solid var(--line); padding-top:14px; page-break-after:avoid; }
  h3{ font-size:12.5pt; margin:18px 0 6px; color:var(--ink); page-break-after:avoid; }
  h4{ font-size:11pt; margin:14px 0 4px; color:var(--muted); }
  p{ margin:7px 0; }
  a{ color:#1F5C8B; text-decoration:none; }
  ul,ol{ margin:7px 0; padding-left:22px; }
  li{ margin:3px 0; }
  strong{ color:var(--navy); }
  code{ background:var(--soft); border:1px solid var(--line); border-radius:4px; padding:1px 5px; font-family:'Consolas',monospace; font-size:9pt; color:#9A3B2F; }
  pre{ background:var(--navy); color:#EAF0F6; padding:12px 14px; border-radius:8px; overflow:auto; font-size:8.6pt; line-height:1.5; page-break-inside:avoid; }
  pre code{ background:none; border:none; color:inherit; padding:0; }
  blockquote{ margin:10px 0; padding:9px 14px; background:#FBF6E9; border-left:4px solid var(--gold); border-radius:0 6px 6px 0; color:#5b4a23; page-break-inside:avoid; }
  blockquote p{ margin:3px 0; }
  table{ width:100%; border-collapse:collapse; margin:12px 0; font-size:9.4pt; page-break-inside:avoid; }
  th{ background:var(--navy); color:#fff; text-align:left; padding:7px 9px; font-weight:600; }
  td{ border:1px solid var(--line); padding:6px 9px; vertical-align:top; }
  tr:nth-child(even) td{ background:#FAF8F2; }
  hr{ border:none; border-top:1px solid var(--line); margin:22px 0; }
  h2{ page-break-before:auto; }
  </style></head><body>
    <section class="cover">
      <div class="cover-bg"></div>
      <img src="${logo}" alt="SoftHam"/>
      <div class="kicker">Manual do Usuário</div>
      <h1>Rep<span class="one">One</span></h1>
      <h2>SalesMasters V2 · Sistema para Representantes Comerciais</h2>
      <div class="rule"></div>
      <div class="meta">Versão ${versao} &nbsp;·&nbsp; Atualizado em ${hoje}</div>
      <div class="casa">SoftHam Sistemas</div>
    </section>
    <main class="content">${body}</main>
  </body></html>`
}

async function run() {
  const { html, logo } = main()

  let chromium
  try { ({ chromium } = await import('playwright')) }
  catch { ({ chromium } = await import('@playwright/test')) }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
  await page.setContent(html, { waitUntil: 'networkidle' })

  if (process.argv.includes('--preview')) {
    await page.screenshot({ path: join(ROOT, 'docs', 'manual-preview-capa.png'), clip: { x: 0, y: 0, width: 794, height: 1000 } })
    console.log('✓ Preview da capa: docs/manual-preview-capa.png')
  }

  const headFoot = (inner) => `<div style="font-size:7pt;color:#9AA4AE;width:100%;padding:0 14mm;font-family:'Segoe UI',Arial;">${inner}</div>`
  await page.pdf({
    path: OUT_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '16mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: headFoot(`<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:.5px solid #E3DCCB;padding-bottom:3px;">
        <span style="color:#1E2D3D;font-weight:600;">RepOne · Manual do Usuário</span>
        <span>SoftHam Sistemas</span></div>`),
    footerTemplate: headFoot(`<div style="display:flex;justify-content:space-between;align-items:center;border-top:.5px solid #E3DCCB;padding-top:3px;">
        <span>softham.com.br</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`),
  })
  await browser.close()

  const kb = (statSync(OUT_PATH).size / 1024).toFixed(0)
  console.log(`✓ PDF gerado: docs/manual-repone.pdf (${kb} KB)`)
}

run().catch(e => { console.error('Falha ao gerar manual:', e); process.exit(1) })
