import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Helper to format CPF/CNPJ
const formatCpfCnpj = (value) => {
    if (!value) return '';
    const cleanValue = String(value).replace(/\D/g, '');
    
    // CNPJ: Se tiver entre 12 e 14 dígitos (ou for maior que 11), trata como CNPJ e completa com zeros
    if (cleanValue.length > 11 && cleanValue.length <= 14) {
        return cleanValue.padStart(14, '0').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    // CPF: Se tiver até 11 dígitos e for maior que 0, trata como CPF e completa com zeros
    if (cleanValue.length > 0 && cleanValue.length <= 11) {
        return cleanValue.padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    
    return value;
};

// Helper to format discount string
const getDiscountString = (o) => {
    if (!o) return '';
    const discs = [];
    for (let i = 1; i <= 12; i++) {
        const val = parseFloat(o[`ped_desc${i}`]);
        if (num(val) > 0) discs.push(`${val.toFixed(2)}%`);
    }
    // Suporte para ped_descadic
    if (parseFloat(o.ped_descadic) > 0) {
        discs.push(`adic ${parseFloat(o.ped_descadic).toFixed(2)}%`);
    }
    return discs.join('+');
};

// Helper for item-level discounts
const getItemDiscountString = (it) => {
    if (!it) return '';
    // if ite_descontos exists and is not just a placeholder, use it
    if (it.ite_descontos && it.ite_descontos.length > 0 && it.ite_descontos !== 'Sem desconto') {
        return it.ite_descontos;
    }
    
    // Fallback: build from ite_des1...12
    const discs = [];
    for (let i = 1; i <= 15; i++) {
        const val = parseFloat(it[`ite_des${i}`]);
        if (num(val) > 0) discs.push(`${val.toFixed(2)}%`);
    }
    if (parseFloat(it.ite_descadic) > 0) {
        discs.push(`${parseFloat(it.ite_descadic).toFixed(2)}%`);
    }
    return discs.join(' + ');
};

const num = (v) => parseFloat(v) || 0;

// Complemento do item: conversão (ite_embuch) ou código original — mas o original SÓ entra
// quando difere do código do produto (senão repetiria o código na coluna de complemento).
const getComplemento = (it) => {
    const orig = (it.pro_codigooriginal && String(it.pro_codigooriginal).trim() !== String(it.ite_produto).trim())
        ? it.pro_codigooriginal : '';
    return it.ite_embuch || orig || '';
};

// Model 15: No Tax Values (Only % IPI) - Item, Quant, Descrição, Preço Lista, Preço Unit Liq, Sub Total, % IPI
const ItemsModel15 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items], groupIndex) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7 }}>
                                Descontos: <Text style={{ fontWeight: 'normal' }}>{discountLabel}</Text>
                                {groupName !== 'GERAL' && <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>
                        <View style={styles.tableHeader}>
                            <Text style={styles.colSq}>ITEM</Text>
                            <Text style={styles.colProd}>CÓDIGO</Text>
                            <Text style={styles.colDesc}>DESCRIÇÃO</Text>
                            <Text style={styles.colQtd}>QTDE</Text>
                            <Text style={styles.colVal}>PREÇO LISTA</Text>
                            <Text style={styles.colVal}>PREÇO UNIT LIQ</Text>
                            <Text style={styles.colTot}>SUB TOTAL</Text>
                        </View>

                        {items.map((item, idx) => {
                            globalSeq++;
                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={styles.colSq}>{globalSeq}</Text>
                                        <Text style={styles.colProd}>{item.ite_produto}</Text>
                                        <Text style={styles.colDesc}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={styles.colQtd}>{item.ite_quant}</Text>
                                        <Text style={styles.colVal}>{fv(item.ite_puni)}</Text>
                                        <Text style={styles.colVal}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ ...styles.colTot, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                    </View>
                                    {item.pro_aplicacao && (
                                        <View style={{ paddingLeft: '22%', paddingBottom: 2 }}>
                                            <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ ...styles.label, width: '70%', paddingLeft: 2 }}>Sub-total:</Text>
                            <Text style={{ ...styles.colTot, borderRightWidth: 0, paddingRight: 2, width: '25%', textAlign: 'right' }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '5%' }}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 15 totals - Clean and Without Tax Details
const TotalsSection15 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total bruto:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totbruto)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total líquido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totliq)}</Text>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Qtd total peças:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <Text style={{ ...styles.label, ...styles.redLabel }}>Vendedor: <Text style={{ color: '#000000', fontWeight: 'bold' }}>{order.ven_nome || ''}</Text></Text>
                <Text style={{ ...styles.label, ...styles.redLabel, marginLeft: 150 }}>{order.ven_fone || ''}</Text>
            </View>
            <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Observações:</Text>
                <View style={{ borderWidth: 0.5, borderColor: '#cbd5e1', borderStyle: 'solid', padding: 3, marginTop: 2, minHeight: 40 }}>
                    <Text style={{ fontSize: 7 }}>{order.ped_obs || order.ped_obscomplementar || ''}</Text>
                </View>
            </View>
        </View>
    );
};


// Model 14: Quick Quote Table - Sq, Prod, Conv, Desc, Quant, Bruto, Liq, Total, IPI
const ItemsModel14 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items], groupIndex) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalBruto = items.reduce((acc, it) => acc + (parseFloat(it.ite_totbruto) || 0), 0);
                const subTotalLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7 }}>
                                Descontos: <Text style={{ fontWeight: 'normal' }}>{discountLabel}</Text>
                                {groupName !== 'GERAL' && <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>
                        <View style={{ ...styles.tableHeader, borderBottomWidth: 0, borderTopWidth: 0 }}>
                            <Text style={{ width: '3%', textAlign: 'center' }}>Sq:</Text>
                            <Text style={{ width: '7%', textAlign: 'center' }}>Produto:</Text>
                            <Text style={{ width: '12%', textAlign: 'center' }}>Cod. orig/Conv./Comp</Text>
                            <Text style={{ flex: 1, paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '5%', textAlign: 'center' }}>Quant</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>Un.Bruto</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>Un.liquido</Text>
                            <Text style={{ width: '10%', textAlign: 'right' }}>Total lqdo</Text>
                            <Text style={{ width: '4%', textAlign: 'right' }}>IPI</Text>
                        </View>

                        {items.map((item, idx) => {
                            globalSeq++;
                            const conv = item.ite_embuch || '';
                            
                            return (
                                <View key={idx} wrap={false}>
                                    <View style={styles.tableRowDashed}>
                                        <Text style={{ width: '3%', textAlign: 'center' }}>{globalSeq}</Text>
                                        <Text style={{ width: '7%', textAlign: 'center' }}>{item.ite_produto}</Text>
                                        <Text style={{ width: '12%', textAlign: 'center', fontSize: 6 }}>{conv}</Text>
                                        <Text style={{ flex: 1, paddingLeft: 2 }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={{ width: '5%', textAlign: 'center', fontWeight: 'bold' }}>{item.ite_quant}</Text>
                                        <Text style={{ width: '8%', textAlign: 'right' }}>{fv(item.ite_puni)}</Text>
                                        <Text style={{ width: '8%', textAlign: 'right' }}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ width: '10%', textAlign: 'right', fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                        <Text style={{ width: '4%', textAlign: 'right', fontSize: 6 }}>{fv(item.ite_ipi)}</Text>
                                    </View>
                                    {item.pro_aplicacao && (
                                        <View style={{ paddingLeft: '22%', paddingBottom: 2 }}>
                                            <Text style={{ fontSize: 6, color: '#4b5563' }}>{item.pro_aplicacao}</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={{ ...styles.subTotalRow, borderTopWidth: 0.5, marginTop: 2 }}>
                            <Text style={{ width: '73%', textAlign: 'left', paddingLeft: 2 }}>Sub-total:</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>{fv(subTotalBruto)}</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '11%', textAlign: 'right', fontWeight: 'bold' }}>{fv(subTotalLiq)}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 13: Landscape Table - Sq, Prod, Comp, Nº Ped, Desc, Quant, Bruto, Liq, C/Imp, Total, IPI, ST
const ItemsModel13 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items]) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalBruto = items.reduce((acc, it) => acc + (parseFloat(it.ite_totbruto) || 0), 0);
                const subTotalLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const subTotalComImpostos = items.reduce((acc, it) => {
                    const totLiq = parseFloat(it.ite_totliquido) || 0;
                    const ipiRate = parseFloat(it.ite_ipi) || 0;
                    const stRate = parseFloat(it.ite_st) || 0;
                    return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
                }, 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#64748b', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, color: '#ffffff' }}>
                                Descontos: {discountLabel} {groupName !== 'GERAL' && `| Grupo: ${groupName}`}
                            </Text>
                        </View>
                        <View style={{ ...styles.tableHeader, backgroundColor: '#64748b', color: '#ffffff', borderBottomWidth: 0 }}>
                            <Text style={{ width: '3%', textAlign: 'center' }}>Sq:</Text>
                            <Text style={{ width: '6%', textAlign: 'center' }}>Produto:</Text>
                            <Text style={{ width: '8%', textAlign: 'center' }}>Complemento</Text>
                            <Text style={{ width: '8%', textAlign: 'center' }}>Nº pedido</Text>
                            <Text style={{ flex: 1, paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '4%', textAlign: 'center' }}>Quant</Text>
                            <Text style={{ width: '7%', textAlign: 'right' }}>Bruto</Text>
                            <Text style={{ width: '7%', textAlign: 'right' }}>Líquido</Text>
                            <Text style={{ width: '7%', textAlign: 'right' }}>C/Imposto</Text>
                            <Text style={{ width: '7%', textAlign: 'right' }}>Total</Text>
                            <Text style={{ width: '3%', textAlign: 'right' }}>IPI</Text>
                            <Text style={{ width: '3%', textAlign: 'right' }}>ST</Text>
                        </View>

                        {items.map((item, idx) => {
                            globalSeq++;
                            const comp = item.pro_codigooriginal || '';
                            const quant = parseFloat(item.ite_quant) || 1;
                            const totLiq = parseFloat(item.ite_totliquido) || 0;
                            const ipiRate = parseFloat(item.ite_ipi) || 0;
                            const stRate = parseFloat(item.ite_st) || 0;
                            const totComImpostos = totLiq * (1 + ipiRate / 100) * (1 + stRate / 100);
                            const unitComImpostos = totComImpostos / quant;

                            return (
                                <View key={idx} style={{ ...styles.tableRowDashed, borderBottomColor: '#cbd5e1' }} wrap={false}>
                                    <Text style={{ width: '3%', textAlign: 'center' }}>{globalSeq}</Text>
                                    <Text style={{ width: '6%', textAlign: 'center', color: '#1e40af', fontWeight: 'bold' }}>{item.ite_produto}</Text>
                                    <Text style={{ width: '8%', textAlign: 'center', fontSize: 6 }}>{comp}</Text>
                                    <Text style={{ width: '8%', textAlign: 'center', fontSize: 6 }}>{order.ped_oc ||order.ped_pedindustria || ''}</Text>
                                    <Text style={{ flex: 1, paddingLeft: 2, color: '#1e40af', fontWeight: 'bold' }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                    <Text style={{ width: '4%', textAlign: 'center', fontWeight: 'bold', color: '#1e40af' }}>{item.ite_quant}</Text>
                                    <Text style={{ width: '7%', textAlign: 'right' }}>{fv(item.ite_puni)}</Text>
                                    <Text style={{ width: '7%', textAlign: 'right' }}>{fv(item.ite_puniliq)}</Text>
                                    <Text style={{ width: '7%', textAlign: 'right' }}>{fv(unitComImpostos)}</Text>
                                    <Text style={{ width: '7%', textAlign: 'right', fontWeight: 'bold' }}>{fv(totComImpostos)}</Text>
                                    <Text style={{ width: '3%', textAlign: 'right', fontSize: 5 }}>{fv(item.ite_ipi)}</Text>
                                    <Text style={{ width: '3%', textAlign: 'right', fontSize: 5 }}>{fv(item.ite_st)}</Text>
                                </View>
                            );
                        })}

                        <View style={{ flexDirection: 'row', borderTopWidth: 0.5, marginTop: 2 }}>
                            <Text style={{ width: '68%' }}></Text>
                            <Text style={{ width: '7%', textAlign: 'right', fontWeight: 'bold' }}>{fv(subTotalBruto)}</Text>
                            <Text style={{ width: '7%', textAlign: 'right', fontWeight: 'bold' }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '7%', textAlign: 'right', fontWeight: 'bold' }}>{fv(subTotalComImpostos)}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 16: Tax Details per Item (NO Price List / NO Gross Price)
// Sq, Produto, Descrição, Quant, Unitário Liq, Unitário c/IPI, Unitário c/IPI+ST, IPI%, ST%, Total c/IPI+ST
const ItemsModel16 = ({ groupedItems }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items]) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalComImpostos = (items as any[]).reduce((acc, it) => {
                    const totLiq = parseFloat(it.ite_totliquido) || 0;
                    const ipiRate = parseFloat(it.ite_ipi) || 0;
                    const stRate = parseFloat(it.ite_st) || 0;
                    return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
                }, 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        {groupName !== 'GERAL' && (
                            <View style={{ backgroundColor: '#ffffff', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                                <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}>Grupo: {groupName}</Text>
                            </View>
                        )}
                        <View style={{ ...styles.tableHeader, borderBottomWidth: 0 }}>
                            <Text style={{ width: '3.5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Sq:</Text>
                            <Text style={{ width: '11%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>Produto:</Text>
                            <Text style={{ width: '10%', textAlign: 'left', paddingLeft: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Complemento:</Text>
                            <Text style={{ flex: 1, paddingLeft: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Descrição do produto:</Text>
                            <Text style={{ width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Quant</Text>
                            <Text style={{ width: '8%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Unit Líq</Text>
                            <Text style={{ width: '8%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Unit c/IPI</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Unit c/IPI+ST</Text>
                            <Text style={{ width: '4%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 1 }}>IPI%</Text>
                            <Text style={{ width: '4%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 1 }}>ST%</Text>
                            <Text style={{ width: '10%', textAlign: 'right', paddingRight: 2 }}>Tot c/IPI+ST</Text>
                        </View>

                        {(items as any[]).map((item, idx) => {
                            globalSeq++;
                            const quant = parseFloat(item.ite_quant) || 1;
                            const totLiq = parseFloat(item.ite_totliquido) || 0;
                            const puniLiq = parseFloat(item.ite_puniliq) || 0;
                            const ipiRate = parseFloat(item.ite_ipi) || 0;
                            const stRate = parseFloat(item.ite_st) || 0;

                            const puniWithIPI = puniLiq * (1 + ipiRate / 100);
                            const totComImpostos = totLiq * (1 + ipiRate / 100) * (1 + stRate / 100);
                            const unitComImpostos = totComImpostos / quant;

                            return (
                                <View key={idx} style={styles.tableRowDashed} wrap={false}>
                                    <Text style={{ width: '3.5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{globalSeq}</Text>
                                    <Text style={{ width: '11%', textAlign: 'left', paddingLeft: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_produto}</Text>
                                    <Text style={{ width: '10%', textAlign: 'left', paddingLeft: 2, fontSize: 6, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{getComplemento(item) || '—'}</Text>
                                    <Text style={{ flex: 1, paddingLeft: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                    <Text style={{ width: '5%', textAlign: 'center', fontWeight: 'bold', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_quant}</Text>
                                    <Text style={{ width: '8%', textAlign: 'right', paddingRight: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{fv(puniLiq)}</Text>
                                    <Text style={{ width: '8%', textAlign: 'right', paddingRight: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{fv(puniWithIPI)}</Text>
                                    <Text style={{ width: '9%', textAlign: 'right', paddingRight: 2, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{fv(unitComImpostos)}</Text>
                                    <Text style={{ width: '4%', textAlign: 'right', paddingRight: 1, fontSize: 6, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{fv(ipiRate)}</Text>
                                    <Text style={{ width: '4%', textAlign: 'right', paddingRight: 1, fontSize: 6, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{fv(stRate)}</Text>
                                    <Text style={{ width: '10%', textAlign: 'right', paddingRight: 2, fontWeight: 'bold' }}>{fv(totComImpostos)}</Text>
                                </View>
                            );
                        })}

                        <View style={{ ...styles.subTotalRow, borderTopWidth: 0.5, marginTop: 2 }}>
                            <Text style={{ width: '63%' }}></Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}></Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}></Text>
                            <Text style={{ width: '9%', textAlign: 'right' }}></Text>
                            <Text style={{ width: '4%', textAlign: 'right' }}></Text>
                            <Text style={{ width: '4%', textAlign: 'right' }}></Text>
                            <Text style={{ width: '10%', textAlign: 'right', fontWeight: 'bold', paddingRight: 2 }}>{fv(subTotalComImpostos)}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 16 totals — clean totals with IPI+ST
const TotalsSection16 = ({ order, items }) => {
    const totalItems = (items as any[])?.length || 0;
    const totalQtd = (items as any[] || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items as any[] || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 130 }}>Total líquido c/IPI e ST:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(totalComImpostos)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 130 }}>Total líquido (sem impostos):</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totliq)}</Text>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Qtd total peças:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <Text style={{ ...styles.label, ...styles.redLabel }}>Vendedor: <Text style={{ color: '#000000', fontWeight: 'bold' }}>{order.ven_nome || ''}</Text></Text>
                <Text style={{ ...styles.label, ...styles.redLabel, marginLeft: 150 }}>{order.ven_fone || ''}</Text>
            </View>
            <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Observações:</Text>
                <View style={{ borderWidth: 0.5, borderColor: '#cbd5e1', borderStyle: 'solid', padding: 3, marginTop: 2, minHeight: 40 }}>
                    <Text style={{ fontSize: 7 }}>{order.ped_obs || order.ped_obscomplementar || ''}</Text>
                </View>
            </View>
        </View>
    );
};

// Model 12: Specific Calculations per Item - Sq, Prod, Desc, Quant, Un.Bruto, Un.Liq, Unit c/IPI e ST, Total c/IPI e ST, IPI, ST
const ItemsModel12 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items]) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalBruto = items.reduce((acc, it) => acc + (parseFloat(it.ite_totbruto) || 0), 0);
                const subTotalLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const subTotalComImpostos = items.reduce((acc, it) => {
                    const totLiq = parseFloat(it.ite_totliquido) || 0;
                    const ipiRate = parseFloat(it.ite_ipi) || 0;
                    const stRate = parseFloat(it.ite_st) || 0;
                    return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
                }, 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7 }}>
                                Descontos: <Text style={{ fontWeight: 'normal' }}>{discountLabel}</Text>
                                {groupName !== 'GERAL' && <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>
                        <View style={{ ...styles.tableHeader, borderBottomWidth: 0 }}>
                            <Text style={{ width: '3%', textAlign: 'center' }}>Sq:</Text>
                            <Text style={{ width: '7%', textAlign: 'center' }}>Produto:</Text>
                            <Text style={{ flex: 1, paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '5%', textAlign: 'center' }}>Quant</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>Un.Bruto</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>Un.liquido</Text>
                            <Text style={{ width: '10%', textAlign: 'right' }}>Unit. c/IPI e ST</Text>
                            <Text style={{ width: '10%', textAlign: 'right' }}>Tot c/IPI e ST</Text>
                            <Text style={{ width: '4%', textAlign: 'right' }}>IPI</Text>
                            <Text style={{ width: '4%', textAlign: 'right' }}>ST</Text>
                        </View>

                        {items.map((item, idx) => {
                            globalSeq++;
                            const quant = parseFloat(item.ite_quant) || 1;
                            const totLiq = parseFloat(item.ite_totliquido) || 0;
                            const ipiRate = parseFloat(item.ite_ipi) || 0;
                            const stRate = parseFloat(item.ite_st) || 0;
                            const totComImpostos = totLiq * (1 + ipiRate / 100) * (1 + stRate / 100);
                            const unitComImpostos = totComImpostos / quant;

                            return (
                                <View key={idx} style={styles.tableRowDashed} wrap={false}>
                                    <Text style={{ width: '3%', textAlign: 'center' }}>{globalSeq}</Text>
                                    <Text style={{ width: '7%', textAlign: 'center' }}>{item.ite_produto}</Text>
                                    <Text style={{ flex: 1, paddingLeft: 2 }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                    <Text style={{ width: '5%', textAlign: 'center', fontWeight: 'bold' }}>{item.ite_quant}</Text>
                                    <Text style={{ width: '8%', textAlign: 'right' }}>{fv(item.ite_puni)}</Text>
                                    <Text style={{ width: '8%', textAlign: 'right' }}>{fv(item.ite_puniliq)}</Text>
                                    <Text style={{ width: '10%', textAlign: 'right' }}>{fv(unitComImpostos)}</Text>
                                    <Text style={{ width: '10%', textAlign: 'right', fontWeight: 'bold' }}>{fv(totComImpostos)}</Text>
                                    <Text style={{ width: '4%', textAlign: 'right', fontSize: 6 }}>{fv(item.ite_ipi)}</Text>
                                    <Text style={{ width: '4%', textAlign: 'right', fontSize: 6 }}>{fv(item.ite_st)}</Text>
                                </View>
                            );
                        })}

                        <View style={{ ...styles.subTotalRow, borderTopWidth: 0.5, marginTop: 2 }}>
                            <Text style={{ width: '64%' }}></Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>{fv(subTotalBruto)}</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '10%', textAlign: 'right' }}></Text>
                            <Text style={{ width: '10%', textAlign: 'right', fontWeight: 'bold' }}>{fv(subTotalComImpostos)}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 11: Light Table - Sq, Prod, Conv/Comp, Desc, Quant, Un.Bruto, Un.Liq, Total, IPI
const ItemsModel11 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items]) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalBruto = items.reduce((acc, it) => acc + (parseFloat(it.ite_totbruto) || 0), 0);
                const subTotalLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7 }}>
                                Descontos: <Text style={{ fontWeight: 'normal' }}>{discountLabel}</Text>
                                {groupName !== 'GERAL' && <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>
                        <View style={{ ...styles.tableHeader, borderBottomWidth: 0 }}>
                            <Text style={{ width: '3%', textAlign: 'center' }}>Sq:</Text>
                            <Text style={{ width: '8%', textAlign: 'center' }}>Produto:</Text>
                            <Text style={{ width: '12%', textAlign: 'center' }}>Cod.orig/Conv./Comp</Text>
                            <Text style={{ flex: 1, paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '6%', textAlign: 'center' }}>Quant</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>Un.Bruto</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>Un.liquido</Text>
                            <Text style={{ width: '10%', textAlign: 'right' }}>Total lqdo</Text>
                            <Text style={{ width: '4%', textAlign: 'right' }}>IPI</Text>
                        </View>

                        {items.map((item, idx) => {
                            globalSeq++;
                            const conv = getComplemento(item) || '—';
                            return (
                                <View key={idx} style={styles.tableRowDashed} wrap={false}>
                                    <Text style={{ width: '3%', textAlign: 'center' }}>{globalSeq}</Text>
                                    <Text style={{ width: '8%', textAlign: 'center' }}>{item.ite_produto}</Text>
                                    <Text style={{ width: '12%', textAlign: 'center', fontSize: 6 }}>{conv}</Text>
                                    <Text style={{ flex: 1, paddingLeft: 2 }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                    <Text style={{ width: '6%', textAlign: 'center', fontWeight: 'bold' }}>{item.ite_quant}</Text>
                                    <Text style={{ width: '8%', textAlign: 'right' }}>{fv(item.ite_puni)}</Text>
                                    <Text style={{ width: '8%', textAlign: 'right' }}>{fv(item.ite_puniliq)}</Text>
                                    <Text style={{ width: '10%', textAlign: 'right', fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                    <Text style={{ width: '4%', textAlign: 'right', fontSize: 6 }}>{fv(item.ite_ipi)}</Text>
                                </View>
                            );
                        })}

                        <View style={{ ...styles.subTotalRow, borderTopWidth: 0.5, marginTop: 2 }}>
                            <Text style={{ width: '70%' }}></Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>{fv(subTotalBruto)}</Text>
                            <Text style={{ width: '8%', textAlign: 'right' }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '10%', textAlign: 'right', fontWeight: 'bold' }}>{fv(subTotalLiq)}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 10: Simple Table - Sq, Quant, Prod, Desc, Un.Liq, Total, IPI
const ItemsModel10 = ({ groupedItems }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, items], groupIndex) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalLiq = items.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);

                return (
                    <View key={key} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7 }}>
                                Descontos: <Text style={{ fontWeight: 'normal' }}>{discountLabel}</Text>
                                {groupName !== 'GERAL' && <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>
                        <View style={styles.tableHeader}>
                            <Text style={{ width: '4%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Sq:</Text>
                            <Text style={{ width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Quant:</Text>
                            <Text style={{ width: '8%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Produto:</Text>
                            <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '12%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Un.líquido:</Text>
                            <Text style={{ width: '12%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Total liqdo:</Text>
                            <Text style={{ width: '5%', textAlign: 'right', paddingRight: 2 }}>IPI:</Text>
                        </View>

                        {items.map((item, idx) => {
                            globalSeq++;
                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={{ width: '4%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{globalSeq}</Text>
                                        <Text style={{ width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_quant}</Text>
                                        <Text style={{ width: '8%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_produto}</Text>
                                        <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={{ width: '12%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ width: '12%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                        <Text style={{ width: '5%', textAlign: 'right', paddingRight: 2 }}>{fv(item.ite_ipi)}</Text>
                                    </View>
                                    {item.pro_aplicacao && (
                                        <View style={{ paddingLeft: '17%', paddingBottom: 2 }}>
                                            <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ ...styles.label, width: '71%', paddingLeft: 2 }}>Sub-total:</Text>
                            <Text style={{ width: '12%', textAlign: 'right', paddingRight: 2 }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '12%', textAlign: 'right', paddingRight: 2 }}>{fv(subTotalLiq)}</Text>
                            <Text style={{ width: '5%' }}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// ============================================================================
// STYLES - Shared styles for all report models
// ============================================================================
const styles = StyleSheet.create({
    page: {
        padding: 20,
        fontSize: 8,
        fontFamily: 'Helvetica',
        color: '#334155',
    },
    // Header Section
    header: {
        flexDirection: 'row',
        borderWidth: 0.5,
        borderColor: '#94a3b8',
        borderStyle: 'solid',
        padding: 5,
        marginBottom: 3,
        alignItems: 'center',
    },
    logoBox: {
        width: 60,
        height: 35,
        borderWidth: 0.5,
        borderColor: '#cbd5e1',
        borderStyle: 'solid',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    companyInfo: {
        flex: 1,
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    companyName: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    industryBar: {
        backgroundColor: '#1e40af',
        color: 'white',
        textAlign: 'center',
        padding: 2,
        fontWeight: 'bold',
        fontSize: 9,
        marginBottom: 3,
    },
    // Grid & Layout
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderWidth: 0.5,
        borderColor: '#94a3b8',
        borderStyle: 'solid',
        padding: 3,
        marginBottom: 3,
    },
    gridRow: {
        flexDirection: 'row',
        marginBottom: 1,
    },
    // Labels & Values
    label: {
        color: '#64748b',
        fontSize: 7,
    },
    value: {
        fontWeight: 'bold',
        fontSize: 8,
    },
    redLabel: {
        color: '#dc2626',
    },
    // Section Containers
    sectionTitle: {
        backgroundColor: '#e2e8f0',
        borderWidth: 0.5,
        borderColor: '#94a3b8',
        borderStyle: 'solid',
        textAlign: 'center',
        fontWeight: 'bold',
        padding: 1,
        fontSize: 8,
    },
    sectionContent: {
        borderWidth: 0.5,
        borderColor: '#94a3b8',
        borderStyle: 'solid',
        borderTopWidth: 0,
        padding: 3,
        marginBottom: 3,
    },
    // Table Styles
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderWidth: 0.5,
        borderColor: '#94a3b8',
        borderStyle: 'solid',
        fontWeight: 'bold',
        fontSize: 7,
    },
    tableRow: {
        flexDirection: 'row',
        borderLeftWidth: 0.5,
        borderLeftColor: '#94a3b8',
        borderLeftStyle: 'solid',
        borderRightWidth: 0.5,
        borderRightColor: '#94a3b8',
        borderRightStyle: 'solid',
        borderBottomWidth: 0.5,
        borderBottomColor: '#cbd5e1',
        borderBottomStyle: 'solid',
        fontSize: 8,
    },
    subTotalRow: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#000000',
        borderTopStyle: 'solid',
        paddingVertical: 2,
        fontWeight: 'bold',
        fontSize: 7,
    },
    // Model 11 specific
    tableRowDashed: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#94a3b8',
        borderBottomStyle: 'dashed',
        paddingVertical: 3,
        minHeight: 18,
    },
    centeredSectionTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#f1f5f9',
        padding: 3,
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
        marginTop: 6,
        marginBottom: 1,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionContentModel11: {
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
        padding: 4,
        marginBottom: 4,
    },
    // Column definitions - Standard
    colSq: { width: '3.5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' },
    colQtd: { width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' },
    colProd: { width: '10%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colRef: { width: '12%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colDesc: { flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colDesc5: { width: '33%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colVal: { width: '8%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 },
    colTot: { width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 },
    colTax: { width: '5%', textAlign: 'right', paddingRight: 2 },
    // Column definitions - With Complement/Conversion
    colComp: { width: '8%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colConv: { width: '18%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    // Column definitions - Model 3 (F3)
    colQuant3: { width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' },
    colProd3: { width: '11%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' },
    colComp3: { width: '9%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colConv3: { width: '9%', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colDesc3: { flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 },
    colLiq3: { width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 },
    colTotLiq3: { width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 },
    colIpi3: { width: '6%', textAlign: 'right', paddingRight: 2 },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 10,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 7,
        color: '#94a3b8',
        borderTopWidth: 0.5,
        borderTopColor: '#e2e8f0',
        borderTopStyle: 'solid',
        paddingTop: 3,
    },
    // Model 5 specific
    totalsTable: {
        flexDirection: 'column',
        marginTop: 5,
        borderWidth: 0.5,
        borderColor: '#000000',
        borderStyle: 'solid',
    },
    totalsTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderBottomWidth: 0.5,
        borderBottomColor: '#000000',
        borderBottomStyle: 'solid',
    },
    totalsTableCellHeader: {
        flex: 1,
        textAlign: 'center',
        fontSize: 7,
        fontWeight: 'bold',
        padding: 2,
        borderRightWidth: 0.5,
        borderRightColor: '#000000',
        borderRightStyle: 'solid',
        color: '#dc2626',
    },
    totalsTableRow: {
        flexDirection: 'row',
    },
    totalsTableCellValue: {
        flex: 1,
        textAlign: 'center',
        fontSize: 9,
        fontWeight: 'bold',
        padding: 3,
        borderRightWidth: 0.5,
        borderRightColor: '#000000',
        borderRightStyle: 'solid',
    },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper to strip "None" literal string
const stripNone = (val) => {
    if (!val) return '';
    const s = String(val).trim().toLowerCase();
    if (s === 'none' || s === 'undefined' || s === 'null' || s === '') return '';
    return String(val);
};

// Format currency value
const fv = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Format date
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // Fix: Handles ISO dates (YYYY-MM-DD) which can shift to previous day
    const isoDate = String(dateStr).substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        const [y, m, d] = isoDate.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
};

// Format currency with 3 decimal places (Model 8)
const fv3 = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

// Group items by discount and product group
const groupItemsByDiscount = (items, separateGroups = 'S') => {
    const groups = {};
    (items || []).forEach(item => {
        const discKey = getItemDiscountString(item) || 'Preço de Tabela';
        const groupName = separateGroups === 'S' ? (item.gru_nome || 'GERAL') : 'GERAL';
        // Composite key for grouping
        const key = `${discKey}|GRP|${groupName}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
};

// ============================================================================
// SUB-COMPONENTS - Reusable sections
// ============================================================================

// Header with logo and company info - Supports Model 2 (Cotação) with industry logo
// Header with specific layout: Logos Top, Order Info Bar Below
const ReportHeader = ({ order, repInfo, logo, industryLogo, modelNum = 1 }) => {
    const isCotacao = modelNum === 2;
    // Prio 1: ped_situacao from database
    // Prio 2: Model 2 fallback
    // Prio 3: Default 'Pedido'
    const titulo = (order.ped_situacao && order.ped_situacao.trim().length > 0) 
        ? order.ped_situacao 
        : (isCotacao ? 'Cotação' : 'Pedido');
        
    const repEnderecoCompleto = `${repInfo?.rep_endereco || ''} ${repInfo?.rep_bairro || ''}`;
    const repCidadeInfo = `${repInfo?.rep_cidade || ''} ${repInfo?.rep_uf ? `UF: ${repInfo.rep_uf}` : ''} ${repInfo?.rep_cep ? `CEP: ${repInfo.rep_cep}` : ''}`;

    // Visual helper: Cotação title in red to distinguish from Order
    const titleStyle = (titulo.toUpperCase().includes('COTA') || isCotacao) ? { color: '#dc2626' } : { color: '#000000' };

    return (
        <View style={{ marginBottom: 2 }}>
            <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', borderBottomWidth: 0 }}>
                {/* Top Section: Logos and Company Info */}
                <View style={{ flexDirection: 'row', padding: 5, minHeight: 60, alignItems: 'center' }}>
                    {/* Left: Rep Logo */}
                    <View style={{ width: 80, alignItems: 'center', justifyContent: 'center' }}>
                        {logo ? (
                            <Image src={logo} style={{ maxWidth: 75, maxHeight: 50 }} />
                        ) : (
                            <Text style={{ fontSize: 6, color: '#94a3b8' }}>LOGO REP</Text>
                        )}
                    </View>

                    {/* Center: Rep Info */}
                    <View style={{ flex: 1, paddingHorizontal: 5, justifyContent: 'center', alignItems: (modelNum === 5 || modelNum === 10 || modelNum === 11 || modelNum === 12 || modelNum === 13) ? 'center' : 'flex-start' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>{repInfo?.rep_nome || 'SOFT HOUSE SISTEMAS'}</Text>
                        {(modelNum === 5 || modelNum === 10 || modelNum === 11 || modelNum === 12 || modelNum === 13) && repInfo?.rep_cnpj && <Text style={{ fontSize: 8 }}>CNPJ: {repInfo.rep_cnpj}</Text>}
                        <Text style={{ fontSize: 8 }}>{(modelNum === 5 || modelNum === 10 || modelNum === 11 || modelNum === 12 || modelNum === 13) ? `End: ${repEnderecoCompleto}` : repEnderecoCompleto}</Text>
                        <Text style={{ fontSize: 8 }}>{(modelNum === 5 || modelNum === 10 || modelNum === 11 || modelNum === 12 || modelNum === 13) ? `Fones: ${repInfo?.rep_fone || ''}` : repCidadeInfo}</Text>
                        {(modelNum === 5 || modelNum === 10 || modelNum === 11 || modelNum === 12 || modelNum === 13) && repInfo?.rep_user_email && <Text style={{ fontSize: 8 }}>E-mail: {repInfo.rep_user_email}</Text>}
                    </View>

                    {/* Right: Industry Logo — com proteção anti-freeze */}
                    <View style={{ width: '20%', alignItems: 'flex-end', justifyContent: 'center' }}>
                        {industryLogo ? (
                            <Image src={industryLogo} style={{ maxWidth: 80, maxHeight: 40, objectFit: 'contain' }} />
                        ) : (
                            <View style={{ width: 80, height: 40, backgroundColor: '#f1f5f9', borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ fontSize: 6, color: '#94a3b8' }}>LOGO</Text>
                            </View>
                        )}
                    </View>
                </View>

                {[4, 11, 12, 13, 14, 15, 16].includes(modelNum) && (
                    <View style={{ borderTopWidth: 0.5, borderTopColor: '#000', borderTopStyle: 'solid', paddingTop: 2, flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#ccc', borderRightStyle: 'solid', paddingLeft: 2 }}>
                            <View style={{ flexDirection: 'row' }}><Text style={styles.label}>{titulo} nº: </Text><Text style={styles.value}>{order.ped_pedido}</Text></View>
                            <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Data: </Text><Text style={styles.value}>{formatDate(order.ped_data)}</Text></View>
                            <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Fone Cli: </Text><Text style={styles.value}>{order.cli_fone || ''}</Text></View>
                        </View>
                        <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#ccc', borderRightStyle: 'solid', paddingLeft: 5 }}>
                            <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Nº ped. cliente/ Ordem compra: </Text><Text style={styles.value}>{order.ped_oc ||order.ped_cliind || order.ped_pedindustria || ''}</Text></View>
                            <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Cond. Pagamento: </Text><Text style={{ ...styles.value, color: '#dc2626' }}>{order.order_payment_type || order.ped_condpag || ''}</Text></View>
                        </View>
                        <View style={{ flex: 0.8, borderRightWidth: 0.5, borderRightColor: '#ccc', borderRightStyle: 'solid', paddingLeft: 5 }}>
                            {modelNum !== 16 && (
                                <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Lista: </Text><Text style={{ ...styles.value, fontWeight: 'bold' }}>{order.ped_tabela || 'PADRÃO'}</Text></View>
                            )}
                            <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Frete: </Text><Text style={{ ...styles.value, color: '#dc2626', fontWeight: 'bold', textDecoration: 'underline' }}>{order.ped_tipofrete === 'C' ? 'FRETE CIF' : 'FRETE FOB'}</Text></View>
                        </View>
                        {modelNum !== 14 && (
                            <View style={{ flex: 1, paddingLeft: 5 }}>
                                <Text style={{ ...styles.label, textAlign: 'center' }}>Vendedor</Text>
                                <Text style={{ ...styles.value, color: '#dc2626', fontWeight: 'bold', textAlign: 'center' }}>{order.ven_nome || ''}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Info Bar (Only for models that don't use expansions) */}
                {![4, 11, 12, 13, 14, 15, 16].includes(modelNum) && (
                    <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 3, backgroundColor: '#ffffff', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', ...titleStyle }}>{titulo} nº: {order.ped_pedido}</Text>
                        </View>
                        <View style={{ flex: 1.5, alignItems: 'center' }}>
                            <Text style={{ fontSize: 9 }}>Ped. cliente/ Ordem compra nº: <Text style={{ fontWeight: 'bold' }}>{order.ped_oc ||order.ped_cliind || ''}</Text></Text>
                        </View>
                        {modelNum === 3 && (
                            <View style={{ flex: 1.2, alignItems: 'center' }}>
                                <Text style={{ fontSize: 9 }}>Tabela: <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>{order.ped_tabela || 'PADRÃO'}</Text></Text>
                            </View>
                        )}
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Data: {formatDate(order.ped_data)}</Text>
                        </View>
                    </View>
                )}

                {/* Model 11 and 12 extra info below header */}

            </View>
        </View>
    );
};

// Industry bar
// Industry bar - Disabled to match Delphi layout (contained in ClientSection)
const IndustryBar = () => null;

// Client info section
// Client info section
const ClientSection = ({ order, hideTitle = false, noBorder = false, modelNum = 1 }) => {
    // Definindo estilo base sem bordas
    const baseStyle = {
        marginTop: 2,
        marginBottom: noBorder ? 0 : 3,
        padding: noBorder ? 0 : 3
    };

    // Adicionando bordas explícitas se não for noBorder
    const containerStyle = noBorder ? baseStyle : {
        ...baseStyle,
        borderWidth: 0.5,
        borderColor: '#94a3b8',
        borderStyle: 'solid'
    };

    // Quando noBorder é true, queremos remover completamente as bordas e padding do conteúdo interno
    // para que ele se ajuste perfeitamente ao container externo (sectionContentModel11)
    const contentStyle = noBorder ? { padding: 0 } : styles.sectionContent;

    return (
        <View style={containerStyle}>
            {!hideTitle && (
                <View style={{ ...styles.sectionTitle, backgroundColor: '#ffffff', borderBottomWidth: 0, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 7, textAlign: 'center' }}>DADOS DO CLIENTE</Text>
                </View>
            )}
            <View style={contentStyle}>
                {/* Indústria */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Indústria:</Text><Text style={styles.value}>{order.for_nome || ''}</Text></View>
                </View>
                {/* Razão Social */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Razão social:</Text><Text style={styles.value}>{order.cli_nome || ''}</Text></View>
                </View>
                {/* Endereço */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Endereço:</Text><Text style={styles.value}>{order.cli_endereco || ''}{order.cli_numero ? ', ' + order.cli_numero : ''}</Text></View>
                </View>
                {/* Complemento */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Complemento:</Text><Text style={styles.value}>{order.cli_complemento || ''}</Text></View>
                </View>
                {/* Bairro e Cidade */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 0.5 }}><Text style={styles.label}>Bairro:</Text><Text style={styles.value}>{order.cli_bairro || ''}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Cidade:</Text><Text style={styles.value}>{order.cli_cidade || ''}</Text></View>
                </View>
                {/* Cep e Estado */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 0.5 }}><Text style={styles.label}>Cep:</Text><Text style={styles.value}>{order.cli_cep || ''}</Text></View>
                    <View style={{ flex: 0.3 }}><Text style={styles.label}>Estado:</Text><Text style={styles.value}>{order.cli_uf || ''}</Text></View>
                </View>
                {/* CNPJ e Inscrição */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>CNPJ:</Text><Text style={styles.value}>{formatCpfCnpj(order.client_cnpj || order.cli_cnpj || order.cli_cgc)}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Inscrição:</Text><Text style={styles.value}>{order.cli_inscricao || ''}</Text></View>
                </View>
                {/* Fone e Fax */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Fone:</Text><Text style={styles.value}>{order.cli_fone || ''}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Fax:</Text><Text style={styles.value}>{order.cli_fax || ''}</Text></View>
                </View>
                {/* Comprador e E-Mail */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 0.5 }}><Text style={styles.label}>Comprador:</Text><Text style={styles.value}>{order.ped_comprador_display || order.ped_comprador || ''}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>E-Mail:</Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.ped_emailcomp || order.cli_email || ''}</Text></View>
                </View>
                {/* E-Mail NFe e Cx. Postal */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>E-Mail NFe:</Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.cli_emailnfe || order.cli_email || ''}</Text></View>
                    <View style={{ flex: 0.5 }}><Text style={styles.label}>Cx. Postal:</Text><Text style={styles.value}>{order.cli_cxpostal || ''}</Text></View>
                </View>
                {/* Suframa */}
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Suframa:</Text><Text style={styles.value}>{order.cli_suframa || ''}</Text></View>
                </View>
                {/* Condições pgto e Frete - Hidden for Model 11 and 12 as they are in the header box */}
                {modelNum !== 11 && modelNum !== 12 && (
                    <View style={styles.gridRow}>
                        <View style={{ flex: 1 }}><Text style={styles.label}>Condições pgto:</Text><Text style={styles.value}>{order.order_payment_type || order.ped_condpag || order.ped_conpgto || ''}</Text></View>
                        <View style={{ flex: 0.5 }}><Text style={styles.label}>Frete:</Text><Text style={{ ...styles.value, ...styles.redLabel }}>{order.ped_tipofrete === 'C' ? 'CIF' : order.ped_tipofrete === 'F' ? 'FOB' : order.ped_tipofrete || ''}</Text></View>
                    </View>
                )}
            </View>
        </View>
    );
};

// Commercial data section
const CommercialSection = ({ order }) => (
    <View style={{ marginBottom: 3 }}>
        <View style={{ ...styles.sectionTitle, backgroundColor: '#ffffff', borderBottomWidth: 0, justifyContent: 'center' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 7, textAlign: 'center' }}>DADOS COMERCIAIS</Text>
        </View>
        <View style={styles.sectionContent}>
            <View style={styles.gridRow}>
                <View style={{ flex: 1 }}><Text style={styles.label}>Vendedor:</Text><Text style={styles.value}>{order.ven_nome || ''}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Cond. Pagto:</Text><Text style={styles.value}>{order.ped_conpgto || ''}</Text></View>
                <View style={{ flex: 0.5 }}><Text style={styles.label}>Frete:</Text><Text style={styles.value}>{order.ped_tipofrete === 'C' ? 'CIF' : order.ped_tipofrete === 'F' ? 'FOB' : order.ped_tipofrete || ''}</Text></View>
            </View>
            <View style={styles.gridRow}>
                <View style={{ flex: 1 }}><Text style={styles.label}>Comprador:</Text><Text style={styles.value}>{order.ped_comprador_display || order.ped_comprador || ''}</Text></View>
                <View style={{ flex: 1.5 }}><Text style={styles.label}>E-Mail:</Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.ped_emailcomp || ''}</Text></View>
            </View>
            <View style={styles.gridRow}>
                <View style={{ flex: 1 }}><Text style={styles.label}>Ped. Cliente/ Ordem Compra:</Text><Text style={styles.value}>{order.ped_oc ||order.ped_cliind || ''}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Pedido Indústria:</Text><Text style={styles.value}>{order.ped_pedindu || ''}</Text></View>
            </View>
        </View>
    </View>
);

// Billing data section
const BillingSection = ({ order, hideTitle = false, noBorder = false }) => {
    const containerStyle = {
        marginBottom: noBorder ? 0 : 3
    };

    return (
        <View style={containerStyle}>
            {!hideTitle && (
                <View style={{ ...styles.sectionTitle, backgroundColor: '#ffffff', borderBottomWidth: 0, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 7, textAlign: 'center' }}>DADOS PARA COBRANÇA</Text>
                </View>
            )}
            <View style={noBorder ? { padding: 0 } : styles.sectionContent}>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1.5 }}><Text style={styles.label}>Endereço:</Text><Text style={styles.value}>O MESMO</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Bairro:</Text><Text style={styles.value}></Text></View>
                </View>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Cidade:</Text><Text style={styles.value}></Text></View>
                    <View style={{ flex: 0.5 }}><Text style={styles.label}>Cep:</Text><Text style={styles.value}></Text></View>
                    <View style={{ flex: 0.3 }}><Text style={styles.label}>UF:</Text><Text style={styles.value}></Text></View>
                </View>
                <View style={styles.gridRow}>
                    <Text style={{ ...styles.label, ...styles.redLabel }}>E-Mail financeiro: <Text style={{ textTransform: 'lowercase' }}>{order.cli_emailfinanceiro || ''}</Text></Text>
                </View>
            </View>
        </View>
    );
};

// Carrier/Transporter section
const CarrierSection = ({ order, hideTitle = false, noBorder = false }) => {
    const containerStyle = {
        marginBottom: noBorder ? 0 : 3
    };

    return (
        <View style={containerStyle}>
            {!hideTitle && (
                <View style={{ ...styles.sectionTitle, backgroundColor: '#ffffff', borderBottomWidth: 0, justifyContent: 'center' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 7, textAlign: 'center' }}>TRANSPORTADORA</Text>
                </View>
            )}
            <View style={noBorder ? { padding: 0 } : styles.sectionContent}>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1.5 }}><Text style={styles.label}>Nome:</Text><Text style={styles.value}>{order.tra_nome || ''}</Text></View>
                </View>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1.5 }}><Text style={styles.label}>Endereço:</Text><Text style={styles.value}>{order.tra_endereco || ''}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Bairro:</Text><Text style={styles.value}>{order.tra_bairro || ''}</Text></View>
                </View>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Cidade:</Text><Text style={styles.value}>{order.tra_cidade || ''}</Text></View>
                    <View style={{ flex: 0.5 }}><Text style={styles.label}>Cep:</Text><Text style={styles.value}>{order.tra_cep || ''}</Text></View>
                    <View style={{ flex: 0.3 }}><Text style={styles.label}>UF:</Text><Text style={styles.value}>{order.tra_uf || ''}</Text></View>
                </View>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1 }}><Text style={styles.label}>CNPJ:</Text><Text style={styles.value}>{formatCpfCnpj(order.tra_cgc)}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>I.Est:</Text><Text style={styles.value}>{order.tra_inscricao || ''}</Text></View>
                </View>
                <View style={styles.gridRow}>
                    <View style={{ flex: 1.5 }}><Text style={styles.label}>E-Mail:</Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.tra_email || ''}</Text></View>
                    <View style={{ flex: 1 }}><Text style={styles.label}>Fone:</Text><Text style={styles.value}>{order.tra_fone || ''}</Text></View>
                </View>
            </View>
        </View>
    );
};      // Observations section
const ObservationsSection = ({ order, highlighted = false }) => (
    <View style={{ marginBottom: 3, marginTop: 2 }}>
        <Text style={{ ...styles.label, ...styles.redLabel, fontSize: 8 }}>Observações:</Text>
        <View style={{ borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid', padding: 3, minHeight: 25 }}>
            {(order.ped_pedindu || order.ped_pedindustria) && (
                <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 2, color: '#1e40af' }}>Nº PEDIDO INDÚSTRIA: {order.ped_pedindu || order.ped_pedindustria}</Text>
            )}
            <Text style={{ fontSize: 7, color: highlighted ? '#dc2626' : '#000000', fontWeight: highlighted ? 'bold' : 'normal' }}>
                {order.ped_obs || ''}
            </Text>
        </View>
    </View>
);

// Order totals section - Matches Delphi layout
const TotalsSection = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {/* Left column - Totals */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 80 }}>Total bruto:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totbruto)}</Text>
                        <Text style={{ ...styles.label, width: 120 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 80 }}>Total líquido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totliq)}</Text>
                        <Text style={{ ...styles.label, width: 120 }}>Qtd total:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 80 }}>Total líquido c/IPI:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totalipi || order.ped_totliq)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 80 }}>Valor ST:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_vlrist)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={{ ...styles.label, width: 80 }}>Total do pedido:</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', width: 100, color: '#1e40af' }}>{fv(totalComImpostos)}</Text>
                    </View>
                </View>
                {/* Right column - Seller */}
                <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                    <Text style={{ ...styles.label }}>Vendedor:</Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#dc2626' }}>{order.ven_nome || ''}</Text>
                </View>
            </View>
        </View>
    );
};

// Footer
const ReportFooter = ({ pageNumber, totalPages }) => (
    <View style={styles.footer} fixed>
        <Text>Gerado em: {new Date().toLocaleString('pt-BR')}</Text>
        <Text>Página {pageNumber} de {totalPages}</Text>
    </View>
);

// Model 3 totals - Compact and matching reference
const TotalsSection3 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total líquido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totliq)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total líquido c/IPI:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totalipi || order.ped_totliq)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Valor ST:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_vlrist)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total do pedido:</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af' }}>{fv(totalComImpostos)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={{ ...styles.label, width: 90 }}>Vendedor:</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#dc2626' }}>{order.ven_nome || ''}</Text>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', textAlign: 'right', flex: 1 }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Qtd total:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', textAlign: 'right', flex: 1 }}>{totalQtd}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#dc2626' }}>{order.ven_fone || ''}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};


// Model 4: Specialized (Alternative Fields) - Quant, Prod, Embuch (Comp), CodOrig (Conv), Descrição, Un.Liq, Total, IPI
const ItemsModel4 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
                const [discountLabel, groupName] = key.split('|GRP|');
                const subTotalLiq = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const subTotalIpi = groupItems.reduce((acc, it) => {
                    const liq = parseFloat(it.ite_totliquido) || 0;
                    const ipiPerc = parseFloat(it.ite_ipi) || 0;
                    return acc + (liq * ipiPerc / 100);
                }, 0);
                const subTotalComIpi = subTotalLiq + subTotalIpi;

                return (
                    <View key={groupIndex} style={{ marginBottom: 5 }}>
                        {/* Discount Group Header */}
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid', borderBottomWidth: 0 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                                Descontos: <Text style={{ color: '#000000' }}>{discountLabel}</Text>
                                {groupName !== 'GERAL' && <Text style={{ color: '#1e40af' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={styles.colQuant3}>Quant:</Text>
                            <Text style={styles.colProd3}>Produto:</Text>
                            <Text style={styles.colComp3}>Complemento:</Text>
                            <Text style={styles.colConv3}>Conversão:</Text>
                            <Text style={styles.colDesc3}>Descrição do produto:</Text>
                            <Text style={styles.colLiq3}>Un.líquido:</Text>
                            <Text style={styles.colTotLiq3}>Total liqdo:</Text>
                            <Text style={styles.colIpi3}>IPI:</Text>
                        </View>

                        {groupItems.map((item, idx) => {
                            globalSeq++;
                            const liq = parseFloat(item.ite_totliquido) || 0;
                            const ipiPerc = parseFloat(item.ite_ipi) || 0;
                            const ipiValor = (liq * ipiPerc / 100);
                            const proAplicacao = stripNone(item.pro_aplicacao);

                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={styles.colQuant3}>{item.ite_quant}</Text>
                                        <Text style={styles.colProd3}>{item.ite_produto}</Text>
                                        <Text style={styles.colComp3}>{stripNone(item.ite_embuch)}</Text>
                                        <Text style={styles.colConv3}>{stripNone(item.pro_codigooriginal)}</Text>
                                        <Text style={styles.colDesc3}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={styles.colLiq3}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ ...styles.colTotLiq3, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                        <Text style={styles.colIpi3}>{fv(ipiValor)}</Text>
                                    </View>
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ ...styles.colQuant3, borderRightWidth: 0, borderLeftWidth: 0 }}>Sub-total:</Text>
                            <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}></Text>
                            <Text style={styles.colLiq3}>{fv(subTotalLiq)}</Text>
                            <Text style={styles.colTotLiq3}>{fv(subTotalComIpi)}</Text>
                            <Text style={styles.colIpi3}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 5 totals - Full Horizontal Grid Table (Format 5/6)
const TotalsSection5 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalPeso = parseFloat(order.ped_pesoliquido) || parseFloat(order.ped_pesobruto) || 0;
    const totalCxs = order.ped_qtdcx || 0;

    return (
        <View style={styles.totalsTable}>
            <View style={styles.totalsTableHeader}>
                <View style={styles.totalsTableCellHeader}><Text>Total líquido</Text></View>
                <View style={styles.totalsTableCellHeader}><Text>Qtd peças</Text></View>
                <View style={styles.totalsTableCellHeader}><Text>Qtd cxs</Text></View>
                <View style={styles.totalsTableCellHeader}><Text>Qtd de itens</Text></View>
                <View style={styles.totalsTableCellHeader}><Text>Peso total</Text></View>
                <View style={{ ...styles.totalsTableCellHeader, borderRightWidth: 0, color: '#1e40af' }}><Text>Total líquido c/IPI:</Text></View>
            </View>
            <View style={styles.totalsTableRow}>
                <View style={styles.totalsTableCellValue}><Text>{fv(order.ped_totliq)}</Text></View>
                <View style={styles.totalsTableCellValue}><Text>{totalQtd}</Text></View>
                <View style={styles.totalsTableCellValue}><Text>{totalCxs}</Text></View>
                <View style={styles.totalsTableCellValue}><Text>{totalItems}</Text></View>
                <View style={styles.totalsTableCellValue}><Text>{totalPeso.toFixed(3)}</Text></View>
                <View style={{ ...styles.totalsTableCellValue, borderRightWidth: 0 }}><Text>{fv(order.ped_totalipi || order.ped_totliq)}</Text></View>
            </View>
        </View>
    );
};

// Model 5: Full Hybrid Table - Sq, Quant, Prod, Conversão, Desc, Un.Liq, Total, IPI
const ItemsModel5 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
                const [discountKey, groupName] = key.split('|GRP|');
                const groupTotalLiq = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const groupTotalIpi = groupItems.reduce((acc, it) => {
                    const liq = parseFloat(it.ite_totliquido) || 0;
                    const ipiPerc = parseFloat(it.ite_ipi) || 0;
                    return acc + (liq * ipiPerc / 100);
                }, 0);
                const groupTotalComIpi = groupTotalLiq + groupTotalIpi;

                return (
                    <View key={groupIndex} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid', borderBottomWidth: 0 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                                Descontos: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                                {groupName !== 'GERAL' && <Text style={{ color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={styles.colSq}>Sq:</Text>
                            <Text style={styles.colQtd}>Quant:</Text>
                            <Text style={styles.colProd}>Produto:</Text>
                            <Text style={styles.colConv}>Conversão:</Text>
                            <Text style={styles.colDesc5}>Descrição do produto:</Text>
                            <Text style={styles.colVal}>Un.líquido:</Text>
                            <Text style={styles.colTot}>Total liqdo:</Text>
                            <Text style={styles.colTax}>IPI:</Text>
                        </View>

                        {groupItems.map((item, idx) => {
                            const liq = parseFloat(item.ite_totliquido) || 0;
                            const ipiPerc = parseFloat(item.ite_ipi) || 0;
                            const ipiValor = (liq * ipiPerc / 100);
                            const itemDiscounts = getItemDiscountString(item);
                            globalSeq++;

                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={styles.colSq}>{globalSeq}</Text>
                                        <Text style={styles.colQtd}>{item.ite_quant}</Text>
                                        <Text style={styles.colProd}>{item.ite_produto}</Text>
                                        <Text style={styles.colConv}>{item.pro_codigooriginal || ''}</Text>
                                        <Text style={styles.colDesc5}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={styles.colVal}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ ...styles.colTot, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                        <Text style={styles.colTax}>{fv(ipiValor)}</Text>
                                    </View>
                                    {(itemDiscounts || item.pro_aplicacao) && (
                                        <View style={{ flexDirection: 'row', paddingLeft: '22%', paddingBottom: 2, backgroundColor: '#fdf2f2' }}>
                                            {itemDiscounts && <Text style={{ fontSize: 7, color: '#dc2626', fontWeight: 'bold', marginRight: 10 }}>DESC: {itemDiscounts}</Text>}
                                            {item.pro_aplicacao && <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>}
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ width: '65%', paddingLeft: 2 }}>Sub-total:</Text>
                            <Text style={{ width: '18%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalLiq)}</Text>
                            <Text style={{ width: '12%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalComIpi)}</Text>
                            <Text style={{ width: '5%' }}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 7 totals - Horizontal Grid with IPI Value
const TotalsSection7 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalPeso = parseFloat(order.ped_pesoliquido) || parseFloat(order.ped_pesobruto) || 0;
    const totalIpiVal = (items || []).reduce((acc, it) => {
        const liq = parseFloat(it.ite_totliquido) || 0;
        const ipiPerc = parseFloat(it.ite_ipi) || 0;
        return acc + (liq * ipiPerc / 100);
    }, 0);

    return (
        <View>
            <View style={styles.totalsTable}>
                <View style={styles.totalsTableHeader}>
                    <View style={styles.totalsTableCellHeader}><Text>Total líquido</Text></View>
                    <View style={styles.totalsTableCellHeader}><Text>Qtd peças</Text></View>
                    <View style={styles.totalsTableCellHeader}><Text>Qtd de itens no pedido</Text></View>
                    <View style={styles.totalsTableCellHeader}><Text>Peso total</Text></View>
                    <View style={styles.totalsTableCellHeader}><Text>IPI R$</Text></View>
                    <View style={{ ...styles.totalsTableCellHeader, borderRightWidth: 0 }}><Text>Total líquido c/IPI:</Text></View>
                </View>
                <View style={styles.totalsTableRow}>
                    <View style={styles.totalsTableCellValue}><Text>{fv(order.ped_totliq)}</Text></View>
                    <View style={styles.totalsTableCellValue}><Text>{totalQtd}</Text></View>
                    <View style={styles.totalsTableCellValue}><Text>{totalItems}</Text></View>
                    <View style={styles.totalsTableCellValue}><Text>{totalPeso.toFixed(3)}</Text></View>
                    <View style={styles.totalsTableCellValue}><Text>{fv(totalIpiVal)}</Text></View>
                    <View style={{ ...styles.totalsTableCellValue, borderRightWidth: 0 }}><Text>{fv(order.ped_totalipi || order.ped_totliq)}</Text></View>
                </View>
            </View>
            <View style={{ marginTop: 5 }}>
                <Text style={{ ...styles.label, color: '#dc2626' }}>Vendedor: <Text style={{ color: '#000000', fontWeight: 'bold' }}>{order.ven_nome || ''}</Text> <Text style={{ color: '#dc2626', marginLeft: 20 }}>{order.ven_fone || ''}</Text></Text>
                <Text style={{ ...styles.label, marginTop: 2 }}>Observações complementares:</Text>
                <View style={{ borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid', padding: 3, minHeight: 40, marginTop: 2 }}>
                    <Text style={{ fontSize: 7 }}>{order.ped_obscomplementar || ''}</Text>
                </View>
            </View>
        </View>
    );
};

// Model 7: Similar to 1 but with IPI Value - Sq, Quant, Prod, Desc, Un.Bruto, Un.Liq, Total, IPI
const ItemsModel7 = ({ groupedItems }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
                const [discountKey, groupName] = key.split('|GRP|');
                const groupTotalLiq = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);

                return (
                    <View key={groupIndex} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                                Descontos: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                                {groupName !== 'GERAL' && <Text style={{ color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={styles.colSq}>Sq:</Text>
                            <Text style={styles.colQtd}>Quant:</Text>
                            <Text style={styles.colProd}>Produto:</Text>
                            <Text style={styles.colDesc}>Descrição do produto:</Text>
                            <Text style={styles.colVal}>Un.Bruto:</Text>
                            <Text style={styles.colVal}>Un.líquido:</Text>
                            <Text style={styles.colTot}>Total liqdo:</Text>
                            <Text style={styles.colTax}>IPI:</Text>
                        </View>

                        {groupItems.map((item, idx) => {
                            const liq = parseFloat(item.ite_totliquido) || 0;
                            const ipiPerc = parseFloat(item.ite_ipi) || 0;
                            const ipiValor = (liq * ipiPerc / 100);
                            const itemDiscounts = getItemDiscountString(item);
                            globalSeq++;

                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={styles.colSq}>{globalSeq}</Text>
                                        <Text style={styles.colQtd}>{item.ite_quant}</Text>
                                        <Text style={styles.colProd}>{item.ite_produto}</Text>
                                        <Text style={styles.colDesc}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={styles.colVal}>{fv(item.ite_puni)}</Text>
                                        <Text style={styles.colVal}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ ...styles.colTot, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                        <Text style={styles.colTax}>{fv(ipiValor)}</Text>
                                    </View>
                                    {(itemDiscounts || item.pro_aplicacao) && (
                                        <View style={{ flexDirection: 'row', paddingLeft: '22%', paddingBottom: 2, backgroundColor: '#fdf2f2' }}>
                                            {itemDiscounts && <Text style={{ fontSize: 7, color: '#dc2626', fontWeight: 'bold', marginRight: 10 }}>DESC: {itemDiscounts}</Text>}
                                            {item.pro_aplicacao && <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>}
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ width: '82%', paddingLeft: 2 }}>Sub-total:</Text>
                            <Text style={{ width: '13%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalLiq)}</Text>
                            <Text style={{ width: '5%' }}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 8: High Precision (3 decimals) - Quant, Prod, Desc, Un.Liq (3), Un.c/IPI (3), Tot.Liq (2), Tot.c/IPI (2), IPI%
const ItemsModel8 = ({ groupedItems, order }) => {
    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
                const [discountKey, groupName] = key.split('|GRP|');
                const groupTotalBruto = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totbruto) || 0), 0);
                const groupTotalLiq = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const groupTotalComIpi = groupItems.reduce((acc, it) => {
                    const liq = parseFloat(it.ite_totliquido) || 0;
                    const ipiPerc = parseFloat(it.ite_ipi) || 0;
                    return acc + (liq * (1 + ipiPerc / 100));
                }, 0);

                return (
                    <View key={groupIndex} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                                Descontos: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                                {groupName !== 'GERAL' && <Text style={{ color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={{ width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Quant:</Text>
                            <Text style={{ width: '8%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Produto:</Text>
                            <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Unitário:</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Un.c/IPI:</Text>
                            <Text style={{ width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Total:</Text>
                            <Text style={{ width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2, fontWeight: 'bold' }}>Total c/IPI:</Text>
                            <Text style={{ width: '5%', textAlign: 'right', paddingRight: 2 }}>IPI:</Text>
                        </View>

                        {groupItems.map((item, idx) => {
                            const liq = parseFloat(item.ite_totliquido) || 0;
                            const ipiPerc = parseFloat(item.ite_ipi) || 0;
                            const pLiq = parseFloat(item.ite_puniliq) || 0;
                            const pComIpi = pLiq * (1 + ipiPerc / 100);
                            const tComIpi = liq * (1 + ipiPerc / 100);
                            const itemDiscounts = getItemDiscountString(item);

                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={{ width: '5%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_quant}</Text>
                                        <Text style={{ width: '8%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_produto}</Text>
                                        <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv3(pLiq)}</Text>
                                        <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv3(pComIpi)}</Text>
                                        <Text style={{ width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(liq)}</Text>
                                        <Text style={{ width: '10%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2, fontWeight: 'bold' }}>{fv(tComIpi)}</Text>
                                        <Text style={{ width: '5%', textAlign: 'right', paddingRight: 2 }}>{fv(ipiPerc)}</Text>
                                    </View>
                                    {(itemDiscounts || item.pro_aplicacao) && (
                                        <View style={{ flexDirection: 'row', paddingLeft: '13%', paddingBottom: 2, backgroundColor: '#fdf2f2' }}>
                                            {itemDiscounts && <Text style={{ fontSize: 7, color: '#dc2626', fontWeight: 'bold', marginRight: 10 }}>DESC: {itemDiscounts}</Text>}
                                            {item.pro_aplicacao && <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>}
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ width: '13%', borderRightWidth: 0 }}>Sub-total:</Text>
                            <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}></Text>
                            <Text style={{ width: '9%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalBruto)}</Text>
                            <Text style={{ width: '9%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalComIpi)}</Text>
                            <Text style={{ width: '10%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalLiq)}</Text>
                            <Text style={{ width: '10%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalComIpi)}</Text>
                            <Text style={{ width: '5%' }}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// Model 9 totals - Detailed Taxes Summary
const TotalsSection9 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 120 }}>Total líquido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totliq)}</Text>
                        <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 120 }}>Total líquido c/ impostos:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(totalComImpostos)}</Text>
                        <Text style={{ ...styles.label, width: 150 }}>Qtd total:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

// Model 9: Taxes Column - Quant, Prod, Desc, Unit, Total, Impostos(R$), Total c/Imp, IPI%, ST%
const ItemsModel9 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
                const [discountKey, groupName] = key.split('|GRP|');
                const groupTotalLiq = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const groupTotalImp = groupItems.reduce((acc, it) => {
                    const liq = parseFloat(it.ite_totliquido) || 0;
                    const ipiPerc = parseFloat(it.ite_ipi) || 0;
                    const stVal = parseFloat(it.ite_valcomst || 0) - parseFloat(it.ite_valcomipi || liq);
                    return acc + (liq * ipiPerc / 100) + stVal;
                }, 0);
                const groupTotalGeral = groupTotalLiq + groupTotalImp;

                return (
                    <View key={groupIndex} style={{ marginBottom: 5 }}>
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                                Descontos: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                                {groupName !== 'GERAL' && <Text style={{ color: '#1e40af', fontWeight: 'bold' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>

                        <View style={styles.tableHeader}>
                            <Text style={{ width: '4%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Sq:</Text>
                            <Text style={{ width: '4%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Quant:</Text>
                            <Text style={{ width: '8%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>Produto:</Text>
                            <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>Descrição do produto:</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Unitário:</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Total:</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Impostos (R$):</Text>
                            <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>Total c/Imp:</Text>
                            <Text style={{ width: '4%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>IPI:</Text>
                            <Text style={{ width: '4%', textAlign: 'right', paddingRight: 2 }}>ST:</Text>
                        </View>

                        {groupItems.map((item, idx) => {
                            const liq = parseFloat(item.ite_totliquido) || 0;
                            const ipiPerc = parseFloat(item.ite_ipi) || 0;
                            const ipiVal = (liq * ipiPerc / 100);
                            const stVal = parseFloat(item.ite_valcomst || 0) - parseFloat(item.ite_valcomipi || liq);
                            const totalImp = ipiVal + stVal;
                            const totalComImp = liq + totalImp;
                            globalSeq++;

                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={{ width: '4%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{globalSeq}</Text>
                                        <Text style={{ width: '4%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_quant}</Text>
                                        <Text style={{ width: '8%', textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}>{item.ite_produto}</Text>
                                        <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingLeft: 2 }}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(liq)}</Text>
                                        <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(totalImp)}</Text>
                                        <Text style={{ width: '9%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(totalComImp)}</Text>
                                        <Text style={{ width: '4%', textAlign: 'right', borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid', paddingRight: 2 }}>{fv(ipiPerc)}</Text>
                                        <Text style={{ width: '4%', textAlign: 'right', paddingRight: 2 }}>{fv(item.ite_st)}</Text>
                                    </View>
                                    {item.pro_aplicacao && (
                                        <View style={{ paddingLeft: '16%', paddingBottom: 2 }}>
                                            <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        <View style={styles.subTotalRow}>
                            <Text style={{ width: '40%', paddingLeft: 2 }}>Sub-total:</Text>
                            <Text style={{ width: '9%', textAlign: 'right', marginLeft: 'auto', paddingRight: 2 }}>{fv(groupTotalLiq)}</Text>
                            <Text style={{ width: '9%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalImp)}</Text>
                            <Text style={{ width: '9%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalGeral)}</Text>
                            <Text style={{ width: '8%' }}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};const ItemsModel3 = ({ groupedItems, order }) => {
    let globalSeq = 0;

    return (
        <View style={{ marginBottom: 3 }}>
            {Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
                const [discountKey, groupName] = key.split('|GRP|');
                const groupTotalLiq = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);
                const groupTotalIpi = groupItems.reduce((acc, it) => {
                    const liq = parseFloat(it.ite_totliquido) || 0;
                    const ipiPerc = parseFloat(it.ite_ipi) || 0;
                    return acc + (liq * ipiPerc / 100);
                }, 0);
                const groupTotalComIpi = groupTotalLiq + groupTotalIpi;

                return (
                    <View key={groupIndex} style={{ marginBottom: 8 }}>
                        {/* Discount Group Header */}
                        <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                                Descontos: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                                {groupName !== 'GERAL' && <Text style={{ color: '#1e40af' }}> - Grupo: {groupName}</Text>}
                            </Text>
                        </View>

                        {/* Table Header per group */}
                        <View style={styles.tableHeader}>
                            <Text style={styles.colQuant3}>Quant:</Text>
                            <Text style={styles.colProd3}>Produto:</Text>
                            <Text style={styles.colComp3}>Complemento:</Text>
                            <Text style={styles.colConv3}>Conversão:</Text>
                            <Text style={styles.colDesc3}>Descrição do produto:</Text>
                            <Text style={styles.colLiq3}>Un.líquido:</Text>
                            <Text style={styles.colTotLiq3}>Total liqdo:</Text>
                            <Text style={styles.colIpi3}>IPI:</Text>
                        </View>

                        {/* Items */}
                        {groupItems.map((item, idx) => {
                            const liq = parseFloat(item.ite_totliquido) || 0;
                            const ipiPerc = parseFloat(item.ite_ipi) || 0;
                            const ipiValor = (liq * ipiPerc / 100);
                            globalSeq++;

                            return (
                                <View key={idx} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                                    <View style={{ flexDirection: 'row' }}>
                                        <Text style={styles.colQuant3}>{item.ite_quant}</Text>
                                        <Text style={styles.colProd3}>{item.ite_produto}</Text>
                                        <Text style={styles.colComp3}>{stripNone(item.ite_embuch)}</Text>
                                        <Text style={styles.colConv3}>{stripNone(item.ite_conversao)}</Text>
                                        <Text style={styles.colDesc3}>{item.pro_nome || item.ite_nomeprod}</Text>
                                        <Text style={styles.colLiq3}>{fv(item.ite_puniliq)}</Text>
                                        <Text style={{ ...styles.colTotLiq3, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                                        <Text style={styles.colIpi3}>{fv(ipiValor)}</Text>
                                    </View>
                                    
                                </View>
                            );
                        })}

                        {/* Group Sub-total */}
                        <View style={styles.subTotalRow}>
                            <Text style={{ ...styles.colQuant3, borderRightWidth: 0, borderLeftWidth: 0 }}>Sub-total:</Text>
                            <Text style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#94a3b8', borderRightStyle: 'solid' }}></Text>
                            <Text style={styles.colLiq3}>{fv(groupTotalLiq)}</Text>
                            <Text style={styles.colTotLiq3}>{fv(groupTotalComIpi)}</Text>
                            <Text style={styles.colIpi3}></Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};
// Model 1: Standard - Sq, Qtd, Prod, Desc, Un.Bruto, Un.Liq, Total
const ItemsModel1 = ({ groupedItems }) => {
    let globalSeq = 0;

    // Achatado em uma lista única de elementos irmãos pra que o react-pdf
    // possa quebrar entre cabeçalho e linhas naturalmente — antes o wrapper
    // View por grupo empurrava o bloco inteiro pra próxima página, deixando
    // uma página em branco quando os itens não cabiam no espaço restante.
    return Object.entries(groupedItems).flatMap(([key, groupItems], groupIndex) => {
        const [discountKey, groupName] = key.split('|GRP|');
        const groupTotalLiquido = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totliquido) || 0), 0);

        // Cabeçalho do grupo (Descontos + colunas) — wrap=false pra manter
        // os dois juntos e minPresenceAhead garante que não fique órfão antes
        // de uma quebra de página: se faltar menos de 40pt depois dele, empurra.
        const header = (
            <View key={`gh-${groupIndex}`} wrap={false} minPresenceAhead={40}>
                <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                        Descontos: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                        {groupName !== 'GERAL' && <Text style={{ color: '#1e40af' }}> - Grupo: {groupName}</Text>}
                    </Text>
                </View>
                <View style={styles.tableHeader}>
                    <Text style={styles.colSq}>Sq:</Text>
                    <Text style={styles.colQtd}>Quant:</Text>
                    <Text style={styles.colProd}>Produto:</Text>
                    <Text style={styles.colDesc}>Descrição do produto:</Text>
                    <Text style={styles.colVal}>Un.Bruto:</Text>
                    <Text style={styles.colVal}>Un.líquido:</Text>
                    <Text style={styles.colTot}>Total lqdo:</Text>
                    <Text style={styles.colTax}>IPI:</Text>
                </View>
            </View>
        );

        const rows = groupItems.map((item, idx) => {
            globalSeq++;
            const compOriginal = stripNone(item.pro_codigooriginal);

            return (
                <View key={`r-${groupIndex}-${idx}`} style={{ ...styles.tableRow, flexDirection: 'column' }} wrap={false}>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={styles.colSq}>{globalSeq}</Text>
                        <Text style={styles.colQtd}>{item.ite_quant}</Text>
                        <Text style={styles.colProd}>{item.ite_produto}</Text>
                        <Text style={styles.colDesc}>{item.pro_nome || item.ite_nomeprod}</Text>
                        <Text style={styles.colVal}>{fv(item.ite_puni)}</Text>
                        <Text style={styles.colVal}>{fv(item.ite_puniliq)}</Text>
                        <Text style={{ ...styles.colTot, fontWeight: 'bold' }}>{fv(item.ite_totliquido)}</Text>
                        <Text style={styles.colTax}>{fv(item.ite_ipi || 0)}</Text>
                    </View>
                    {(compOriginal || item.pro_aplicacao) && (
                        <View style={{ flexDirection: 'row', paddingLeft: '22%', paddingBottom: 2, backgroundColor: '#f9fafb' }}>
                            {compOriginal && <Text style={{ fontSize: 7, color: '#1e40af', fontWeight: 'bold', marginRight: 10 }}>COMPL: {compOriginal}</Text>}
                            {item.pro_aplicacao && <Text style={{ fontSize: 7, color: '#4b5563' }}>{item.pro_aplicacao}</Text>}
                        </View>
                    )}
                </View>
            );
        });

        const subtotal = (
            <View key={`st-${groupIndex}`} style={{ ...styles.subTotalRow, marginBottom: 3 }} wrap={false}>
                <Text style={{ width: '65%', paddingLeft: 2 }}>Sub-total:</Text>
                <Text style={{ width: '18%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalLiquido)}</Text>
                <Text style={{ width: '12%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalLiquido)}</Text>
                <Text style={{ width: '5%' }}></Text>
            </View>
        );

        return [header, ...rows, subtotal];
    });
};

// Model 2: Cotação - Sq, Quant, Prod, Desc, Unit c/IPI, Total c/IPI, %IPI
const ItemsModel2 = ({ groupedItems }) => {
    let globalSeq = 0;

    return Object.entries(groupedItems).map(([key, groupItems], groupIndex) => {
        const [discountKey, groupName] = key.split('|GRP|');
        const groupTotalIPI = groupItems.reduce((acc, it) => acc + (parseFloat(it.ite_totalipi) || parseFloat(it.ite_totliquido) || 0), 0);

        return (
            <View key={groupIndex} style={{ marginBottom: 3 }}>
                {/* Discount Header */}
                <View style={{ backgroundColor: '#ffffff', padding: 2, borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 7, ...styles.redLabel }}>
                        Descontos praticados nos itens abaixo: <Text style={{ color: '#000000' }}>{discountKey}</Text>
                        {groupName !== 'GERAL' && <Text style={{ color: '#1e40af' }}> - Grupo: {groupName}</Text>}
                    </Text>
                </View>

                {/* Table Header - Model 2 */}
                <View style={styles.tableHeader}>
                    <Text style={styles.colSq}>Sq:</Text>
                    <Text style={styles.colQtd}>Quant:</Text>
                    <Text style={styles.colProd}>Produto:</Text>
                    <Text style={styles.colDesc}>Descrição do produto:</Text>
                    <Text style={styles.colVal}>Unit c/IPI:</Text>
                    <Text style={styles.colTot}>Total c/IPI:</Text>
                    <Text style={styles.colTax}>%IPI:</Text>
                </View>

                {/* Items */}
                {groupItems.map((item, idx) => {
                    globalSeq++;
                    const unitIPI = parseFloat(item.ite_puniipi) || parseFloat(item.ite_puniliq) || 0;
                    const totalIPI = parseFloat(item.ite_totalipi) || parseFloat(item.ite_totliquido) || 0;
                    const percIPI = parseFloat(item.ite_ipi) || 0;
                    return (
                        <View key={idx} style={styles.tableRow} wrap={false}>
                            <Text style={styles.colSq}>{globalSeq}</Text>
                            <Text style={styles.colQtd}>{item.ite_quant}</Text>
                            <Text style={styles.colProd}>{item.ite_produto}</Text>
                            <Text style={styles.colDesc}>{item.pro_nome || item.ite_nomeprod}</Text>
                            <Text style={styles.colVal}>{fv(unitIPI)}</Text>
                            <Text style={{ ...styles.colTot, fontWeight: 'bold' }}>{fv(totalIPI)}</Text>
                            <Text style={styles.colTax}>{fv(percIPI)}</Text>
                        </View>
                    );
                })}

                {/* Subtotal */}
                <View style={styles.subTotalRow}>
                    <Text style={{ width: '70%', paddingLeft: 2 }}>Sub-total:</Text>
                    <Text style={{ width: '20%', textAlign: 'right', paddingRight: 2 }}>{fv(groupTotalIPI)}</Text>
                    <Text style={{ width: '10%' }}></Text>
                </View>
            </View>
        );
    });
};

// Model 14 totals - Executive Grid for Quotes
const TotalsSection14 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    const BoxHeader = ({ title }) => (
        <View style={{ backgroundColor: '#64748b', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
            <Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold', textAlign: 'center' }}>{title}</Text>
        </View>
    );

    return (
        <View>
            <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid', marginTop: 3 }}>
                <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                    <BoxHeader title="Total bruto" />
                    <Text style={{ textAlign: 'center', padding: 3, fontSize: 9 }}>{fv(order.ped_totbruto)}</Text>
                </View>
                <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                    <BoxHeader title="Total" />
                    <Text style={{ textAlign: 'center', padding: 3, fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totliq)}</Text>
                </View>
                <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                    <BoxHeader title="Com Impostos" />
                    <Text style={{ textAlign: 'center', padding: 3, fontSize: 9, fontWeight: 'bold' }}>{fv(totalComImpostos)}</Text>
                </View>
                <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                    <BoxHeader title="Nº Ítens" />
                    <Text style={{ textAlign: 'center', padding: 3, fontSize: 9 }}>{totalItems}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <BoxHeader title="Qtd total" />
                    <Text style={{ textAlign: 'center', padding: 3, fontSize: 9 }}>{totalQtd}</Text>
                </View>
            </View>
            <View style={{ backgroundColor: '#64748b', padding: 2, marginTop: 2, borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid' }}>
                <Text style={{ color: '#ffffff', fontSize: 8, fontWeight: 'bold', textAlign: 'center' }}>OBSERVAÇÕES GERAIS</Text>
            </View>
            <View style={{ borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid', borderTopWidth: 0, padding: 4, minHeight: 40 }}>
                <Text style={{ fontSize: 7 }}>{order.ped_obs || ''}</Text>
            </View>
        </View>
    );
};

// Model 13 totals - Landscape composite footer
const TotalsSection13 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    const BoxHeader = ({ title }) => (
        <View style={{ backgroundColor: '#94a3b8', padding: 2, borderBottomWidth: 0.5, borderBottomColor: '#000', borderBottomStyle: 'solid' }}>
            <Text style={{ color: '#ffffff', fontSize: 7, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>{title}</Text>
        </View>
    );

    return (
        <View style={{ flexDirection: 'row', gap: 5 }}>
            {/* Left side: Totals Grid + Obs */}
            <View style={{ flex: 1.5 }}>
                <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid' }}>
                    <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                        <BoxHeader title="Total bruto" />
                        <Text style={{ textAlign: 'center', padding: 2, fontSize: 8, fontWeight: 'bold' }}>{fv(order.ped_totbruto)}</Text>
                    </View>
                    <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                        <BoxHeader title="Total" />
                        <Text style={{ textAlign: 'center', padding: 2, fontSize: 8, fontWeight: 'bold' }}>{fv(order.ped_totliq)}</Text>
                    </View>
                    <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                        <BoxHeader title="Com Impostos" />
                        <Text style={{ textAlign: 'center', padding: 2, fontSize: 8, fontWeight: 'bold' }}>{fv(totalComImpostos)}</Text>
                    </View>
                    <View style={{ flex: 1, borderRightWidth: 0.5, borderRightColor: '#000', borderRightStyle: 'solid' }}>
                        <BoxHeader title="Nº ítens" />
                        <Text style={{ textAlign: 'center', padding: 2, fontSize: 8, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <BoxHeader title="Qtd total" />
                        <Text style={{ textAlign: 'center', padding: 2, fontSize: 8, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                </View>
                <View style={{ borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid', marginTop: 2 }}>
                    <BoxHeader title="OBSERVAÇÕES GERAIS" />
                    <View style={{ minHeight: 40, padding: 3 }}>
                        <Text style={{ fontSize: 7, color: '#DC2626', fontWeight: 'bold' }}>{order.ped_obs || order.ped_obscomplementar || ''}</Text>
                    </View>
                </View>
            </View>

            {/* Right side: Carrier */}
            <View style={{ flex: 1, borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid' }}>
                <BoxHeader title="TRANSPORTADORA" />
                <View style={{ padding: 3, gap: 1 }}>
                    <View style={{ flexDirection: 'row' }}><Text style={styles.label}>CNPJ: </Text><Text style={styles.value}>{formatCpfCnpj(order.tra_cgc)}</Text><Text style={styles.label}> - Inscrição</Text></View>
                    <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Nome: </Text><Text style={styles.value}>{order.tra_nome || ''}</Text></View>
                    <View style={{ flexDirection: 'row' }}><Text style={styles.label}>Fone: </Text><Text style={styles.value}>{order.tra_fone || ''}</Text></View>
                    <View style={{ flexDirection: 'row' }}><Text style={styles.label}>E-Mail: </Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.tra_email || ''}</Text></View>
                </View>
            </View>
        </View>
    );
};

// Model 12 totals - Grid with IPI and ST in Footer
const TotalsSection12 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);
    const totalComImpostos = (items || []).reduce((acc, it) => {
        const totLiq = parseFloat(it.ite_totliquido) || 0;
        const ipiRate = parseFloat(it.ite_ipi) || 0;
        const stRate = parseFloat(it.ite_st) || 0;
        return acc + (totLiq * (1 + ipiRate / 100) * (1 + stRate / 100));
    }, 0);

    return (
        <View>
            <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
                <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 100 }}>Total bruto:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totbruto)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 100 }}>Total líquido:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totliq)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 140 }}>Total líquido c/IPI e ST:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(totalComImpostos)}</Text>
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 150 }}>Qtd total:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 150 }}>Vendedor: <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>{order.ven_nome || ''}</Text></Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={{ marginTop: 5 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', textAlign: 'center', textDecoration: 'underline' }}>OBSERVAÇÕES GERAIS</Text>
                <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 2, minHeight: 60 }}>
                    <Text style={{ fontSize: 7 }}>{order.ped_obs || order.ped_obscomplementar || ''}</Text>
                </View>
            </View>
        </View>
    );
};

// Model 11 totals - Clean Grid with Observações Gerais
const TotalsSection11 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);

    return (
        <View>
            <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
                <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 100 }}>Total bruto:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totbruto)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 100 }}>Total líquido:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totliq)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 100 }}>Total líquido c/IPI:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fv(order.ped_totalipi || order.ped_totliq)}</Text>
                        </View>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 150 }}>Qtd total:</Text>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                            <Text style={{ ...styles.label, width: 150 }}>Vendedor: <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>{order.ven_nome || ''}</Text></Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={{ marginTop: 5 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', textAlign: 'center', textDecoration: 'underline' }}>OBSERVAÇÕES GERAIS</Text>
                <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 2, minHeight: 60 }}>
                    <Text style={{ fontSize: 7, color: '#DC2626', fontWeight: 'bold' }}>{order.ped_obs || order.ped_obscomplementar || ''}</Text>
                </View>
            </View>
        </View>
    );
};

// Model 10 totals - Grid Style with Seller Info
const TotalsSection10 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#000000', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total líquido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totliq)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 90 }}>Total líquido c/IPI:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totalipi || order.ped_totliq)}</Text>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 150 }}>Qtd total:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <Text style={{ ...styles.label, ...styles.redLabel }}>Vendedor: <Text style={{ color: '#000000', fontWeight: 'bold' }}>{order.ven_nome || ''}</Text></Text>
                <Text style={{ ...styles.label, ...styles.redLabel, marginLeft: 150 }}>{order.ven_fone || ''}</Text>
            </View>
            <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Observações complementares:</Text>
                <View style={{ borderWidth: 0.5, borderColor: '#cbd5e1', borderStyle: 'solid', padding: 3, marginTop: 2, minHeight: 40 }}>
                    <Text style={{ fontSize: 7 }}>{order.ped_obscomplementar || ''}</Text>
                </View>
            </View>
        </View>
    );
};

// Order totals section for Model 2 - Cotação
const TotalsSection2 = ({ order, items }) => {
    const totalItems = items?.length || 0;
    const totalQtd = (items || []).reduce((acc, it) => acc + (parseFloat(it.ite_quant) || 0), 0);

    return (
        <View style={{ borderWidth: 0.5, borderColor: '#94a3b8', borderStyle: 'solid', padding: 5, marginTop: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {/* Left column - Totals */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 80 }}>Total líquido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totliq)}</Text>
                        <Text style={{ ...styles.label, width: 120 }}>Quantidade de itens no pedido:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalItems}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ ...styles.label, width: 80 }}>Total líquido c/IPI:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', width: 80 }}>{fv(order.ped_totalipi || order.ped_totliq)}</Text>
                        <Text style={{ ...styles.label, width: 120 }}>Qtd total:</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{totalQtd}</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={{ ...styles.label }}>Observações complementares:</Text>
                    </View>
                    <View style={{ borderWidth: 0.5, borderColor: '#cbd5e1', borderStyle: 'solid', padding: 3, marginTop: 2, minHeight: 30 }}>
                        <Text style={{ fontSize: 7 }}>{order.ped_obscomplementar || ''}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

// Helper to ensure Base64 has correct prefix and is clean
// MAX_LOGO_BASE64_SIZE: Aumentado para 500KB para logotipos de REP que podem ser maiores
// react-pdf/renderer pode travar com imagens gigantes, mas 500KB é seguro para logos.
const MAX_LOGO_BASE64_SIZE = 500000;
const MAX_INDUSTRY_LOGO_SIZE = 150000;

// Detecta se uma string é um caminho de arquivo (NÃO base64)
const isFilePath = (str) => {
    if (!str || typeof str !== 'string') return false;
    // Windows paths: C:\..., D:\..., \\server\...
    if (/^[A-Za-z]:[\\\/]/.test(str)) return true;
    if (str.startsWith('\\\\')) return true;
    // Unix paths: /home/..., /var/...
    if (/^\/[a-z]/i.test(str) && str.includes('/')) return true;
    // File extensions sem base64
    if (/\.(png|jpg|jpeg|gif|bmp|svg|webp)$/i.test(str)) return true;
    return false;
};

const formatBase64 = (data, label = 'Image') => {
    if (!data) return '';

    // If it's a PG Buffer object {type: 'Buffer', data: [...]}
    if (typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
        try {
            // Rejeita buffers muito grandes antes de processar
            if (data.data.length > MAX_LOGO_BASE64_SIZE) {
                console.warn(`⚠️ [${label}] Buffer muito grande (${(data.data.length / 1024).toFixed(1)}KB) — ignorado para evitar freeze.`);
                return '';
            }
            const uint8Array = new Uint8Array(data.data);
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            data = window.btoa(binary);
        } catch (e) {
            console.error('Erro ao converter Buffer para Base64:', e);
            return '';
        }
    }

    // Convert to string and clean
    let cleanString = typeof data === 'string' ? data : String(data);

    // PROTEÇÃO: Rejeitar caminhos de arquivo (for_locimagem guarda path, não base64)
    if (isFilePath(cleanString)) {
        console.warn(`⚠️ [${label}] Valor é um caminho de arquivo, não base64: "${cleanString.substring(0, 50)}..." — ignorado.`);
        return '';
    }

    // Se já é uma data URL válida, validar e retornar
    if (cleanString.startsWith('data:image')) {
        const rawBase64 = cleanString.replace(/^data:image\/[a-z+]+;base64,/, '');
        if (rawBase64.length > MAX_LOGO_BASE64_SIZE) {
            console.warn(`⚠️ [${label}] Logotipo muito grande (${(rawBase64.length / 1024).toFixed(1)}KB) — ignorado.`);
            return '';
        }
        if (rawBase64.length < 20) return '';
        return cleanString;
    }

    // Raw base64 string (sem prefixo data:image)
    let rawBase64 = cleanString.replace(/[\n\r\s]/g, '');

    // PROTEÇÃO ANTI-FREEZE: Limite rigoroso para react-pdf
    if (rawBase64.length > MAX_LOGO_BASE64_SIZE) {
        console.warn(`⚠️ [${label}] Logotipo muito grande (${(rawBase64.length / 1024).toFixed(1)}KB base64) — ignorado para evitar travamento do navegador.`);
        return '';
    }

    if (rawBase64.length < 20) return '';

    // Validar que é realmente base64 (só caracteres válidos)
    if (!/^[A-Za-z0-9+/=]+$/.test(rawBase64)) {
        console.warn(`⚠️ [${label}] String não é base64 válido — ignorado.`);
        return '';
    }

    // Detect MIME type pelos primeiros bytes do base64
    let mime = 'image/png';
    const start = rawBase64.substring(0, 10);
    if (start.match(/^\/9j\//)) mime = 'image/jpeg';
    else if (start.startsWith('iVBORw')) mime = 'image/png';
    else if (start.startsWith('R0lGOD')) mime = 'image/gif';
    else if (start.startsWith('PHN2Zy')) mime = 'image/svg+xml';

    return `data:${mime};base64,${rawBase64}`;
};

// ============================================================================
// FORMATO 18 — REMAP (layout clássico monospace + caixinhas labeled)
// Solicitado em 2026-05-21 pela REMAP. Layout fiel ao PDF de referência.
// Cada bloco é uma "caixinha" com label pequena no topo e valor maior embaixo.
// Tabela de itens em fonte monospace, sem bordas internas.
// ============================================================================
const remapStyles = StyleSheet.create({
    page: {
        padding: 18,
        fontSize: 8,
        fontFamily: 'Helvetica',
        color: '#000',
    },
    // ── Cabeçalho da empresa ──────────────────────────────────────
    companyHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        borderBottomStyle: 'solid',
        paddingBottom: 4,
        marginBottom: 4,
        alignItems: 'flex-end',
    },
    companyLogo: {
        width: 90,
        height: 30,
        marginRight: 10,
        objectFit: 'contain',
    },
    companyInfo: { flex: 1 },
    companyName: { fontSize: 11, fontWeight: 'bold', marginBottom: 1 },
    companyContact: { fontSize: 8, color: '#000' },
    pageNumber: { fontSize: 8, fontWeight: 'bold' },

    // ── Caixinhas labeled ─────────────────────────────────────────
    boxRow: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#000',
        borderTopStyle: 'solid',
    },
    boxRowFirst: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#000',
        borderTopStyle: 'solid',
    },
    box: {
        paddingHorizontal: 4,
        paddingVertical: 3,
        borderRightWidth: 0.5,
        borderRightColor: '#000',
        borderRightStyle: 'solid',
        borderLeftWidth: 0.5,
        borderLeftColor: '#000',
        borderLeftStyle: 'solid',
        flex: 1,
    },
    boxNoLeftBorder: {
        paddingHorizontal: 4,
        paddingVertical: 3,
        borderRightWidth: 0.5,
        borderRightColor: '#000',
        borderRightStyle: 'solid',
        flex: 1,
    },
    boxLabel: { fontSize: 6, color: '#000', marginBottom: 1 },
    boxValue: { fontSize: 9, fontWeight: 'bold', color: '#000' },
    boxValueLg: { fontSize: 10, fontWeight: 'bold', color: '#000' },

    // ── Container de boxes (fecha borda inferior) ─────────────────
    boxesWrapper: {
        borderBottomWidth: 0.5,
        borderBottomColor: '#000',
        borderBottomStyle: 'solid',
        marginBottom: 4,
    },

    // ── Tabela de itens ───────────────────────────────────────────
    itemsTable: {
        marginTop: 2,
        marginBottom: 2,
    },
    itemsHead: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#000',
        borderBottomStyle: 'solid',
        paddingBottom: 2,
        marginBottom: 2,
        fontFamily: 'Courier',
        fontSize: 8,
        fontWeight: 'bold',
    },
    itemRow: {
        flexDirection: 'row',
        fontFamily: 'Courier',
        fontSize: 8,
        paddingVertical: 0.5,
    },
    colItem:     { width: 26 },
    colQtd:      { width: 28, textAlign: 'right', paddingRight: 4 },
    colCod:      { width: 60 },
    colDesc:     { flex: 1, paddingRight: 4 },
    colPrUnit:   { width: 50, textAlign: 'right', paddingRight: 4 },
    colIpi:      { width: 28, textAlign: 'right', paddingRight: 4 },
    colSt:       { width: 32, textAlign: 'right', paddingRight: 4 },
    colPrcImp:   { width: 50, textAlign: 'right', paddingRight: 4 },
    colPrFinal:  { width: 56, textAlign: 'right' },
    itemsRule:   {
        borderTopWidth: 0.5,
        borderTopColor: '#000',
        borderTopStyle: 'dashed',
        marginTop: 3,
        marginBottom: 3,
    },

    // ── Rodapé ────────────────────────────────────────────────────
    nfeEmail: { fontSize: 8, marginTop: 2, fontFamily: 'Courier' },
    legalNotice: {
        fontSize: 7,
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 4,
        fontFamily: 'Helvetica',
    },
    footerWrap: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#000',
        borderTopStyle: 'solid',
    },
    footerLeft: {
        flex: 1,
        padding: 6,
        borderRightWidth: 0.5,
        borderRightColor: '#000',
        borderRightStyle: 'solid',
    },
    footerRight: {
        flex: 1,
        padding: 6,
    },
    footerStrong: { fontSize: 9, fontWeight: 'bold', fontFamily: 'Courier' },
    footerNote: { fontSize: 8, marginTop: 4, fontFamily: 'Courier' },
    footerSig: {
        fontSize: 7,
        textAlign: 'center',
        marginTop: 18,
        borderTopWidth: 0.5,
        borderTopColor: '#000',
        borderTopStyle: 'solid',
        paddingTop: 2,
    },
    digitadoPor: {
        marginTop: 6,
        fontSize: 7,
        fontFamily: 'Courier',
    },
});

const remapNum = (v) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const remapInt = (v) => Math.round(parseFloat(v) || 0).toString();
const remapTrunc = (s, n) => {
    const str = (s || '').toString();
    return str.length > n ? str.substring(0, n) : str;
};

const RemapBox = ({ label, value, flex = 1, valueStyle = {} }) => (
    <View style={[remapStyles.boxNoLeftBorder, { flex }]}>
        <Text style={remapStyles.boxLabel}>{label}</Text>
        <Text style={[remapStyles.boxValue, valueStyle]}>{value || ' '}</Text>
    </View>
);

const RemapReport = ({ order, items, repInfo, industryLogo }) => {
    const dataPedido = formatDate(order.ped_data);
    const dataEntrega = formatDate(order.ped_datafat || order.ped_data);
    const qtdTotal = items?.reduce((s, it) => s + (parseFloat(it.ite_quant) || 0), 0) || 0;
    const totBruto = parseFloat(order.ped_totbruto) || 0;
    const totLiq = parseFloat(order.ped_totliq) || 0;
    const totImp = totLiq + (parseFloat(order.ped_totalipi) || 0) + items?.reduce((s, it) => s + (parseFloat(it.ite_st) || 0), 0);
    // Desconto EFETIVO do pedido (bruto → líquido), mesmo cálculo do card "Dados do Pedido".
    const descEfetivoPct = totBruto > 0 ? ((totBruto - totLiq) / totBruto) * 100 : 0;
    const descEfetivoLabel = `${descEfetivoPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    const enderecoCompleto = [order.cli_endereco, order.cli_numero].filter(Boolean).join(' ');
    const cidadeUf = [order.cli_cidade, order.cli_uf].filter(Boolean).join(' / ');

    return (
        <Page size="A4" orientation="portrait" style={remapStyles.page}>
            {/* ── Cabeçalho da empresa ───────────────────────────── */}
            <View style={remapStyles.companyHeader}>
                {industryLogo ? (
                    <Image src={industryLogo} style={remapStyles.companyLogo} />
                ) : (
                    <View style={remapStyles.companyLogo} />
                )}
                <View style={remapStyles.companyInfo}>
                    <Text style={remapStyles.companyName}>{order.for_nome || repInfo.rep_nome}</Text>
                    <Text style={remapStyles.companyContact}>
                        {[order.for_email || repInfo.rep_user_email, repInfo.rep_endereco].filter(Boolean).join('  ')}
                    </Text>
                    <Text style={remapStyles.companyContact}>
                        {[order.for_fone, repInfo.rep_fone].filter(Boolean).join('  ')}
                    </Text>
                </View>
                <Text style={remapStyles.pageNumber}>Pag. 1</Text>
            </View>

            {/* ── Bloco de identificação (caixinhas labeled) ─────── */}
            <View style={remapStyles.boxesWrapper}>
                <View style={remapStyles.boxRowFirst}>
                    <RemapBox label="Pedido N." value={order.ped_pedido} flex={1.3} valueStyle={{ fontFamily: 'Courier' }} />
                    <RemapBox label="Data Pedido" value={dataPedido} flex={1} />
                    <RemapBox label="Entrega" value={dataEntrega} flex={1} />
                    <RemapBox label="Ordem de Compra" value={order.ped_oc || order.ped_pedido || ''} flex={1.4} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Cliente" value={order.cli_nome} flex={4.8} valueStyle={{ fontSize: 10 }} />
                    <RemapBox label="Código" value={String(order.ped_cliente || '')} flex={0.9} valueStyle={{ fontFamily: 'Courier' }} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Endereço" value={enderecoCompleto} flex={4.5} />
                    <RemapBox label="CEP" value={order.cli_cep} flex={1.2} valueStyle={{ fontFamily: 'Courier' }} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Cidade/UF" value={cidadeUf} flex={1} />
                    <RemapBox label="Bairro" value={order.cli_bairro} flex={1} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="CNPJ/CPF" value={formatCpfCnpj(order.client_cnpj || order.cli_cnpj)} flex={1} valueStyle={{ fontFamily: 'Courier' }} />
                    <RemapBox label="Inscrição Estadual" value={order.cli_inscricao} flex={1} valueStyle={{ fontFamily: 'Courier' }} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Telefone" value={order.cli_fone} flex={1} valueStyle={{ fontFamily: 'Courier' }} />
                    <RemapBox label="Comprador" value={order.ped_comprador_display || order.ped_comprador || ''} flex={1} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Endereço de Cobrança" value="O MESMO" flex={1} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="E-Mail" value={order.ped_emailcomp || order.cli_email || ''} flex={1} valueStyle={{ textTransform: 'lowercase' }} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Vendedor" value={`${order.ped_vendedor || ''}   ${order.ven_nome || ''}`} flex={4.5} valueStyle={{ fontFamily: 'Courier' }} />
                    <RemapBox label="Região" value={order.cli_regiao2 ? String(order.cli_regiao2) : ''} flex={1.2} valueStyle={{ fontFamily: 'Courier' }} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Representada"
                        value={`${order.ped_industria || ''}   ${order.for_nome || order.for_nomered || ''}`}
                        flex={1}
                        valueStyle={{ fontFamily: 'Courier', fontSize: 10 }} />
                </View>

                <View style={remapStyles.boxRow}>
                    <RemapBox label="Desconto" value={descEfetivoLabel} flex={1} valueStyle={{ fontFamily: 'Courier' }} />
                    <RemapBox label="Prazos" value={order.ped_condpag || ''} flex={3} />
                </View>
            </View>

            {/* ── Tabela de itens ───────────────────────────────── */}
            <View style={remapStyles.itemsTable}>
                <View style={remapStyles.itemsHead}>
                    <Text style={remapStyles.colItem}>Item</Text>
                    <Text style={remapStyles.colQtd}>QTD.</Text>
                    <Text style={remapStyles.colCod}>Código</Text>
                    <Text style={remapStyles.colDesc}>Descrição</Text>
                    <Text style={remapStyles.colPrUnit}>Pr.Unit.</Text>
                    <Text style={remapStyles.colIpi}>IPI</Text>
                    <Text style={remapStyles.colSt}>ST</Text>
                    <Text style={remapStyles.colPrcImp}>Pr.c/imp</Text>
                    <Text style={remapStyles.colPrFinal}>Pr.Final</Text>
                </View>

                {items?.map((it, idx) => {
                    const seq = String(it.ite_seq || idx + 1).padStart(3, '0');
                    const quant = remapInt(it.ite_quant);
                    const puni = remapNum(it.ite_puniliq || it.ite_puni);
                    const ipi = remapNum(it.ite_ipi);
                    const st = remapNum(it.ite_st);
                    const pCimp = remapNum(it.ite_valcomipi || it.ite_puni);
                    const pFinal = remapNum(it.ite_totliquido);
                    return (
                        <View key={idx} style={remapStyles.itemRow}>
                            <Text style={remapStyles.colItem}>{seq}</Text>
                            <Text style={remapStyles.colQtd}>{quant}</Text>
                            <Text style={remapStyles.colCod}>{remapTrunc(it.ite_produto, 12)}</Text>
                            <Text style={remapStyles.colDesc}>{remapTrunc(it.ite_nomeprod, 38)}</Text>
                            <Text style={remapStyles.colPrUnit}>{puni}</Text>
                            <Text style={remapStyles.colIpi}>{ipi}</Text>
                            <Text style={remapStyles.colSt}>{st}</Text>
                            <Text style={remapStyles.colPrcImp}>{pCimp}</Text>
                            <Text style={remapStyles.colPrFinal}>{pFinal}</Text>
                        </View>
                    );
                })}

                <View style={remapStyles.itemsRule} />
            </View>

            {/* ── Rodapé ─────────────────────────────────────────── */}
            <Text style={remapStyles.nfeEmail}>E-Mail para a NF-e: {order.cli_emailnfe || order.cli_email || ''}</Text>
            <Text style={remapStyles.legalNotice}>
                Conforme Lei 4886/65 Art. 43 Del Credere, o representante não é o responsável pelo crédito
            </Text>

            <View style={remapStyles.footerWrap}>
                <View style={remapStyles.footerLeft}>
                    <Text style={remapStyles.footerStrong}>Quant.Total do Pedido = {remapInt(qtdTotal)}</Text>
                    <Text style={remapStyles.footerNote}>ESTE PEDIDO NÃO VALE COMO RECIBO</Text>
                    <Text style={remapStyles.footerSig}>Assinatura do Comprador</Text>
                </View>
                <View style={remapStyles.footerRight}>
                    <Text style={remapStyles.footerStrong}>Valor Total Bruto: {remapNum(totBruto)}</Text>
                    <Text style={remapStyles.footerStrong}>Valor Total s/impostos: {remapNum(totLiq)}</Text>
                    <Text style={remapStyles.footerStrong}>Valor Total c/impostos: {remapNum(totImp)}</Text>
                    <Text style={remapStyles.footerNote}>N. Pedido: {order.ped_pedido}</Text>
                </View>
            </View>

            <Text style={remapStyles.digitadoPor}>Digitado por: {(order.ven_nome || '').toUpperCase()}</Text>
        </Page>
    );
};

// ============================================================================
// MODEL 19 — REMAP "Premium" (paleta azul/navy, logo da indústria no quadro)
// ============================================================================
const BLUE = '#2563EB';
const NAVY = '#0F172A';

// DM Mono (Regular + Medium) — fontes do Model 19. TTFs em public/fonts (entram no dist).
Font.register({
    family: 'DM Mono',
    fonts: [
        { src: '/fonts/DMMono-Regular.ttf', fontWeight: 'normal' },
        { src: '/fonts/DMMono-Medium.ttf', fontWeight: 'medium' },
    ],
});

const INK = '#111827';  // "preto" — todas as fontes da cópia (negrito = 'medium', o peso forte do DM Mono)
const r2 = StyleSheet.create({
    page: { padding: 26, fontSize: 8.5, color: INK, fontFamily: 'DM Mono', fontWeight: 'medium' },
    topBar: { height: 4, backgroundColor: BLUE, marginBottom: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    repLogoBox: { width: 92, height: 46, marginRight: 12, justifyContent: 'center' },
    coName: { fontSize: 12, fontWeight: 'medium', color: INK },
    coLine: { fontSize: 7.5, color: INK, fontWeight: 'medium', marginTop: 2 },
    pedLabel: { fontSize: 7, color: INK, fontWeight: 'medium', textTransform: 'uppercase', textAlign: 'right', letterSpacing: 1 },
    pedNum: { fontSize: 18, fontWeight: 'medium', color: INK, textAlign: 'right' },
    cardRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    card: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 5, padding: '6px 8px' },
    cardAccent: { borderColor: BLUE, backgroundColor: '#EFF4FE' },
    cardLabel: { fontSize: 6.5, color: INK, fontWeight: 'medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    cardValue: { fontSize: 9.5, fontWeight: 'medium', color: INK },
    blockTitle: { fontSize: 7, color: INK, fontWeight: 'medium', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    clientBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, backgroundColor: '#F8FAFC', padding: 10, marginBottom: 12 },
    razao: { fontSize: 11, fontWeight: 'medium', color: INK, marginBottom: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    fLabel: { fontSize: 6.5, color: INK, fontWeight: 'medium', textTransform: 'uppercase', marginBottom: 1 },
    fVal: { fontSize: 8.5, color: INK, fontWeight: 'medium', marginBottom: 6 },
    comRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, marginBottom: 12 },
    comCell: { flex: 1, padding: '7px 8px', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
    comCellLast: { flex: 1, padding: '7px 8px' },
    logoCell: { height: 42, justifyContent: 'center', alignItems: 'center' },
    itHead: { flexDirection: 'row', backgroundColor: NAVY, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, marginBottom: 2 },
    itHeadTxt: { color: '#FFFFFF', fontSize: 6.5, fontWeight: 'bold', textTransform: 'uppercase' },
    itRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
    cSeq: { width: '5%', fontSize: 7, color: INK, fontWeight: 'medium' },
    cCod: { width: '8%', fontSize: 8, color: INK, fontWeight: 'medium' },
    cDesc: { width: '32%', paddingRight: 4 },
    cQtd: { width: '7%', alignItems: 'center' },
    cUni: { width: '10%', textAlign: 'right', paddingRight: 12, color: INK, fontWeight: 'medium' },
    cImp: { width: '6.5%', textAlign: 'center', color: INK, fontWeight: 'medium' },
    cUniImp: { width: '12%', textAlign: 'right', color: INK, fontWeight: 'medium' },
    cTot: { width: '13%', textAlign: 'right', color: INK, fontWeight: 'medium' },
    descTxt: { fontSize: 8.5, color: INK, fontWeight: 'medium' },
    qtyCircle: { backgroundColor: '#DBEAFE', borderRadius: 4, minWidth: 22, height: 16, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
    qtyTxt: { color: INK, fontSize: 8, fontWeight: 'medium', textAlign: 'center', lineHeight: 1 },
    sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 },
    sumLeft: { fontSize: 8, color: INK, fontWeight: 'medium' },
    totCard: { backgroundColor: NAVY, borderRadius: 8, padding: 12, width: 230 },
    totLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    totLbl: { fontSize: 7.5, color: '#FFFFFF', fontWeight: 'medium', textTransform: 'uppercase' },
    totVal: { fontSize: 8.5, color: '#FFFFFF', fontWeight: 'medium' },
    totFinalLbl: { fontSize: 8, color: '#FFFFFF', fontWeight: 'medium', textTransform: 'uppercase' },
    totFinalVal: { fontSize: 13, color: '#FFFFFF', fontWeight: 'medium' },
    totDivider: { borderTopWidth: 0.5, borderTopColor: '#334155', marginVertical: 5 },
    legal: { fontSize: 6.5, color: INK, fontWeight: 'medium', marginTop: 14, lineHeight: 1.4 },
    sigLine: { marginTop: 36, borderTopWidth: 0.5, borderTopColor: '#94A3B8', width: 220, alignSelf: 'flex-end' },
    sigTxt: { fontSize: 7, color: INK, fontWeight: 'medium', textAlign: 'right' },
});

const F2 = ({ label, value, w }) => (
    <View style={{ width: w || '50%' }}>
        <Text style={r2.fLabel}>{label}</Text>
        <Text style={r2.fVal}>{value || '—'}</Text>
    </View>
);

const RemapReport2 = ({ order, items, repInfo, logo, industryLogo }) => {
    const totBruto = parseFloat(order.ped_totbruto) || 0;
    const totLiq = parseFloat(order.ped_totliq) || 0;
    // c/impostos CORRETO: soma valor-com-ipi-e-st por item (= s/impostos quando não há imposto).
    const totComImp = (items?.reduce((s, it) => s + (parseFloat(it.ite_valcomst) || parseFloat(it.ite_totliquido) || 0), 0)) || totLiq;
    const totPecas = items?.reduce((s, it) => s + (parseFloat(it.ite_quant) || 0), 0) || 0;
    const frete = order.ped_tipofrete === 'C' ? 'CIF' : order.ped_tipofrete === 'F' ? 'FOB' : (order.ped_tipofrete || '—');
    const ender = [order.cli_endereco, order.cli_numero].filter(Boolean).join(', ');
    const cidadeUf = [order.cli_cidade, order.cli_uf].filter(Boolean).join(' / ');

    return (
        <Page size="A4" orientation="portrait" style={r2.page}>
            <View style={r2.topBar} />

            {/* Cabeçalho REMAP + Pedido Nº */}
            <View style={r2.headerRow}>
                {/* Logo da REMAP — à esquerda, ANTES do nome */}
                {logo ? (
                    <View style={r2.repLogoBox}>
                        <Image src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </View>
                ) : null}
                <View style={{ flex: 1 }}>
                    <Text style={r2.coName}>{(repInfo.rep_nome || '').toUpperCase()}</Text>
                    <Text style={r2.coLine}>{[repInfo.rep_endereco, repInfo.rep_bairro, [repInfo.rep_cidade, repInfo.rep_uf].filter(Boolean).join(' / ')].filter(Boolean).join(' — ')}</Text>
                    <Text style={r2.coLine}>{repInfo.rep_fone}</Text>
                </View>
                <View style={{ width: 150 }}>
                    <Text style={r2.pedLabel}>Pedido N°</Text>
                    <Text style={r2.pedNum}>{order.ped_pedido}</Text>
                </View>
            </View>

            {/* Cards */}
            <View style={r2.cardRow}>
                <View style={[r2.card, r2.cardAccent]}><Text style={r2.cardLabel}>Data do Pedido</Text><Text style={r2.cardValue}>{formatDate(order.ped_data)}</Text></View>
                <View style={r2.card}><Text style={r2.cardLabel}>Código Cliente</Text><Text style={r2.cardValue}>{order.ped_cliente}</Text></View>
                <View style={r2.card}><Text style={r2.cardLabel}>Prazo (dias)</Text><Text style={r2.cardValue}>{order.ped_condpag || '—'}</Text></View>
                <View style={r2.card}><Text style={r2.cardLabel}>Desconto</Text><Text style={r2.cardValue}>{remapNum(order.ped_descadic || 0)}%</Text></View>
                <View style={r2.card}><Text style={r2.cardLabel}>Ordem de Compra</Text><Text style={r2.cardValue}>{order.ped_oc || '—'}</Text></View>
            </View>

            {/* Dados do cliente */}
            <Text style={r2.blockTitle}>Dados do Cliente</Text>
            <View style={r2.clientBox}>
                <Text style={r2.razao}>{order.cli_nome}</Text>
                <View style={r2.grid}>
                    <F2 label="Endereço" value={[ender, order.cli_bairro, cidadeUf, order.cli_cep && `CEP ${order.cli_cep}`].filter(Boolean).join(' · ')} w="60%" />
                    <View style={{ width: '40%', alignItems: 'flex-end' }}>
                        <Text style={r2.fLabel}>Comprador</Text>
                        <Text style={r2.fVal}>{order.ped_comprador_display || order.ped_comprador || '—'}</Text>
                    </View>
                    <F2 label="CNPJ" value={formatCpfCnpj(order.client_cnpj || order.cli_cnpj)} w="33%" />
                    <F2 label="Inscr. Estadual" value={order.cli_inscricao} w="33%" />
                    <F2 label="End. Cobrança" value="O mesmo" w="34%" />
                    <F2 label="E-mail (NF-e e pedidos)" value={order.cli_emailnfe || order.cli_email} w="100%" />
                </View>
            </View>

            {/* Informações comerciais */}
            <Text style={r2.blockTitle}>Informações Comerciais</Text>
            <View style={r2.comRow}>
                <View style={r2.comCell}><Text style={r2.fLabel}>Vendedor</Text><Text style={r2.fVal}>{order.ven_nome || '—'}</Text></View>
                <View style={r2.comCell}><Text style={r2.fLabel}>Representada</Text><Text style={r2.fVal}>{`${order.ped_industria || ''} — ${order.for_nomered || order.for_nome || ''}`}</Text></View>
                <View style={r2.comCell}><Text style={r2.fLabel}>Transportadora</Text><Text style={r2.fVal}>{order.tra_nome || '—'}</Text>{order.tra_cgc ? <Text style={[r2.fVal, { fontSize: 6.5, color: '#94A3B8' }]}>{formatCpfCnpj(order.tra_cgc)}</Text> : null}</View>
                <View style={r2.comCell}><Text style={r2.fLabel}>Frete</Text><Text style={r2.fVal}>{frete}</Text></View>
                {/* Logo da indústria — no fim da linha, depois do Frete ("passar p/final") */}
                <View style={r2.comCellLast}>
                    <View style={r2.logoCell}>
                        {industryLogo
                            ? <Image src={industryLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : <Text style={r2.fVal}>{order.for_nomered || order.for_nome || '—'}</Text>}
                    </View>
                </View>
            </View>

            {/* Itens */}
            <Text style={r2.blockTitle}>Itens do Pedido</Text>
            <View style={r2.itHead}>
                <Text style={[r2.cSeq, r2.itHeadTxt]}>#</Text>
                <Text style={[r2.cCod, r2.itHeadTxt]}>Código</Text>
                <Text style={[r2.cDesc, r2.itHeadTxt]}>Descrição</Text>
                <Text style={[r2.cQtd, r2.itHeadTxt]}>Qtd.</Text>
                <Text style={[r2.cUni, r2.itHeadTxt]}>Pr. Unit.</Text>
                <Text style={[r2.cImp, r2.itHeadTxt]}>IPI</Text>
                <Text style={[r2.cImp, r2.itHeadTxt]}>ST</Text>
                <Text style={[r2.cUniImp, r2.itHeadTxt]}>Pr. c/Imp.</Text>
                <Text style={[r2.cTot, r2.itHeadTxt]}>Total</Text>
            </View>
            {items?.map((it, idx) => {
                const ipi = parseFloat(it.ite_ipi) || 0;
                const st = parseFloat(it.ite_st) || 0;
                // Preço UNITÁRIO com impostos: líquido unit × (1+IPI%) × (1+ST%)
                const unitComImp = (parseFloat(it.ite_puniliq || it.ite_puni) || 0) * (1 + ipi / 100) * (1 + st / 100);
                return (
                    <View key={idx} style={r2.itRow} wrap={false}>
                        <Text style={r2.cSeq}>{String(it.ite_seq || idx + 1).padStart(3, '0')}</Text>
                        <Text style={r2.cCod}>{remapTrunc(it.ite_produto, 10)}</Text>
                        <View style={r2.cDesc}>
                            <Text style={r2.descTxt}>{remapTrunc(it.ite_nomeprod, 40)}</Text>
                        </View>
                        <View style={r2.cQtd}><View style={r2.qtyCircle}><Text style={r2.qtyTxt}>{remapInt(it.ite_quant)}</Text></View></View>
                        <Text style={r2.cUni}>{remapNum(it.ite_puniliq || it.ite_puni)}</Text>
                        <Text style={r2.cImp}>{ipi > 0 ? remapNum(ipi) : '–'}</Text>
                        <Text style={r2.cImp}>{st > 0 ? remapNum(st) : '–'}</Text>
                        <Text style={r2.cUniImp}>{remapNum(unitComImp)}</Text>
                        <Text style={r2.cTot}>{remapNum(it.ite_totliquido)}</Text>
                    </View>
                );
            })}

            {/* Totais */}
            <View style={r2.sumRow} wrap={false}>
                <Text style={r2.sumLeft}>{items?.length || 0} itens no total · Total do pedido: {remapInt(totPecas)} peças.</Text>
                <View style={r2.totCard} wrap={false}>
                    <View style={r2.totLine}><Text style={r2.totLbl}>Valor Bruto</Text><Text style={r2.totVal}>R$ {remapNum(totBruto)}</Text></View>
                    <View style={r2.totLine}><Text style={r2.totLbl}>Total s/ Impostos</Text><Text style={r2.totVal}>R$ {remapNum(totLiq)}</Text></View>
                    <View style={r2.totDivider} />
                    <View style={r2.totLine}><Text style={r2.totFinalLbl}>Total c/ Impostos</Text><Text style={r2.totFinalVal}>R$ {remapNum(totComImp)}</Text></View>
                </View>
            </View>

            {/* Rodapé legal */}
            <Text style={r2.legal}>
                Este pedido não vale como recibo. Conforme Lei 4886/65, Art. 43 — Del Credere: o representante não é responsável pelo crédito.
                {order.ped_obs ? `\nOBS: ${order.ped_obs}` : ''}
                {`\nDigitado por: ${(repInfo.rep_nome || '').toUpperCase()}`}
            </Text>
            <View style={r2.sigLine} />
            <Text style={r2.sigTxt}>Assinatura do Comprador</Text>
        </Page>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const OrderPdfReport = ({ order, items, companyData, model = '1', separateGroups = 'N' }) => {
    // Extract data from companyData and order
    // Ensure model is treated as integer safely
    const modelInt = parseInt(model, 10);
    const modelNum = isNaN(modelInt) ? 1 : modelInt;

    const repInfo = {
        rep_nome: companyData?.nome || '',
        rep_cnpj: companyData?.cnpj || '',
        rep_fone: companyData?.fones || '',
        rep_endereco: companyData?.endereco || '',
        rep_bairro: companyData?.bairro || '',
        rep_cidade: companyData?.cidade || '',
        rep_uf: companyData?.uf || '',
        rep_cep: companyData?.cep || '',
        rep_user_email: companyData?.email || ''
    };
    const logo = formatBase64(companyData?.logotipo, 'RepLogo'); // Base64 from empresa_status
    // Logotipo da indústria restaurado (com prioridade para o campo processado pelo backend)
    const industryLogo = formatBase64(order.industry_logotipo || order.industry_logotipo_resized || order.for_logotipo || order.for_locimagem, 'IndustryLogo');

    // Group items by discount
    const groupedItems = groupItemsByDiscount(items, separateGroups);

    // Determine page orientation based on model
    // 18 = formato REMAP (portrait, layout próprio) — removido da lista de landscape
    const isLandscape = [13, 17, 23, 24].includes(modelNum);

    // Hide certain sections for reorder models
    // 18 = REMAP (não é reorder model) — removido
    const isReorderModel = [17].includes(modelNum);

    // Formato 18 (REMAP) tem layout próprio — bypassa todas as seções padrão
    const isRemapModel = modelNum === 18;
    // Formato 19 (REMAP Premium — paleta azul/navy, logo da indústria no quadro)
    const isRemapModel2 = modelNum === 19;

    // Select items renderer based on model
    const renderItems = () => {
        switch (modelNum) {
            case 2:
                return <ItemsModel2 groupedItems={groupedItems} />;
            case 3:
                return <ItemsModel3 groupedItems={groupedItems} order={order} />;
            case 4:
                return <ItemsModel4 groupedItems={groupedItems} order={order} />;
            case 5:
                return <ItemsModel5 groupedItems={groupedItems} order={order} />;
            case 7:
                return <ItemsModel7 groupedItems={groupedItems} />;
            case 8:
                return <ItemsModel8 groupedItems={groupedItems} order={order} />;
            case 9:
                return <ItemsModel9 groupedItems={groupedItems} order={order} />;
            case 10:
                return <ItemsModel10 groupedItems={groupedItems} />;
            case 11:
                return <ItemsModel11 groupedItems={groupedItems} order={order} />;
            case 12:
                return <ItemsModel12 groupedItems={groupedItems} order={order} />;
            case 13:
                return <ItemsModel13 groupedItems={groupedItems} order={order} />;
            case 14:
                return <ItemsModel14 groupedItems={groupedItems} order={order} />;
            case 15:
                return <ItemsModel15 groupedItems={groupedItems} order={order} />;
            case 16:
                return <ItemsModel16 groupedItems={groupedItems} />;
            default:
                return <ItemsModel1 groupedItems={groupedItems} />;
        }
    };

    // Select totals section based on model
    const renderTotals = () => {
        switch (modelNum) {
            case 2:
                return <TotalsSection2 order={order} items={items} />;
            case 3:
                return <TotalsSection3 order={order} items={items} />;
            case 4:
                return <TotalsSection13 order={order} items={items} />;
            case 5:
                return <TotalsSection5 order={order} items={items} />;
            case 7:
                return <TotalsSection7 order={order} items={items} />;
            case 8:
                return <TotalsSection3 order={order} items={items} />;
            case 9:
                return <TotalsSection9 order={order} items={items} />;
            case 10:
                return <TotalsSection10 order={order} items={items} />;
            case 11:
                return <TotalsSection11 order={order} items={items} />;
            case 12:
                return <TotalsSection12 order={order} items={items} />;
            case 13:
                return <TotalsSection13 order={order} items={items} />;
            case 14:
                return <TotalsSection14 order={order} items={items} />;
            case 15:
                return <TotalsSection15 order={order} items={items} />;
            case 16:
                return <TotalsSection16 order={order} items={items} />;
            default:
                return <TotalsSection order={order} items={items} />;
        }
    };

    // Formato 19 (REMAP Premium) — bypass total: layout próprio
    if (isRemapModel2) {
        return (
            <Document>
                <RemapReport2 order={order} items={items} repInfo={repInfo} logo={logo} industryLogo={industryLogo} />
            </Document>
        );
    }

    // Formato 18 (REMAP) — bypass total: layout próprio, ignora todas as seções padrão
    if (isRemapModel) {
        return (
            <Document>
                <RemapReport order={order} items={items} repInfo={repInfo} industryLogo={industryLogo} />
            </Document>
        );
    }

    return (
        <Document>
            <Page
                size="A4"
                orientation={isLandscape ? 'landscape' : 'portrait'}
                style={styles.page}
            >
                {/* Header - Logotipo da Indústria desativado por performance conforme solicitado */}
                <ReportHeader
                    order={order}
                    repInfo={repInfo}
                    logo={logo}
                    industryLogo={industryLogo}
                    modelNum={modelNum}
                />

                {/* Client Section - Includes Industry, Commercial data */}
                {modelNum !== 4 && modelNum !== 11 && modelNum !== 12 && modelNum !== 13 && modelNum !== 14 && modelNum !== 15 && modelNum !== 16 && <ClientSection order={order} modelNum={modelNum} />}


                {/* 3. Carrier, Billing and Obs - Only if modelNum != 4, 10, 11, 12, 13, 14 and not reorder model */}
                {modelNum !== 4 && modelNum !== 10 && modelNum !== 11 && modelNum !== 12 && modelNum !== 13 && modelNum !== 14 && modelNum !== 15 && modelNum !== 16 && !isReorderModel && (
                    <>
                        {/* Commercial Data (for models that don't have it in ClientSection) */}
                        {[3, 5, 7, 8, 9].includes(modelNum) && <CommercialSection order={order} />}


                        <View style={{ flexDirection: 'row', gap: 3 }}>
                            {!isReorderModel && (
                                <View style={{ flex: 1 }}>
                                    <BillingSection order={order} />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <CarrierSection order={order} />
                            </View>
                        </View>
                        {modelNum !== 23 && modelNum !== 24 && (
                            <ObservationsSection order={order} />
                        )}
                        {modelNum === 24 && (
                            <ObservationsSection order={order} highlighted={true} />
                        )}
                    </>
                )}

                {/* Model 4, 11 and 12 sections (centered titles and full boxes) */}
                {(modelNum === 4 || modelNum === 11 || modelNum === 12 || modelNum === 15 || modelNum === 16) && (
                    <>
                        <Text style={styles.centeredSectionTitle}>DADOS DO CLIENTE</Text>
                        <View style={styles.sectionContentModel11}>
                            <ClientSection order={order} hideTitle={true} noBorder={true} modelNum={modelNum} />
                        </View>

                        <Text style={styles.centeredSectionTitle}>DADOS PARA COBRANÇA</Text>
                        <View style={styles.sectionContentModel11}>
                            <BillingSection order={order} hideTitle={true} noBorder={true} />
                        </View>

                        {(modelNum === 11 || modelNum === 12 || modelNum === 16) && (
                            <>
                                <Text style={styles.centeredSectionTitle}>TRANSPORTADORA</Text>
                                <View style={styles.sectionContentModel11}>
                                    <CarrierSection order={order} hideTitle={true} noBorder={true} />
                                </View>
                            </>
                        )}
                    </>
                )}

                {/* Model 13 special client section */}
                {modelNum === 13 && (
                    <View style={{ borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid', marginTop: 3, marginBottom: 3 }}>
                        <Text style={{ ...styles.centeredSectionTitle, marginTop: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 }}>DADOS DO CLIENTE</Text>
                        <View style={{ padding: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                <Text style={{ fontSize: 9, fontWeight: 'bold' }}>CNPJ: {formatCpfCnpj(order.client_cnpj || order.cli_cnpj)}</Text>
                                <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Inscrição: {order.cli_inscricao || ''}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <View style={{ flex: 1.5 }}><Text style={styles.label}>Razão social: </Text><Text style={styles.value}>{order.cli_nome}</Text></View>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <View style={{ flex: 1 }}><Text style={styles.label}>Endereço: </Text><Text style={styles.value}>{order.cli_endereco}{order.cli_numero ? ', ' + order.cli_numero : ''}</Text></View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 0.8 }}><Text style={styles.label}>Complemento: </Text><Text style={styles.value}>{order.cli_complemento}</Text></View>
                                <View style={{ flex: 1 }}><Text style={styles.label}>Bairro: </Text><Text style={styles.value}>{order.cli_bairro}</Text></View>
                                <View style={{ flex: 0.4 }}><Text style={styles.label}>Cx.postal: </Text><Text style={styles.value}>{order.cli_cxpostal}</Text></View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}><Text style={styles.label}>Cidade: </Text><Text style={styles.value}>{order.cli_cidade}</Text></View>
                                <View style={{ flex: 0.5 }}><Text style={styles.label}>Cep: </Text><Text style={styles.value}>{order.cli_cep} / {order.cli_uf}</Text></View>
                                <View style={{ flex: 0.5 }}><Text style={styles.label}>Fax: </Text><Text style={styles.value}>{order.cli_fax}</Text></View>
                                <View style={{ flex: 0.5 }}><Text style={{ ...styles.label, color: '#dc2626' }}>Suframa: </Text><Text style={styles.value}>{order.cli_suframa}</Text></View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}><Text style={styles.label}>Fone: </Text><Text style={styles.value}>{order.cli_fone}</Text></View>
                                <View style={{ flex: 0.8 }}><Text style={styles.label}>Comprador: </Text><Text style={styles.value}>{order.ped_comprador_display || order.ped_comprador}</Text></View>
                                <View style={{ flex: 1.5 }}><Text style={styles.label}>E-mail: </Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.ped_emailcomp || order.cli_email}</Text></View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}><Text style={styles.label}>E-Mail NFe: </Text><Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.cli_emailnfe}</Text></View>
                                <View style={{ flex: 1 }}><Text style={{ ...styles.label, color: '#dc2626' }}>E-Mail financeiro: </Text><Text style={{ ...styles.value, color: '#dc2626', textTransform: 'lowercase' }}>{order.cli_emailfinanceiro}</Text></View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Model 14 special simple quote section */}
                {modelNum === 14 && (
                    <View style={{ borderWidth: 0.5, borderColor: '#000', borderStyle: 'solid', marginTop: 3, marginBottom: 3 }}>
                        <Text style={{ ...styles.centeredSectionTitle, marginTop: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 }}>DADOS DO CLIENTE</Text>
                        <View style={{ padding: 5 }}>
                            <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                                <View style={{ flex: 2, flexDirection: 'row' }}>
                                    <Text style={{ ...styles.label, width: 80 }}>Razão social: </Text>
                                    <Text style={{ ...styles.value, fontWeight: 'bold', fontSize: 9 }}>{order.cli_nome}</Text>
                                </View>
                                <View style={{ flex: 1, flexDirection: 'row' }}>
                                    <Text style={{ ...styles.label, width: 36 }}>CNPJ: </Text>
                                    <Text style={{ ...styles.value, fontWeight: 'bold', fontSize: 9 }}>{formatCpfCnpj(order.client_cnpj || order.cli_cnpj || order.cli_cgc)}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <View style={{ flex: 1, flexDirection: 'row' }}>
                                    <Text style={{ ...styles.label, width: 80 }}>Comprador: </Text>
                                    <Text style={styles.value}>{order.ped_comprador_display || order.ped_comprador || ''}</Text>
                                </View>
                                <View style={{ flex: 1, flexDirection: 'row' }}>
                                    <Text style={styles.label}>E-mail: </Text>
                                    <Text style={{ ...styles.value, textTransform: 'lowercase' }}>{order.cli_email || ''}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* 4. Items Table */}
                {renderItems()}

                {/* 5. Totals */}
                {renderTotals()}

                {/* 6. Model 10 specific: Carrier and Obs at bottom */}
                {modelNum === 10 && (
                    <>
                        <CarrierSection order={order} />
                        <ObservationsSection order={order} />
                    </>
                )}

                {/* 7. Model 15: Transportadora at the bottom (after items/totals) */}
                {modelNum === 15 && (
                    <>
                        <Text style={styles.centeredSectionTitle}>TRANSPORTADORA</Text>
                        <View style={styles.sectionContentModel11}>
                            <CarrierSection order={order} hideTitle={true} noBorder={true} />
                        </View>
                    </>
                )}

                {/* Footer */}
                <ReportFooter pageNumber={1} totalPages={1} />
            </Page>
        </Document>
    );
};

export default OrderPdfReport;
