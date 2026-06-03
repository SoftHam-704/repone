// src/mobile/lib/rota.ts
// Helpers de cálculo de distância e geração de URLs do Google Maps para Rotas mobile.

export interface PontoGeo {
  lat: number | null;
  lng: number | null;
}

/** Distância em km entre dois pontos (fórmula de Haversine, linha reta). */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Soma das distâncias entre paradas consecutivas, com fator de correção 1.3
 * (rota real vs linha reta) — mesma lógica usada na ItinerariosPage do web.
 */
export function calcKm(stops: PontoGeo[]): number {
  const c = stops.filter((s) => s.lat && s.lng) as { lat: number; lng: number }[];
  if (c.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < c.length - 1; i++) {
    total += haversine(c[i].lat, c[i].lng, c[i + 1].lat, c[i + 1].lng);
  }
  return total * 1.3;
}

// Google Maps Directions API (api=1) aceita destino + até ~9 waypoints.
const MAX_STOPS = 10;

/**
 * URL do Google Maps com TODAS as paradas como waypoints na ordem.
 * Origem omitida = localização atual do dispositivo.
 * Retorna '' se não houver parada com coordenada.
 * Se exceder MAX_STOPS, usa as primeiras (quem chama avisa o usuário).
 */
export function mapsUrlRotaInteira(stops: PontoGeo[]): string {
  const valid = stops.filter((s) => s.lat && s.lng) as { lat: number; lng: number }[];
  if (valid.length === 0) return '';
  const limited = valid.slice(0, MAX_STOPS);
  const destination = limited[limited.length - 1];
  const waypoints = limited
    .slice(0, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');
  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

/** Quantidade de paradas que NÃO cabem no link multi-parada (para avisar o REP). */
export function paradasForaDoLink(stops: PontoGeo[]): number {
  const valid = stops.filter((s) => s.lat && s.lng);
  return Math.max(0, valid.length - MAX_STOPS);
}

/** URL do Google Maps navegando até UM cliente (origem = localização atual). */
export function mapsUrlCliente(p: PontoGeo): string {
  if (!p.lat || !p.lng) return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
}
