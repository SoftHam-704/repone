import { useState, useEffect, useRef, CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload, AlertCircle, CheckCircle2, Info, Sparkles, X, FileSpreadsheet,
  Calendar, Factory, Tag, Package, FileText, Barcode,
  ChevronLeft, ChevronRight, Plus, Wand2, ArrowLeft, Loader2, HelpCircle,
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
  | 'codigooriginal' | 'codbarras' | 'descontoadd' | 'ncm' | 'curva' | 'categoria' | 'conversao' | 'ciclo';

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
    fields: ['codigooriginal','codbarras','descontoadd','ncm','curva','categoria','conversao','ciclo'] as TextareaKey[] },
];

const FIELD_LABELS: Record<TextareaKey, { label: string; required: boolean; fullWidth?: boolean; wide?: boolean }> = {
  codigo:             { label: 'Código',             required: true  },
  complemento:        { label: 'Complemento',         required: false },
  nome:               { label: 'Nome do Produto',     required: true, fullWidth: true },
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
  ciclo:              { label: 'Ciclo (C=Corrente / L=Lançamento)', required: false },
};

const EMPTY: TextareasState = {
  codigo:'', complemento:'', nome:'', linha:'', precobruto:'', precopromo:'', precoespecial:'',
  grupo:'', aplicacao:'', embalagem:'', peso:'', ipi:'', st:'', prepeso:'',
  codigooriginal:'', codbarras:'', descontoadd:'', ncm:'', curva:'',
  categoria:'', conversao:'', itab_grupodesconto:'', ciclo:'',
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
  const [activeTab, setActiveTab]           = useState(0);
  const [formData, setFormData]             = useState({
    industria: '', nomeTabela: '',
    dataTabela: new Date().toISOString().split('T')[0], dataVencimento: '',
  });
  const [textareas, setTextareas]           = useState<TextareasState>(EMPTY);
  const [lineCounts, setLineCounts]         = useState<Record<string,number>>({});
  const [adjustments, setAdjustments]       = useState<Record<string,number>>({});
  const [isValid, setIsValid]               = useState(false);
  const [industries, setIndustries]         = useState<Industry[]>([]);
  const [existingTables, setExistingTables] = useState<ExistingTable[]>([]);
  const [importing, setImporting]           = useState(false);
  const [result, setResult]                 = useState<ImportResult | null>(null);
  const [progress, setProgress]             = useState({ current:0, total:0, percentage:0 });
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
          ciclo: (['C','c','L','l'].includes(get('ciclo',i))) ? get('ciclo',i).toUpperCase() : 'C',
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

  const getTabCount = (idx: number) => {
    const t = TABS[idx];
    const counts = t.fields.map(f => lineCounts[f] || 0).filter(c => c > 0);
    return counts.length > 0 ? counts[0] : 0;
  };

  const isExisting = existingTables.some(t => t.nome_tabela === formData.nomeTabela);
  const canImport  = isValid && !importing && !!formData.industria && !!formData.nomeTabela;

  // ── Design tokens ──
  const V = {
    bg: '#E8E1D4', bgField: '#F5F0E8', bgCard: '#FDFCFA',
    navy: '#1E2D3D', navyMid: '#28374A', navyBorder: '#334155',
    gold: '#B8962E', goldLight: '#D4A843',
    border: '#D4C9B8',
    textLight: '#E2D9C8', textMuted: '#94A3B8', textDim: '#64748B',
    white: '#ffffff', red: '#ef4444',
  };

  // ── TextareaField ──
  const TextareaField = ({ field }: { field: TextareaKey }) => {
    const cfg   = FIELD_LABELS[field];
    const count = lineCounts[field] || 0;
    const adj   = adjustments[field] || 0;
    const codigoCount = lineCounts.codigo || 0;
    const mismatch = count > 0 && codigoCount > 0 && count !== codigoCount;
    const span = cfg.fullWidth ? { gridColumn:'span 3' } : cfg.wide ? { gridColumn:'span 2' } : {};
    return (
      <div style={{ background:V.white, borderRadius:9, border:`1px solid ${mismatch ? V.red : V.border}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', ...span }}>
        <div style={{ background:cfg.required ? V.navy : V.navyMid, padding:'7px 11px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:9, fontWeight:900, color:cfg.required ? V.gold : V.textMuted, letterSpacing:'0.8px', textTransform:'uppercase' }}>
            {cfg.label}{cfg.required && <span style={{ color:V.red, marginLeft:3 }}>*</span>}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            {adj > 0 && <span style={{ fontSize:8, color:V.gold, fontWeight:700 }}>{adj}↓</span>}
            <span onClick={() => setTextareas(p => ({ ...p, [field]:'' }))} title="Limpar"
              style={{ background:cfg.required ? V.navyMid : V.navy, borderRadius:10, padding:'2px 9px', fontSize:9, color:mismatch ? V.red : V.textMuted, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:13, fontWeight:900, color:mismatch ? V.red : V.gold, lineHeight:1 }}>{count}</span>
              <span style={{ fontSize:8, color:mismatch ? V.red : V.textLight, letterSpacing:'0.3px' }}>linhas</span>
            </span>
          </div>
        </div>
        <textarea
          value={textareas[field]}
          onChange={e => setTextareas(p => ({ ...p, [field]:e.target.value }))}
          placeholder="Cole aqui..."
          style={{ width:'100%', flex:1, minHeight:160, padding:14, fontFamily:'monospace', fontSize:15, resize:'vertical', border:'none', outline:'none', background:V.bgCard, color:V.navy, whiteSpace:'pre', overflowWrap:'normal', overflowX:'auto', lineHeight:1.7, boxSizing:'border-box' }}
        />
      </div>
    );
  };

  return (
    <div style={{ fontFamily:'system-ui', background:V.bg }}>

      {/* ── Navy Header ── */}
      <div style={{ background:V.navy, padding:'16px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ width:36, height:36, background:V.gold, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <FileSpreadsheet size={18} color={V.navy} />
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:'white', letterSpacing:'-0.3px' }}>Importação de Tabela de Preços</div>
            <div style={{ fontSize:10, color:V.textMuted, marginTop:1 }}>Cole as colunas do Excel nos campos correspondentes</div>
          </div>
          {isValid && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, background:'rgba(184,150,46,0.15)', border:`1px solid ${V.gold}66`, borderRadius:8, padding:'5px 12px', flexShrink:0 }}>
              <CheckCircle2 size={14} color={V.gold} />
              <span style={{ fontSize:11, fontWeight:900, color:V.gold }}>{lineCounts.codigo} prontos</span>
            </div>
          )}
        </div>

        {/* Config fields */}
        <div style={{ display:'grid', gridTemplateColumns:'2.5fr 2fr 1.2fr 1.2fr auto', gap:10, alignItems:'end' }}>
          <div>
            <div style={{ fontSize:8, color:V.gold, fontWeight:800, letterSpacing:'0.8px', marginBottom:4 }}>INDÚSTRIA *</div>
            <select value={String(formData.industria)}
              onChange={e => setFormData(p => ({ ...p, industria:e.target.value, nomeTabela:'' }))}
              style={{ width:'100%', height:34, padding:'0 10px', borderRadius:7, border:`1px solid ${V.navyBorder}`, background:V.navyMid, fontSize:11, fontWeight:600, color:V.textLight, outline:'none', cursor:'pointer', appearance:'none' }}>
              <option value="">Selecione a indústria...</option>
              {industries.map(i => <option key={i.value} value={String(i.value)}>{i.label}</option>)}
            </select>
          </div>

          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ fontSize:8, color:V.gold, fontWeight:800, letterSpacing:'0.8px' }}>TABELA *</div>
              {formData.industria && existingTables.length > 0 && !showNewTableInput && (
                <button onClick={() => setShowNewTableInput(true)}
                  style={{ fontSize:8, color:V.gold, fontWeight:800, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:2 }}>
                  <Plus size={8} />NOVA
                </button>
              )}
            </div>
            {formData.industria && existingTables.length > 0 && !showNewTableInput ? (
              <select value={formData.nomeTabela}
                onChange={e => { if (e.target.value === '__NEW__') { setFormData(p => ({ ...p, nomeTabela:'' })); setShowNewTableInput(true); } else setFormData(p => ({ ...p, nomeTabela:e.target.value })); }}
                style={{ width:'100%', height:34, padding:'0 10px', borderRadius:7, border:`1px solid ${V.gold}`, background:V.navyMid, fontSize:11, fontWeight:800, color:V.textLight, outline:'none', cursor:'pointer', appearance:'none', textTransform:'uppercase' }}>
                <option value="">Selecione...</option>
                <option value="__NEW__">➕ CRIAR NOVA</option>
                {existingTables.map((t,i) => (
                  <option key={i} value={t.nome_tabela}>{t.nome_tabela} ({t.total_produtos})</option>
                ))}
              </select>
            ) : (
              <div style={{ position:'relative' }}>
                <input type="text" value={formData.nomeTabela}
                  onChange={e => setFormData(p => ({ ...p, nomeTabela:e.target.value.toUpperCase() }))}
                  placeholder="Ex: PADRAO..."
                  disabled={!formData.industria}
                  style={{ width:'100%', height:34, padding:'0 10px', paddingRight:existingTables.length > 0 ? 28 : 10, borderRadius:7, border:`1px solid ${V.gold}`, background:V.navyMid, fontSize:11, fontWeight:800, color:V.textLight, outline:'none', textTransform:'uppercase', boxSizing:'border-box' }} />
                {existingTables.length > 0 && (
                  <button onClick={() => { setShowNewTableInput(false); setFormData(p => ({ ...p, nomeTabela:'' })); }}
                    style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:V.textDim, display:'flex', padding:2 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize:8, color:V.textMuted, fontWeight:800, letterSpacing:'0.8px', marginBottom:4 }}>DATA TABELA</div>
            <input type="date" className="classic-date-input" value={formData.dataTabela}
              onChange={e => setFormData(p => ({ ...p, dataTabela:e.target.value }))}
              style={{ width:'100%', height:34, padding:'0 8px', borderRadius:7, border:`1px solid ${V.navyBorder}`, background:V.navyMid, fontSize:11, color:V.textLight, outline:'none', boxSizing:'border-box', colorScheme:'dark' }} />
          </div>

          <div>
            <div style={{ fontSize:8, color:V.textMuted, fontWeight:800, letterSpacing:'0.8px', marginBottom:4 }}>VALIDADE</div>
            <input type="date" className="classic-date-input" value={formData.dataVencimento}
              onChange={e => setFormData(p => ({ ...p, dataVencimento:e.target.value }))}
              style={{ width:'100%', height:34, padding:'0 8px', borderRadius:7, border:`1px solid ${V.navyBorder}`, background:V.navyMid, fontSize:11, color:V.textLight, outline:'none', boxSizing:'border-box', colorScheme:'dark' }} />
          </div>

          <button onClick={handleImport} disabled={!canImport}
            style={{ background:canImport ? `linear-gradient(135deg,${V.gold} 0%,${V.goldLight} 60%,#E8B84B 100%)` : V.navyBorder, borderRadius:9, padding:'0 20px', height:36, border: canImport ? `1px solid ${V.goldLight}88` : 'none', cursor:canImport ? 'pointer' : 'not-allowed', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:7, boxShadow: canImport ? `0 4px 16px rgba(184,150,46,0.45), inset 0 1px 0 rgba(255,255,255,0.2)` : 'none', transition:'box-shadow .2s' }}>
            {importing
              ? <><div style={{ width:13, height:13, border:`2px solid rgba(0,0,0,0.25)`, borderTopColor:V.navy, borderRadius:'50%', animation:'spin 1s linear infinite' }} /><span style={{ fontSize:11, fontWeight:900, color:V.navy }}>Importando...</span></>
              : <><Upload size={13} color={canImport ? V.navy : V.textDim} /><span style={{ fontSize:12, fontWeight:900, color:canImport ? V.navy : V.textDim, letterSpacing:'0.2px' }}>⚡ Importar</span></>
            }
          </button>
        </div>

        {/* Status banner */}
        {formData.nomeTabela && (
          <div style={{ marginTop:10, background:V.navyMid, borderRadius:7, padding:'8px 12px', display:'flex', alignItems:'center', gap:8, border:`1px solid ${(isExisting ? '#D97706' : V.gold)}33` }}>
            <div style={{ width:7, height:7, background:isExisting ? '#D97706' : V.gold, borderRadius:'50%', flexShrink:0 }} />
            <span style={{ fontSize:10, color:isExisting ? '#D97706' : V.gold, fontWeight:700 }}>
              Modo: {isExisting ? 'ATUALIZAR TABELA' : 'CRIAR NOVA TABELA'}
            </span>
            <span style={{ fontSize:10, color:V.textDim }}>
              — Tabela "{formData.nomeTabela}" {isExisting
                ? `(${existingTables.find(t => t.nome_tabela === formData.nomeTabela)?.total_produtos || 0} produtos)`
                : 'será criada'}
            </span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ background:V.bg, borderBottom:`2px solid ${V.border}`, padding:'0 20px', display:'flex', gap:2 }}>
        {TABS.map((tab, idx) => {
          const Icon = tab.Icon;
          const count = getTabCount(idx);
          const isActive = activeTab === idx;
          return (
            <button key={tab.id} onClick={() => setActiveTab(idx)}
              style={{ padding:'10px 16px', fontSize:11, fontWeight:isActive ? 900 : 700, color:isActive ? V.navy : V.textMuted, border:'none', background:'transparent', cursor:'pointer', borderBottom:`3px solid ${isActive ? V.gold : 'transparent'}`, marginBottom:'-2px', display:'flex', alignItems:'center', gap:6, transition:'all .15s', flexShrink:0 }}>
              <Icon size={13} color={isActive ? V.navy : V.textMuted} />
              {tab.label}
              {count > 0 && (
                <span style={{ background:isActive ? V.gold : V.border, color:isActive ? V.navy : V.textDim, borderRadius:10, padding:'1px 7px', fontSize:9, fontWeight:900 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Field grid ── */}
      <div style={{ padding:'16px 20px', background:V.bgField }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          {TABS[activeTab].fields.map(field => <TextareaField key={field} field={field} />)}
        </div>

        {!isValid && Object.values(lineCounts).some(c => c > 0) && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fef2f2', border:`1px solid #fecaca`, borderRadius:8 }}>
            <AlertCircle size={14} color={V.red} />
            <span style={{ fontSize:11, fontWeight:600, color:'#7f1d1d' }}>
              Número de linhas inconsistente. Todos os campos preenchidos devem ter o mesmo total.
            </span>
          </div>
        )}
      </div>

      {/* ── Progress Bar ── */}
      {importing && progress.total > 0 && (
        <div style={{ padding:'12px 20px', background:V.navyMid, borderTop:`1px solid ${V.navyBorder}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:V.textLight }}>Lote {progress.current} / {progress.total}</span>
            <span style={{ fontSize:14, fontWeight:900, color:V.gold }}>{progress.percentage}%</span>
          </div>
          <div style={{ width:'100%', height:6, background:V.navyBorder, borderRadius:3, overflow:'hidden' }}>
            <motion.div style={{ height:'100%', background:`linear-gradient(to right,${V.gold},${V.goldLight})` }}
              initial={{ width:0 }} animate={{ width:`${progress.percentage}%` }} transition={{ duration:0.3 }} />
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {result && (
        <div style={{ padding:'16px 20px', background:V.bgField }}>
          <ResultBox result={result} />
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ background:V.bg, padding:'12px 20px', borderTop:`1px solid ${V.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:V.bgField, border:`1px solid ${V.border}`, borderRadius:8, padding:'8px 12px' }}>
          <Info size={13} color={V.textDim} />
          <span style={{ fontSize:10, color:V.textDim, fontWeight:600 }}>Use as abas para navegar entre os grupos de campos</span>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => { setTextareas(EMPTY); setResult(null); }}
            style={{ border:`1px solid ${V.border}`, borderRadius:7, padding:'7px 14px', fontSize:11, color:V.textDim, fontWeight:700, background:V.white, cursor:'pointer' }}>
            Limpar Tudo
          </button>
          <button onClick={handleImport} disabled={!canImport}
            style={{ background:canImport ? `linear-gradient(135deg,${V.gold} 0%,${V.goldLight} 60%,#E8B84B 100%)` : V.border, borderRadius:10, padding:'11px 30px', fontSize:13, fontWeight:900, color:canImport ? V.navy : V.textDim, cursor:canImport ? 'pointer' : 'not-allowed', border: canImport ? `1px solid ${V.goldLight}99` : `1px solid ${V.border}`, display:'flex', alignItems:'center', gap:8, boxShadow: canImport ? `0 6px 24px rgba(184,150,46,0.5), 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)` : 'none', letterSpacing:'0.3px', transition:'box-shadow .2s' }}>
            {importing
              ? <><div style={{ width:15, height:15, border:`2px solid rgba(0,0,0,0.2)`, borderTopColor:V.navy, borderRadius:'50%', animation:'spin 1s linear infinite' }} /><span>Importando...</span></>
              : <><Upload size={15} /><span>⚡ Importar Tabela</span></>
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .classic-date-input::-webkit-calendar-picker-indicator { filter: brightness(0) invert(0.75); cursor: pointer; }
        .classic-date-input::-webkit-datetime-edit { color: #E2D9C8; }
        .classic-date-input::-webkit-datetime-edit-fields-wrapper { color: #E2D9C8; }
        .classic-date-input::-webkit-datetime-edit-text { color: #94A3B8; }
      `}</style>
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
  { key:'codigo',        label:'Código *',          required:true  },
  { key:'descricao',     label:'Descrição *',        required:true  },
  { key:'linha',         label:'Marca / Linha',      required:false },
  { key:'precobruto',    label:'Preço Normal *',     required:true  },
  { key:'precopromo',    label:'Preço Promoção',     required:false },
  { key:'precoespecial', label:'Preço Especial',     required:false },
  { key:'ipi',           label:'IPI %',              required:false },
  { key:'st',            label:'ST %',               required:false },
  { key:'embalagem',     label:'Embalagem',          required:false },
  { key:'peso',          label:'Peso (kg)',           required:false },
  { key:'conversao',     label:'Conversão',          required:false },
  { key:'aplicacao',     label:'Aplicação',          required:false },
  { key:'grupo',         label:'Grupo de Produto',   required:false },
  { key:'codbarras',     label:'Código de Barras',   required:false },
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
      const dataRows = rows.slice(1).filter((row: any[]) => row.some(cell => String(cell).trim() !== ''));
      setHeaders(hdrs); setRawData(dataRows); setPreview(dataRows.slice(0, 6));
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
      codigo:get(row,'codigo'), descricao:get(row,'descricao'), linha:get(row,'linha'),
      precobruto:get(row,'precobruto'),
      precopromo:get(row,'precopromo'), precoespecial:get(row,'precoespecial'), ipi:get(row,'ipi'),
      st:get(row,'st'), embalagem:get(row,'embalagem'), peso:get(row,'peso'),
      conversao:get(row,'conversao'), aplicacao:get(row,'aplicacao'),
      grupo:get(row,'grupo'), codbarras:get(row,'codbarras'),
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

// ─── Modal de Ajuda — Tabela de Preços ───────────────────────────────────────

function TabelaHelpModal({ onClose }: { onClose: () => void }) {
  const navy = '#0F1E2E', gold = '#B8962E', dim = '#7A9BB5', light = '#E8F0F7';
  const sec: React.CSSProperties = { marginBottom: 28 };
  const h2: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: gold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 };
  const p: React.CSSProperties = { fontSize: 12, color: dim, lineHeight: 1.8, marginBottom: 8 };
  const tip = (accent = gold): React.CSSProperties => ({ background: 'rgba(184,150,46,0.08)', border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: light, lineHeight: 1.75, marginBottom: 8 });
  const step = (n: number): React.CSSProperties => ({ width: 22, height: 22, borderRadius: '50%', background: gold, color: navy, fontWeight: 900, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });
  const badge = (txt: string, color = gold) => (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, background: `${color}22`, border: `1px solid ${color}55`, color, fontWeight: 900, fontSize: 10, marginRight: 4 }}>{txt}</span>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(5,15,25,0.7)' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101, width: 600, background: '#0D1B2A', boxShadow: '-8px 0 40px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ background: '#0F1E2E', borderBottom: '1px solid #1E3A52', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, background: gold, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={18} color={navy} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>Guia — Tabela de Preços</div>
              <div style={{ fontSize: 11, color: dim, marginTop: 1 }}>Como importar e manter as tabelas atualizadas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', color: dim, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', color: light }}>

          <div style={sec}>
            <div style={h2}><Package size={13} color={gold} /> Para que serve a Tabela de Preços?</div>
            <p style={p}>A tabela de preços é a <strong style={{ color: light }}>base de referência para precificação dos pedidos</strong>. Quando o rep cria um pedido, o sistema consulta automaticamente a tabela ativa da indústria para sugerir os preços dos produtos.</p>
            <p style={p}>Manter as tabelas atualizadas garante que os pedidos reflitam os preços corretos — especialmente após reajustes da indústria.</p>
          </div>

          <div style={sec}>
            <div style={h2}><FileText size={13} color={gold} /> O que é cada campo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { campo: 'INDÚSTRIA', desc: 'Fornecedor dono desta tabela. Cada tabela pertence a uma única indústria.' },
                { campo: 'TABELA', desc: 'Nome que identifica a tabela. Use nomes claros como TABELA_JAN2026 ou STANDARD_2026. A mesma indústria pode ter múltiplas tabelas (ex: tabela padrão + tabela especial para rede).' },
                { campo: 'DATA', desc: 'Data de vigência — quando os preços entram em vigor.' },
                { campo: 'VENCIMENTO', desc: 'Data limite de validade. Opcional — deixe em branco para tabelas sem prazo.' },
              ].map(f => (
                <div key={f.campo} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid #1E3A52' }}>
                  <div style={{ minWidth: 110, fontWeight: 900, fontSize: 11, color: gold, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.campo}</div>
                  <div style={{ fontSize: 12, color: dim, lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><Upload size={13} color={gold} /> Como preparar o Excel e importar</div>

            {[
              { n: 1, titulo: 'Abra a tabela da indústria no Excel', texto: 'A indústria envia a lista de preços geralmente em .xlsx ou .xls. Abra no Excel normalmente.' },
              { n: 2, titulo: 'Identifique as colunas necessárias', texto: 'Você precisa de: (1) código do produto, (2) descrição/nome, (3) preço. Podem ter nomes diferentes — "Cód.", "Referência", "Produto", "Preço Tab.", "PMC", etc.' },
              { n: 3, titulo: 'Selecione e copie cada coluna', texto: 'Clique no cabeçalho da coluna para selecionar tudo, depois Ctrl+C. Cole no campo correspondente aqui no sistema. Repita para as 3 colunas.' },
              { n: 4, titulo: 'Preencha indústria, nome da tabela e datas', texto: 'Selecione a indústria e escolha uma tabela existente (para atualizar) ou crie uma nova.' },
              { n: 5, titulo: 'Clique em Importar', texto: 'O sistema valida e importa os produtos. Produtos já existentes na tabela são atualizados automaticamente.' },
            ].map(item => (
              <div key={item.n} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={step(item.n)}>{item.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 12, color: light, marginBottom: 3 }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: dim, lineHeight: 1.7 }}>{item.texto}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={sec}>
            <div style={h2}><Tag size={13} color={gold} /> Tabela existente vs Nova tabela</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={tip()}>
                <strong style={{ color: gold }}>Atualizar tabela existente</strong> — Selecione o nome da tabela já cadastrada. Os produtos serão atualizados com os novos preços. Use quando a indústria envia um reajuste sobre a mesma tabela.
              </div>
              <div style={tip('#7C3AED')}>
                <strong style={{ color: '#A78BFA' }}>Criar nova tabela</strong> — Clique em "+ NOVA" e dê um nome diferente. Os produtos antigos da outra tabela continuam intactos. Use quando a indústria lança uma tabela completamente nova (ex: novo ano, nova linha de produtos).
              </div>
            </div>
          </div>

          <div style={sec}>
            <div style={h2}><Sparkles size={13} color={gold} /> Dicas Práticas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Se a coluna de preços no Excel tiver R$ ou separador de milhar, o sistema interpreta automaticamente — não precisa limpar.',
                'Códigos com zeros à esquerda (ex: 00123) são preservados. Não altere o formato da coluna.',
                'Se a indústria mandar colunas extras (margem, desconto, SKU), ignore-as — copie apenas código, nome e preço.',
                'Use nomes de tabela padronizados: TABELA_2026, ESPECIAL_REDE_2026. Facilita encontrar depois.',
                'Após importar, abra um pedido e verifique se os preços estão aparecendo corretamente para essa indústria.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, ...tip(), alignItems: 'flex-start' }}>
                  <CheckCircle2 size={12} color={gold} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function ImportacaoPrecosPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'classic'|'magic'>(searchParams.get('tab') === 'magic' ? 'magic' : 'classic');
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div style={{ minHeight:'100vh', background: tab==='classic' ? '#E8E1D4' : 'linear-gradient(135deg,#f1f5f9 0%,#ffffff 50%,#ecfdf5 100%)' }}>
      {showHelp && <TabelaHelpModal onClose={() => setShowHelp(false)} />}
      {/* Tab switcher */}
      <div style={{ display:'flex', alignItems:'center', background:'#1E2D3D', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px -2px rgba(0,0,0,0.3)', padding:'0 20px' }}>
        {([
          { key:'classic', label:'📋  Importar Tabela',  desc:'Colar colunas do Excel' },
          { key:'magic',   label:'✨  Magic Import',     desc:'Upload Excel com detecção automática' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'12px 20px', border:'none', background:'transparent', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2, borderBottom:`3px solid ${tab===t.key ? '#B8962E' : 'transparent'}`, transition:'border-color .2s' }}>
            <span style={{ fontSize:13, fontWeight:tab===t.key ? 800:600, color:tab===t.key ? 'white' : '#94A3B8' }}>{t.label}</span>
            <span style={{ fontSize:10, fontWeight:600, color:'#64748B' }}>{t.desc}</span>
          </button>
        ))}
        <button onClick={() => setShowHelp(true)}
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'1px solid #2E4A66', background:'rgba(184,150,46,0.08)', cursor:'pointer', color:'#B8962E', fontSize:11, fontWeight:800 }}>
          <HelpCircle size={13} /> Ajuda
        </button>
      </div>
      {tab==='classic' ? <ClassicImport /> : (
        <div style={{ padding:24 }}><MagicImport /></div>
      )}
    </div>
  );
}
