import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Edit, Receipt, CheckCircle, Clock, Save, AlertCircle, ChevronLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const getToken = () => localStorage.getItem('sm_token');
const authHeaders = (): Record<string, string> => {
    const token = getToken();
    return token
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
};

const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatDate = (d: any) => {
    if (!d) return '';
    const isoDate = String(d).substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        const [y, m, day] = isoDate.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('pt-BR');
    }
    return new Date(d).toLocaleDateString('pt-BR');
};

const toInputDate = (d: any) => {
    if (!d) return new Date().toISOString().split('T')[0];
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.substring(0, 10);
    }
    return new Date(d).toISOString().split('T')[0];
};

// ─── Máscaras de entrada ───────────────────────────────────────────────────────
const applyMoneyMask = (raw: string) => {
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoney = (masked: string) => {
    if (!masked) return 0;
    return parseFloat(String(masked).replace(/\./g, '').replace(',', '.')) || 0;
};

const applyPercentMask = (raw: string) => {
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parsePercent = (masked: string) => {
    if (!masked) return 0;
    return parseFloat(String(masked).replace(/\./g, '').replace(',', '.')) || 0;
};

// ─── Situação Selector ────────────────────────────────────────────────────────
function SituacaoSelector({ situacao, onToggle, loading }: { situacao: string; onToggle: () => void; loading: boolean }) {
    const isFaturado = situacao === 'F';

    return (
        <button
            onClick={onToggle}
            disabled={loading}
            className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 ${
                isFaturado
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            } ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer active:scale-95'}`}
            title="Clique para alterar a situação manualmente"
        >
            <div className={`w-2 h-2 rounded-full ${isFaturado ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
            {isFaturado ? (
                <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Faturamento Concluído</span>
                </>
            ) : (
                <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Faturamento Pendente</span>
                </>
            )}
            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white p-1 rounded-full shadow-lg">
                <RefreshCw className="w-2.5 h-2.5" />
            </div>
        </button>
    );
}

// ─── Formulário de Lançamento ─────────────────────────────────────────────────
function LancamentoForm({
    pedido,
    lancamento,
    rates,
    onSave,
    onCancel,
    orderItems,
}: {
    pedido: string;
    lancamento: any;
    rates: any;
    onSave: () => void;
    onCancel: () => void;
    orderItems: any[];
}) {
    const initValor = lancamento?.fat_valorfat
        ? applyMoneyMask(String(Math.round(lancamento.fat_valorfat * 100)))
        : '';
    // fat_percent = comissão do ESCRITÓRIO (for_percom). Sempre usa essa como base do lançamento.
    const initPercent = (lancamento?.fat_percent ?? rates?.escritorio ?? 0)
        ? applyPercentMask(String(Math.round((lancamento?.fat_percent ?? rates?.escritorio ?? 0) * 100)))
        : '';

    const [form, setForm] = useState({
        fat_nf: lancamento?.fat_nf || '',
        fat_datafat: toInputDate(lancamento?.fat_datafat),
        fat_valorfat_mask: initValor,
        fat_percent_mask: initPercent,
        fat_obs: lancamento?.fat_obs || '',
    });

    const [itemQtds, setItemQtds] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        orderItems.forEach(i => { init[i.ite_produto] = ''; });
        if (lancamento?._items) {
            lancamento._items.forEach((it: any) => {
                init[it.ite_produto] = String(it.qtd_delta);
            });
        }
        return init;
    });

    const [saving, setSaving] = useState(false);

    const valorReal = parseMoney(form.fat_valorfat_mask);
    const percentReal = parsePercent(form.fat_percent_mask);
    const comissaoEscritorio = parseFloat((valorReal * percentReal / 100).toFixed(2));
    const comissaoPreposto   = parseFloat((valorReal * (rates?.vendedor ?? 0) / 100).toFixed(2));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.fat_nf.trim()) { toast.error('Informe o número da NF'); return; }
        if (!valorReal || valorReal <= 0) { toast.error('Informe o valor faturado'); return; }

        setSaving(true);
        try {
            const items = Object.entries(itemQtds)
                .filter(([, v]) => v !== '' && parseFloat(v) > 0)
                .map(([ite_produto, v]) => ({ ite_produto, qtd_delta: parseFloat(v) }));

            const payload: any = {
                fat_pedido: pedido,
                fat_industria: rates?.ped_industria,
                fat_datafat: form.fat_datafat,
                fat_valorfat: valorReal,
                fat_nf: form.fat_nf.trim(),
                fat_obs: form.fat_obs,
                fat_percent: percentReal,        // comissão do escritório (for_percom)
                fat_percomissind: 'E',           // sempre escritório — preposto deriva de vendedor_ind
                items,
                ...(lancamento && {
                    items_old: lancamento._items || [],
                    items_new: items
                })
            };

            const url = lancamento
                ? `${API_BASE}/billing/${pedido}/${lancamento.fat_lancto}`
                : `${API_BASE}/billing`;

            const resp = await fetch(url, {
                method: lancamento ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await resp.json();

            if (data.success) {
                toast.success(lancamento ? 'Lançamento atualizado!' : 'Faturamento lançado com sucesso!');
                onSave();
            } else {
                toast.error(data.message || 'Erro ao salvar');
            }
        } catch {
            toast.error('Erro de conexão');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Número da NF *</label>
                    <input
                        type="text"
                        value={form.fat_nf}
                        onChange={e => setForm(f => ({ ...f, fat_nf: e.target.value }))}
                        placeholder="Ex: 051767"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Data de Faturamento</label>
                    <input
                        type="date"
                        value={form.fat_datafat}
                        onChange={e => setForm(f => ({ ...f, fat_datafat: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Valor Faturado (R$) *</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={form.fat_valorfat_mask}
                        onChange={e => setForm(f => ({ ...f, fat_valorfat_mask: applyMoneyMask(e.target.value) }))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">COMISSÃO</p>
                <div className="grid grid-cols-2 gap-3">
                    {/* Comissão do Escritório */}
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Escritório — % ({rates?.escritorio ?? 0}%)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={form.fat_percent_mask}
                                onChange={e => setForm(f => ({ ...f, fat_percent_mask: applyPercentMask(e.target.value) }))}
                                placeholder="0,00"
                                className="w-full px-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-black text-sm text-center">
                            {formatCurrency(comissaoEscritorio)}
                        </div>
                    </div>
                    {/* Comissão do Preposto — derivada de vendedor_ind */}
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Preposto — % ({rates?.vendedor ?? 0}%)
                        </label>
                        <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold text-sm flex items-center justify-center h-[38px]">
                            {rates?.vendedor ?? 0}%
                            <span className="text-[9px] ml-1 font-normal text-slate-400">(vendedor_ind)</span>
                        </div>
                        <div className={`px-3 py-1.5 rounded-xl border font-black text-sm text-center ${
                            (rates?.vendedor ?? 0) > 0
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-slate-100 text-slate-400'
                        }`}>
                            {(rates?.vendedor ?? 0) > 0 ? formatCurrency(comissaoPreposto) : 'Sem vínculo'}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Observações</label>
                <input
                    type="text"
                    value={form.fat_obs}
                    onChange={e => setForm(f => ({ ...f, fat_obs: e.target.value }))}
                    maxLength={100}
                    placeholder="Observação opcional..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
            </div>

            {orderItems.length > 0 && (
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        BAIXA MANUAL DE ITENS <span className="text-slate-400 normal-case font-bold">(Informe a quantidade faturada nesta NF)</span>
                    </p>
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th className="text-left px-3 py-2 font-black text-slate-500 uppercase tracking-wider">Produto</th>
                                    <th className="text-right px-3 py-2 font-black text-slate-500 uppercase tracking-wider bg-blue-50/50">Vendido</th>
                                    <th className="text-right px-3 py-2 font-black text-slate-500 uppercase tracking-wider bg-amber-50/50">Já Faturado</th>
                                    <th className="text-right px-3 py-2 font-black text-slate-500 uppercase tracking-wider bg-rose-50/50">Saldo</th>
                                    <th className="text-right px-3 py-2 font-black text-teal-600 uppercase tracking-wider">A Faturar Agora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {orderItems.map(item => {
                                    const jaNestaNF = lancamento?._items?.find((it: any) => it.ite_produto === item.ite_produto)?.qtd_delta || 0;
                                    const disponivel = item.saldo_qtd + jaNestaNF;

                                    return (
                                        <tr key={item.ite_produto} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-2 font-bold text-slate-700">
                                                <div className="text-[10px] text-slate-400 font-normal leading-tight">{item.ite_produto}</div>
                                                <div className="truncate max-w-[200px]">{item.ite_descricao}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-blue-600 bg-blue-50/20">{item.ite_qtde}</td>
                                            <td className="px-3 py-2 text-right font-bold text-amber-600 bg-amber-50/20">
                                                {item.ite_qtdfat - jaNestaNF}
                                                {jaNestaNF > 0 && <span className="text-[10px] text-slate-400 block font-normal">+{jaNestaNF} nesta NF</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-rose-500 bg-rose-50/20">{item.saldo_qtd}</td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    max={disponivel}
                                                    value={itemQtds[item.ite_produto] || ''}
                                                    onChange={e => setItemQtds(q => ({ ...q, [item.ite_produto]: e.target.value }))}
                                                    className="w-20 px-2 py-1.5 rounded-lg border border-teal-200 bg-white text-teal-700 font-black text-xs text-right focus:border-teal-400 outline-none"
                                                    placeholder="0"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-black text-xs uppercase tracking-widest hover:bg-teal-700 flex items-center justify-center gap-2"
                >
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    {lancamento ? 'Atualizar' : 'Salvar Faturamento'}
                </button>
            </div>
        </form>
    );
}

// ─── BillingDialog Principal ──────────────────────────────────────────────────
export default function BillingDialog({ order, onClose }: { order: any; onClose: () => void }) {
    const [tab, setTab] = useState('lancamentos');
    const [lancamentos, setLancamentos] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [rates, setRates] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingLancamento, setEditingLancamento] = useState<any>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const pedido = order?.ped_pedido;

    const loadData = useCallback(async () => {
        if (!pedido) return;
        setLoading(true);
        try {
            const [fatRes, itemsRes, ratesRes] = await Promise.all([
                fetch(`${API_BASE}/billing/${pedido}`, { headers: authHeaders() }),
                fetch(`${API_BASE}/billing/${pedido}/items`, { headers: authHeaders() }),
                fetch(`${API_BASE}/billing/${pedido}/commission-rates`, { headers: authHeaders() }),
            ]);

            const [fatData, itemsData, ratesData] = await Promise.all([
                fatRes.json(), itemsRes.json(), ratesRes.json()
            ]);

            if (fatData.success) {
                setLancamentos(fatData.lancamentos || []);
                setSummary(fatData.summary);
            }

            if (itemsData.success && itemsData.items) {
                setOrderItems(itemsData.items);
            }

            if (ratesData.success && ratesData.rates) {
                setRates(ratesData.rates);
            }
        } catch {
            toast.error('Erro ao carregar dados de faturamento');
        } finally {
            setLoading(false);
        }
    }, [pedido]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDelete = async (fat: any) => {
        if (!window.confirm('Excluir este lançamento? As quantidades faturadas serão estornadas.')) return;
        try {
            const resp = await fetch(`${API_BASE}/billing/${pedido}/${fat.fat_lancto}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            const data = await resp.json();
            if (data.success) {
                toast.success('Lançamento excluído!');
                loadData();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Erro ao excluir');
        }
    };

    const handleSaved = () => {
        setShowForm(false);
        setEditingLancamento(null);
        loadData();
    };

    const handleToggleStatus = async () => {
        if (!summary) return;
        const newStatus = summary.situacao === 'F' ? 'P' : 'F';

        const msg = newStatus === 'F'
            ? "Deseja marcar este pedido como FATURADO INTEGRALMENTE?\n\nUse esta opção se a indústria já faturou o que foi possível e não irá entregar o restante."
            : "Deseja retornar o pedido para situação PENDENTE?";

        if (!window.confirm(msg)) return;

        setUpdatingStatus(true);
        try {
            const resp = await fetch(`${API_BASE}/billing/${pedido}/status`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ situacao: newStatus })
            });
            const data = await resp.json();
            if (data.success) {
                toast.success('Situação atualizada!');
                loadData();
            }
        } catch {
            toast.error('Erro ao atualizar situação');
        } finally {
            setUpdatingStatus(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-teal-50">
                            <Receipt className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">FATURAMENTO</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pedido}</p>
                        </div>
                        {summary && (
                            <SituacaoSelector
                                situacao={summary.situacao}
                                onToggle={handleToggleStatus}
                                loading={updatingStatus}
                            />
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {summary && (
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Valor do Pedido</p>
                            <p className="text-sm font-black text-slate-700">{formatCurrency(summary.ped_totliq)}</p>
                        </div>
                        <div className="text-center border-x border-slate-200">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Faturado</p>
                            <p className="text-sm font-black text-emerald-600">{formatCurrency(summary.total_faturado)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Saldo a Faturar</p>
                            <p className={`text-sm font-black ${summary.saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {formatCurrency(summary.saldo)}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex border-b border-slate-100 px-6">
                    {[
                        { key: 'lancamentos', label: 'LANÇAMENTOS' },
                        { key: 'itens', label: 'ITENS FATURADOS' }
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setTab(t.key); setShowForm(false); }}
                            className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${
                                tab === t.key
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {tab === 'lancamentos' && (
                                <motion.div key="lancamentos" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {showForm ? (
                                        <div>
                                            <button
                                                onClick={() => { setShowForm(false); setEditingLancamento(null); }}
                                                className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-slate-600 mb-4 uppercase tracking-wider"
                                            >
                                                <ChevronLeft className="w-4 h-4" /> Voltar
                                            </button>
                                            <LancamentoForm
                                                pedido={pedido}
                                                lancamento={editingLancamento}
                                                rates={rates}
                                                orderItems={orderItems}
                                                onSave={handleSaved}
                                                onCancel={() => { setShowForm(false); setEditingLancamento(null); }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <button
                                                onClick={() => { setEditingLancamento(null); setShowForm(true); }}
                                                className="w-full py-3 rounded-2xl border-2 border-dashed border-teal-300 text-teal-600 font-black text-xs uppercase tracking-widest hover:bg-teal-50 flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> Novo Faturamento
                                            </button>

                                            {lancamentos.length === 0 ? (
                                                <div className="text-center py-12 text-slate-400">
                                                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p className="font-bold text-sm">Nenhum faturamento lançado</p>
                                                    <p className="text-xs mt-1">Clique em "Novo Faturamento" para registrar</p>
                                                </div>
                                            ) : (
                                                lancamentos.map(fat => (
                                                    <div key={fat.fat_lancto} className="rounded-2xl border border-slate-200 p-4 hover:border-teal-200 hover:bg-teal-50/30">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">NF</p>
                                                                    <p className="text-sm font-black text-slate-800">{fat.fat_nf || '—'}</p>
                                                                </div>
                                                                <div className="h-8 w-px bg-slate-200" />
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</p>
                                                                    <p className="text-sm font-bold text-slate-600">{formatDate(fat.fat_datafat)}</p>
                                                                </div>
                                                                <div className="h-8 w-px bg-slate-200" />
                                                                <div>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</p>
                                                                    <p className="text-sm font-black text-emerald-600">{formatCurrency(fat.fat_valorfat)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => { setEditingLancamento(fat); setShowForm(true); }}
                                                                    className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:text-blue-600"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(fat)}
                                                                    className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-600"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {tab === 'itens' && (
                                <motion.div key="itens" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    {orderItems.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400">
                                            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                            <p className="font-bold text-sm">Nenhum item encontrado</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        <th className="text-left px-4 py-3 font-black text-slate-500 uppercase tracking-wider">Produto</th>
                                                        <th className="text-right px-4 py-3 font-black text-slate-500 uppercase tracking-wider bg-blue-50/50">Vendido</th>
                                                        <th className="text-right px-4 py-3 font-black text-slate-500 uppercase tracking-wider bg-amber-50/50">Já Faturado</th>
                                                        <th className="text-right px-4 py-3 font-black text-slate-500 uppercase tracking-wider bg-rose-50/50">Saldo</th>
                                                        <th className="text-center px-4 py-3 font-black text-slate-500 uppercase tracking-wider">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orderItems.map((item, i) => (
                                                        <tr key={item.ite_produto} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                            <td className="px-4 py-3">
                                                                <p className="font-black text-slate-700">{item.ite_produto}</p>
                                                                {item.ite_descricao && <p className="text-slate-400 text-[10px] truncate max-w-[200px]">{item.ite_descricao}</p>}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-50/5">{item.ite_qtde}</td>
                                                            <td className="px-4 py-3 text-right font-black text-amber-600 bg-amber-50/5">{item.ite_qtdfat || 0}</td>
                                                            <td className="px-4 py-3 text-right font-black text-rose-500 bg-rose-50/5">{item.saldo_qtd}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                {(item.ite_faturado === 'S' || item.saldo_qtd <= 0) ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
                                                                        <CheckCircle className="w-3 h-3" /> Faturado
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase">
                                                                        <Clock className="w-3 h-3" /> Pendente
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
