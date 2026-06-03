// src/mobile/components/RotaMap.tsx
import { useEffect, useRef } from 'react';
import { Route } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrige ícone padrão quebrado pelo bundler
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const NAVY = '#28374A';
const MUSTARD = '#FFD200';

export interface ParadaMapa {
  cli_nome: string;
  cli_endereco: string;
  cli_endnum: string;
  cli_bairro: string;
  cli_cidade: string;
  cli_uf: string;
  cli_latitude: number | null;
  cli_longitude: number | null;
  gps_real: boolean;
}

export function RotaMap({
  paradas,
  kmTotal,
  center,
}: {
  paradas: ParadaMapa[];
  kmTotal: number;
  center: [number, number];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<L.Map | null>(null);
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

    const map = leafRef.current;
    const layer = layerRef.current!;
    layer.clearLayers();

    const withCoords = paradas.filter((p) => p.cli_latitude && p.cli_longitude);
    if (withCoords.length === 0) return;

    const coords: [number, number][] = withCoords.map((p) => [p.cli_latitude!, p.cli_longitude!]);

    withCoords.forEach((p, idx) => {
      const borderColor = p.gps_real ? MUSTARD : '#94a3b8';
      const bgColor = p.gps_real ? NAVY : '#64748b';
      const icon = L.divIcon({
        html: `<div style="background:${bgColor};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,0.3)">${idx + 1}</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const coordLabel = p.gps_real
        ? ''
        : '<br/><i style="color:#94a3b8;font-size:10px">📍 coord. aproximada da cidade</i>';
      L.marker([p.cli_latitude!, p.cli_longitude!], { icon })
        .bindPopup(
          `<b>${p.cli_nome}</b><br/>${p.cli_endereco}${p.cli_endnum ? ', ' + p.cli_endnum : ''}<br/>${p.cli_bairro} — ${p.cli_cidade}/${p.cli_uf}${coordLabel}`
        )
        .addTo(layer);
    });

    if (coords.length > 1) {
      L.polyline(coords, { color: MUSTARD, weight: 3, opacity: 0.8, dashArray: '6,4' }).addTo(layer);
    }

    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
  }, [paradas]);

  useEffect(
    () => () => {
      leafRef.current?.remove();
      leafRef.current = null;
    },
    []
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', overflow: 'hidden' }} />
      {kmTotal > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 1000,
            background: NAVY,
            color: '#fff',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <Route size={13} style={{ color: MUSTARD }} />~{kmTotal.toFixed(0)} km estimados
        </div>
      )}
    </div>
  );
}
