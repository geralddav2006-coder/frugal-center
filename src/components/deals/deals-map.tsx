"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

export interface MapDeal {
  id: string;
  lat: number;
  lng: number;
  price: string;
  title: string;
  business: string;
  image: string | null;
  original: string | null;
  distance: string | null;
}

/** Leaflet map with Airbnb-style price pins. Tiles: CARTO Positron (OpenStreetMap data). */
export function DealsMap({ deals, center, className }: { deals: MapDeal[]; center: { lat: number; lng: number }; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const [active, setActive] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 13);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(m);
      let errors = 0;
      tiles.on("tileerror", () => {
        if (++errors > 8) setFailed(true);
      });
      L.circleMarker([center.lat, center.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#191919", fillOpacity: 1 })
        .addTo(m)
        .bindTooltip("You", { direction: "top" });
      const bounds = L.latLngBounds([[center.lat, center.lng]]);
      for (const d of deals) {
        const icon = L.divIcon({ className: "", html: `<span class="fc-pin" data-id="${d.id}">${d.price.replace(/</g, "")}</span>`, iconSize: [0, 0] });
        const marker = L.marker([d.lat, d.lng], { icon, keyboard: true, title: `${d.business}: ${d.title}` }).addTo(m);
        marker.on("click", () => setActive(d.id));
        markers.current[d.id] = marker;
        bounds.extend([d.lat, d.lng]);
      }
      if (deals.length) m.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current = {};
    };
  }, [deals, center.lat, center.lng]);

  useEffect(() => {
    document.querySelectorAll(".fc-pin").forEach((n) => n.classList.toggle("is-active", (n as HTMLElement).dataset.id === active));
  }, [active]);

  const sel = deals.find((d) => d.id === active);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={el} className="absolute inset-0" role="application" aria-label="Map of nearby deals" />
      {failed ? (
        <p className="absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold shadow">Map tiles couldn&apos;t load. Pins still show deal locations.</p>
      ) : null}
      {sel ? (
        <Link href={`/deals/${sel.id}`} className="absolute inset-x-3 bottom-3 z-[500] mx-auto flex max-w-sm gap-3 rounded-2xl bg-white p-2.5 shadow-[var(--shadow-lift)] sm:bottom-6">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-mist">
            {sel.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sel.image} alt="" className="size-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            ) : null}
          </div>
          <div className="min-w-0 py-1">
            <p className="truncate text-xs font-semibold text-muted">{sel.business}{sel.distance ? ` · ${sel.distance}` : ""}</p>
            <p className="truncate font-bold">{sel.title}</p>
            <p className="mt-0.5 text-sm"><span className="font-extrabold">{sel.price}</span> {sel.original ? <span className="text-muted line-through">{sel.original}</span> : null}</p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
