/** Towns Frugal Center has launched in. Each one's launch areas (ZIPs) are grouped around it. */
export const MARKETS = [
  { name: "Dracut", zip: "01826", label: "Dracut Center", lat: 42.6708, lng: -71.3028 },
  { name: "Wakefield", zip: "01880", label: "Wakefield", lat: 42.5065, lng: -71.0723 },
] as const;

export type Market = (typeof MARKETS)[number];

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestMarket(p: { lat: number; lng: number }): Market {
  return MARKETS.reduce((best, m) => (milesBetween(p, m) < milesBetween(p, best) ? m : best), MARKETS[0] as Market);
}
