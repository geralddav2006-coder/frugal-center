"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO',
        subdomains: "abcd",
      }).addTo(map);
      const icon = L.divIcon({ className: "", html: `<span class="fc-pin is-active">${label.replace(/[<>&]/g, "")}</span>`, iconSize: [0, 0] });
      L.marker([lat, lng], { icon }).addTo(map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, label]);
  return <div ref={el} className="absolute inset-0" role="img" aria-label={`Map showing ${label}`} />;
}
