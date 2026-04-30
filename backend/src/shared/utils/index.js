/**
 * Utilitários compartilhados do backend RepOne
 */

// Padrão de resposta da API
const apiSuccess = (data, message = 'OK') => ({ success: true, data, message });
const apiError   = (error, message)        => ({ success: false, error, message });

// Formata valor monetário pt-BR
const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Formata percentual pt-BR
const formatPercent = (value) =>
    (value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = { apiSuccess, apiError, formatCurrency, formatPercent };
