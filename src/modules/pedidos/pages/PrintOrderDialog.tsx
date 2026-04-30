import React, { useState, useEffect } from 'react';
import { Printer, Mail, FileSpreadsheet, X, MessageCircle, Info } from 'lucide-react';

interface PrintOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string | null;
  onPrint: (model: number, sorting: string) => void;
  onExportExcel: (sorting: string) => void;
  onSendEmail: (sorting: string) => void;
  onWhatsApp: (model: number, sorting: string, encodedMessage: string) => void;
  defaultModel?: number;
  defaultSorting?: string;
  orderToPrintIndustryName?: string;
  orderTotal?: string;
}

const activeModels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

const PrintOrderDialog: React.FC<PrintOrderDialogProps> = ({
  isOpen,
  onClose,
  orderNumber,
  onPrint,
  onExportExcel,
  onSendEmail,
  onWhatsApp,
  defaultModel = 1,
  defaultSorting = 'digitacao',
  orderToPrintIndustryName,
  orderTotal,
}) => {
  const [sorting, setSorting] = useState(defaultSorting);
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  useEffect(() => {
    if (isOpen) {
      setSorting(defaultSorting);
      setSelectedModel(defaultModel);
    }
  }, [isOpen, defaultSorting, defaultModel]);

  const handlePrint = (model: number) => {
    setSelectedModel(model);
    onPrint(model, sorting);
  };

  const handleWhatsApp = () => {
    if (!orderNumber) return;
    const message =
      `Olá! Segue o pedido *${orderNumber}* da *${orderToPrintIndustryName || 'Nossa Indústria'}*.\n\n` +
      `Total: *${orderTotal || ''}*\n` +
      `Status: *Pendente*`;
    const encoded = encodeURIComponent(message);
    onWhatsApp(selectedModel, sorting, encoded);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 32, width: 540, maxWidth: '95vw',
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid #F1F5F9', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 128, height: 128, background: 'rgba(16,185,129,0.05)', borderRadius: '50%', marginRight: -64, marginTop: -64, filter: 'blur(24px)' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ padding: 10, background: 'rgba(16,185,129,0.1)', borderRadius: 12 }}>
                  <Printer style={{ width: 24, height: 24, color: '#059669' }} />
                </div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>
                  Impressão de Pedido
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  padding: '3px 12px', borderRadius: 999, background: '#F1F5F9',
                  fontSize: 11, fontWeight: 900, color: '#64748B', textTransform: 'uppercase',
                  letterSpacing: 1, border: '1px solid #E2E8F0',
                }}>
                  PEDIDO: <span style={{ color: '#059669' }}>{orderNumber}</span>
                </span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#CBD5E1' }} />
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Selecione o layout
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8' }}>
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Ordenação */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                Ordenação dos Itens
              </span>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(to right, #F1F5F9, transparent)' }} />
            </div>
            <div style={{ display: 'flex', gap: 32, paddingLeft: 8 }}>
              {[
                { id: 'digitacao', label: 'Digitação' },
                { id: 'codigo', label: 'Código' },
                { id: 'alfabetica', label: 'Alfabética' },
              ].map((opt) => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => setSorting(opt.id)}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sorting === opt.id ? '#10B981' : '#CBD5E1'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {sorting === opt.id && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />}
                  </div>
                  <span
                    onClick={() => setSorting(opt.id)}
                    style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: sorting === opt.id ? '#10B981' : '#64748B', cursor: 'pointer' }}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Modelos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                Formatos Disponíveis
              </span>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(to right, #F1F5F9, transparent)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
              {activeModels.map((m) => (
                <button
                  key={m}
                  onClick={() => handlePrint(m)}
                  style={{
                    height: 44, border: selectedModel === m ? '2px solid #059669' : '1px solid #E2E8F0',
                    borderRadius: 12, fontSize: 13, fontWeight: 900, cursor: 'pointer',
                    transition: 'all 0.2s', position: 'relative',
                    background: selectedModel === m ? '#059669' : '#fff',
                    color: selectedModel === m ? '#fff' : '#475569',
                    transform: selectedModel === m ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: selectedModel === m ? '0 8px 20px rgba(5,150,105,0.25)' : 'none',
                  }}
                  title={`Imprimir no formato ${m}`}
                >
                  {m}
                </button>
              ))}
              {/* Excel */}
              <button
                onClick={() => onExportExcel(sorting)}
                style={{
                  height: 44, border: '1px solid #D1FAE5', borderRadius: 12,
                  background: '#ECFDF5', color: '#059669', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                title="Exportar para Excel"
              >
                <FileSpreadsheet style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#94A3B8',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                background: '#F8FAFC', padding: '6px 12px', borderRadius: 999, border: '1px solid #F1F5F9',
              }}>
                <Info style={{ width: 12, height: 12 }} />
                Clique no número para abrir a pré-visualização
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: '#F8FAFC', padding: '20px 32px', borderTop: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
        }}>
          <button
            onClick={handleWhatsApp}
            style={{
              height: 48, padding: '0 20px', border: '2px solid rgba(37,211,102,0.3)',
              borderRadius: 12, background: 'rgba(37,211,102,0.1)', color: '#25D366',
              cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase',
              letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
          >
            <MessageCircle style={{ width: 16, height: 16 }} />
            WhatsApp
          </button>
          <button
            onClick={() => onSendEmail(sorting)}
            style={{
              height: 48, padding: '0 20px', border: '2px solid rgba(59,130,246,0.3)',
              borderRadius: 12, background: 'rgba(59,130,246,0.05)', color: '#3B82F6',
              cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase',
              letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
          >
            <Mail style={{ width: 16, height: 16 }} />
            E-mail
          </button>
          <button
            onClick={onClose}
            style={{
              height: 48, padding: '0 20px', border: '1px solid #E2E8F0',
              borderRadius: 12, background: '#fff', color: '#64748B',
              cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase',
              letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintOrderDialog;
