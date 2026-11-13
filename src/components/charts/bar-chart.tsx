"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface BarDatum {
  key: string;
  label: string; // axis label
  value: number;
  display: string; // formatted value for tooltip/label
  detail?: string;
  highlight?: boolean;
}

/** Single-series column chart: thin rounded bars, hover tooltip, recessive axis, table fallback. */
export function BarChart({ data, title, height = 180 }: { data: BarDatum[]; title: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="m-0">
      <div className="relative flex items-end gap-2" style={{ height }} role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${d.display}`).join(", ")}`}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
        {data.map((d, i) => {
          const h = d.value === 0 ? 0 : Math.max(4, (d.value / max) * (height - 28));
          return (
            <div
              key={d.key}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${d.label}: ${d.display}`}
            >
              {d.highlight || hover === i ? (
                <span className="absolute z-10 rounded-lg bg-ink px-2 py-1 text-[11px] font-bold whitespace-nowrap text-white shadow" style={{ bottom: h + 8 }}>
                  {d.display}
                  {d.detail ? <span className="font-normal text-white/70"> · {d.detail}</span> : null}
                </span>
              ) : null}
              <div
                className={cn("w-full max-w-10 rounded-t-[4px] transition-[height,background] duration-500", d.highlight ? "bg-lime" : hover === i ? "bg-lime-ink" : "bg-lime-ink/80")}
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2" aria-hidden>
        {data.map((d) => (
          <span key={d.key} className={cn("flex-1 text-center text-xs", d.highlight ? "font-bold text-ink" : "text-muted")}>{d.label}</span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">View as table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-line last:border-0">
                <th scope="row" className="py-1.5 font-medium">{d.label}</th>
                <td className="py-1.5 text-right tabular">{d.display}{d.detail ? ` (${d.detail})` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
