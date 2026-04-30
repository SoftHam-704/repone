import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { BlobProvider } from '@react-pdf/renderer';
import OrderPdfReport from './OrderPdfReport';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

// Limite seguro para base64 dentro do react-pdf (150KB string ≈ 110KB imagem)
const MAX_SAFE_BASE64 = 150000;

// Auxiliar para redimensionar imagem Base64 no cliente
const resizeBase64Image = (base64Str: string, maxWidth = 300, maxHeight = 150): Promise<string | null> => {
    return new Promise((resolve) => {
        if (!base64Str) return resolve(null);

        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx!.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(null);
    });
};

// Sanitiza qualquer campo de imagem base64 para evitar freeze no react-pdf
const sanitizeImageField = (value: any, isCompany = false) => {
    if (!value) return value;
    if (typeof value !== 'string') return value;
    const limit = isCompany ? 1000000 : 180000;
    const raw = value.replace(/^data:image\/[a-z]+;base64,/, '');
    if (raw.length > limit) {
        console.warn(`⚠️ [ReportEngine] Imagem ${isCompany ? 'Empresa' : 'Indústria'} muito grande (${(raw.length / 1024).toFixed(1)}KB) — removida.`);
        return null;
    }
    return value;
};

const sanitizeDataForPdf = (order: any, companyData: any) => {
    const cleanOrder = { ...order };
    cleanOrder.industry_logotipo = sanitizeImageField(cleanOrder.industry_logotipo || cleanOrder.for_logotipo || cleanOrder.industry_logotipo_resized);
    cleanOrder.for_logotipo = cleanOrder.industry_logotipo;
    cleanOrder.for_locimagem = null;

    const cleanCompany = companyData ? { ...companyData } : companyData;
    if (cleanCompany) {
        cleanCompany.logotipo = sanitizeImageField(cleanCompany.logotipo, true);
    }

    return { cleanOrder, cleanCompany };
};

const PDF_TIMEOUT_MS = 20000;

const OrderReportEngine = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const model = searchParams.get('model') || '1';
    const sortBy = searchParams.get('sortBy') || 'digitacao';
    const industria = searchParams.get('industria');
    const separateGroups = searchParams.get('separateGroups') || 'N';

    const [data, setData] = useState<any>(null);
    const [companyData, setCompanyData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timedOut, setTimedOut] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const token = searchParams.get('token') || localStorage.getItem('sm_token');
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!industria) {
                    console.error('Missing industria parameter');
                    setLoading(false);
                    return;
                }

                const [orderResponse, companyResponse] = await Promise.all([
                    fetch(`${API_BASE}/orders/${id}/print-data?sortBy=${sortBy}&industria=${industria}`, { headers: authHeaders }),
                    fetch(`${API_BASE}/config/company`, { headers: authHeaders })
                ]);

                const orderResult = await orderResponse.json();
                const companyResult = await companyResponse.json();

                console.log('📦 [OrderReportEngine] Fetch result:', orderResult);

                if (orderResult.success && orderResult.data) {
                    const orderData = orderResult.data.order;

                    if (orderData.industry_logotipo || orderData.for_logotipo) {
                        const logoToProcess = orderData.industry_logotipo || orderData.for_logotipo;
                        const resized = await resizeBase64Image(logoToProcess);
                        if (resized) {
                            orderData.industry_logotipo = resized;
                            orderData.for_logotipo = resized;
                        }
                    }

                    setData(orderResult.data);

                    const orderNum = orderData.ped_pedido;
                    const cliName = orderData.cli_nomred || orderData.cli_nome || 'CLIENTE';
                    const sanitizedCliName = cliName.replace(/[/\\?%*:|"<>]/g, '-').trim();
                    document.title = `${orderNum}-${sanitizedCliName}`;
                } else {
                    console.warn(`⚠️ Order not found or error from API: ${orderResult.message || 'Unknown error'}`);
                }

                if (companyResult.success) {
                    setCompanyData(companyResult.config);
                }

            } catch (error) {
                console.error('❌ Error fetching order data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, sortBy, industria, model]);

    useEffect(() => {
        if (!loading && data && !pdfReady && !timedOut) {
            timeoutRef.current = setTimeout(() => {
                console.error('❌ [ReportEngine] PDF rendering timed out after', PDF_TIMEOUT_MS, 'ms');
                setTimedOut(true);
            }, PDF_TIMEOUT_MS);
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [loading, data, pdfReady, timedOut]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-200">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!data) {
        return <div className="p-10 text-center bg-slate-200 h-screen">Pedido não encontrado ou erro ao carregar dados.</div>;
    }

    if (timedOut) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-200">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
                    <h2 className="text-lg font-bold text-slate-800">PDF demorou demais para renderizar</h2>
                    <p className="text-sm text-slate-500">
                        O logotipo da indústria pode estar muito grande.
                        A impressão será gerada sem o logotipo.
                    </p>
                    <button
                        onClick={() => {
                            if (data?.order) {
                                data.order.industry_logotipo = null;
                                data.order.for_logotipo = null;
                                data.order.for_locimagem = null;
                            }
                            setTimedOut(false);
                            setPdfReady(false);
                            setData({ ...data });
                        }}
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Tentar novamente sem logotipo
                    </button>
                </div>
            </div>
        );
    }

    const { order, items } = data;
    const { cleanOrder, cleanCompany } = sanitizeDataForPdf(order, companyData);

    return (
        <div className="h-screen w-screen overflow-hidden relative group">
            <BlobProvider document={<OrderPdfReport model={model} order={cleanOrder} items={items} companyData={cleanCompany} separateGroups={separateGroups} />}>
                {({ url, loading: pdfLoading, error }: any) => {
                    if (error) {
                        console.error('❌ [BlobProvider] Error:', error);
                        return (
                            <div className="h-screen w-screen flex items-center justify-center bg-slate-200">
                                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center space-y-4">
                                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                                    <h2 className="text-lg font-bold text-slate-800">Erro ao gerar PDF</h2>
                                    <p className="text-sm text-slate-500">{error.message || 'Erro desconhecido'}</p>
                                </div>
                            </div>
                        );
                    }

                    if (pdfLoading) {
                        return (
                            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-200 gap-3">
                                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                <span className="text-sm text-slate-400 font-medium">Gerando relatório PDF...</span>
                            </div>
                        );
                    }

                    if (!pdfReady) {
                        setPdfReady(true);
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    }

                    const sanitizedCliName = (order.cli_nomred || order.cli_nome || 'CLIENTE').replace(/[/\\?%*:|"<>]/g, '-').trim();
                    const fileName = `${order.ped_pedido}-${sanitizedCliName}.pdf`;

                    return (
                        <>
                            <iframe
                                src={`${url}#zoom=100`}
                                width="100%"
                                height="100%"
                                style={{ border: 'none' }}
                                title={fileName}
                            />
                            <a
                                href={url}
                                download={fileName}
                                className="absolute bottom-8 right-8 z-50 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 opacity-0 group-hover:opacity-100 flex items-center gap-2 font-bold text-sm"
                                title="Baixar PDF"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                Baixar Arquivo
                            </a>
                        </>
                    );
                }}
            </BlobProvider>
        </div>
    );
};

export default OrderReportEngine;
