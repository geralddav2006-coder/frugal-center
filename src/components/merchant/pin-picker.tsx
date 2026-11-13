"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/** Click or drag to set the exact storefront location. */
export function PinPicker({ lat, lng, onChange }: { lat: number; lng: number; onChange: (p: { lat: number; lng: number }) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<{ move: (lat: number, lng: number) => void } | null>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO" }).addTo(map);
      const icon = L.divIcon({ className: "", html: `<span class="fc-pin is-active">Your business</span>`, iconSize: [0, 0] });
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
      const set = (p: { lat: number; lng: number }) => cb.current({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
      marker.on("dragend", () => set(marker.getLatLng()));
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        set(e.latlng);
      });
      api.current = { move: (a, b) => { marker.setLatLng([a, b]); map?.setView([a, b]); } };
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.move(lat, lng);
  }, [lat, lng]);

  return <div ref={el} className="h-56 w-full overflow-hidden rounded-2xl border border-line bg-mist" role="application" aria-label="Map: click to set your business location" />;
}
