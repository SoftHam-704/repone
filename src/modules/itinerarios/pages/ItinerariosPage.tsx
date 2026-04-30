import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Plus, Trash2, GripVertical, ChevronRight, X, Navigation, Route, Users, HelpCircle } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { G } from '@/shared/components/layout/CadastroShell';

// ─── Leaflet (lazy CSS) ───────────────────────────────────────────────────────
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// Fix default marker icon broken by webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Itinerario {
  iti_codigo: number;
  iti_descricao: string;
  iti_frequencia: string;
  iti_observacao: string;
  iti_vendedor_id: number | null;
  iti_regiao_id: number | null;
  vendedor_nome?: string;
  regiao_nome?: string;
  total_paradas?: number;
}

interface Parada {
  itp_codigo: number;
  itp_ordem: number;
  itp_obs: string;
  cli_codigo: number;
  cli_nome: string;
  cli_fantasia: string;
  cli_endereco: string;
  cli_endnum: string;
  cli_bairro: string;
  cli_cidade: string;
  cli_uf: string;
  cli_cep: string;
  cli_latitude: number | null;
  cli_longitude: number | null;
  gps_real: boolean;
  cli_fone1: string;
}

interface ClienteRota {
  cli_codigo: number;
  cli_nome: string;
  cli_fantasia: string;
  cli_bairro: string;
  cli_cidade: string;
  cli_uf: string;
  cli_latitude: number | null;
  cli_longitude: number | null;
  gps_real: boolean;
  regiao_nome: string;
}

interface Vendedor { ven_codigo: number; ven_nome: string; }
interface Regiao   { reg_codigo: number; reg_descricao: string; }

const DIAS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];

// ─── Mapa Leaflet ─────────────────────────────────────────────────────────────
function RotaMap({ paradas, kmTotal, center }: { paradas: Parada[]; kmTotal: number; center: [number, number] }) {
  const mapRef   = useRef<HTMLDivElement>(null);
  const leafRef  = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!leafRef.current) {
      leafRef.current = L.map(mapRef.current, { zoomControl: true }).setView(center, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(leafRef.current);
      layerRef.current = L.layerGroup().addTo(leafRef.current);
    }

    const map   = leafRef.current;
    const layer = layerRef.current!;
    layer.clearLayers();

    const withCoords = paradas.filter(p => p.cli_latitude && p.cli_longitude);
    if (withCoords.length === 0) return;

    const coords: [number, number][] = withCoords.map(p => [p.cli_latitude!, p.cli_longitude!]);

    // Markers numerados — mustard border = GPS real, cinza = coord. de cidade
    withCoords.forEach((p, idx) => {
      const borderColor = p.gps_real ? G.mustard : '#94a3b8';
      const bgColor     = p.gps_real ? G.text    : '#64748b';
      const icon = L.divIcon({
        html: `<div style="background:${bgColor};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,0.3)">${idx + 1}</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const coordLabel = p.gps_real ? '' : '<br/><i style="color:#94a3b8;font-size:10px">📍 coord. aproximada da cidade</i>';
      L.marker([p.cli_latitude!, p.cli_longitude!], { icon })
        .bindPopup(`<b>${p.cli_nome}</b><br/>${p.cli_endereco}${p.cli_endnum ? ', ' + p.cli_endnum : ''}<br/>${p.cli_bairro} — ${p.cli_cidade}/${p.cli_uf}${coordLabel}`)
        .addTo(layer);
    });

    // Linha da rota
    if (coords.length > 1) {
      L.polyline(coords, { color: G.mustard, weight: 3, opacity: 0.8, dashArray: '6,4' }).addTo(layer);
    }

    // Fit bounds
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [paradas]);

  // Cleanup
  useEffect(() => () => { leafRef.current?.remove(); leafRef.current = null; }, []);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }} />
      {kmTotal > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
          background: G.text, color: '#fff', borderRadius: 8, padding: '6px 12px',
          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          <Route size={13} style={{ color: G.mustard }} />
          ~{kmTotal.toFixed(0)} km estimados
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ItinerariosPage() {
  // Listas
  const [itinerarios, setItinerarios] = useState<Itinerario[]>([]);
  const [vendedores,  setVendedores]  = useState<Vendedor[]>([]);
  const [regioes,     setRegioes]     = useState<Regiao[]>([]);

  // Selecionado
  const [selected,    setSelected]    = useState<Itinerario | null>(null);
  const [paradas,     setParadas]     = useState<Parada[]>([]);

  // Clientes para montar rota
  const [clientes,      setClientes]      = useState<ClienteRota[]>([]);
  const [filtros,       setFiltros]       = useState({ regiao: '', setor: '', cidade: '', bairro: '', search: '' });
  const [setores,       setSetores]       = useState<{ set_codigo: number; set_nome: string; cid_nome?: string }[]>([]);
  const [cidadesRegiao, setCidadesRegiao] = useState<string[]>([]); // nomes das cidades da região selecionada

  // UI
  const [view,        setView]        = useState<'planner' | 'form'>('planner');
  const [editing,     setEditing]     = useState<Partial<Itinerario>>({});
  const [saving,      setSaving]      = useState(false);
  const [loadingCli,  setLoadingCli]  = useState(false);
  const [kmTotal,     setKmTotal]     = useState(0);
  const [dragOver,    setDragOver]    = useState<number | null>(null);
  const [mapCenter,   setMapCenter]   = useState<[number, number]>([-15.7801, -47.9292]); // Brasília como fallback
  const [showHelp,    setShowHelp]    = useState(false);
  const dragItem                      = useRef<number | null>(null);

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const loadItinerarios = useCallback(async () => {
    const res = await api.get('/itinerarios');
    setItinerarios(res.data.data || []);
  }, []);

  const loadParadas = useCallback(async (id: number) => {
    const res = await api.get(`/itinerarios/${id}/paradas`);
    const data: Parada[] = res.data.data || [];
    setParadas(data);
    calcKm(data);
  }, []);

  const loadClientes = useCallback(async () => {
    setLoadingCli(true);
    try {
      const params = new URLSearchParams();
      if (filtros.regiao)  params.append('regiao',  filtros.regiao);
      if (filtros.setor)   params.append('setor',   filtros.setor);
      if (filtros.cidade)  params.append('cidade',  filtros.cidade);
      if (filtros.bairro)  params.append('bairro',  filtros.bairro);
      if (filtros.search)  params.append('search',  filtros.search);
      const res = await api.get(`/itinerarios/clientes-rota?${params}`);
      setClientes(res.data.data || []);
    } finally { setLoadingCli(false); }
  }, [filtros]);

  useEffect(() => { loadItinerarios(); }, [loadItinerarios]);
  useEffect(() => {
    const t = setTimeout(() => loadClientes(), 350);
    return () => clearTimeout(t);
  }, [loadClientes]);

  // Carrega cidades da região selecionada para filtrar o dropdown de setores
  useEffect(() => {
    if (!filtros.regiao) { setCidadesRegiao([]); return; }
    api.get(`/regioes/${filtros.regiao}/cidades`)
      .then(r => setCidadesRegiao((r.data.data || []).map((c: any) => c.cid_nome as string)))
      .catch(() => setCidadesRegiao([]));
  }, [filtros.regiao]);

  useEffect(() => {
    api.get('/sellers?limit=100').then(r => setVendedores(r.data.data || [])).catch(() => {});
    api.get('/regioes').then(r => setRegioes(r.data.data || [])).catch(() => {});
    api.get('/setores?limit=500').then(r => setSetores(r.data.data || [])).catch(() => {});
    // Centralizar o mapa na cidade da empresa
    api.get('/empresa').then(async r => {
      const emp = r.data.data;
      if (!emp?.emp_cidade) return;
      const q = encodeURIComponent(`${emp.emp_cidade}, ${emp.emp_uf}, Brasil`);
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`).then(r => r.json()).catch(() => []);
      if (geo[0]) setMapCenter([parseFloat(geo[0].lat), parseFloat(geo[0].lon)]);
    }).catch(() => {});
  }, []);

  // ── Cálculo de distância (Haversine) ─────────────────────────────────────────
  function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function calcKm(stops: Parada[]) {
    const withCoords = stops.filter(p => p.cli_latitude && p.cli_longitude);
    if (withCoords.length < 2) { setKmTotal(0); return; }
    let total = 0;
    for (let i = 0; i < withCoords.length - 1; i++) {
      total += haversine(withCoords[i].cli_latitude!, withCoords[i].cli_longitude!, withCoords[i+1].cli_latitude!, withCoords[i+1].cli_longitude!);
    }
    setKmTotal(total * 1.3); // fator de correção de rota real vs linha reta
  }

  // ── Seleção de itinerário ─────────────────────────────────────────────────────
  const selectItinerario = async (it: Itinerario) => {
    setSelected(it);
    setView('planner');
    await loadParadas(it.iti_codigo);

    // Pré-filtrar clientes pela região do itinerário
    if (it.iti_regiao_id) {
      setFiltros(prev => ({ ...prev, regiao: String(it.iti_regiao_id), setor: '', cidade: '' }));

      // Centralizar mapa na primeira cidade da região
      try {
        const r = await api.get(`/regioes/${it.iti_regiao_id}/cidades`);
        const cidades = r.data.data || [];
        if (cidades.length > 0) {
          const cidade = cidades[0];
          const q = encodeURIComponent(`${cidade.cid_nome}, ${cidade.cid_uf}, Brasil`);
          const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`).then(r => r.json()).catch(() => []);
          if (geo[0]) setMapCenter([parseFloat(geo[0].lat), parseFloat(geo[0].lon)]);
        }
      } catch { /* mantém centro atual */ }
    } else {
      setFiltros(prev => ({ ...prev, regiao: '', setor: '' }));
    }
  };

  // ── Adicionar cliente à rota ──────────────────────────────────────────────────
  const addCliente = async (cli: ClienteRota) => {
    if (!selected) return;
    if (paradas.some(p => p.cli_codigo === cli.cli_codigo)) return;
    try {
      await api.post(`/itinerarios/${selected.iti_codigo}/paradas`, { cli_codigo: cli.cli_codigo });
      await loadParadas(selected.iti_codigo);
    } catch (err: any) { alert(err?.response?.data?.message || 'Erro.'); }
  };

  // ── Remover parada ────────────────────────────────────────────────────────────
  const removeParada = async (cliId: number) => {
    if (!selected) return;
    try {
      await api.delete(`/itinerarios/${selected.iti_codigo}/paradas/${cliId}`);
      await loadParadas(selected.iti_codigo);
    } catch { /* ignore */ }
  };

  // ── Drag & drop reorder ───────────────────────────────────────────────────────
  const onDragStart = (idx: number) => { dragItem.current = idx; };
  const onDragEnter = (idx: number) => setDragOver(idx);
  const onDrop = async () => {
    if (!selected || dragItem.current === null || dragItem.current === dragOver) { setDragOver(null); return; }
    const novo = [...paradas];
    const [moved] = novo.splice(dragItem.current, 1);
    novo.splice(dragOver!, 0, moved);
    setParadas(novo);
    setDragOver(null);
    dragItem.current = null;
    calcKm(novo);
    await api.put(`/itinerarios/${selected.iti_codigo}/paradas/reorder`, { ordem: novo.map(p => p.cli_codigo) });
  };

  // ── Salvar itinerário ─────────────────────────────────────────────────────────
  const saveItinerario = async () => {
    if (!editing.iti_descricao?.trim()) return;
    setSaving(true);
    try {
      if (editing.iti_codigo) {
        await api.put(`/itinerarios/${editing.iti_codigo}`, editing);
      } else {
        const res = await api.post('/itinerarios', editing);
        const novo = await api.get(`/itinerarios/${res.data.id}`);
        setSelected(novo.data.data);
        setParadas([]);
        setKmTotal(0);
      }
      await loadItinerarios();
      setView('planner');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  const deleteItinerario = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir este itinerário e todas as paradas?')) return;
    try {
      await api.delete(`/itinerarios/${id}`);
      if (selected?.iti_codigo === id) { setSelected(null); setParadas([]); }
      await loadItinerarios();
    } catch (err: any) { alert(err?.response?.data?.message || 'Erro.'); }
  };

  const setFiltro = (k: keyof typeof filtros, v: string) =>
    setFiltros(prev => ({
      ...prev,
      [k]: v,
      // Ao mudar região, reseta setor e cidade para evitar filtros conflitantes
      ...(k === 'regiao' ? { setor: '', cidade: '' } : {}),
    }));

  // ── Render ────────────────────────────────────────────────────────────────────
  const paradasSemCoord   = paradas.filter(p => !p.cli_latitude).length;
  const paradasCidadeCoord = paradas.filter(p => p.cli_latitude && !p.gps_real).length;

  return (
    <div style={{ display: 'flex', height: '100%', background: G.bg, overflow: 'hidden', fontFamily: 'inherit' }}>

      {/* ── Coluna esquerda: lista de itinerários ─────────────────────────────── */}
      <div style={{ width: 280, borderRight: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${G.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: G.text, textTransform: 'uppercase', letterSpacing: 1 }}>
              Itinerários
            </div>
            <button
              onClick={() => setShowHelp(true)}
              title="Como usar"
              style={{ background: 'transparent', border: `1px solid ${G.border}`, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: G.textSec, flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = G.mustard; e.currentTarget.style.color = G.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.textSec; }}
            >
              <HelpCircle size={13} />
            </button>
          </div>
          <button
            onClick={() => { setEditing({}); setView('form'); }}
            style={{ width: '100%', background: G.mustard, border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 800, cursor: 'pointer', color: G.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={14} /> Novo Itinerário
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {itinerarios.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: G.textMuted, fontSize: 12 }}>
              Nenhum itinerário ainda.<br />Crie o primeiro!
            </div>
          )}
          {itinerarios.map(it => (
            <div
              key={it.iti_codigo}
              onClick={() => selectItinerario(it)}
              style={{
                padding: '10px 16px', cursor: 'pointer', borderLeft: selected?.iti_codigo === it.iti_codigo ? `3px solid ${G.mustard}` : '3px solid transparent',
                background: selected?.iti_codigo === it.iti_codigo ? `${G.mustard}18` : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (selected?.iti_codigo !== it.iti_codigo) e.currentTarget.style.background = G.bg; }}
              onMouseLeave={e => { if (selected?.iti_codigo !== it.iti_codigo) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: G.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.iti_descricao}
                  </div>
                  {it.vendedor_nome && (
                    <div style={{ fontSize: 11, color: G.textSec, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={10} /> {it.vendedor_nome}
                    </div>
                  )}
                  {it.regiao_nome && (
                    <div style={{ fontSize: 11, color: G.textSec, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={10} /> {it.regiao_nome}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {it.iti_frequencia && (
                      <span style={{ fontSize: 10, background: `${G.mustard}33`, color: G.text, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                        {it.iti_frequencia.substring(0, 3).toUpperCase()}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: G.textMuted }}>
                      {it.total_paradas || 0} parada{it.total_paradas !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={e => deleteItinerario(it.iti_codigo, e)}
                  style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: G.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = G.danger}
                  onMouseLeave={e => e.currentTarget.style.color = G.textMuted}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Area central/direita ──────────────────────────────────────────────── */}
      {view === 'form' ? (
        /* ── Formulário de itinerário ─────────────────────────────────────────── */
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40, overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: `1px solid ${G.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.text, marginBottom: 24 }}>
              {editing.iti_codigo ? 'Editar Itinerário' : 'Novo Itinerário'}
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Nome *</label>
            <input
              style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16, background: G.bg, color: G.text, boxSizing: 'border-box' }}
              value={editing.iti_descricao || ''}
              onChange={e => setEditing(p => ({ ...p, iti_descricao: e.target.value }))}
              placeholder="Ex: ROTA NORTE — SEGUNDA"
              autoFocus
            />

            <label style={{ fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Vendedor</label>
            <select
              style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16, background: G.bg, color: G.text, boxSizing: 'border-box' }}
              value={editing.iti_vendedor_id || ''}
              onChange={e => setEditing(p => ({ ...p, iti_vendedor_id: e.target.value ? parseInt(e.target.value) : null }))}
            >
              <option value="">— Sem vendedor —</option>
              {vendedores.map(v => <option key={v.ven_codigo} value={v.ven_codigo}>{v.ven_nome}</option>)}
            </select>

            <label style={{ fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Região</label>
            <select
              style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16, background: G.bg, color: G.text, boxSizing: 'border-box' }}
              value={editing.iti_regiao_id || ''}
              onChange={e => setEditing(p => ({ ...p, iti_regiao_id: e.target.value ? parseInt(e.target.value) : null }))}
            >
              <option value="">— Sem região —</option>
              {regioes.map(r => <option key={r.reg_codigo} value={r.reg_codigo}>{r.reg_descricao}</option>)}
            </select>

            <label style={{ fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Dia da Semana</label>
            <select
              style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16, background: G.bg, color: G.text, boxSizing: 'border-box' }}
              value={editing.iti_frequencia || ''}
              onChange={e => setEditing(p => ({ ...p, iti_frequencia: e.target.value }))}
            >
              <option value="">— Sem dia fixo —</option>
              {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <label style={{ fontSize: 11, fontWeight: 700, color: G.textSec, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Observações</label>
            <textarea
              style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 24, background: G.bg, color: G.text, resize: 'vertical', minHeight: 72, boxSizing: 'border-box' }}
              value={editing.iti_observacao || ''}
              onChange={e => setEditing(p => ({ ...p, iti_observacao: e.target.value }))}
              placeholder="Cidades, bairros, observações..."
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setView('planner')} style={{ flex: 1, border: `1px solid ${G.border}`, background: 'transparent', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: G.textSec }}>
                Cancelar
              </button>
              <button onClick={saveItinerario} disabled={saving} style={{ flex: 2, background: G.mustard, border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', color: G.text }}>
                {saving ? 'Salvando...' : 'Salvar Itinerário'}
              </button>
            </div>
          </div>
        </div>

      ) : selected ? (
        /* ── Planner: mapa + paradas + clientes ───────────────────────────────── */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Painel esquerdo: Paradas da rota */}
          <div style={{ width: 300, borderRight: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', background: '#fafaf8', flexShrink: 0 }}>
            <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${G.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: G.text, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Rota: {selected.iti_descricao}
                </span>
                <button
                  onClick={() => { setEditing(selected); setView('form'); }}
                  style={{ fontSize: 10, color: G.textSec, background: 'transparent', border: `1px solid ${G.border}`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                >
                  Editar
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: G.textSec }}>
                <span><b style={{ color: G.text }}>{paradas.length}</b> paradas</span>
                {kmTotal > 0 && <span><b style={{ color: G.text }}>~{kmTotal.toFixed(0)}km</b></span>}
                {paradasCidadeCoord > 0 && <span style={{ color: '#94a3b8' }}>📍 {paradasCidadeCoord} aprox.</span>}
                {paradasSemCoord > 0 && <span style={{ color: '#e07b00' }}>⚠ {paradasSemCoord} sem coord.</span>}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {paradas.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: G.textMuted, fontSize: 12 }}>
                  Adicione clientes da lista ao lado →
                </div>
              )}
              {paradas.map((p, idx) => (
                <div
                  key={p.cli_codigo}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragEnter={() => onDragEnter(idx)}
                  onDragEnd={onDrop}
                  onDragOver={e => e.preventDefault()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                    borderBottom: `1px solid ${G.border}`,
                    background: dragOver === idx ? `${G.mustard}22` : 'transparent',
                    cursor: 'grab', transition: 'background 0.1s',
                  }}
                >
                  <GripVertical size={12} style={{ color: G.textMuted, flexShrink: 0 }} />
                  <div style={{ width: 22, height: 22, background: G.text, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff', border: `2px solid ${G.mustard}`, flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cli_nome}</div>
                    <div style={{ fontSize: 10, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.cli_bairro ? `${p.cli_bairro} · ` : ''}{p.cli_cidade}/{p.cli_uf}
                    </div>
                    {!p.cli_latitude
                      ? <div style={{ fontSize: 9, color: '#e07b00', fontWeight: 700 }}>⚠ sem coordenada</div>
                      : !p.gps_real && <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>📍 coord. de cidade</div>
                    }
                  </div>
                  <button
                    onClick={() => removeParada(p.cli_codigo)}
                    style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: G.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = G.danger}
                    onMouseLeave={e => e.currentTarget.style.color = G.textMuted}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Centro: Mapa */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: 16 }}>
              <RotaMap paradas={paradas} kmTotal={kmTotal} center={mapCenter} />
            </div>
          </div>

          {/* Painel direito: Busca de clientes */}
          <div style={{ width: 300, borderLeft: `1px solid ${G.border}`, display: 'flex', flexDirection: 'column', background: '#fafaf8', flexShrink: 0 }}>
            <div style={{ padding: '16px 16px 10px', borderBottom: `1px solid ${G.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: G.text, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                Adicionar Clientes
              </div>

              {/* Filtros */}
              <select
                style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 11, background: '#fff', color: G.text, marginBottom: 6 }}
                value={filtros.regiao}
                onChange={e => setFiltro('regiao', e.target.value)}
              >
                <option value="">Todas as regiões</option>
                {regioes.map(r => <option key={r.reg_codigo} value={r.reg_codigo}>{r.reg_descricao}</option>)}
              </select>

              <select
                style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 11, background: '#fff', color: G.text, marginBottom: 6 }}
                value={filtros.setor}
                onChange={e => setFiltro('setor', e.target.value)}
              >
                <option value="">Todos os setores/bairros</option>
                {(cidadesRegiao.length > 0
                  ? setores.filter(s => !s.cid_nome || cidadesRegiao.includes(s.cid_nome))
                  : setores
                ).map(s => (
                  <option key={s.set_codigo} value={s.set_codigo}>
                    {s.set_nome}{s.cid_nome ? ` — ${s.cid_nome}` : ''}
                  </option>
                ))}
              </select>

              <input
                style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 11, background: '#fff', color: G.text, marginBottom: 6, boxSizing: 'border-box' }}
                placeholder="Filtrar por cidade..."
                value={filtros.cidade}
                onChange={e => setFiltro('cidade', e.target.value)}
              />

              <input
                style={{ width: '100%', border: `1px solid ${G.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 11, background: '#fff', color: G.text, boxSizing: 'border-box' }}
                placeholder="Buscar cliente..."
                value={filtros.search}
                onChange={e => setFiltro('search', e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingCli && <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: G.textMuted }}>Carregando...</div>}
              {!loadingCli && clientes.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: G.textMuted }}>Nenhum cliente encontrado.</div>
              )}
              {!loadingCli && clientes.map(cli => {
                const jaAdicionado = paradas.some(p => p.cli_codigo === cli.cli_codigo);
                const semCoord     = !cli.cli_latitude;
                const coordCidade  = cli.cli_latitude && !cli.gps_real;
                const pinColor     = jaAdicionado ? G.success : semCoord ? '#e07b00' : coordCidade ? '#94a3b8' : G.mustard;
                return (
                  <div
                    key={cli.cli_codigo}
                    onClick={() => !jaAdicionado && addCliente(cli)}
                    style={{
                      padding: '7px 12px', borderBottom: `1px solid ${G.border}`,
                      cursor: jaAdicionado ? 'default' : 'pointer',
                      opacity: jaAdicionado ? 0.45 : 1,
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: jaAdicionado ? `${G.mustard}10` : 'transparent',
                    }}
                    onMouseEnter={e => { if (!jaAdicionado) e.currentTarget.style.background = `${G.mustard}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = jaAdicionado ? `${G.mustard}10` : 'transparent'; }}
                  >
                    <MapPin size={11} style={{ color: pinColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: G.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cli.cli_nome}
                      </div>
                      <div style={{ fontSize: 10, color: G.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(cli as any).setor_nome
                          ? <span style={{ color: G.mustard, fontWeight: 700 }}>{(cli as any).setor_nome} · </span>
                          : cli.cli_bairro ? `${cli.cli_bairro} · ` : ''}
                        {cli.cli_cidade}/{cli.cli_uf}
                      </div>
                      {semCoord    && <div style={{ fontSize: 9, color: '#e07b00', fontWeight: 700 }}>⚠ sem coordenada</div>}
                      {coordCidade && <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>📍 coord. de cidade</div>}
                    </div>
                    {jaAdicionado
                      ? <span style={{ fontSize: 9, fontWeight: 800, color: G.success, flexShrink: 0 }}>✓</span>
                      : <ChevronRight size={11} style={{ color: G.textMuted, flexShrink: 0 }} />
                    }
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '8px 12px', borderTop: `1px solid ${G.border}`, fontSize: 10, color: G.textMuted }}>
              {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} encontrado{clientes.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

      ) : (
        /* ── Tela inicial: nenhum itinerário selecionado ─────────────────────── */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: G.textMuted }}>
          <Navigation size={48} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Selecione ou crie um itinerário</div>
          <div style={{ fontSize: 12 }}>Monte a rota de visitas para cada vendedor</div>
        </div>
      )}

      {/* ── Modal de Ajuda ───────────────────────────────────────────────────── */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: `1px solid ${G.border}` }}
          >
            {/* Header do modal */}
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: G.text }}>Como usar — Itinerários de Visita</div>
                <div style={{ fontSize: 11, color: G.textSec, marginTop: 2 }}>Monte e gerencie rotas de visita para seus vendedores</div>
              </div>
              <button onClick={() => setShowHelp(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: G.textMuted, display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {[
                {
                  step: '1',
                  title: 'Crie um itinerário',
                  desc: 'Clique em "+ Novo Itinerário" e defina o nome, vendedor responsável, região e o dia da semana em que a rota é percorrida.',
                },
                {
                  step: '2',
                  title: 'Selecione o itinerário na lista',
                  desc: 'Clique sobre um itinerário à esquerda para abrir o planejador. O mapa centraliza automaticamente na região configurada.',
                },
                {
                  step: '3',
                  title: 'Filtre e adicione clientes',
                  desc: 'Use os filtros à direita (região, setor, cidade, busca) para localizar os clientes. Clique sobre um cliente para adicioná-lo à rota. Clientes já adicionados aparecem esmaecidos com ✓ verde.',
                },
                {
                  step: '4',
                  title: 'Reordene as paradas',
                  desc: 'Arraste as paradas pelo ícone ⠿ no painel central para definir a sequência ideal da rota. A distância estimada é calculada automaticamente.',
                },
                {
                  step: '5',
                  title: 'Visualize no mapa',
                  desc: 'Os marcadores numerados mostram a ordem das paradas. A linha tracejada indica o trajeto entre elas e o total de km estimados aparece no canto inferior.',
                },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: G.mustard, color: G.text, fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.step}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: G.text, marginBottom: 3 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: G.textSec, lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              ))}

              {/* Legenda de ícones */}
              <div style={{ background: G.bg, borderRadius: 10, padding: '14px 16px', marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: G.text, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Legenda do mapa</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { cor: G.mustard, borda: G.mustard, label: 'GPS real', desc: 'coordenada exata do cliente (coletada em campo)' },
                    { cor: '#64748b', borda: '#94a3b8', label: 'Coord. de cidade', desc: 'posição aproximada — centroide do município' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: item.cor === G.mustard ? G.text : item.cor, border: `2px solid ${item.borda}`, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: G.text }}>
                        <b>{item.label}</b> — <span style={{ color: G.textSec }}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e07b00', border: `2px solid #e07b00`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>!</span>
                    </div>
                    <div style={{ fontSize: 12, color: G.text }}>
                      <b>Sem coordenada</b> — <span style={{ color: G.textSec }}>cliente não aparece no mapa</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: G.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
                Clique fora deste painel ou no ✕ para fechar.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
