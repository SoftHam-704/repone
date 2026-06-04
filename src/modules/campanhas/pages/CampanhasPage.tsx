import React, { useState, useEffect, useCallback } from 'react';
import {
  Target, TrendingUp, AlertCircle, Plus, Search,
  Sparkles, Activity, RotateCcw, Trash2, ChevronLeft,
  Save, Calculator, CheckCircle2, History, Award, FileText,
  X, LayoutGrid, Store, Package, AlertTriangle, HelpCircle, Calendar,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignTipo = 'CRESCIMENTO' | 'MIX' | 'POSITIVACAO' | 'VOLUME';

interface Campaign {
  cmp_codigo: number;
  cmp_descricao: string;
  cmp_status: string;
  cmp_tipo: CampaignTipo;
  cmp_cliente_id: number;
  cmp_industria_id: number;
  cmp_promotor_id: number | null;
  cmp_periodo_base_ini: string;
  cmp_periodo_base_fim: string;
  cmp_campanha_ini: string;
  cmp_campanha_fim: string;
  cmp_base_dias_kpi: number;
  cmp_base_valor_total: number;
  cmp_base_qtd_total: number;
  cmp_base_media_diaria_val: number;
  cmp_base_media_diaria_qtd: number;
  cmp_perc_crescimento: number;
  cmp_meta_valor_total: number;
  cmp_meta_qtd_total: number;
  cmp_meta_diaria_val: number;
  cmp_meta_diaria_qtd: number;
  cmp_real_valor_total: number;
  cmp_real_qtd_total: number;
  cmp_verba_solicitada: number;
  cmp_tema: string;
  cmp_observacao: string;
  cmp_justificativa: string;
  cmp_premiacoes: string;
  cmp_setor: string;
  cmp_regiao: string;
  cmp_equipe_vendas: number;
  cmp_tipo_periodo: string;
  cli_nome: string;
  cli_nomred: string;
  cli_fantasia: string;
  industria_nome: string;
  industria_nomered: string;
}

interface TrackingLog {
  tra_id: number;
  tra_campanha_id: number;
  tra_data: string;
  tra_vlr_acumulado: number;
  tra_qtd_acumulada: number;
  tra_observacao: string;
}

interface SimulationData {
  base: { days: number; total_value: number; total_qty: number; daily_avg_value: number; daily_avg_qty: number; };
  projection: { days: number; growth_percent: number; target_daily_value: number; target_daily_qty: number; target_total_value: number; target_total_qty: number; };
}

interface AutoProgress {
  realizado: number;
  meta: number;
  progress_pct: number;
  elapsed_pct: number;
  behind: boolean;
  tipo: string;
  label: string;
  base_apuracao: 'SELL_OUT' | 'SELL_IN';
  sell_in: number;
  sell_out: number;
  sell_through: number | null;
  sem_reporte: boolean;
}

// ─── Tipo Config ──────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<CampaignTipo, { label: string; color: string; bg: string; border: string; Icon: React.ElementType; metaLabel: string; metaUnit: string; desc: string }> = {
  CRESCIMENTO: {
    label: 'Crescimento', color: '#059669', bg: '#ECFDF5', border: '#6EE7B7',
    Icon: TrendingUp,
    metaLabel: 'Meta de Faturamento (R$)', metaUnit: 'R$',
    desc: 'Meta em valor financeiro — quanto o cliente deve faturar com a indústria durante o período da campanha.',
  },
  MIX: {
    label: 'Mix de Produtos', color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD',
    Icon: LayoutGrid,
    metaLabel: 'Meta: Famílias/Grupos de Produto', metaUnit: 'famílias',
    desc: 'Meta de diversificação — quantas famílias ou grupos de produto diferentes o cliente deve comprar.',
  },
  POSITIVACAO: {
    label: 'Positivação', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D',
    Icon: Store,
    metaLabel: 'Meta: Meses com Pedido', metaUnit: 'meses',
    desc: 'Meta de ativação — o cliente deve realizar compras em X meses distintos dentro do período da campanha.',
  },
  VOLUME: {
    label: 'Volume', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD',
    Icon: Package,
    metaLabel: 'Meta: Quantidade de Unidades', metaUnit: 'unidades',
    desc: 'Meta em quantidade física — total de unidades vendidas durante o período, independente do valor.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt    = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: number) => (v || 0).toLocaleString('pt-BR');
const fmtDate = (iso: string) => iso ? iso.split('T')[0] : '';

function fmtRealized(tipo: CampaignTipo | string, v: number) {
  return tipo === 'CRESCIMENTO' ? fmt(v) : fmtNum(v);
}

function statusColor(s: string) {
  if (s === 'ATIVA')     return { bg: '#10B981', text: '#fff' };
  if (s === 'CONCLUIDA') return { bg: '#3B82F6', text: '#fff' };
  if (s === 'CANCELADA') return { bg: '#6B7280', text: '#fff' };
  return { bg: '#F59E0B', text: '#fff' };
}

function statusBar(s: string) {
  if (s === 'ATIVA')     return '#10B981';
  if (s === 'CONCLUIDA') return '#3B82F6';
  if (s === 'CANCELADA') return '#9CA3AF';
  return '#F59E0B';
}

function tipoColor(t: string) {
  return TIPO_CONFIG[t as CampaignTipo]?.color || '#64748B';
}

// ─── HelpTooltip (mini — usado no formulário) ────────────────────────────────

function HelpTooltip({ content }: { content: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setShow(s => !s)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', padding: 2 }}
      >
        <HelpCircle size={17} />
      </button>
      {show && (
        <>
          <div onClick={() => setShow(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{
            position: 'absolute', top: 28, right: 0, zIndex: 999, width: 340,
            background: '#1E293B', color: '#F1F5F9', borderRadius: 14, padding: 18,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', fontSize: 12, lineHeight: 1.75,
          }}>
            {content}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Banner explicativo dos 4 tipos (didática) ───────────────────────────────

const TIPO_EXEMPLOS: Record<CampaignTipo, { exemplo: string; metaResumo: string }> = {
  CRESCIMENTO: {
    exemplo: '"Cliente compra R$ 8 mil/mês. Quero que vire R$ 12 mil/mês."',
    metaResumo: 'Meta em R$',
  },
  MIX: {
    exemplo: '"Só compra 2 marcas. Quero que compre 5 marcas distintas."',
    metaResumo: 'Meta em famílias',
  },
  POSITIVACAO: {
    exemplo: '"Compra esporádico. Quero que compre todo mês do trimestre."',
    metaResumo: 'Meta em meses',
  },
  VOLUME: {
    exemplo: '"Não importa preço. Quero bater X unidades no período."',
    metaResumo: 'Meta em unidades',
  },
};

function TipoCampanhaBanner({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      border: '1px solid #E2E8F0', borderRadius: 16,
      padding: '16px 20px', marginBottom: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Qual o objetivo da sua campanha?
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            Escolha o tipo conforme o que você quer estimular no lojista.
          </div>
        </div>
        <button onClick={onOpenHelp}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8,
            border: '1px solid #93C5FD', background: '#EFF6FF',
            color: '#1D4ED8', fontSize: 11, fontWeight: 800, cursor: 'pointer',
          }}>
          <HelpCircle size={13} /> Guia completo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {(Object.entries(TIPO_CONFIG) as [CampaignTipo, typeof TIPO_CONFIG[CampaignTipo]][]).map(([k, v]) => {
          const ex = TIPO_EXEMPLOS[k];
          return (
            <div key={k} style={{
              background: '#fff', borderRadius: 12,
              border: `1px solid ${v.border}`, borderLeft: `4px solid ${v.color}`,
              padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <v.Icon size={14} color={v.color} />
                <span style={{ fontSize: 11, fontWeight: 900, color: v.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {v.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4, fontStyle: 'italic' }}>
                {ex.exemplo}
              </div>
              <div style={{
                display: 'inline-block', alignSelf: 'flex-start',
                background: v.bg, color: v.color, fontSize: 9, fontWeight: 900,
                padding: '2px 8px', borderRadius: 999, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>
                {ex.metaResumo}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stepper visual do formulário ────────────────────────────────────────────

function WizardSteps({ current }: { current: 'planning' | 'monitoring' | 'audit' }) {
  const steps = [
    { id: 'planning'   as const, label: 'Configurar',    sub: 'tipo, parceiros e meta' },
    { id: 'monitoring' as const, label: 'Acompanhar',    sub: 'progresso e tracking' },
    { id: 'audit'      as const, label: 'Auditar',       sub: 'histórico e ajustes' },
  ];
  const order = { planning: 0, monitoring: 1, audit: 2 } as const;
  const ci = order[current];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
      {steps.map((s, i) => {
        const active = s.id === current;
        const done   = i < ci;
        return (
          <React.Fragment key={s.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: active ? '#1E293B' : done ? '#10B981' : '#E2E8F0',
                color: active || done ? '#fff' : '#94A3B8',
                fontSize: 11, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done ? '✓' : (i + 1)}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: active ? '#1E293B' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{s.sub}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#10B981' : '#E2E8F0', margin: '0 16px', borderRadius: 1 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Detalhes opcionais (colapsável — Setor/Região/Equipe) ───────────────────

function DetalhesOpcionais({
  setor, regiao, equipe, onChange,
}: {
  setor: string; regiao: string; equipe: number;
  onChange: (s: string, r: string, e: number) => void;
}) {
  // Começa expandido se algum campo já tem valor (vindo de edição), senão recolhido
  const [open, setOpen] = useState(!!(setor || regiao || equipe));
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
    background: '#fff', fontSize: 13, color: '#1E293B', outline: 'none', fontFamily: 'inherit',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 5, display: 'block',
  };
  return (
    <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: open ? '14px 16px' : '10px 16px', background: open ? '#F8FAFC' : 'transparent' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          color: '#64748B', fontSize: 12, fontWeight: 800,
        }}>
        <span style={{ fontSize: 14, transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>▸</span>
        <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Detalhes opcionais</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'none', letterSpacing: 0 }}>
          (setor, região, equipe — use se a indústria pedir)
        </span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <span style={lbl}>Setor</span>
            <input style={inp} value={setor} onChange={e => onChange(e.target.value, regiao, equipe)} placeholder="Ex: Pesados" />
          </div>
          <div>
            <span style={lbl}>Região</span>
            <input style={inp} value={regiao} onChange={e => onChange(setor, e.target.value, equipe)} placeholder="Ex: Sul de Minas" />
          </div>
          <div>
            <span style={lbl}>Equipe (Qtd)</span>
            <input type="number" style={inp} value={equipe} onChange={e => onChange(setor, regiao, parseInt(e.target.value) || 0)} placeholder="0" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hint inline (microcopy didático embaixo de campos) ──────────────────────

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: '#64748B', lineHeight: 1.4,
      marginTop: 4, paddingLeft: 2,
      display: 'flex', alignItems: 'flex-start', gap: 5,
    }}>
      <span style={{ flexShrink: 0 }}>💡</span>
      <span>{children}</span>
    </div>
  );
}

// ─── Modal de Ajuda Completo ──────────────────────────────────────────────────

function CampanhasHelpModal({ onClose }: { onClose: () => void }) {
  const sec: React.CSSProperties = { marginBottom: 28 };
  const h2: React.CSSProperties = { fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 };
  const p: React.CSSProperties = { fontSize: 13, color: '#475569', lineHeight: 1.75, marginBottom: 8 };
  const pill = (color: string, bg: string, border: string): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 999,
    background: bg, border: `1px solid ${border}`, color, fontWeight: 900, fontSize: 11,
  });
  const step = (n: number, color: string): React.CSSProperties => ({
    width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff',
    fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  });
  const tip: React.CSSProperties = {
    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
    padding: '10px 14px', fontSize: 12, color: '#475569', lineHeight: 1.7, marginBottom: 8,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.5)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101,
        width: 640, background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Cabeçalho */}
        <div style={{ background: '#1E293B', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <HelpCircle size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: 0.3 }}>Guia de Campanhas</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Como planejar, lançar e acompanhar campanhas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', color: '#94A3B8', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

          {/* O que é */}
          <div style={sec}>
            <div style={h2}><Target size={15} color="#1E293B" /> O que é uma Campanha Promocional?</div>
            <p style={p}>
              Uma campanha é um <strong>acordo comercial com prazo, meta e acompanhamento</strong> entre o representante,
              o cliente (lojista) e a indústria. O objetivo é estimular o lojista a comprar mais — em valor,
              variedade, frequência ou quantidade — em troca de verbas, premiações ou descontos especiais.
            </p>
            <p style={p}>
              O sistema calcula o progresso <strong>automaticamente a partir dos pedidos</strong> registrados,
              sem necessidade de lançamento manual.
            </p>
          </div>

          {/* Os 4 tipos */}
          <div style={sec}>
            <div style={h2}><LayoutGrid size={15} color="#1E293B" /> Os 4 Tipos de Campanha</div>

            {/* CRESCIMENTO */}
            <div style={{ borderLeft: '3px solid #059669', paddingLeft: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <TrendingUp size={14} color="#059669" />
                <span style={{ ...pill('#059669', '#ECFDF5', '#6EE7B7') }}>CRESCIMENTO</span>
              </div>
              <p style={p}><strong>Meta em valor financeiro (R$).</strong> Use quando a indústria quer aumentar o faturamento com um cliente específico.</p>
              <div style={tip}>
                <strong>Exemplo:</strong> A IMA quer que a Auto Peças Silva saia de R$ 8.000/mês para R$ 12.000/mês no trimestre.
                O sistema analisa o histórico dos últimos 90 dias, calcula a média diária e projeta a meta com o % de crescimento que você definir.
              </div>
              <p style={{ ...p, fontSize: 12, color: '#64748B' }}>
                📌 Use a <strong>simulação histórica</strong> para calcular a meta automaticamente. Informe o período base e o % desejado de crescimento.
              </p>
            </div>

            {/* MIX */}
            <div style={{ borderLeft: '3px solid #2563EB', paddingLeft: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <LayoutGrid size={14} color="#2563EB" />
                <span style={{ ...pill('#2563EB', '#EFF6FF', '#93C5FD') }}>MIX DE PRODUTOS</span>
              </div>
              <p style={p}><strong>Meta em número de famílias/grupos diferentes.</strong> Use quando a indústria quer que o lojista diversifique as compras.</p>
              <div style={tip}>
                <strong>Exemplo:</strong> A SNR quer que um cliente que só compra Rolamentos passe a comprar também Cubos de Roda, Homocinéticas e Bandejas — meta de 4 famílias distintas no semestre.
              </div>
              <p style={{ ...p, fontSize: 12, color: '#64748B' }}>
                📌 Informe manualmente a <strong>quantidade de famílias</strong> que o lojista deve atingir. O sistema conta as famílias distintas nos pedidos do período.
              </p>
            </div>

            {/* POSITIVAÇÃO */}
            <div style={{ borderLeft: '3px solid #D97706', paddingLeft: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Store size={14} color="#D97706" />
                <span style={{ ...pill('#D97706', '#FFFBEB', '#FCD34D') }}>POSITIVAÇÃO</span>
              </div>
              <p style={p}><strong>Meta de ativação — meses com pedido.</strong> Use para transformar clientes esporádicos em compradores regulares.</p>
              <div style={tip}>
                <strong>Exemplo:</strong> Um lojista que compra da NTN só em 2-3 meses por ano. A campanha exige que ele compre em pelo menos 5 meses dentro de 6 — garantindo presença do produto na loja.
              </div>
              <p style={{ ...p, fontSize: 12, color: '#64748B' }}>
                📌 Informe a <strong>quantidade de meses distintos</strong> que o cliente deve ter pedido. Ideal para ativação de carteira.
              </p>
            </div>

            {/* VOLUME */}
            <div style={{ borderLeft: '3px solid #7C3AED', paddingLeft: 16, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Package size={14} color="#7C3AED" />
                <span style={{ ...pill('#7C3AED', '#F5F3FF', '#C4B5FD') }}>VOLUME</span>
              </div>
              <p style={p}><strong>Meta em quantidade de unidades.</strong> Use quando há desconto por volume ou bonificação em peças.</p>
              <div style={tip}>
                <strong>Exemplo:</strong> A Mahle oferece 2% de desconto se o lojista comprar 500 filtros de óleo no trimestre. A meta é 500 unidades.
              </div>
              <p style={{ ...p, fontSize: 12, color: '#64748B' }}>
                📌 Informe a <strong>quantidade de unidades</strong> como meta. O sistema soma as quantidades dos pedidos do período.
              </p>
            </div>
          </div>

          {/* Passo a passo */}
          <div style={sec}>
            <div style={h2}><FileText size={15} color="#1E293B" /> Como Criar uma Campanha — Passo a Passo</div>

            {[
              { cor: '#059669', titulo: 'Escolha o tipo', texto: 'Selecione o tipo que melhor representa o objetivo da campanha. Isso define como a meta será medida e acompanhada.' },
              { cor: '#2563EB', titulo: 'Defina parceiro e indústria', texto: 'Selecione o cliente (lojista) e a indústria participante. Ambos são obrigatórios — a meta e o progresso são calculados para esse par específico.' },
              { cor: '#D97706', titulo: 'Defina o período da campanha', texto: 'Informe as datas de início e fim. Sem essas datas o monitoramento de atraso não funciona.' },
              { cor: '#7C3AED', titulo: 'Configure a meta', texto: 'Para CRESCIMENTO: use o botão "Calcular Objetivos" — escolha o período histórico de referência e o % de crescimento desejado. Para os demais tipos: informe a meta diretamente no campo correspondente.' },
              { cor: '#059669', titulo: 'Salve e ative', texto: 'Clique em "Criar Campanha". A campanha começa como SIMULAÇÃO. Quando o acordo for firmado, abra-a e mude o status para ATIVA.' },
              { cor: '#2563EB', titulo: 'Acompanhe na aba Monitoramento', texto: 'O sistema calcula o progresso real automaticamente com base nos pedidos. Um alerta laranja aparece quando o realizado está abaixo do ritmo esperado para o período decorrido.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                <div style={step(i + 1, item.cor)}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: '#1E293B', marginBottom: 4 }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>{item.texto}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Monitoramento */}
          <div style={sec}>
            <div style={h2}><Activity size={15} color="#1E293B" /> Monitoramento e Alertas</div>
            <p style={p}>
              A aba <strong>Monitoramento</strong> mostra o progresso real calculado a partir dos pedidos do período,
              comparado com a meta definida.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <div style={{ ...tip, borderLeft: '3px solid #10B981' }}>
                <strong style={{ color: '#059669' }}>Barra verde</strong> — Campanha no ritmo ou adiantada. Continue assim.
              </div>
              <div style={{ ...tip, borderLeft: '3px solid #EA580C' }}>
                <strong style={{ color: '#C2410C' }}>⚠ Alerta laranja</strong> — O progresso está abaixo de 75% do tempo decorrido. O lojista precisa acelerar as compras para atingir a meta.
              </div>
            </div>
            <p style={{ ...p, fontSize: 12, color: '#64748B' }}>
              O alerta aparece tanto no card da lista quanto dentro da campanha. Ao ver o alerta, entre em contato com o lojista e registre a visita na agenda.
            </p>
          </div>

          {/* Dicas */}
          <div style={sec}>
            <div style={h2}><Award size={15} color="#1E293B" /> Boas Práticas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Sempre defina datas de início e fim — sem elas o alerta de atraso não funciona.',
                'Para CRESCIMENTO, use pelo menos 60-90 dias de histórico na simulação para ter uma base confiável.',
                'Use SIMULAÇÃO para apresentar a proposta ao lojista antes de ativar. Mude para ATIVA apenas quando o acordo for confirmado.',
                'Uma campanha de MIX funciona bem combinada com uma visita presencial para mostrar o catálogo completo da indústria.',
                'POSITIVAÇÃO é ideal para lojistas que compram por impulso — a campanha cria um compromisso formal de frequência.',
                'Ao encerrar, mude para CONCLUÍDA e use a aba Auditoria para registrar o resultado, justificativa e premiações pagas.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', ...tip }}>
                  <CheckCircle2 size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
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

// ─── Inline Search ────────────────────────────────────────────────────────────

function InlineSearch({ placeholder, endpoint, labelKey, valueKey, value, onChange }: {
  placeholder: string; endpoint: string; labelKey: string; valueKey: string;
  value: { id: number | null; label: string };
  onChange: (id: number, label: string, item: any) => void;
}) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!q || q.length < 2) { setOpts([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`${endpoint}?search=${encodeURIComponent(q)}&limit=15`);
        setOpts(res.data.data || []);
        setOpen(true);
      } catch { setOpts([]); }
    }, 300);
  }, [q, endpoint]);

  if (value.id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid #10B981', background: '#F0FDF4' }}>
        <CheckCircle2 size={13} color="#10B981" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#065F46' }}>{value.label}</span>
        <button onClick={() => onChange(0, '', null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 14 }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      />
      {open && opts.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto' }}>
          {opts.map((o, i) => (
            <div key={i}
              onClick={() => { onChange(o[valueKey], o[labelKey] || o.cli_nomred || o.for_nomered || o.for_nome, o); setQ(''); setOpen(false); setOpts([]); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1E293B', borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              {o[labelKey] || o.cli_nomred || o.for_nomered || o.for_nome}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Type Selector ────────────────────────────────────────────────────────────

function TipoSelector({ value, onChange }: { value: CampaignTipo; onChange: (t: CampaignTipo) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>Tipo de Campanha</span>
        <HelpTooltip content={
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10, color: '#F1F5F9' }}>Tipos de Campanha</div>
            {(Object.entries(TIPO_CONFIG) as [CampaignTipo, typeof TIPO_CONFIG[CampaignTipo]][]).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 900, color: v.color, fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>{v.label}</div>
                <div style={{ color: '#CBD5E1', fontSize: 11 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        } />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {(Object.entries(TIPO_CONFIG) as [CampaignTipo, typeof TIPO_CONFIG[CampaignTipo]][]).map(([k, v]) => {
          const active = value === k;
          return (
            <button key={k} onClick={() => onChange(k)}
              style={{
                padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${active ? v.color : '#E2E8F0'}`,
                background: active ? v.bg : '#fff',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
              <v.Icon size={18} color={active ? v.color : '#94A3B8'} />
              <span style={{ fontSize: 10, fontWeight: 900, color: active ? v.color : '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.3 }}>
                {v.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Campaign Form ────────────────────────────────────────────────────────────

function CampaignForm({ data, onClose, onSave }: { data: Campaign | null; onClose: () => void; onSave: (f: any) => void }) {
  const [activeTab, setActiveTab] = useState<'planning' | 'monitoring' | 'audit'>(
    data && (data.cmp_status === 'ATIVA' || data.cmp_status === 'CONCLUIDA') ? 'monitoring' : 'planning'
  );
  const [loadingSim, setLoadingSim]       = useState(false);
  const [trackingLogs, setTrackingLogs]   = useState<TrackingLog[]>([]);
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [autoProgress, setAutoProgress]   = useState<AutoProgress | null>(null);
  const [loadingAuto, setLoadingAuto]     = useState(false);
  const [coverage, setCoverage]           = useState<{ tem_cobertura: boolean; sugestao_base: string; ultimo_periodo: string | null; total: number } | null>(null);
  const [newTrack, setNewTrack] = useState({ tra_data: new Date().toISOString().split('T')[0], tra_vlr_acumulado: 0, tra_qtd_acumulada: 0, tra_observacao: '' });

  const [form, setForm] = useState({
    cmp_codigo: null as number | null,
    cmp_descricao: '',
    cmp_tipo: 'CRESCIMENTO' as CampaignTipo,
    cmp_cliente_id: null as number | null,
    client_name: '',
    cmp_industria_id: null as number | null,
    industry_name: '',
    cmp_promotor_id: null as number | null,
    cmp_setor: '', cmp_regiao: '', cmp_equipe_vendas: 0,
    cmp_tipo_periodo: 'TRIMESTRAL',
    cmp_periodo_base_ini: '', cmp_periodo_base_fim: '',
    cmp_campanha_ini: '', cmp_campanha_fim: '',
    cmp_perc_crescimento: 20,
    cmp_verba_solicitada: 0,
    cmp_tema: '',
    cmp_meta_qtd_input: 0,
    simulation_data: null as SimulationData | null,
    cmp_observacao: '', cmp_justificativa: '', cmp_premiacoes: '',
    cmp_status: 'SIMULACAO',
    cmp_real_valor_total: 0, cmp_real_qtd_total: 0,
    cmp_base_apuracao: 'SELL_IN' as 'SELL_OUT' | 'SELL_IN',
  });

  useEffect(() => {
    if (data) {
      setForm({
        cmp_codigo:           data.cmp_codigo,
        cmp_tipo:             (data.cmp_tipo as CampaignTipo) || 'CRESCIMENTO',
        cmp_descricao:        data.cmp_descricao || '',
        cmp_cliente_id:       data.cmp_cliente_id || null,
        client_name:          data.cli_nomred || data.cli_fantasia || data.cli_nome || '',
        cmp_industria_id:     data.cmp_industria_id || null,
        industry_name:        data.industria_nomered || data.industria_nome || '',
        cmp_promotor_id:      data.cmp_promotor_id || null,
        cmp_setor:            data.cmp_setor || '',
        cmp_regiao:           data.cmp_regiao || '',
        cmp_equipe_vendas:    data.cmp_equipe_vendas || 0,
        cmp_tipo_periodo:     data.cmp_tipo_periodo || 'TRIMESTRAL',
        cmp_periodo_base_ini: fmtDate(data.cmp_periodo_base_ini),
        cmp_periodo_base_fim: fmtDate(data.cmp_periodo_base_fim),
        cmp_campanha_ini:     fmtDate(data.cmp_campanha_ini),
        cmp_campanha_fim:     fmtDate(data.cmp_campanha_fim),
        cmp_perc_crescimento: parseFloat(String(data.cmp_perc_crescimento)) || 20,
        cmp_verba_solicitada: parseFloat(String(data.cmp_verba_solicitada)) || 0,
        cmp_tema:             data.cmp_tema || '',
        cmp_meta_qtd_input:   parseFloat(String(data.cmp_meta_qtd_total)) || 0,
        simulation_data: data.cmp_base_valor_total ? {
          base:       { days: data.cmp_base_dias_kpi || 0, total_value: parseFloat(String(data.cmp_base_valor_total)) || 0, total_qty: parseFloat(String(data.cmp_base_qtd_total)) || 0, daily_avg_value: parseFloat(String(data.cmp_base_media_diaria_val)) || 0, daily_avg_qty: parseFloat(String(data.cmp_base_media_diaria_qtd)) || 0 },
          projection: { days: 0, growth_percent: parseFloat(String(data.cmp_perc_crescimento)) || 0, target_total_value: parseFloat(String(data.cmp_meta_valor_total)) || 0, target_total_qty: parseFloat(String(data.cmp_meta_qtd_total)) || 0, target_daily_value: parseFloat(String(data.cmp_meta_diaria_val)) || 0, target_daily_qty: parseFloat(String(data.cmp_meta_diaria_qtd)) || 0 },
        } : null,
        cmp_observacao:       data.cmp_observacao || '',
        cmp_justificativa:    data.cmp_justificativa || '',
        cmp_premiacoes:       data.cmp_premiacoes || '',
        cmp_status:           data.cmp_status || 'SIMULACAO',
        cmp_real_valor_total: parseFloat(String(data.cmp_real_valor_total)) || 0,
        cmp_real_qtd_total:   parseFloat(String(data.cmp_real_qtd_total)) || 0,
        cmp_base_apuracao:    ((data as any).cmp_base_apuracao === 'SELL_OUT' ? 'SELL_OUT' : 'SELL_IN'),
      });
      fetchTracking(data.cmp_codigo);
    } else {
      const end = new Date(), start = new Date();
      start.setMonth(end.getMonth() - 3);
      setForm(prev => ({ ...prev, cmp_periodo_base_ini: start.toISOString().split('T')[0], cmp_periodo_base_fim: end.toISOString().split('T')[0] }));
    }
  }, [data]);

  useEffect(() => {
    if (activeTab === 'monitoring' && form.cmp_codigo) fetchAutoProgress(form.cmp_codigo);
  }, [activeTab, form.cmp_codigo]);

  // Cobertura de sell-out do par → sugere a base (D5) e avisa quando não há reporte (D6).
  useEffect(() => {
    const cli = form.cmp_cliente_id, ind = form.cmp_industria_id;
    if (!cli || !ind || form.cmp_tipo === 'MIX') { setCoverage(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/campaigns/sellout-coverage?cliente=${cli}&industria=${ind}`);
        if (cancelled || !res.data.success) return;
        setCoverage(res.data.data);
        // auto-sugestão só em campanha nova (não mexe no critério de campanha já gravada)
        if (!form.cmp_codigo) setForm(prev => ({ ...prev, cmp_base_apuracao: res.data.data.sugestao_base }));
      } catch { /* ok */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cmp_cliente_id, form.cmp_industria_id, form.cmp_tipo]);

  const fetchTracking = async (id: number) => {
    try {
      const res = await api.get(`/campaigns/${id}/tracking`);
      if (res.data.success) setTrackingLogs(res.data.data || []);
    } catch { /* ok */ }
  };

  const fetchAutoProgress = async (id: number) => {
    setLoadingAuto(true);
    try {
      const res = await api.get(`/campaigns/${id}/auto-progress`);
      if (res.data.success) setAutoProgress(res.data.data);
    } catch { /* ok */ }
    finally { setLoadingAuto(false); }
  };

  const handleSimulate = async () => {
    if (!form.cmp_cliente_id || !form.cmp_industria_id || !form.cmp_periodo_base_ini || !form.cmp_periodo_base_fim) {
      toast.error('Preencha cliente, indústria e período de referência.'); return;
    }
    setLoadingSim(true);
    try {
      const res = await api.post('/campaigns/simulate', {
        client_id: form.cmp_cliente_id, industry_id: form.cmp_industria_id,
        base_start: form.cmp_periodo_base_ini, base_end: form.cmp_periodo_base_fim,
        campaign_start: form.cmp_campanha_ini || form.cmp_periodo_base_ini,
        campaign_end:   form.cmp_campanha_fim || form.cmp_periodo_base_fim,
        growth_percent: form.cmp_perc_crescimento,
      });
      if (res.data.success) {
        setForm(prev => ({
          ...prev,
          simulation_data: res.data.data,
          cmp_verba_solicitada: parseFloat((res.data.data.projection.target_total_value * 0.02).toFixed(2)),
        }));
        toast.success('Simulação concluída!');
      }
    } catch { toast.error('Erro na simulação.'); }
    finally { setLoadingSim(false); }
  };

  const handleAddTracking = async () => {
    if (!newTrack.tra_vlr_acumulado && !newTrack.tra_qtd_acumulada) { toast.error('Informe o valor ou quantidade.'); return; }
    try {
      const res = await api.post(`/campaigns/${form.cmp_codigo}/tracking`, newTrack);
      if (res.data.success) {
        toast.success('Progresso lançado!');
        setShowTrackingForm(false);
        fetchTracking(form.cmp_codigo!);
        setForm(prev => ({ ...prev, cmp_real_valor_total: newTrack.tra_vlr_acumulado, cmp_real_qtd_total: newTrack.tra_qtd_acumulada }));
      }
    } catch { toast.error('Erro ao lançar progresso.'); }
  };

  const handleDeleteTrack = async (tid: number) => {
    if (!window.confirm('Remover este lançamento?')) return;
    try {
      await api.delete(`/campaigns/tracking/${tid}`);
      toast.success('Removido.');
      const remaining = trackingLogs.filter(t => t.tra_id !== tid);
      setTrackingLogs(remaining);
      const latest = remaining[0];
      setForm(prev => ({ ...prev, cmp_real_valor_total: latest?.tra_vlr_acumulado || 0, cmp_real_qtd_total: latest?.tra_qtd_acumulada || 0 }));
    } catch { toast.error('Erro ao remover.'); }
  };

  const tipoConf = TIPO_CONFIG[form.cmp_tipo] || TIPO_CONFIG.CRESCIMENTO;
  const isCrescimento = form.cmp_tipo === 'CRESCIMENTO';

  const manualProgress = isCrescimento && form.simulation_data
    ? Math.min(100, (form.cmp_real_valor_total / (form.simulation_data.projection.target_total_value || 1)) * 100)
    : 0;

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 5 };
  const card: React.CSSProperties = { background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

  const handleSaveClick = () => {
    const payload: any = { ...form };
    if (!isCrescimento) {
      payload.cmp_meta_qtd_total = form.cmp_meta_qtd_input;
    }
    onSave(payload);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#F8FAFC', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#64748B', fontSize: 13, fontWeight: 700 }}>
            <ChevronLeft size={16} /> Campanhas
          </button>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '3px 10px', borderRadius: 999, background: tipoConf.bg, border: `1px solid ${tipoConf.border}`, fontSize: 10, fontWeight: 900, color: tipoConf.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {tipoConf.label}
            </div>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#1E293B' }}>{data ? 'Gestão de Campanha' : 'Nova Campanha'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSaveClick}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tipoConf.color, color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {data ? 'Salvar Alterações' : 'Criar Campanha'}
          </button>
        </div>
      </div>

      {/* Stepper visual — reduz sensação de "tem campo demais" */}
      <WizardSteps current={activeTab} />

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 28px', display: 'flex', gap: 0, flexShrink: 0 }}>
        {([
          { id: 'planning',   label: 'Planejamento',  icon: FileText },
          { id: 'monitoring', label: 'Monitoramento', icon: Activity, disabled: !isCrescimento ? !form.cmp_cliente_id : !form.simulation_data },
          { id: 'audit',      label: 'Auditoria',     icon: Award,   disabled: !data },
        ] as any[]).map(t => (
          <button key={t.id} onClick={() => !t.disabled && setActiveTab(t.id)} disabled={t.disabled}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer',
              fontWeight: 900, fontSize: 12, color: activeTab === t.id ? tipoConf.color : t.disabled ? '#CBD5E1' : '#64748B',
              borderBottom: activeTab === t.id ? `2px solid ${tipoConf.color}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

        {/* ── PLANEJAMENTO ── */}
        {activeTab === 'planning' && (
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Tipo selector */}
            <div style={card}>
              <TipoSelector value={form.cmp_tipo} onChange={t => setForm(prev => ({ ...prev, cmp_tipo: t, simulation_data: null }))} />
            </div>

            {/* Configuração */}
            <div style={card}>
              <div style={{ borderLeft: `4px solid ${tipoConf.color}`, paddingLeft: 14, marginBottom: 20 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#1E293B' }}>1. Configuração Inicial</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Defina o parceiro, indústria e período da campanha.</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                <div>
                  <span style={lbl}>Título da Ação Comercial</span>
                  <input style={inp} value={form.cmp_descricao} onChange={e => setForm({ ...form, cmp_descricao: e.target.value })} placeholder="Ex: Desafio Q1 2026 — Aceleração de Mix" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <span style={lbl}>Parceiro (Lojista)</span>
                    <InlineSearch
                      placeholder="Selecionar cliente..." endpoint="/clients"
                      labelKey="cli_nomred" valueKey="cli_codigo"
                      value={{ id: form.cmp_cliente_id, label: form.client_name }}
                      onChange={(id, label, item) => setForm(prev => ({ ...prev, cmp_cliente_id: id || null, client_name: item?.cli_nomred || label }))}
                    />
                  </div>
                  <div>
                    <span style={lbl}>Indústria / Fornecedor</span>
                    <InlineSearch
                      placeholder="Selecionar indústria..." endpoint="/suppliers"
                      labelKey="for_nomered" valueKey="for_codigo"
                      value={{ id: form.cmp_industria_id, label: form.industry_name }}
                      onChange={(id, label, item) => setForm(prev => ({ ...prev, cmp_industria_id: id || null, industry_name: item?.for_nomered || item?.for_nome || label }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <span style={lbl}>Início da Campanha</span>
                    <input type="date" style={inp} value={form.cmp_campanha_ini} onChange={e => setForm({ ...form, cmp_campanha_ini: e.target.value })} />
                    <FieldHint>Quando a campanha entra em vigor para o lojista.</FieldHint>
                  </div>
                  <div>
                    <span style={lbl}>Fim da Campanha</span>
                    <input type="date" style={inp} value={form.cmp_campanha_fim} onChange={e => setForm({ ...form, cmp_campanha_fim: e.target.value })} />
                    <FieldHint>Após esta data o sistema fecha a apuração e calcula se bateu a meta.</FieldHint>
                  </div>
                </div>

                {/* Detalhes opcionais — colapsável, esconde campos pouco usados */}
                <DetalhesOpcionais
                  setor={form.cmp_setor}
                  regiao={form.cmp_regiao}
                  equipe={form.cmp_equipe_vendas}
                  onChange={(s, r, e) => setForm({ ...form, cmp_setor: s, cmp_regiao: r, cmp_equipe_vendas: e })}
                />
              </div>
            </div>

            {/* Base de apuração — como a meta é medida (sell-out = giro real) */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14 }}>★</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#1E293B', textTransform: 'uppercase' }}>Base de apuração</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Como o progresso da campanha é medido.</div>
                </div>
              </div>

              {form.cmp_tipo === 'MIX' ? (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
                  Campanhas de <strong>Mix</strong> são apuradas por <strong>sell-in</strong> (o sell-out atual não tem quebra por família). Mede a diversidade de compra do lojista.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {([
                      { v: 'SELL_OUT', t: 'Sell-out — giro real', d: 'O que o lojista VENDEU na ponta' },
                      { v: 'SELL_IN',  t: 'Sell-in — compra',     d: 'O que o lojista COMPROU de você' },
                    ] as const).map(o => {
                      const active = form.cmp_base_apuracao === o.v;
                      const accent = o.v === 'SELL_OUT' ? '#059669' : '#64748B';
                      return (
                        <button key={o.v} type="button" onClick={() => setForm({ ...form, cmp_base_apuracao: o.v })}
                          style={{ flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                            border: `2px solid ${active ? accent : '#E2E8F0'}`, background: active ? (o.v === 'SELL_OUT' ? '#ECFDF5' : '#F8FAFC') : '#fff' }}>
                          <div style={{ fontWeight: 900, fontSize: 13, color: active ? accent : '#1E293B' }}>{o.t}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{o.d}</div>
                        </button>
                      );
                    })}
                  </div>

                  {coverage && (
                    form.cmp_base_apuracao === 'SELL_OUT' && !coverage.tem_cobertura ? (
                      <div style={{ marginTop: 12, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#C2410C', lineHeight: 1.5 }}>
                        ⚠ Este cliente <strong>não reporta sell-out</strong> recente — a campanha ficará <strong>"aguardando reporte"</strong>. Cadastre o sell-out em <strong>Movimentações → Sell-Out</strong>, ou apure por sell-in (proxy) enquanto isso.
                      </div>
                    ) : coverage.tem_cobertura ? (
                      <div style={{ marginTop: 12, background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#047857', lineHeight: 1.5 }}>
                        ✓ Cliente reporta sell-out{coverage.ultimo_periodo ? <> (último: <strong>{String(coverage.ultimo_periodo).slice(0, 7).split('-').reverse().join('/')}</strong>)</> : ''} — apuração por <strong>giro real</strong> disponível.
                      </div>
                    ) : (
                      <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                        Sem histórico de sell-out para este cliente — recomendado apurar por <strong>sell-in</strong> até ele reportar.
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            {/* Análise / Meta */}
            {isCrescimento ? (
              /* CRESCIMENTO: simulação histórica */
              <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 16, right: 16, opacity: 0.04 }}><TrendingUp size={80} color="#0F172A" /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: tipoConf.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14 }}>2</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#1E293B', textTransform: 'uppercase' }}>Análise de Potencial</div>
                </div>

                {/* Caixa explicativa: o que é "período base" */}
                <div style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1D4ED8', lineHeight: 1.5,
                }}>
                  <strong>O que é período base?</strong> É o histórico que serve de comparação. Se a campanha
                  vai de Abr a Jun/2026, use Jan-Mar/2026 como base. O sistema calcula a média diária
                  do que o cliente comprava e projeta a meta.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <span style={lbl}>Janela de Histórico</span>
                    <select style={{ ...inp }} value={form.cmp_tipo_periodo} onChange={e => setForm({ ...form, cmp_tipo_periodo: e.target.value })}>
                      <option value="BIMESTRAL">Bimestral (60 dias)</option>
                      <option value="TRIMESTRAL">Trimestral (90 dias)</option>
                      <option value="SEMESTRAL">Semestral (180 dias)</option>
                      <option value="ANUAL">Anual (365 dias)</option>
                    </select>
                    <FieldHint>Quanto histórico considerar. Trimestral é o padrão.</FieldHint>
                  </div>
                  <div>
                    <span style={lbl}>% Crescimento Meta</span>
                    <input type="number" style={inp} value={form.cmp_perc_crescimento} onChange={e => setForm({ ...form, cmp_perc_crescimento: parseFloat(e.target.value) || 0 })} />
                    <FieldHint>Quanto a mais quer vender vs o período base. 15–25% é realista; acima disso, justifique.</FieldHint>
                  </div>
                  <div>
                    <span style={lbl}>Início do Período Base</span>
                    <input type="date" style={inp} value={form.cmp_periodo_base_ini} onChange={e => setForm({ ...form, cmp_periodo_base_ini: e.target.value })} />
                  </div>
                  <div>
                    <span style={lbl}>Fim do Período Base</span>
                    <input type="date" style={inp} value={form.cmp_periodo_base_fim} onChange={e => setForm({ ...form, cmp_periodo_base_fim: e.target.value })} />
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button onClick={handleSimulate} disabled={loadingSim}
                    style={{ padding: '12px 40px', borderRadius: 12, border: 'none', background: loadingSim ? '#94A3B8' : tipoConf.color, color: '#fff', fontWeight: 900, fontSize: 14, cursor: loadingSim ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {loadingSim ? <><RotateCcw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analisando...</> : <><Calculator size={16} /> Calcular Objetivos de Venda</>}
                  </button>
                </div>

                {form.simulation_data && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: 'Total Vendido', value: fmt(form.simulation_data.base.total_value), hi: false },
                        { label: 'Dias Úteis',    value: `${form.simulation_data.base.days} dias`,   hi: false },
                        { label: 'Média Diária',  value: fmt(form.simulation_data.base.daily_avg_value), hi: true, hiColor: '#ECFDF5', hiText: '#059669' },
                        { label: 'Meta Diária',   value: fmt(form.simulation_data.projection.target_daily_value), hi: true, hiColor: '#FFFBEB', hiText: '#D97706' },
                      ].map(f => (
                        <div key={f.label} style={{ background: f.hi ? f.hiColor! : '#F8FAFC', borderRadius: 12, padding: 14, border: `1px solid ${f.hi ? (f.hiText === '#059669' ? '#BBF7D0' : '#FDE68A') : '#E2E8F0'}` }}>
                          <div style={{ fontSize: 9, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{f.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: f.hi ? f.hiText! : '#1E293B' }}>{f.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <span style={lbl}>Tema / Mote</span>
                        <input style={inp} value={form.cmp_tema} onChange={e => setForm({ ...form, cmp_tema: e.target.value })} placeholder="Ex: Queima de Estoque / Lançamento Verão..." />
                        <FieldHint>Como você vai "vender" a campanha pro lojista. Nome curto e marcante.</FieldHint>
                      </div>
                      <div>
                        <span style={lbl}>Verba Solicitada (R$)</span>
                        <input type="number" step="0.01" style={inp} value={form.cmp_verba_solicitada} onChange={e => setForm({ ...form, cmp_verba_solicitada: parseFloat(e.target.value) || 0 })} />
                        <FieldHint>R$ que <strong>a indústria vai bancar</strong> (frete grátis, brindes, descontos extras). Diferente da premiação ao cliente.</FieldHint>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* MIX / POSITIVAÇÃO / VOLUME: meta manual */
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: tipoConf.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 14 }}>2</div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#1E293B', textTransform: 'uppercase' }}>Definição de Meta</div>
                </div>

                <div style={{ background: tipoConf.bg, border: `1px solid ${tipoConf.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: tipoConf.color, fontWeight: 600 }}>
                  {tipoConf.desc}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={lbl}>{tipoConf.metaLabel}</span>
                    <input type="number" style={{ ...inp, borderColor: tipoConf.border }} value={form.cmp_meta_qtd_input}
                      onChange={e => setForm({ ...form, cmp_meta_qtd_input: parseFloat(e.target.value) || 0 })}
                      placeholder={`Ex: 5 ${tipoConf.metaUnit}`}
                    />
                    <FieldHint>Número absoluto que o cliente precisa atingir até o fim da campanha.</FieldHint>
                  </div>
                  <div>
                    <span style={lbl}>Verba Solicitada (R$)</span>
                    <input type="number" step="0.01" style={inp} value={form.cmp_verba_solicitada} onChange={e => setForm({ ...form, cmp_verba_solicitada: parseFloat(e.target.value) || 0 })} />
                    <FieldHint>R$ que <strong>a indústria vai bancar</strong> (frete grátis, brindes, descontos extras). Diferente da premiação ao cliente.</FieldHint>
                  </div>
                  <div>
                    <span style={lbl}>Tema / Mote</span>
                    <input style={inp} value={form.cmp_tema} onChange={e => setForm({ ...form, cmp_tema: e.target.value })} placeholder="Ex: Ativação Q1 2026..." />
                  </div>
                  <div>
                    <span style={lbl}>Janela de Referência</span>
                    <select style={{ ...inp }} value={form.cmp_tipo_periodo} onChange={e => setForm({ ...form, cmp_tipo_periodo: e.target.value })}>
                      <option value="BIMESTRAL">Bimestral</option>
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MONITORAMENTO ── */}
        {activeTab === 'monitoring' && (
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Auto-Progress (from orders) */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Activity size={16} color={tipoConf.color} /> Progresso Real
                  {autoProgress && (
                    autoProgress.base_apuracao === 'SELL_OUT' ? (
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#047857', fontSize: 10, fontWeight: 900, letterSpacing: 0.3 }}>SELL-OUT · GIRO REAL</span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569', fontSize: 10, fontWeight: 900, letterSpacing: 0.3 }}>
                        {autoProgress.tipo === 'MIX' ? 'SELL-IN · COMPRA' : 'SELL-IN · GIRO NÃO CONFIRMADO'}
                      </span>
                    )
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {form.cmp_codigo && (
                    <button onClick={() => fetchAutoProgress(form.cmp_codigo!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                      <RotateCcw size={12} /> Atualizar
                    </button>
                  )}
                  <select value={form.cmp_status} onChange={e => setForm({ ...form, cmp_status: e.target.value })} style={{ ...inp, width: 'auto', fontSize: 12 }}>
                    <option value="SIMULACAO">Simulação</option>
                    <option value="ATIVA">Ativa</option>
                    <option value="CONCLUIDA">Concluída</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
              </div>

              {loadingAuto ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 12 }}>Calculando progresso real...</div>
              ) : autoProgress ? (
                <>
                  {autoProgress.sem_reporte && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <Activity size={16} color="#2563EB" />
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>
                        Aguardando reporte de sell-out deste cliente no período — o realizado fica em espera, não é 0%. Cadastre em <strong>Movimentações → Sell-Out</strong>.
                      </div>
                    </div>
                  )}

                  {autoProgress.behind && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <AlertTriangle size={16} color="#EA580C" />
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C' }}>
                        Campanha atrasada — {autoProgress.elapsed_pct.toFixed(0)}% do período decorrido, apenas {autoProgress.progress_pct.toFixed(0)}% da meta atingida.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'Meta', value: isCrescimento ? fmt(autoProgress.meta) : `${fmtNum(autoProgress.meta)} ${autoProgress.label}`, color: '#F59E0B' },
                      { label: 'Realizado', value: isCrescimento ? fmt(autoProgress.realizado) : `${fmtNum(autoProgress.realizado)} ${autoProgress.label}`, color: autoProgress.progress_pct >= 100 ? '#10B981' : tipoConf.color },
                      { label: 'Progresso', value: `${autoProgress.progress_pct.toFixed(0)}%`, color: autoProgress.progress_pct >= 100 ? '#10B981' : '#64748B' },
                    ].map(f => (
                      <div key={f.label} style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{f.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: f.color }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                      <span>Meta: {autoProgress.progress_pct.toFixed(0)}%</span>
                      <span>Período: {autoProgress.elapsed_pct.toFixed(0)}% decorrido</span>
                    </div>
                    <div style={{ height: 10, background: '#F1F5F9', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${autoProgress.elapsed_pct}%`, background: '#E2E8F0', borderRadius: 8, position: 'absolute' }} />
                      <div style={{ height: '100%', width: `${autoProgress.progress_pct}%`, background: autoProgress.progress_pct >= 100 ? '#10B981' : tipoConf.color, borderRadius: 8, position: 'absolute', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>

                  {/* Dual-view: comprou (sell-in) · vendeu (sell-out) · giro (sell-through) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 18 }}>
                    {[
                      { label: 'Comprou (sell-in)',    value: fmt(autoProgress.sell_in),  color: '#475569', sub: 'pediu de você' },
                      { label: 'Vendeu (sell-out)',    value: fmt(autoProgress.sell_out), color: '#059669', sub: 'girou na ponta' },
                      { label: 'Giro (sell-through)',  value: autoProgress.sell_through == null ? '—' : `${autoProgress.sell_through.toFixed(0)}%`,
                        color: autoProgress.sell_through == null ? '#94A3B8' : autoProgress.sell_through >= 80 ? '#059669' : '#DC2626', sub: 'vendeu ÷ comprou' },
                    ].map(f => (
                      <div key={f.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{f.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: f.color }}>{f.value}</div>
                        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 3 }}>{f.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8, textAlign: 'center', lineHeight: 1.4 }}>
                    Sell-through baixo = estoque parado na loja (comprou e não girou). O sell-out vem do reporte em <strong>Movimentações → Sell-Out</strong>.
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                  {form.cmp_codigo ? 'Nenhum dado encontrado nos pedidos para este período.' : 'Salve a campanha primeiro para ver o progresso real.'}
                </div>
              )}
            </div>

            {/* Log manual (override) */}
            {isCrescimento && (
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <History size={16} color="#94A3B8" /> Log Manual (Override)
                  </div>
                  <button onClick={() => setShowTrackingForm(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tipoConf.color, color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={13} /> Lançar
                  </button>
                </div>

                {showTrackingForm && (
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, border: '1px solid #E2E8F0', marginBottom: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div><span style={lbl}>Data</span><input type="date" style={inp} value={newTrack.tra_data} onChange={e => setNewTrack({ ...newTrack, tra_data: e.target.value })} /></div>
                      <div><span style={lbl}>Vlr Acumulado (R$)</span><input type="number" step="0.01" style={inp} value={newTrack.tra_vlr_acumulado} onChange={e => setNewTrack({ ...newTrack, tra_vlr_acumulado: parseFloat(e.target.value) || 0 })} /></div>
                      <div><span style={lbl}>Qtd Acumulada</span><input type="number" style={inp} value={newTrack.tra_qtd_acumulada} onChange={e => setNewTrack({ ...newTrack, tra_qtd_acumulada: parseFloat(e.target.value) || 0 })} /></div>
                    </div>
                    <input style={{ ...inp, marginBottom: 10 }} value={newTrack.tra_observacao} onChange={e => setNewTrack({ ...newTrack, tra_observacao: e.target.value })} placeholder="Observação (opcional)" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddTracking} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tipoConf.color, color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>Confirmar</button>
                      <button onClick={() => setShowTrackingForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                {trackingLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>Nenhum lançamento manual ainda.</div>
                ) : (
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Data', 'Vlr Acumulado', 'Qtd Acumulada', 'Obs', ''].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Vlr Acumulado' || h === 'Qtd Acumulada' ? 'right' : 'left', fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trackingLogs.map(t => (
                        <tr key={t.tra_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 700, color: '#64748B' }}>{fmtDate(t.tra_data)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 900, color: tipoConf.color, fontFamily: 'monospace' }}>{fmt(parseFloat(String(t.tra_vlr_acumulado)))}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#1E293B' }}>{t.tra_qtd_acumulada}</td>
                          <td style={{ padding: '7px 10px', color: '#94A3B8', fontSize: 11 }}>{t.tra_observacao}</td>
                          <td style={{ padding: '7px 4px' }}>
                            <button onClick={() => handleDeleteTrack(t.tra_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FCA5A5' }}><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── AUDITORIA ── */}
        {activeTab === 'audit' && (
          <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={card}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={16} color="#F59E0B" /> Auditoria e Encerramento
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <span style={lbl}>Justificativa</span>
                  <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' } as any} value={form.cmp_justificativa} onChange={e => setForm({ ...form, cmp_justificativa: e.target.value })} placeholder="Justificativa dos resultados..." />
                  <FieldHint>Por que bateu (ou não bateu) a meta. Texto para conversa com a indústria no fechamento.</FieldHint>
                </div>
                <div>
                  <span style={lbl}>Premiações / Bonificações</span>
                  <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' } as any} value={form.cmp_premiacoes} onChange={e => setForm({ ...form, cmp_premiacoes: e.target.value })} placeholder="Ex: 5% de desconto extra, kit ferramentas, viagem para fábrica..." />
                  <FieldHint>O que <strong>o lojista ganha</strong> se bater a meta. Diferente da "Verba" (que é da indústria pra você operacionalizar).</FieldHint>
                </div>
                <div>
                  <span style={lbl}>Observações Gerais</span>
                  <textarea style={{ ...inp, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' } as any} value={form.cmp_observacao} onChange={e => setForm({ ...form, cmp_observacao: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ item, onEdit }: { item: Campaign; onEdit: (c: Campaign) => void }) {
  const tipo = (item.cmp_tipo as CampaignTipo) || 'CRESCIMENTO';
  const tc = TIPO_CONFIG[tipo] || TIPO_CONFIG.CRESCIMENTO;
  const sc = statusColor(item.cmp_status || 'SIMULACAO');

  const isCrescimento = tipo === 'CRESCIMENTO';
  const meta     = isCrescimento ? parseFloat(String(item.cmp_meta_valor_total)) : parseFloat(String(item.cmp_meta_qtd_total));
  const realizado = isCrescimento ? parseFloat(String(item.cmp_real_valor_total)) : parseFloat(String(item.cmp_real_qtd_total));
  const progress = meta > 0 ? Math.min(100, (realizado / meta) * 100) : 0;

  // Behind-schedule check from stored data
  const behind = (() => {
    if (item.cmp_status !== 'ATIVA' || !item.cmp_campanha_ini || !item.cmp_campanha_fim || meta === 0) return false;
    const now = Date.now();
    const start = new Date(item.cmp_campanha_ini).getTime();
    const end   = new Date(item.cmp_campanha_fim).getTime();
    const totalMs = end - start;
    if (totalMs <= 0) return false;
    const elapsedPct = Math.min(100, ((now - start) / totalMs) * 100);
    return elapsedPct > 15 && progress < elapsedPct * 0.75;
  })();

  return (
    <div style={{ background: '#fff', borderRadius: 24, border: `1px solid ${behind ? '#FED7AA' : '#E2E8F0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div style={{ height: 5, background: tc.color }} />

      <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <tc.Icon size={18} color={tc.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.cmp_descricao}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.cli_nomred || item.cli_fantasia || item.cli_nome}
            </div>
          </div>
        </div>

        {/* Fornecedor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
          <Sparkles size={9} color="#F59E0B" />
          {item.industria_nomered || item.industria_nome}
        </div>

        {/* Vigência da campanha — DD/MM/YY → DD/MM/YY */}
        {(item.cmp_campanha_ini || item.cmp_campanha_fim) && (() => {
          const fmt = (iso: string) => {
            if (!iso) return '—';
            const [y, m, d] = iso.split('T')[0].split('-');
            return `${d}/${m}/${y.slice(2)}`;
          };
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#64748B' }}>
              <Calendar size={9} color="#7C3AED" />
              <span style={{ fontFamily: 'monospace', letterSpacing: 0.2 }}>
                {fmt(item.cmp_campanha_ini)} → {fmt(item.cmp_campanha_fim)}
              </span>
            </div>
          );
        })()}

        {/* Alerta atraso */}
        {behind && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#C2410C' }}>
            <AlertTriangle size={11} /> Campanha atrasada
          </div>
        )}

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{isCrescimento ? 'Meta Diária' : tc.metaLabel.split(':')[0].trim()}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace' }}>
              {isCrescimento ? fmt(parseFloat(String(item.cmp_meta_diaria_val || 0))) : `${fmtNum(parseFloat(String(item.cmp_meta_qtd_total || 0)))} ${tc.metaUnit}`}
            </div>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Verba</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace' }}>{fmt(parseFloat(String(item.cmp_verba_solicitada || 0)))}</div>
          </div>
        </div>

        {/* Progresso */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#10B981' : tc.color, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#64748B', whiteSpace: 'nowrap' }}>{progress.toFixed(0)}%</span>
            </div>
          </div>
          <button onClick={() => onEdit(item)} style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 10, border: `1px solid ${tc.border}`, background: tc.bg, color: tc.color, fontWeight: 900, fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
            Gerenciar
          </button>
        </div>
      </div>

      {/* Badges */}
      <div style={{ position: 'absolute', top: 13, right: 13, display: 'flex', gap: 5 }}>
        <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 999, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {tc.label}
        </span>
        <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 999, background: sc.bg, color: sc.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {item.cmp_status || 'SIM'}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [showHelp, setShowHelp]   = useState(false);
  const [selected, setSelected]   = useState<Campaign | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      if (res.data.success) setCampaigns(res.data.data || []);
    } catch { toast.error('Erro ao carregar campanhas.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const filtered = campaigns.filter(c => {
    if (filterTipo && c.cmp_tipo !== filterTipo) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.cmp_descricao || '').toLowerCase().includes(q) ||
      (c.cli_nomred || c.cli_fantasia || c.cli_nome || '').toLowerCase().includes(q) ||
      (c.industria_nome || '').toLowerCase().includes(q)
    );
  });

  const handleSave = async (form: any) => {
    try {
      const isEdit = !!form.cmp_codigo;
      if (isEdit) {
        await api.put(`/campaigns/${form.cmp_codigo}`, form);
        toast.success('Campanha atualizada!');
      } else {
        await api.post('/campaigns', form);
        toast.success('Campanha criada!');
      }
      setShowForm(false);
      fetchCampaigns();
    } catch { toast.error('Erro ao salvar campanha.'); }
  };

  if (showForm) {
    return <CampaignForm data={selected} onClose={() => setShowForm(false)} onSave={handleSave} />;
  }

  const totalVerba   = campaigns.reduce((s, c) => s + parseFloat(String(c.cmp_verba_solicitada || 0)), 0);
  const totalAtivas  = campaigns.filter(c => c.cmp_status === 'ATIVA').length;
  const totalPlan    = campaigns.filter(c => c.cmp_status === 'SIMULACAO').length;

  return (
    <>
      {showHelp && <CampanhasHelpModal onClose={() => setShowHelp(false)} />}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 9, background: '#1E293B', borderRadius: 12 }}>
            <Target size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.3 }}>Campanhas Promocionais</div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 1 }}>Crescimento · Mix · Positivação · Volume</div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', color: '#64748B', fontSize: 12, fontWeight: 700 }}
          >
            <HelpCircle size={14} /> Ajuda
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por cliente, indústria ou título..."
              style={{ padding: '10px 12px 10px 30px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', width: 260, background: '#F8FAFC' }}
            />
          </div>
          <button onClick={() => { setSelected(null); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: '#1E293B', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={16} /> Nova Campanha
          </button>
        </div>
      </div>

      {/* Stats + Tipo Filters */}
      <div style={{ padding: '14px 28px 0', flexShrink: 0 }}>

        {/* Banner didático: 4 tipos com exemplo prático */}
        <TipoCampanhaBanner onOpenHelp={() => setShowHelp(true)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Total de Campanhas', value: campaigns.length,   color: '#1E293B' },
            { label: 'Ativas',             value: totalAtivas,        color: '#10B981' },
            { label: 'Em Planejamento',    value: totalPlan,          color: '#F59E0B' },
            { label: 'Verba Comprometida', value: `R$ ${totalVerba.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: '#1E293B', small: true },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: s.small ? 14 : 22, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tipo filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setFilterTipo('')}
            style={{ padding: '5px 14px', borderRadius: 999, border: `1px solid ${!filterTipo ? '#1E293B' : '#E2E8F0'}`, background: !filterTipo ? '#1E293B' : '#fff', color: !filterTipo ? '#fff' : '#64748B', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
            Todos
          </button>
          {(Object.entries(TIPO_CONFIG) as [CampaignTipo, typeof TIPO_CONFIG[CampaignTipo]][]).map(([k, v]) => {
            const count = campaigns.filter(c => (c.cmp_tipo || 'CRESCIMENTO') === k).length;
            if (!count) return null;
            return (
              <button key={k} onClick={() => setFilterTipo(filterTipo === k ? '' : k)}
                style={{ padding: '5px 14px', borderRadius: 999, border: `1px solid ${filterTipo === k ? v.color : v.border}`, background: filterTipo === k ? v.bg : '#fff', color: filterTipo === k ? v.color : '#64748B', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <v.Icon size={10} /> {v.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#94A3B8' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #1E293B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>Carregando campanhas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 16, background: '#fff', borderRadius: 24, border: '2px dashed #E2E8F0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={36} color="#E2E8F0" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3 }}>Nenhuma campanha no radar</div>
            <button onClick={() => { setSelected(null); setShowForm(true); }} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#1E293B', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
            {filtered.map(c => (
              <CampaignCard key={c.cmp_codigo} item={c} onEdit={c => { setSelected(c); setShowForm(true); }} />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
