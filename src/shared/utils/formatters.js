// ===================================================
// RepOne - Utilitários de formatação e máscaras
// ===================================================

// Moeda
export const formatCurrency = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Máscara monetária — digitar 5813172 → "58.131,72"
export const applyMoneyMask = (raw) => {
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
};
export const parseMoney = (masked) =>
    parseFloat(String(masked).replace(/\./g, '').replace(',', '.')) || 0;

// Percentual (mesma lógica)
export const applyPercentMask = applyMoneyMask;
export const parsePercent      = parseMoney;

// Datas
export const formatDate = (d) =>
    d ? new Intl.DateTimeFormat('pt-BR').format(new Date(d)) : '-';

// Status de pedidos com classes Tailwind
export const ORDER_STATUS = {
    P: { label: 'Pendente',    bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
    F: { label: 'Faturado',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    C: { label: 'Cancelado',   bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
    A: { label: 'Aprovado',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
    T: { label: 'Transmitido', bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200'  },
};
