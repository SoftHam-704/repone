import { useState, useEffect, useRef, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, AlertCircle, CheckCircle2, Info, Sparkles, X, FileSpreadsheet,
  Calendar, Factory, Tag, Package, FileText, Barcode,
  ChevronLeft, ChevronRight, Plus, Wand2, ArrowLeft, Loader2,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Industry   { value: string | number; label: string; }
interface ExistingTable { nome_tabela: string; total_produtos: number; }
interface ErroDetalhe   { codigo: string; descricao: string; erro: string; }

type TextareaKey =
  | 'codigo' | 'complemento' | 'nome' | 'linha' | 'precobruto' | 'precopromo' | 'precoespecial'
  | 'grupo'  | 'aplicacao'   | 'embalagem' | 'peso' | 'prepeso' | 'itab_grupodesconto' | 'ipi' | 'st'
  | 'codigooriginal' | 'codbarras' | 'descontoadd' | 'ncm' | 'curva' | 'categoria' | 'conversao';

type TextareasState = Record<TextareaKey, string>;

interface ImportResult {
  success?: boolean; message?: string;
  resumo?: { total: number; inseridos: number; atualizados: number; erros: number; detalhesErros: ErroDetalhe[]; };
}

// ─── V1 Colors ───────────────────────────────────────────────────────────────
const C = {
  emerald: '#10b981', emeraldDark: '#059669', emeraldBg: '#f0fdf4', emeraldBorder: '#a7f3d0',
  blue: '#3b82f6', blueBg: '#eff6ff',
  purple: '#8b5cf6',
  slate50: '#f8fafc', slate100: '#f1f5f9', slate200: '#e2e8f0',
  slate400: '#94a3b8', slate500: '#64748b', slate600: '#475569', slate700: '#334155', slate800: '#1e293b',
  amber50: '#fffbeb', amber200: '#fde68a', amber600: '#d97706', amber800: '#92400e',
  red50: '#fef2f2', red200: '#fecaca', red500: '#ef4444',
  white: '#ffffff',
};

// ─── Smart Split ──────────────────────────────────────────────────────────────
const smartSplit = (text: string): { lines: string[]; adjustedCount: number } => {
  if (!text) return { lines: [], adjustedCount: 0 };
  const rawLines = text.split(/\r?\n/);
  const rows: string[] = [];
  let currentCell = '', inQuotedCell = false, adjustedCount = 0;
  for (const line of rawLines) {
    if (!inQuotedCell) {
      if (line.trim().startsWith('"')) {
        if (line.trim().endsWith('"') && line.trim().length > 1 && !line.trim().endsWith('""'))
          rows.push(line.trim());
        else { inQuotedCell = true; currentCell = line; }
      } else rows.push(line.trim());
    } else {
      adjustedCount++;
      currentCell += '\n' + line;
      if (line.trim().endsWith('"') && !line.trim().endsWith('""')) {
        inQuotedCell = false; rows.push(currentCell.trim()); currentCell = '';
      }
    }
  }
  if (inQuotedCell) rows.push(currentCell.trim());
  const processed = rows.map(r => {
    let v = r;
    if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
    return v.replace(/""/g, '"').replace(/\n/g, ' ').trim();
  });
  while (processed.length > 0 && processed[processed.length - 1] === '') processed.pop();
  return { lines: processed, adjustedCount };
};

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 0, label: 'Dados Principais',         Icon: Package, color: C.emerald,
    fields: ['codigo','complemento','linha','nome','precobruto','precopromo','precoespecial'] as TextareaKey[] },
  { id: 1, label: 'Detalhes do Produto',       Icon: FileText, color: C.blue,
    fields: ['grupo','aplicacao','embalagem','peso','prepeso','itab_grupodesconto','ipi','st'] as TextareaKey[] },
  { id: 2, label: 'Códigos e Classificações',  Icon: Barcode, color: C.purple,
    fields: ['codigooriginal','codbarras','descontoadd','ncm','curva','categoria','conversao'] as TextareaKey[] },
];

const FIELD_LABELS: Record<TextareaKey, { label: string; required: boolean; fullWidth?: boolean; wide?: boolean }> = {
  codigo:             { label: 'Código',             required: true  },
  complemento:        { label: 'Complemento',         required: false },
  nome:               { label: 'Nome do Produto',     required: true, wide: true },
  linha:              { label: 'Marca / Linha',       required: false },
  precobruto:         { label: 'Preço Bruto',         required: true  },
  precopromo:         { label: 'Preço Promoção',      required: false },
  precoespecial:      { label: 'Preço Especial',      required: false },
  grupo:              { label: 'Grupo de Produtos',   required: false },
  aplicacao:          { label: 'Aplicação',           required: false, wide: true },
  embalagem:          { label: 'Embalagem',           required: false },
  peso:               { label: 'Peso',                required: false },
  prepeso:            { label: 'Preço por Peso/Qtd', required: false },
  ipi:                { label: '% IPI',               required: false },
  st:                 { label: '% ST',                required: false },
  codigooriginal:     { label: 'Código Original',     required: false },
  codbarras:          { label: 'Código de Barras',    required: false },
  descontoadd:        { label: 'Desconto Adicional',  required: false },
  ncm:                { label: 'NCM',                 required: false },
  curva:              { label: 'Curva ABC',            required: false },
  categoria:          { label: 'Categoria',           required: false },
  conversao:          { label: 'Conversão',           required: false },
  itab_grupodesconto: { label: 'Grupo de Desconto',   required: false },
};

const EMPTY: TextareasState = {
  codigo:'', complemento:'', nome:'', linha:'', precobruto:'', precopromo:'', precoespecial:'',
  grupo:'', aplicacao:'', embalagem:'', peso:'', ipi:'', st:'', prepeso:'',
  codigooriginal:'', codbarras:'', descontoadd:'', ncm:'', curva:'',
  categoria:'', conversao:'', itab_grupodesconto:'',
};

// ─── Inline style helpers ─────────────────────────────────────────────────────
const card: CSSProperties = {
  background: C.white, border: `2px solid ${C.slate200}`, borderRadius: 16,
  boxShadow: '0 4px 24px -8px rgba(0,0,0,0.08)', overflow: 'hidden',
};
const btnBase: CSSProperties = {
  display:'flex', alignItems:'center', gap:8, cursor:'pointer',
  border:'none', borderRadius:12, fontWeight:700, transition:'all .2s',
};

// ─── Classic Import ───────────────────────────────────────────────────────────
function ClassicImport() {
  const [activeTab, setActiveTab]         = useState(0);
  const [direction, setDirection]         = useState(0);
  const [formData, setFormData]           = useState({
    industria: '', nomeTabela: '',
    dataTabela: new Date().toISOString().split('T')[0], dataVencimento: '',
  });
  const [textareas, setTextareas]         = useState<TextareasState>(EMPTY);
  const [lineCounts, setLineCounts]       = useState<Record<string,number>>({});
  const [adjustments, setAdjustments]    = useState<Record<string,number>>({});
  const [isValid, setIsValid]             = useState(false);
  const [industries, setIndustries]       = useState<Industry[]>([]);
  const [existingTables, setExistingTables] = useState<ExistingTable[]>([]);
  const [importing, setImporting]         = useState(false);
  const [result, setResult]               = useState<ImportResult | null>(null);
  const [progress, setProgress]           = useState({ current:0, total:0, percentage:0 });
  const [showNewTableInput, setShowNewTableInput] = useState(false);

  useEffect(() => {
    api.get('/aux/industrias').then(r => setIndustries(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setExistingTables([]); setShowNewTableInput(false);
    setFormData(p => ({ ...p, nomeTabela: '' }));
    if (!formData.industria) return;
    api.get(`/price-tables/${formData.industria}`)
      .then(r => { const d: ExistingTable[] = r.data.data || []; setExistingTables(d); if (!d.length) setShowNewTableInput(true); })
      .catch(() => {});
  }, [formData.industria]);

  useEffect(() => {
    const counts: Record<string,number> = {}, adjs: Record<string,number> = {}, raw: Record<string,number> = {};
    (Object.keys(textareas) as TextareaKey[]).forEach(k => {
      const { lines, adjustedCount } = smartSplit(textareas[k]);
      raw[k] = lines.length;
      counts[k] = k === 'codigo' ? lines.filter(l => l.trim() !== '').length : lines.length;
      adjs[k] = adjustedCount;
    });
    setLineCounts(counts); setAdjustments(adjs);
    const active = (Object.keys(textareas) as TextareaKey[]).filter(k => raw[k] > 0);
    setIsValid(active.length > 0 && active.every(k => raw[k] === raw[active[0]]) && (raw.codigo || 0) > 0);
  }, [textareas]);

  const navigateTab = (n: number) => { setDirection(n > activeTab ? 1 : -1); setActiveTab(n); };

  const parseValue = (val: string | undefined): number | null => {
    if (!val && val !== '0') return null;
    const c = val.toString().replace(/[^\d,.-]/g, '');
    if (!c) return 0;
    if (c.includes(',') && c.includes('.')) return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(c.replace(',', '.')) || 0;
  };

  const handleImport = async () => {
    if (!formData.industria || !formData.nomeTabela) { toast.error('Preencha Indústria e Nome da Tabela!'); return; }
    if (!isValid) { toast.error('Todos os campos preenchidos devem ter o mesmo número de linhas!'); return; }
    setImporting(true); setResult(null);
    try {
      const sp: Record<string, string[]> = {};
      (Object.keys(textareas) as TextareaKey[]).forEach(k => { sp[k] = smartSplit(textareas[k]).lines; });
      const hasField = (f: TextareaKey) => textareas[f].trim() !== '';
      const get = (f: TextareaKey, i: number) => sp[f]?.[i] || '';
      const produtos = [];
      for (let i = 0; i < sp.codigo.length; i++) {
        const code = sp.codigo[i]; if (!code?.trim()) continue;
        produtos.push({
          codigo: code, complemento: get('complemento',i), descricao: get('nome',i), linha: get('linha',i),
          precobruto:    hasField('precobruto')    ? parseValue(get('precobruto',i))    : null,
          precopromo:    hasField('precopromo')    ? parseValue(get('precopromo',i))    : null,
          precoespecial: hasField('precoespecial') ? parseValue(get('precoespecial',i)) : null,
          grupo: get('grupo',i), aplicacao: get('aplicacao',i),
          embalagem:     hasField('embalagem')     ? (parseInt(get('embalagem',i).replace(/\D/g,'')) || 1) : null,
          peso:          hasField('peso')          ? parseValue(get('peso',i))          : null,
          prepeso:       hasField('prepeso')       ? parseValue(get('prepeso',i))       : null,
          ipi:           hasField('ipi')           ? parseValue(get('ipi',i))           : null,
          st:            hasField('st')            ? parseValue(get('st',i))            : null,
          codigooriginal: get('codigooriginal',i), codbarras: get('codbarras',i),
          descontoadd:   hasField('descontoadd')   ? parseValue(get('descontoadd',i))   : null,
          ncm: get('ncm',i), curva: get('curva',i), categoria: get('categoria',i), conversao: get('conversao',i),
          grupodesconto: hasField('itab_grupodesconto') ? get('itab_grupodesconto',i) : null,
        });
      }
      const lotes: typeof produtos[] = [];
      for (let i = 0; i < produtos.length; i += 1000) lotes.push(produtos.slice(i, i + 1000));
      setProgress({ current:0, total:lotes.length, percentage:0 });
      let ins = 0, upd = 0, errs = 0; const details: ErroDetalhe[] = [];
      for (let i = 0; i < lotes.length; i++) {
        const pct = Math.round(((i+1)/lotes.length)*100);
        setProgress({ current:i+1, total:lotes.length, percentage:pct });
        const r = await api.post('/price-tables/import', {
          industria: parseInt(formData.industria), nomeTabela: formData.nomeTabela.toUpperCase(),
          dataTabela: formData.dataTabela, dataVencimento: formData.dataVencimento || null, produtos: lotes[i],
        });
        if (r.data.success) {
          ins  += r.data.resumo?.produtosNovos       || 0;
          upd  += r.data.resumo?.produtosAtualizados || 0;
          errs += r.data.resumo?.erros               || 0;
          if (r.data.resumo?.detalhesErros?.length) details.push(...r.data.resumo.detalhesErros);
        } else throw new Error(r.data.message || 'Erro no lote');
      }
      setResult({ success:true, resumo:{ total:produtos.length, inseridos:ins, atualizados:upd, erros:errs, detalhesErros:details } });
    } catch (e: any) {
      setResult({ success:false, message:`Erro: ${e.message}` });
    } finally { setImporting(false); }
  };

  const getCountColor = (field: TextareaKey) => {
    const cur = smartSplit(textareas[field]).lines.length;
    if (cur === 0) return C.slate400;
    return cur === smartSplit(textareas.codigo).lines.length ? C.emerald : C.red500;
  };

  const getTabCount = (idx: number) => {
    const tab = TABS[idx];
    const counts = tab.fields.map(f => lineCounts[f] || 0).filter(c => c > 0);
    return counts.length > 0 ? counts[0] : 0;
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 500 : -500, opacity: 0 }),
    center: { zIndex: 1, x: 0, opacity: 1 },
    exit:  (d: number) => ({ zIndex: 0, x: d < 0 ? 500 : -500, opacity: 0 }),
  };

  const tabBg = (color: string) =>
    color === C.emerald ? `linear-gradient(to right,${C.emerald},${C.emeraldDark})`
    : color === C.blue  ? 'linear-gradient(to right,#3b82f6,#2563eb)'
    :                     'linear-gradient(to right,#8b5cf6,#7c3aed)';

  // ── TextareaField (inline component) ──
  const TextareaField = ({ field }: { field: TextareaKey }) => {
    const cfg = FIELD_LABELS[field];
    const count = lineCounts[field] || 0;
    const adj   = adjustments[field] || 0;
    const color = getCountColor(field);
    const isFullW = cfg.fullWidth ? { gridColumn: 'span 3' } : cfg.wide ? { gridColumn: 'span 2' } : {};
    return (
      <div style={{ ...card, display:'flex', flexDirection:'column', ...isFullW, transition:'box-shadow .2s, border-color .2s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.emerald; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px -8px rgba(16,185,129,0.15)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.slate200; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px -8px rgba(0,0,0,0.08)'; }}>
        {/* Card header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:`linear-gradient(to right,${C.slate50},${C.slate100})`, borderBottom:`1px solid ${C.slate200}` }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.slate700, textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:6 }}>
            {cfg.label}
            {cfg.required && <span style={{ color:C.red500, fontSize:16 }}>*</span>}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {adj > 0 && (
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:C.amber600, background:C.amber50, padding:'3px 8px', borderRadius:20, fontWeight:600 }}>
                <Sparkles size={11} />{adj} ajustadas
              </span>
            )}
            <span onClick={() => setTextareas(p => ({ ...p, [field]:'' }))}
              title="Clique para limpar"
              style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, cursor:'pointer', background:C.slate100, color, transition:'background .15s' }}>
              {count} linhas
            </span>
          </div>
        </div>
        {/* Textarea */}
        <textarea
          value={textareas[field]}
          onChange={e => setTextareas(p => ({ ...p, [field]:e.target.value }))}
          placeholder={`Cole aqui os dados de ${cfg.label.toLowerCase()}...`}
          style={{ width:'100%', height:180, padding:14, fontFamily:'monospace', fontSize:12, resize:'none', border:'none', outline:'none', background:C.white, color:C.slate700, whiteSpace:'pre', overflowWrap:'normal', overflowX:'auto', lineHeight:1.5 }}
        />
      </div>
    );
  };

  const isExisting = existingTables.some(t => t.nome_tabela === formData.nomeTabela);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f1f5f9 0%,#ffffff 50%,#ecfdf5 100%)', padding:24 }}>
      <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', flexDirection:'column', gap:24 }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ padding:16, background:`linear-gradient(135deg,${C.emerald},${C.emeraldDark})`, borderRadius:16, boxShadow:`0 8px 24px -4px ${C.emerald}55` }}>
              <FileSpreadsheet size={40} color={C.white} />
            </div>
            <div>
              <h1 style={{ fontSize:28, fontWeight:900, color:C.slate800, margin:0, letterSpacing:'-0.03em' }}>
                Importação de <span style={{ color:C.emerald }}>Tabela de Preços</span>
              </h1>
              <p style={{ fontSize:13, color:C.slate500, margin:'4px 0 0', fontWeight:500 }}>
                Cole os dados do Excel nos campos correspondentes
              </p>
            </div>
          </div>
          {isValid && (
            <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', background:C.emeraldBg, border:`2px solid ${C.emeraldBorder}`, borderRadius:16, boxShadow:'0 4px 16px -4px rgba(16,185,129,0.2)' }}>
              <CheckCircle2 size={22} color={C.emerald} />
              <span style={{ fontSize:15, fontWeight:900, color:C.emeraldDark }}>{lineCounts.codigo} produtos prontos!</span>
            </motion.div>
          )}
        </div>

        {/* ── Config Card ── */}
        <div style={card}>
          <div style={{ padding:24 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 160px 160px', gap:16 }}>

              {/* Indústria */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.slate600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <Factory size={14} color={C.emerald} />Indústria *
                </label>
                <select value={String(formData.industria)}
                  onChange={e => setFormData(p => ({ ...p, industria:e.target.value, nomeTabela:'' }))}
                  style={{ width:'100%', height:48, padding:'0 12px', borderRadius:12, border:`2px solid ${C.slate200}`, background:C.white, fontSize:13, fontWeight:600, color:C.slate700, outline:'none', cursor:'pointer', appearance:'none' }}>
                  <option value="">Selecione a indústria...</option>
                  {industries.map(i => <option key={i.value} value={String(i.value)}>{i.label}</option>)}
                </select>
              </div>

              {/* Nome da Tabela */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.slate600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Tag size={14} color="#3b82f6" />
                    {showNewTableInput ? 'Nova Tabela *' : 'Tabela *'}
                  </span>
                  {formData.industria && existingTables.length > 0 && !showNewTableInput && (
                    <button onClick={() => setShowNewTableInput(true)}
                      style={{ fontSize:10, color:C.emerald, fontWeight:700, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                      <Plus size={11} />NOVA
                    </button>
                  )}
                </label>
                {formData.industria && existingTables.length > 0 && !showNewTableInput ? (
                  <select value={formData.nomeTabela}
                    onChange={e => { if (e.target.value === '__NEW__') { setFormData(p => ({ ...p, nomeTabela:'' })); setShowNewTableInput(true); } else setFormData(p => ({ ...p, nomeTabela:e.target.value })); }}
                    style={{ width:'100%', height:48, padding:'0 12px', borderRadius:12, border:`2px solid ${C.slate200}`, background:C.white, fontSize:13, fontWeight:700, color:C.slate700, outline:'none', cursor:'pointer', appearance:'none', textTransform:'uppercase' }}>
                    <option value="">Selecione...</option>
                    <option value="__NEW__">➕ CRIAR NOVA TABELA</option>
                    {existingTables.map((t,i) => (
                      <option key={i} value={t.nome_tabela}>{t.nome_tabela} — {t.total_produtos} produtos</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ position:'relative' }}>
                    <Sparkles size={15} color={C.emerald} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                    <input type="text" value={formData.nomeTabela}
                      onChange={e => setFormData(p => ({ ...p, nomeTabela:e.target.value.toUpperCase() }))}
                      placeholder="Ex: PADRAO, PROMOCIONAL..."
                      disabled={!formData.industria}
                      style={{ width:'100%', height:48, paddingLeft:36, paddingRight: existingTables.length > 0 ? 36 : 12, borderRadius:12, border:`2px solid ${C.emeraldBorder}`, background:C.white, fontSize:13, fontWeight:700, color:C.slate800, outline:'none', textTransform:'uppercase', boxSizing:'border-box' }} />
                    {existingTables.length > 0 && (
                      <button onClick={() => { setShowNewTableInput(false); setFormData(p => ({ ...p, nomeTabela:'' })); }}
                        style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:C.slate400, display:'flex', padding:4 }}>
                        <X size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Data Tabela */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.slate600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                  <Calendar size={13} color="#8b5cf6" />Data Tabela
                </label>
                <input type="date" value={formData.dataTabela}
                  onChange={e => setFormData(p => ({ ...p, dataTabela:e.target.value }))}
                  style={{ width:'100%', height:48, padding:'0 12px', borderRadius:12, border:`2px solid ${C.slate200}`, background:C.white, fontSize:13, fontWeight:600, color:C.slate700, outline:'none', boxSizing:'border-box' }} />
              </div>

              {/* Validade */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.slate600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, display:'block' }}>Validade</label>
                <input type="date" value={formData.dataVencimento}
                  onChange={e => setFormData(p => ({ ...p, dataVencimento:e.target.value }))}
                  style={{ width:'100%', height:48, padding:'0 12px', borderRadius:12, border:`2px solid ${C.slate200}`, background:C.white, fontSize:13, fontWeight:600, color:C.slate700, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>

            {/* Status Banner */}
            {formData.nomeTabela && (
              <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                style={{ marginTop:16, padding:'12px 16px', borderRadius:12, display:'flex', alignItems:'center', gap:10,
                  background: isExisting ? C.amber50 : C.emeraldBg,
                  border: `2px solid ${isExisting ? C.amber200 : C.emeraldBorder}` }}>
                {isExisting
                  ? <><AlertCircle size={18} color={C.amber600} />
                      <div><p style={{ margin:0, fontSize:13, fontWeight:700, color:C.amber800 }}>Modo: ATUALIZAR TABELA</p>
                           <p style={{ margin:0, fontSize:11, color:C.amber600 }}>Códigos existentes serão atualizados</p></div></>
                  : <><CheckCircle2 size={18} color={C.emerald} />
                      <div><p style={{ margin:0, fontSize:13, fontWeight:700, color:C.emeraldDark }}>Modo: CRIAR NOVA TABELA</p>
                           <p style={{ margin:0, fontSize:11, color:C.emerald }}>Tabela "{formData.nomeTabela}" será criada</p></div></>
                }
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:C.white, borderRadius:16, border:`2px solid ${C.slate200}`, padding:8, boxShadow:'0 4px 16px -4px rgba(0,0,0,0.06)' }}>
          <button onClick={() => navigateTab(Math.max(0, activeTab-1))} disabled={activeTab===0}
            style={{ ...btnBase, padding:12, borderRadius:12, background:'none', color: activeTab===0 ? C.slate200 : C.slate600, cursor: activeTab===0 ? 'not-allowed':'pointer' }}>
            <ChevronLeft size={24} />
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {TABS.map((tab, idx) => {
              const Icon = tab.Icon;
              const count = getTabCount(idx);
              const isActive = activeTab === idx;
              return (
                <motion.button key={tab.id} onClick={() => navigateTab(idx)}
                  whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                  style={{ ...btnBase, padding:'10px 20px', borderRadius:12,
                    background: isActive ? tabBg(tab.color) : 'transparent',
                    color: isActive ? C.white : C.slate600,
                    boxShadow: isActive ? `0 4px 16px -4px ${tab.color}88` : 'none' }}>
                  <Icon size={18} color={isActive ? C.white : C.slate400} />
                  <span style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{tab.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize:10, fontWeight:900, padding:'2px 7px', borderRadius:20,
                      background: isActive ? 'rgba(255,255,255,0.2)' : C.emeraldBg,
                      color: isActive ? C.white : C.emerald }}>
                      {count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <button onClick={() => navigateTab(Math.min(TABS.length-1, activeTab+1))} disabled={activeTab===TABS.length-1}
            style={{ ...btnBase, padding:12, borderRadius:12, background:'none', color: activeTab===TABS.length-1 ? C.slate200 : C.slate600, cursor: activeTab===TABS.length-1 ? 'not-allowed':'pointer' }}>
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Dot indicators */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {TABS.map((_, i) => (
            <div key={i} style={{ height:8, borderRadius:4, background: activeTab===i ? C.emerald : C.slate200, width: activeTab===i ? 32 : 8, transition:'all .3s' }} />
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ ...card, minHeight:500, overflow:'hidden', position:'relative' }}>
          <motion.div key={activeTab} custom={direction}
              variants={slideVariants} initial="enter" animate="center"
              transition={{ x:{ type:'spring', stiffness:300, damping:30 }, opacity:{ duration:0.2 } }}
              style={{ padding:24 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:20 }}>
                {TABS[activeTab].fields.map(field => <TextareaField key={field} field={field} />)}
              </div>
            </motion.div>
        </div>

        {/* ── Alerta de linhas inconsistentes ── */}
        {!isValid && Object.values(lineCounts).some(c => c > 0) && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:C.red50, border:`2px solid ${C.red200}`, borderRadius:12 }}>
            <AlertCircle size={18} color={C.red500} />
            <span style={{ fontSize:13, fontWeight:600, color:'#7f1d1d' }}>
              <strong>Atenção!</strong> Número de linhas inconsistente entre os campos. Todos os campos preenchidos devem ter o mesmo total de linhas.
            </span>
          </div>
        )}

        {/* ── Progress Bar ── */}
        {importing && progress.total > 0 && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
            style={{ padding:24, background:C.blueBg, border:`2px solid #bfdbfe`, borderRadius:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#1e3a5f' }}>Processando lote {progress.current} de {progress.total}</span>
              <span style={{ fontSize:24, fontWeight:900, color:C.blue }}>{progress.percentage}%</span>
            </div>
            <div style={{ width:'100%', height:16, background:'#bfdbfe', borderRadius:8, overflow:'hidden' }}>
              <motion.div style={{ height:'100%', background:`linear-gradient(to right,${C.blue},${C.emerald})` }}
                initial={{ width:0 }} animate={{ width:`${progress.percentage}%` }} transition={{ duration:0.3 }} />
            </div>
          </motion.div>
        )}

        {/* ── Result ── */}
        {result && <ResultBox result={result} />}

        {/* ── Action Buttons ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:16, borderTop:`2px solid ${C.slate200}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:C.blueBg, border:`2px solid #bfdbfe`, borderRadius:12, flex:1, marginRight:16 }}>
            <Info size={16} color={C.blue} />
            <span style={{ fontSize:12, color:'#1e3a5f', fontWeight:600 }}>
              <strong>Dica:</strong> Use as setas ← → ou clique nas abas para navegar entre as categorias de campos.
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => { setTextareas(EMPTY); setResult(null); }}
              style={{ ...btnBase, height:48, padding:'0 24px', border:`2px solid ${C.slate200}`, background:C.white, color:C.slate600, fontSize:13 }}>
              <X size={16} />Limpar Tudo
            </button>
            <button onClick={handleImport}
              disabled={!isValid || importing || !formData.industria || !formData.nomeTabela}
              style={{ ...btnBase, height:48, padding:'0 32px', fontSize:14, fontWeight:800,
                background: (!isValid || !formData.industria || !formData.nomeTabela)
                  ? C.slate200 : `linear-gradient(to right,${C.emerald},${C.emeraldDark})`,
                color: (!isValid || !formData.industria || !formData.nomeTabela) ? C.slate400 : C.white,
                boxShadow: (!isValid || !formData.industria || !formData.nomeTabela) ? 'none' : `0 8px 24px -4px ${C.emerald}66`,
                cursor: (!isValid || !formData.industria || !formData.nomeTabela) ? 'not-allowed' : 'pointer',
              }}>
              {importing ? (
                <><div style={{ width:18, height:18, border:`2px solid rgba(255,255,255,0.3)`, borderTopColor:C.white, borderRadius:'50%', animation:'spin 1s linear infinite' }} />Importando...</>
              ) : !formData.industria ? <><Factory size={18} />Selecione a Indústria</>
                : !formData.nomeTabela ? <><Tag size={18} />Nomeie a Tabela</>
                : !isValid ? <><AlertCircle size={18} />Verifique as Linhas</>
                : <><Upload size={18} />Importar Tabela</>}
            </button>
          </div>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Result Box ───────────────────────────────────────────────────────────────
function ResultBox({ result }: { result: ImportResult }) {
  const ok = result.success !== false;
  return (
    <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
      style={{ padding:24, background: ok ? C.emeraldBg : C.red50, border:`2px solid ${ok ? C.emeraldBorder : C.red200}`, borderRadius:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        {ok ? <CheckCircle2 size={24} color={C.emerald} /> : <AlertCircle size={24} color={C.red500} />}
        <span style={{ fontSize:16, fontWeight:900, color: ok ? C.emeraldDark : '#7f1d1d' }}>
          {result.message || 'Importação concluída!'}
        </span>
      </div>
      {result.resumo && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Total',       value:result.resumo.total,       border:C.slate200, color:C.slate800 },
              { label:'Inseridos',   value:result.resumo.inseridos,   border:C.emeraldBorder, color:C.emeraldDark },
              { label:'Atualizados', value:result.resumo.atualizados, border:'#bfdbfe', color:C.blue },
              ...(result.resumo.erros > 0 ? [{ label:'Erros', value:result.resumo.erros, border:C.red200, color:C.red500 }] : []),
            ].map(s => (
              <div key={s.label} style={{ background:C.white, border:`2px solid ${s.border}`, borderRadius:12, padding:'14px 16px' }}>
                <p style={{ margin:0, fontSize:10, fontWeight:700, color:C.slate500, textTransform:'uppercase', letterSpacing:'0.1em' }}>{s.label}</p>
                <p style={{ margin:'4px 0 0', fontSize:28, fontWeight:900, color:s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          {result.resumo.detalhesErros?.length > 0 && (
            <div style={{ background:C.white, border:`2px solid ${C.red200}`, borderRadius:12, overflow:'hidden' }}>
              <div style={{ background:C.red50, padding:'8px 16px', borderBottom:`1px solid ${C.red200}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:900, color:C.red500, textTransform:'uppercase', letterSpacing:'0.12em' }}>Relatório de Inconsistências</span>
                <button onClick={() => {
                  const txt = result.resumo!.detalhesErros.map(e => `${e.codigo}\t${e.descricao}\t${e.erro}`).join('\n');
                  navigator.clipboard.writeText(`Código\tDescrição\tErro\n${txt}`);
                  toast.success('Lista de erros copiada!');
                }} style={{ fontSize:10, fontWeight:700, color:C.red500, background:'none', border:'none', cursor:'pointer', padding:'4px 10px', borderRadius:6 }}>
                  Copiar Erros
                </button>
              </div>
              <div style={{ maxHeight:200, overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead style={{ background:C.slate50, position:'sticky', top:0 }}>
                    <tr>{['Cód','Descrição','Erro'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:700, color:C.slate500, borderBottom:`1px solid ${C.slate100}`, textTransform:'uppercase', fontSize:10 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {result.resumo.detalhesErros.map((e, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.slate50}` }}>
                        <td style={{ padding:'8px 12px', fontFamily:'monospace', fontWeight:700, color:C.slate700 }}>{e.codigo}</td>
                        <td style={{ padding:'8px 12px', color:C.slate600, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>{e.descricao}</td>
                        <td style={{ padding:'8px 12px', color:C.red500, fontStyle:'italic' }}>{e.erro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── Magic Import ─────────────────────────────────────────────────────────────
const MAGIC_FIELDS = [
  { key:'codigo',        label:'Código *',        required:true  },
  { key:'descricao',     label:'Descrição *',      required:true  },
  { key:'linha',         label:'Marca / Linha',    required:false },
  { key:'precobruto',    label:'Preço Normal *',   required:true  },
  { key:'precopromo',    label:'Preço Promoção',   required:false },
  { key:'precoespecial', label:'Preço Especial',   required:false },
  { key:'ipi',           label:'IPI %',            required:false },
  { key:'st',            label:'ST %',             required:false },
  { key:'embalagem',     label:'Embalagem',        required:false },
  { key:'peso',          label:'Peso (kg)',         required:false },
  { key:'conversao',     label:'Conversão',        required:false },
  { key:'aplicacao',     label:'Aplicação',        required:false },
  { key:'codbarras',     label:'Código de Barras', required:false },
];

function MagicImport() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [existingTables, setExistingTables] = useState<ExistingTable[]>([]);
  const [selInd, setSelInd]     = useState('');
  const [nomeTabela, setNomeTabela] = useState('');
  const [novaTabela, setNovaTabela] = useState('');
  const [step, setStep]         = useState<'upload'|'mapping'|'importing'|'done'>('upload');
  const [headers, setHeaders]   = useState<string[]>([]);
  const [preview, setPreview]   = useState<any[][]>([]);
  const [rawData, setRawData]   = useState<any[][]>([]);
  const [mapping, setMapping]   = useState<Record<string,string>>({});
  const [result, setResult]     = useState<ImportResult|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.get('/aux/industrias').then(r => setIndustries(r.data.data||[])).catch(()=>{}); }, []);
  useEffect(() => {
    setExistingTables([]); setNomeTabela('');
    if (!selInd) return;
    api.get(`/price-tables/${selInd}`).then(r => setExistingTables(r.data.data||[])).catch(()=>{});
  }, [selInd]);

  const tabelaFinal = nomeTabela === '__nova__' ? novaTabela : nomeTabela;

  const handleFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      if (rows.length < 2) { toast.error('Planilha vazia.'); return; }
      const hdrs = rows[0].map((h:any) => String(h));
      setHeaders(hdrs); setRawData(rows.slice(1)); setPreview(rows.slice(1,6));
      const auto: Record<string,string> = {};
      const norm = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
      MAGIC_FIELDS.forEach(f => {
        const fn = norm(f.key);
        const idx = hdrs.map(norm).findIndex(h => h.includes(fn) || fn.includes(h.substring(0,4)));
        if (idx >= 0) auto[f.key] = String(idx);
      });
      setMapping(auto); setStep('mapping');
    } catch { toast.error('Erro ao ler arquivo Excel.'); }
  };

  const doImport = async () => {
    if (!selInd || !tabelaFinal) { toast.error('Selecione indústria e tabela.'); return; }
    const get = (row:any[], key:string) => { const idx = mapping[key]; if (idx===undefined||idx==='') return ''; return String(row[parseInt(idx)]??'').trim(); };
    const produtos = rawData.map(row => ({
      codigo:get(row,'codigo'), descricao:get(row,'descricao'), precobruto:get(row,'precobruto'),
      precopromo:get(row,'precopromo'), precoespecial:get(row,'precoespecial'), ipi:get(row,'ipi'),
      st:get(row,'st'), embalagem:get(row,'embalagem'), peso:get(row,'peso'),
      conversao:get(row,'conversao'), aplicacao:get(row,'aplicacao'), codbarras:get(row,'codbarras'),
    })).filter(p => p.codigo);
    setStep('importing');
    try {
      const r = await api.post('/price-tables/import', {
        industria:parseInt(selInd), nomeTabela:tabelaFinal,
        dataTabela: new Date().toISOString().split('T')[0], produtos,
      });
      setResult(r.data); setStep('done');
    } catch (e:any) { toast.error(e?.response?.data?.message||'Erro.'); setStep('mapping'); }
  };

  const sel: CSSProperties = { width:'100%', height:42, padding:'0 12px', borderRadius:10, border:`2px solid ${C.slate200}`, background:C.white, fontSize:13, fontWeight:600, color:C.slate700, outline:'none', cursor:'pointer', appearance:'none' };

  if (step==='importing') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:280, gap:16 }}>
      <Loader2 size={40} color={C.emerald} style={{ animation:'spin 1s linear infinite' }} />
      <span style={{ fontSize:15, fontWeight:700, color:C.slate700 }}>Importando produtos...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (step==='done'&&result) return (
    <div style={{ maxWidth:700 }}>
      <ResultBox result={result} />
      <button onClick={() => { setStep('upload'); setResult(null); setRawData([]); setHeaders([]); }}
        style={{ ...btnBase, marginTop:16, padding:'10px 20px', border:`1px solid ${C.slate200}`, background:C.white, fontSize:13, color:C.slate600 }}>
        <ArrowLeft size={14} />Nova Importação
      </button>
    </div>
  );

  if (step==='mapping') return (
    <div style={{ maxWidth:860, display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:C.slate600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
            <Factory size={13} color={C.emerald} />Indústria *
          </label>
          <select value={selInd} onChange={e => setSelInd(e.target.value)} style={sel}>
            <option value="">Selecione...</option>
            {industries.map(i => <option key={i.value} value={String(i.value)}>{i.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:C.slate600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
            <Tag size={13} color="#3b82f6" />Tabela *
          </label>
          <select value={nomeTabela} onChange={e => setNomeTabela(e.target.value)} disabled={!selInd} style={{ ...sel, textTransform:'uppercase', fontWeight:700 }}>
            <option value="">Selecione...</option>
            <option value="__nova__">➕ CRIAR NOVA TABELA</option>
            {existingTables.map((t,i) => <option key={i} value={t.nome_tabela}>{t.nome_tabela}</option>)}
          </select>
        </div>
      </div>
      {nomeTabela==='__nova__' && (
        <input value={novaTabela} onChange={e => setNovaTabela(e.target.value.toUpperCase())} placeholder="Nome da nova tabela..."
          style={{ height:42, padding:'0 12px', borderRadius:10, border:`2px solid ${C.emeraldBorder}`, fontSize:13, fontWeight:700, color:C.slate800, outline:'none', textTransform:'uppercase', width:'50%', boxSizing:'border-box' }} />
      )}

      <div>
        <p style={{ fontSize:11, fontWeight:700, color:C.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
          Planilha: <strong style={{ color:C.slate800 }}>{headers.length} colunas</strong> · <strong style={{ color:C.slate800 }}>{rawData.length} linhas</strong>
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {MAGIC_FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ fontSize:11, fontWeight:700, color:C.slate600, marginBottom:4, display:'block' }}>{f.label}</label>
              <select value={mapping[f.key]??''} onChange={e => setMapping(p => ({ ...p, [f.key]:e.target.value }))} style={sel}>
                <option value="">— não mapear —</option>
                {headers.map((h,i) => <option key={i} value={String(i)}>Col {i+1}: {h||'(sem nome)'}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {preview.length > 0 && (
        <div style={{ ...card, overflow:'hidden' }}>
          <div style={{ background:C.slate50, padding:'8px 14px', borderBottom:`1px solid ${C.slate200}`, fontSize:10, fontWeight:700, color:C.slate500, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            Prévia — primeiras {preview.length} linhas
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead style={{ background:C.slate50 }}>
                <tr>{MAGIC_FIELDS.filter(f => mapping[f.key]!==undefined&&mapping[f.key]!=='').map(f => (
                  <th key={f.key} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:C.slate500, borderBottom:`1px solid ${C.slate200}` }}>{f.key.toUpperCase()}</th>
                ))}</tr>
              </thead>
              <tbody>
                {preview.map((row,i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.slate50}` }}>
                    {MAGIC_FIELDS.filter(f => mapping[f.key]!==undefined&&mapping[f.key]!=='').map(f => (
                      <td key={f.key} style={{ padding:'8px 10px', fontFamily:'monospace', color:C.slate700 }}>{String(row[parseInt(mapping[f.key])]??'')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', paddingTop:16, borderTop:`2px solid ${C.slate200}` }}>
        <button onClick={() => setStep('upload')}
          style={{ ...btnBase, padding:'10px 20px', border:`1px solid ${C.slate200}`, background:C.white, fontSize:13, color:C.slate600 }}>
          <ArrowLeft size={14} />Voltar
        </button>
        <button onClick={doImport} disabled={!selInd||!tabelaFinal}
          style={{ ...btnBase, padding:'10px 28px', fontSize:14, fontWeight:800,
            background:!selInd||!tabelaFinal ? C.slate200 : `linear-gradient(to right,${C.emerald},${C.emeraldDark})`,
            color:!selInd||!tabelaFinal ? C.slate400 : C.white,
            cursor:!selInd||!tabelaFinal ? 'not-allowed':'pointer',
            boxShadow:!selInd||!tabelaFinal ? 'none':`0 8px 24px -4px ${C.emerald}66` }}>
          <Wand2 size={16} />Importar {rawData.length} produto(s)
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:560 }}>
      <div onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
        style={{ border:`2px dashed ${C.slate200}`, borderRadius:20, padding:'64px 40px', textAlign:'center', cursor:'pointer', background:C.white, transition:'border-color .2s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.emerald)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = C.slate200)}>
        <Wand2 size={44} color={C.emerald} style={{ margin:'0 auto 16px', display:'block' }} />
        <div style={{ fontSize:17, fontWeight:900, color:C.slate800, marginBottom:8 }}>Arraste seu arquivo Excel aqui</div>
        <div style={{ fontSize:13, color:C.slate500, fontWeight:500, marginBottom:20 }}>ou clique para selecionar um arquivo .xlsx / .xls</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:12, background:'#1D1D1D', color:'#FFD200', fontSize:13, fontWeight:900 }}>
          <Wand2 size={15} />MAGIC IMPORT
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
        onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f); }} />
      <p style={{ marginTop:16, fontSize:11, color:C.slate400, fontWeight:600, textAlign:'center' }}>
        Detecção automática de colunas com mapeamento visual antes de importar.
      </p>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ImportacaoPrecosPage() {
  const [tab, setTab] = useState<'classic'|'magic'>('classic');
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f1f5f9 0%,#ffffff 50%,#ecfdf5 100%)' }}>
      {/* Tab switcher */}
      <div style={{ display:'flex', borderBottom:`2px solid ${C.slate200}`, background:C.white, position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px -2px rgba(0,0,0,0.06)', padding:'0 24px' }}>
        {([
          { key:'classic', label:'📋  Importar Tabela',  desc:'Colar colunas do Excel' },
          { key:'magic',   label:'✨  Magic Import',     desc:'Upload Excel com detecção automática' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'14px 24px', border:'none', background:'transparent', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2, borderBottom:`3px solid ${tab===t.key ? C.emerald : 'transparent'}`, transition:'border-color .2s' }}>
            <span style={{ fontSize:13, fontWeight: tab===t.key ? 800:600, color: tab===t.key ? C.slate800 : C.slate400 }}>{t.label}</span>
            <span style={{ fontSize:10, fontWeight:600, color:C.slate400 }}>{t.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:24 }}>
        {tab==='classic' ? <ClassicImport /> : <MagicImport />}
      </div>
    </div>
  );
}
