"use client";
import { useMemo, useRef, useState } from "react";

export interface LineSeries {
  name: string;
  color: string; // validated categorical slot
  values: number[];
}

/** Multi-series line chart (one y-axis), crosshair + tooltip, legend + direct end labels, table fallback. */
export function LineChart({ labels, series, height = 220, title }: { labels: string[]; series: LineSeries[]; height?: number; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 32, r: 92, t: 12, b: 24 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(max / Math.max(1, Math.pow(10, Math.floor(Math.log10(max))) / 2)) * Math.max(1, Math.pow(10, Math.floor(Math.log10(max))) / 2);
  const x = (i: number) => pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const ticks = [0, niceMax / 2, niceMax];
  const paths = useMemo(
    () => series.map((s) => s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, labels.length, niceMax],
  );
  const step = Math.ceil(labels.length / 6);

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap gap-4" aria-label="Legend">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-0.5 w-5 rounded" style={{ background: s.color }} aria-hidden /> {s.name}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        className="relative"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (labels.length - 1));
          setHover(Math.min(labels.length - 1, Math.max(0, i)));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e6e0" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b6e66">{Math.round(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % step === 0 || i === labels.length - 1 ? (
            <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="#6b6e66">{l}</text>
          ) : null))}
          {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#191919" strokeOpacity={0.25} /> : null}
          {series.map((s, si) => (
            <g key={s.name}>
              <path d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <text x={x(labels.length - 1) + 8} y={y(s.values.at(-1) ?? 0) + 4 + (si ? 12 : -2) * (Math.abs(y(series[0]!.values.at(-1) ?? 0) - y(series[1]?.values.at(-1) ?? 0)) < 14 ? 1 : 0)} fontSize={12} fontWeight={700} fill="#191919">
                {s.name}
              </text>
              {hover != null ? <circle cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} /> : null}
            </g>
          ))}
        </svg>
        {hover != null ? (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-[var(--shadow-lift)]"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
          >
            <p className="font-bold">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden /> {s.name}: <strong className="tabular">{s.values[hover]}</strong>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink">View as table</summary>
        <div className="max-h-64 overflow-auto">
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead><tr className="text-muted"><th className="py-1 font-medium">Date</th>{series.map((s) => <th key={s.name} className="py-1 text-right font-medium">{s.name}</th>)}</tr></thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l + i} className="border-t border-line">
                  <td className="py-1">{l}</td>
                  {series.map((s) => <td key={s.name} className="py-1 text-right tabular">{s.values[i]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
