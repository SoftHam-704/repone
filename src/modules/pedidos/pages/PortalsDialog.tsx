import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Building2, ExternalLink, Globe, ArrowRight, CheckCircle2, FileUp, Upload, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

const authHeaders = (): Record<string, string> => ({
    'Authorization': `Bearer ${localStorage.getItem('sm_token') || ''}`,
});

// ─── Inline async client search ──────────────────────────────────────────────
interface ClientOption { value: number; label: string; }

function ClientSearchInput({
    value, onChange
}: { value: number | ''; onChange: (val: number | '', name: string) => void }) {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<ClientOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!value) { setSelected(''); setQuery(''); }
    }, [value]);

    const search = (q: string) => {
        setQuery(q);
        setOpen(true);
        if (timer.current) clearTimeout(timer.current);
        if (q.length < 2) { setOptions([]); return; }
        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/clients?search=${encodeURIComponent(q)}&situacao=A&limit=15`, { headers: authHeaders() });
                const json = await res.json();
                const list = (json.data || []).map((c: any) => ({
                    value: c.cli_codigo,
                    label: `${c.cli_nomred || c.cli_nome} - ${c.cli_cnpj}`
                }));
                setOptions(list);
            } catch { setOptions([]); }
            finally { setLoading(false); }
        }, 300);
    };

    const pick = (opt: ClientOption) => {
        setSelected(opt.label);
        setQuery(opt.label);
        setOpen(false);
        onChange(opt.value, opt.label);
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={query}
                onChange={e => search(e.target.value)}
                onFocus={() => query.length >= 2 && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                placeholder="BUSCAR CLIENTE POR NOME OU CNPJ..."
                className="w-full px-4 py-3 bg-white border border-stone-300 font-mono text-xs text-stone-700 outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 uppercase"
            />
            {open && (loading || options.length > 0) && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-stone-200 shadow-xl max-h-48 overflow-y-auto">
                    {loading && <div className="p-3 text-[10px] font-mono text-stone-400 uppercase tracking-widest text-center">Buscando...</div>}
                    {options.map(opt => (
                        <button key={opt.value} onMouseDown={() => pick(opt)}
                            className="w-full text-left px-4 py-2 text-xs font-mono text-stone-700 hover:bg-stone-100 truncate">
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Inline price table search ────────────────────────────────────────────────
interface PriceTableOption { value: string; label: string; }

function PriceTableSearchInput({
    industryId, value, onChange
}: { industryId: number | null; value: string; onChange: (val: string) => void }) {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<PriceTableOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!value) { setQuery(''); }
    }, [value]);

    const doSearch = (q: string) => {
        if (!industryId) { setOptions([]); return; }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `${API_BASE}/price-tables/${industryId}`,
                    { headers: authHeaders() }
                );
                const json = await res.json();
                const lowerQ = q.toLowerCase();
                const list = (json.data || [])
                    .filter((t: any) => !lowerQ || (t.nome_tabela || '').toLowerCase().includes(lowerQ))
                    .map((t: any) => ({
                        label: t.nome_tabela || String(t.tab_codigo),
                        value: t.nome_tabela || ''
                    }));
                setOptions(list);
            } catch { setOptions([]); }
            finally { setLoading(false); }
        }, 200);
    };

    const search = (q: string) => {
        setQuery(q);
        setOpen(true);
        doSearch(q);
    };

    const pick = (opt: PriceTableOption) => {
        setQuery(opt.label);
        setOpen(false);
        onChange(opt.value);
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={query}
                onChange={e => search(e.target.value)}
                onFocus={() => { setOpen(true); doSearch(query); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                placeholder="BUSCAR TABELA DE PREÇOS..."
                className="w-full px-4 py-3 bg-white border border-emerald-200 font-mono text-xs text-stone-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase"
            />
            {open && (loading || options.length > 0) && (
                <div className="absolute z-50 top-full left-0 right-0 bg-white border border-stone-200 shadow-xl max-h-48 overflow-y-auto">
                    {loading && <div className="p-3 text-[10px] font-mono text-stone-400 uppercase tracking-widest text-center">Buscando...</div>}
                    {options.map((opt, i) => (
                        <button key={i} onMouseDown={() => pick(opt)}
                            className="w-full text-left px-4 py-2 text-xs font-mono text-stone-700 hover:bg-stone-100 truncate">
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface PortalsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId?: string | null;
}

const PortalsDialog: React.FC<PortalsDialogProps> = ({ open, onOpenChange, orderId }) => {
    const [activeIndustries, setActiveIndustries] = useState<string[]>([]);
    const [allIndustries, setAllIndustries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Import mode state
    const [importMode, setImportMode] = useState(false);
    const [importPortal, setImportPortal] = useState<string>('');
    const [importClient, setImportClient] = useState<number | ''>('');
    const [importClientName, setImportClientName] = useState('');
    const [importText, setImportText] = useState('');
    const [importPriceTable, setImportPriceTable] = useState('');
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const [selectedIndustryId, setSelectedIndustryId] = useState<number | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);

    // PARAFLU state
    const [parafluMode, setParafluMode] = useState(false);
    const [parafluPreview, setParafluPreview] = useState<any>(null);
    const [parafluFile, setParafluFile] = useState<File | null>(null);
    const [isParafluProcessing, setIsParafluProcessing] = useState(false);
    const [parafluResult, setParafluResult] = useState<any>(null);

    const allPortals = [
        "TSA", "VIEMAR",
        "BORG", "PATRAL",
        "SINALSUL", "ARCA",
        "PHINIA", "STAHL",
        "NINO", "SAMPEL",
        "POLO", "DRIVEWAY",
        "3RHO", "IGUAÇU",
        "PARAFLU", "OSPINA"
    ];

    useEffect(() => {
        const fetchIndustries = async () => {
            if (!open) return;
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE}/aux/industrias`, { headers: authHeaders() });
                const json = await response.json();
                console.log('[PortaisDialog] industrias response:', json);
                if (json.success) {
                    setAllIndustries(json.data);
                    const names = json.data.map((i: any) =>
                        `${i.for_nomered || i.label || ''} ${i.for_nome || ''}`.trim().toUpperCase()
                    );
                    console.log('[PortaisDialog] activeIndustries:', names);
                    setActiveIndustries(names);
                } else {
                    console.error('[PortaisDialog] API erro:', json.message);
                    toast.error(`Erro ao carregar portais: ${json.message || 'resposta inválida'}`);
                }
            } catch (error) {
                console.error('[PortaisDialog] fetch falhou:', error);
                toast.error('Não foi possível carregar os portais disponíveis.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchIndustries();
    }, [open]);

    const normalize = (s: string) =>
        (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

    const portals = allPortals.filter(portal =>
        activeIndustries.some(ind => normalize(ind).includes(normalize(portal)))
    );

    // ─── Download helper ──────────────────────────────────────────────────────
    const downloadBlob = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    // ─── Export handlers ──────────────────────────────────────────────────────
    const exportPortal = async (portal: string, method: string, ext: string, label: string) => {
        if (!orderId) { toast.error('Este portal requer um pedido salvo para exportação.'); return; }
        const toastId = toast.loading(`Gerando arquivo ${label}...`);
        try {
            const res = await fetch(`${API_BASE}/orders/${orderId}/export/${portal}`, {
                method,
                headers: { 'Content-Type': 'application/json', ...authHeaders() }
            });
            if (res.ok) {
                const blob = await res.blob();
                const filename = portal === 'sampel'
                    ? `SAMPEL_${orderId}.${ext}`
                    : `${orderId}.${ext}`;
                downloadBlob(blob, filename);
                toast.success(`Arquivo ${filename} baixado com sucesso!`, { id: toastId });
            } else {
                const data = await res.json();
                toast.error(`Erro: ${data.message || 'Falha no download'}`, { id: toastId });
            }
        } catch (error) {
            console.error(`Erro exportação ${portal}:`, error);
            toast.error('Erro ao conectar com servidor.', { id: toastId });
        }
    };

    // ─── PARAFLU handlers ─────────────────────────────────────────────────────
    const handleParafluFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setParafluFile(file);
        setIsParafluProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${API_BASE}/portal/paraflu/preview`, {
                method: 'POST',
                headers: authHeaders(),
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                setParafluPreview(data);
                toast.success(`${data.totalNFes} NFes identificadas na planilha!`);
            } else {
                toast.error(data.message || 'Erro ao analisar planilha.');
            }
        } catch (err) {
            console.error('❌ [PARAFLU] Preview error:', err);
            toast.error('Erro ao processar planilha Paraflu.');
        } finally {
            setIsParafluProcessing(false);
            event.target.value = '';
        }
    };

    const handleParafluImport = async () => {
        if (!parafluFile && !parafluPreview) { toast.error('Selecione a planilha primeiro.'); return; }
        setIsParafluProcessing(true);
        const toastId = toast.loading('Importando faturamento Paraflu...');
        try {
            const fileInput = document.getElementById('paraflu-file-input') as HTMLInputElement;
            const file = fileInput?.files?.[0] || parafluFile;
            if (!file) {
                toast.error('Arquivo não encontrado. Selecione novamente.', { id: toastId });
                setIsParafluProcessing(false);
                return;
            }
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${API_BASE}/portal/paraflu/import`, {
                method: 'POST',
                headers: authHeaders(),
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                setParafluResult(data);
                toast.success(data.message, { id: toastId });
            } else {
                toast.error(data.message || 'Erro na importação.', { id: toastId });
            }
        } catch (err) {
            console.error('❌ [PARAFLU] Import error:', err);
            toast.error('Erro ao importar faturamento.', { id: toastId });
        } finally {
            setIsParafluProcessing(false);
        }
    };

    const resetParafluMode = () => {
        setParafluMode(false);
        setParafluPreview(null);
        setParafluFile(null);
        setParafluResult(null);
        setIsParafluProcessing(false);
    };

    // ─── Import mode handlers (PATRAL / ARCA) ────────────────────────────────
    const handlePortalClick = (portal: string) => {
        if (portal === 'PARAFLU') { setParafluMode(true); return; }
        if (portal === 'STAHL')   { exportPortal('stahl', 'POST', 'txt', 'STAHL'); return; }
        if (portal === 'IGUAÇU')  { exportPortal('iguacu', 'POST', 'xml', 'IGUAÇU'); return; }
        if (portal === 'VIEMAR')  { exportPortal('viemar', 'POST', 'xlsx', 'VIEMAR'); return; }
        if (portal === 'SAMPEL')  { exportPortal('sampel', 'GET', 'xlsx', 'SAMPEL'); return; }
        if (portal === 'POLO')    { exportPortal('polo', 'POST', 'csv', 'POLO'); return; }
        if (portal === 'OSPINA')  { exportPortal('ospina', 'POST', 'txt', 'OSPINA'); return; }

        // PATRAL / ARCA → import mode
        setImportPortal(portal);
        setImportMode(true);
        setImportText('');
        setImportClient('');
        setImportClientName('');
        setImportPriceTable('');

        const foundIndustry = allIndustries.find(i => {
            const fullName = `${i.for_nomered || i.label || ''} ${i.for_nome || ''}`.trim();
            return normalize(fullName).includes(normalize(portal));
        });
        setSelectedIndustryId(foundIndustry ? (foundIndustry.for_codigo || foundIndustry.value) : null);
    };

    const handleExcelFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsProcessingFile(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

            let items: any[] = [];
            const isArcaPda = rows.slice(0, 15).some((row: any) =>
                row && row.some((cell: any) => typeof cell === 'string' && cell.includes('ARCA RETENTORES'))
            );

            if (isArcaPda) {
                rows.forEach((row: any) => {
                    if (row && row.length > 16) {
                        const seq = row[4];
                        const code = row[11] || row[8];
                        const desc = row[6];
                        const qtyStr = row[15] || row[12];
                        const priceStr = row[16] || row[13];
                        if (seq && !isNaN(seq) && qtyStr && priceStr) {
                            const cleanNum = (val: any) => {
                                if (!val) return 0;
                                return parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'));
                            };
                            const parsedQty = cleanNum(qtyStr);
                            if (parsedQty > 0) {
                                items.push({
                                    codigo: String(code || '').trim().toUpperCase(),
                                    ite_produto: String(code || '').trim().toUpperCase(),
                                    descricao: desc || 'Item Importado (ARCA PDA)',
                                    quantidade: parsedQty,
                                    ite_quant: parsedQty,
                                    preco_unitario: cleanNum(priceStr),
                                    portal_price: cleanNum(priceStr),
                                    markup: 0
                                });
                            }
                        }
                    }
                });
            } else {
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
                jsonData.forEach(row => {
                    const codigo = row["CÓDIGO"] || row["Codigo"] || row["codigo"] || row["ITEM"] || row["PRODUTO"] || row["Referência"] || row["REFERENCIA"];
                    const quant = parseFloat(row["QUANTIDADE"] || row["Quantidade"] || row["quantidade"] || row["QTD"] || 0);
                    const preco = parseFloat(row["PREÇO UNITÁRIO"] || row["Preço Unitário"] || row["PRECO"] || row["VALOR"] || row["PRECO UNIT"] || 0);
                    if (codigo && quant > 0) {
                        items.push({
                            codigo: String(codigo).trim().toUpperCase(),
                            ite_produto: String(codigo).trim().toUpperCase(),
                            descricao: row["DESCRIÇÃO"] || row["Descricao"] || row["desc"] || row["NOME"] || 'Produto Importado (Excel)',
                            quantidade: quant, ite_quant: quant,
                            preco_unitario: preco, portal_price: preco, markup: 0
                        });
                    }
                });
            }

            if (items.length === 0) {
                toast.error('Nenhum item válido identificado no arquivo Excel.');
            } else {
                setImportPreview(items);
                toast.success(`${items.length} itens identificados no Excel da ARCA!`);
            }
        } catch (error) {
            console.error('Erro ao ler Excel:', error);
            toast.error('Erro ao processar arquivo Excel.');
        } finally {
            setIsProcessingFile(false);
            event.target.value = '';
        }
    };

    const handleImportSubmit = () => {
        if (!importClient) { toast.error('Selecione um cliente para a importação.'); return; }
        if (!importText.trim()) { toast.error('O texto da importação não pode estar vazio.'); return; }

        if (importPortal === 'PATRAL') {
            const items: any[] = [];
            const text = importText.trim();

            if (text.toUpperCase().includes('CÓDIGO:')) {
                const blocks = text.split(/CÓDIGO:/i);
                blocks.forEach((block, index) => {
                    if (index === 0) return;
                    try {
                        const codigoMatch = block.match(/^\s*([\w./-]+)(?:\s+|$)/i);
                        const qtyMatch = block.match(/QUANTIDADE:\s*(\d+(?:\s+\d+)?(?:[.,]\d+)?)/i);
                        const priceMatch = block.match(/PREÇO UNITÁRIO:\s*R\$\s*([\d.,]+)/i);
                        const descMatch = block.match(/DESCRI[CÇ][AÃ]O:\s*(.*?)(?:\n|$)/i);
                        if (codigoMatch && qtyMatch) {
                            let codigo = codigoMatch[1].trim().toUpperCase();
                            let qtyRaw = qtyMatch[1].trim().replace(',', '.');
                            if (qtyRaw.includes(' ')) qtyRaw = qtyRaw.split(/\s+/)[0];
                            const ite_quant = parseFloat(qtyRaw) || 0;
                            items.push({
                                codigo, ite_produto: codigo,
                                descricao: descMatch ? descMatch[1].trim() : 'Produto Importado',
                                quantidade: ite_quant, ite_quant,
                                preco_unitario: priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : 0,
                                portal_price: priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : 0,
                                markup: 0
                            });
                        }
                    } catch (e) { console.error("Erro no parser de bloco:", e); }
                });
            }

            if (items.length === 0) {
                const lines = importText.trim().split('\n');
                lines.forEach(line => {
                    if (!line.trim()) return;
                    const tabularMatch = line.match(/^(\S+)\s+(.*?)\s+(\d+(?:[.,]\d+)?)(?:\s+R\$\s*[\d.,]+)?/);
                    if (tabularMatch) {
                        const codigo = tabularMatch[1].trim().toUpperCase();
                        const qtde = parseFloat(tabularMatch[3].replace(',', '.'));
                        const noise = ['ITEM', 'COD', 'CÓD', 'PRODUTO', 'DESC', 'QTD', 'QUANT'];
                        if (noise.some(n => codigo.includes(n))) return;
                        if (codigo && !isNaN(qtde) && qtde > 0) {
                            items.push({
                                codigo, ite_produto: codigo,
                                descricao: tabularMatch[2].trim(),
                                quantidade: qtde, ite_quant: qtde,
                                preco_unitario: 0, markup: 0
                            });
                        }
                    }
                });
            }

            if (items.length === 0) { toast.error('Não consegui identificar nenhum item. Verifique o formato do texto colado.'); return; }
            setImportPreview(items);
            toast.success(`${items.length} itens identificados! Verifique a prévia.`);
            return;
        }

        const finalItems = importPortal === 'PATRAL' ? importPreview : [];
        if (finalItems.length > 0) submitImport(finalItems);
    };

    const submitImport = (items: any[]) => {
        if (!importClient) { toast.error('Selecione o Cliente antes de confirmar a importação.'); return; }
        if (!importPriceTable) { toast.error(`Selecione a Tabela de Preços da ${importPortal} antes de confirmar.`); return; }

        const event = new CustomEvent('portalImportCompleted', {
            detail: {
                portal: importPortal,
                cliente: importClient,
                clienteNome: importClientName,
                items,
                tabela: importPriceTable,
                industriaId: selectedIndustryId
            }
        });
        window.dispatchEvent(event);
        toast.success(`Importação de ${items.length} itens enviada para o pedido!`);
        resetImportMode();
        onOpenChange(false);
    };

    const resetImportMode = () => {
        setImportMode(false);
        setImportPortal('');
        setImportText('');
        setImportPreview([]);
        setImportClient('');
        setImportClientName('');
        setImportPriceTable('');
        setSelectedIndustryId(null);
        resetParafluMode();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

            {/* Dialog */}
            <div className="relative bg-[#EAEAE5] rounded-3xl shadow-2xl border border-stone-300 overflow-visible flex flex-col max-h-[90vh] w-full max-w-[850px] mx-4">

                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-300 flex items-center justify-between bg-stone-50 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-stone-900 rounded-sm">
                            <Globe className="h-5 w-5 text-stone-50" />
                        </div>
                        <div>
                            <h3 className="text-xl font-medium text-stone-900 tracking-tight leading-none uppercase">Portais Industriais</h3>
                            <p className="text-xs font-mono text-stone-500 uppercase tracking-widest mt-1">Selecione o destino da exportação</p>
                        </div>
                    </div>
                    <button onClick={() => onOpenChange(false)}
                        className="p-2 hover:bg-stone-200 rounded-sm transition-colors duration-200 group">
                        <X className="h-5 w-5 text-stone-400 group-hover:text-stone-600" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 bg-[#EAEAE5] min-h-[250px] flex flex-col justify-center overflow-y-auto overflow-x-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900 mb-4"></div>
                            <p className="font-mono uppercase tracking-widest text-[10px]">Carregando portais disponíveis...</p>
                        </div>

                    ) : parafluMode ? (
                        <div>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h4 className="text-3xl font-medium text-stone-900">Importação PARAFLU</h4>
                                    <p className="text-xs font-mono text-stone-400 uppercase tracking-widest mt-1">Upload da planilha de faturamento • UPSERT por NFe</p>
                                </div>
                                <button onClick={resetParafluMode} className="text-xs font-mono text-stone-500 hover:text-stone-900 uppercase tracking-widest flex items-center gap-2">
                                    ← Voltar
                                </button>
                            </div>

                            {parafluResult ? (
                                <div className="space-y-4">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                            <h4 className="text-lg font-medium text-emerald-900">Importação Concluída!</h4>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-white rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-emerald-700">{parafluResult.inserted}</p>
                                                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Novos Pedidos</p>
                                            </div>
                                            <div className="bg-white rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-amber-600">{parafluResult.updated}</p>
                                                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Atualizados</p>
                                            </div>
                                            <div className="bg-white rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-stone-700">{parafluResult.totalNFes}</p>
                                                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Total NFes</p>
                                            </div>
                                        </div>
                                        {parafluResult.errors && parafluResult.errors.length > 0 && (
                                            <div className="mt-4 bg-red-50 rounded-xl p-3">
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Erros ({parafluResult.errors.length})</p>
                                                {parafluResult.errors.map((e: any, i: number) => (
                                                    <p key={i} className="text-[10px] font-mono text-red-500">{e.nfe}: {e.error}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={resetParafluMode}
                                        className="w-full py-3 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-all">
                                        Concluir
                                    </button>
                                </div>

                            ) : parafluPreview ? (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-black uppercase text-blue-800 tracking-wider flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                {parafluPreview.totalNFes} NFes Identificadas ({parafluPreview.totalRows} linhas)
                                            </h4>
                                            <button onClick={() => { setParafluPreview(null); setParafluFile(null); }}
                                                className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-widest">
                                                Trocar Arquivo
                                            </button>
                                        </div>
                                        <div className="max-h-52 overflow-y-auto pr-2">
                                            <table className="w-full text-left text-[10px]">
                                                <thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
                                                    <tr>
                                                        <th className="py-2 font-black uppercase text-blue-600 tracking-tighter">NFe</th>
                                                        <th className="py-2 font-black uppercase text-blue-600 tracking-tighter">CNPJ</th>
                                                        <th className="py-2 font-black uppercase text-blue-600 tracking-tighter">Período</th>
                                                        <th className="py-2 font-black uppercase text-blue-600 tracking-tighter text-right">Itens</th>
                                                        <th className="py-2 font-black uppercase text-blue-600 tracking-tighter text-right">Total Fat</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {parafluPreview.data.map((nfe: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-blue-100/50 hover:bg-blue-100/30 transition-colors">
                                                            <td className="py-2 font-mono font-bold text-blue-900">{nfe.documento}</td>
                                                            <td className="py-2 text-blue-700">{nfe.cnpj}</td>
                                                            <td className="py-2 text-blue-700">{nfe.periodo}</td>
                                                            <td className="py-2 font-bold text-blue-900 text-right">{nfe.qtdItens}</td>
                                                            <td className="py-2 font-bold text-blue-900 text-right">
                                                                {nfe.totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <button onClick={handleParafluImport} disabled={isParafluProcessing}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white rounded-2xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all group active:scale-[0.98]">
                                        {isParafluProcessing ? (
                                            <><Loader2 className="h-5 w-5 animate-spin" /> Importando...</>
                                        ) : (
                                            <><Upload className="h-5 w-5" /> Confirmar Importação de {parafluPreview.totalNFes} NFes</>
                                        )}
                                    </button>
                                    <p className="text-[10px] text-center text-stone-400 uppercase font-mono tracking-tighter">
                                        Pedidos existentes serão atualizados • Novos serão inseridos
                                    </p>
                                </div>

                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-200 rounded-2xl p-12 bg-blue-50/50 hover:bg-blue-50 transition-colors group/upload relative cursor-pointer">
                                        <input id="paraflu-file-input" type="file" accept=".xlsx,.xls"
                                            onChange={handleParafluFileSelect}
                                            className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover/upload:scale-110 transition-transform">
                                            <FileUp className="h-8 w-8 text-blue-600" />
                                        </div>
                                        <h4 className="text-sm font-medium text-stone-900 uppercase tracking-tight">Selecione a Planilha Paraflu</h4>
                                        <p className="text-[10px] font-mono text-stone-400 mt-2 uppercase tracking-widest">Faturamento Paraflu (.xlsx)</p>
                                    </div>
                                    {isParafluProcessing && (
                                        <div className="flex items-center justify-center gap-2 text-stone-500 py-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-[10px] uppercase font-mono tracking-widest">Analisando planilha...</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    ) : importMode ? (
                        <div>
                            <div className="flex items-center justify-between mb-8">
                                <h4 className="text-3xl font-medium text-stone-900">Importação {importPortal}</h4>
                                <button onClick={resetImportMode} className="text-xs font-mono text-stone-500 hover:text-stone-900 uppercase tracking-widest flex items-center gap-2">
                                    ← Voltar
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div className="relative">
                                    <label className="text-xs font-mono text-stone-500 uppercase tracking-widest mb-2 block">1. Selecione o Cliente de Destino</label>
                                    <ClientSearchInput
                                        value={importClient}
                                        onChange={(val, name) => { setImportClient(val); setImportClientName(name); }}
                                    />
                                </div>

                                {(importPortal.toUpperCase().includes('PATRAL') || importPortal.toUpperCase().includes('ARCA')) && (
                                    <div className="relative">
                                        <label className="text-xs font-mono text-emerald-600 font-bold uppercase tracking-widest mb-2 block">2. Selecione a Tabela de Preços ({importPortal})</label>
                                        <PriceTableSearchInput
                                            industryId={selectedIndustryId}
                                            value={importPriceTable}
                                            onChange={setImportPriceTable}
                                        />
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {!importPreview.length ? (
                                        <>
                                            {importPortal.toUpperCase().includes('ARCA') ? (
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-2xl p-12 bg-stone-50/50 hover:bg-stone-50 transition-colors group/upload relative cursor-pointer">
                                                        <input type="file" accept=".xlsx,.xls"
                                                            onChange={handleExcelFileSelection}
                                                            className="absolute inset-0 opacity-0 cursor-pointer" />
                                                        <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover/upload:scale-110 transition-transform">
                                                            <FileUp className="h-8 w-8 text-stone-900" />
                                                        </div>
                                                        <h4 className="text-sm font-medium text-stone-900 uppercase tracking-tight">Localizar Arquivo Excel Arca</h4>
                                                        <p className="text-[10px] font-mono text-stone-400 mt-2 uppercase tracking-widest">Suporte: .xlsx ou .xls</p>
                                                    </div>
                                                    {isProcessingFile && (
                                                        <div className="flex items-center justify-center gap-2 text-stone-500 py-2">
                                                            <div className="animate-spin h-3 w-3 border-t-2 border-stone-900 rounded-full"></div>
                                                            <span className="text-[10px] uppercase font-mono tracking-widest">Lendo planilha...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest pl-1">
                                                            Cole o texto do Portal aqui
                                                        </label>
                                                        <textarea
                                                            placeholder="Cole aqui o conteúdo do carrinho ou pedido..."
                                                            value={importText}
                                                            onChange={e => setImportText(e.target.value)}
                                                            className="w-full h-48 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all font-mono text-xs text-stone-600 resize-none"
                                                        />
                                                    </div>
                                                    <button onClick={handleImportSubmit}
                                                        className="w-full py-4 bg-stone-900 hover:bg-stone-800 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all group active:scale-[0.98]"
                                                        style={{ color: '#FFD700' }}>
                                                        <span>Identificar Itens</span>
                                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wider flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Itens Identificados ({importPreview.length})
                                                    </h4>
                                                    <button onClick={() => setImportPreview([])}
                                                        className="text-[10px] font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest">
                                                        Limpar / Refazer
                                                    </button>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto pr-2">
                                                    <table className="w-full text-left text-[10px]">
                                                        <thead className="sticky top-0 bg-emerald-50 border-b border-emerald-200">
                                                            <tr>
                                                                <th className="py-2 font-black uppercase text-emerald-600 tracking-tighter">Cód</th>
                                                                <th className="py-2 font-black uppercase text-emerald-600 tracking-tighter">Descrição</th>
                                                                <th className="py-2 font-black uppercase text-emerald-600 tracking-tighter text-right">Qtd</th>
                                                                <th className="py-2 font-black uppercase text-emerald-600 tracking-tighter text-right">Preço</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {importPreview.map((item, idx) => (
                                                                <tr key={idx} className="border-b border-emerald-100/50 hover:bg-emerald-100/30 transition-colors">
                                                                    <td className="py-2 font-mono font-bold text-emerald-900">{item.codigo}</td>
                                                                    <td className="py-2 text-emerald-700 truncate max-w-[150px]">{item.descricao}</td>
                                                                    <td className="py-2 font-bold text-emerald-900 text-right">{item.quantidade}</td>
                                                                    <td className="py-2 font-bold text-emerald-900 text-right">
                                                                        {item.preco_unitario > 0 ? `R$ ${item.preco_unitario.toFixed(2)}` : '--'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => submitImport(importPreview)}
                                                disabled={!importClient || !importPriceTable}
                                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 disabled:opacity-50 text-white disabled:text-stone-500 rounded-2xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all group active:scale-[0.98]">
                                                <Plus className="h-5 w-5" />
                                                <span>Confirmar Importação de {importPreview.length} Itens</span>
                                            </button>
                                            {(!importClient || !importPriceTable) && (
                                                <p className="text-[10px] text-center text-stone-400 uppercase font-mono tracking-tighter">
                                                    Pendente: Selecione {!importClient ? 'o Cliente' : 'a Tabela'} acima
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    ) : portals.length === 0 ? (
                        <div className="text-center p-12 bg-white/60 backdrop-blur-md border border-white/50 shadow-lg rounded-xl">
                            <Building2 className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                            <h4 className="text-xl font-medium text-stone-900 mb-2">Nenhum portal compatível</h4>
                            <p className="text-sm text-stone-500 leading-relaxed">Nenhuma das indústrias ativas possui integração mapeada neste sistema.</p>
                        </div>

                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {portals.map((portal, index) => (
                                <motion.button
                                    key={portal}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ scale: 1.02, y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handlePortalClick(portal)}
                                    className="group relative flex flex-col justify-between p-6 bg-white border border-stone-200 hover:border-stone-900 hover:shadow-xl transition-all duration-500 min-h-[140px] overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-stone-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <div className="mb-4 relative z-10 p-3 rounded bg-stone-100 text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-colors duration-500 self-start">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <span className="text-lg font-medium text-stone-900 relative z-10 self-start text-left">
                                        {portal}
                                    </span>
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-1 group-hover:translate-x-0 z-10">
                                        <ExternalLink className="h-4 w-4 text-stone-400 group-hover:text-white" />
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-stone-50 border-t border-stone-300 flex justify-between items-center rounded-b-3xl">
                    <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">
                        SalesMasters V2 • Módulo de Integração
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PortalsDialog;
