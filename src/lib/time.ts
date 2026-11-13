/** Timezone helpers built on Intl, so business-local times are always correct. */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = DOW;

function parts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const m = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour: Number(m.hour) % 24,
    minute: Number(m.minute),
    second: Number(m.second),
    dow: DOW.indexOf(m.weekday as (typeof DOW)[number]),
  };
}

function offsetMs(date: Date, tz: string) {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-14T15:30" wall time in `tz` -> UTC Date. */
export function zonedInputToDate(local: string, tz: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) throw new Error("Invalid date/time");
  const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[];
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  let result = guess - offsetMs(new Date(guess), tz);
  const second = guess - offsetMs(new Date(result), tz);
  if (second !== result) result = second;
  return new Date(result);
}

/** UTC Date -> "2026-11-14T15:30" wall time in `tz` (for datetime-local inputs). */
export function dateToZonedInput(date: Date | string, tz: string): string {
  const p = parts(new Date(date), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function zonedDayAndMinutes(date: Date, tz: string) {
  const p = parts(date, tz);
  return { dow: p.dow, minutes: p.hour * 60 + p.minute, ymd: `${p.year}-${p.month}-${p.day}` };
}

export function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

export function formatHHMM(hhmm: string) {
  const mins = hhmmToMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

export function formatTime(date: Date | string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
    new Date(date),
  );
}

/** "Today", "Tomorrow", or "Fri, Nov 14" relative to now, in `tz`. */
export function formatDay(date: Date | string, tz: string, now = new Date()) {
  const d = new Date(date);
  const a = zonedDayAndMinutes(d, tz).ymd;
  if (a === zonedDayAndMinutes(now, tz).ymd) return "Today";
  if (a === zonedDayAndMinutes(new Date(now.getTime() + 86400000), tz).ymd) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
}

export function formatDayTime(date: Date | string, tz: string, now = new Date()) {
  return `${formatDay(date, tz, now)} · ${formatTime(date, tz)}`;
}

export function formatDate(date: Date | string, tz = "America/Chicago") {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }).format(
    new Date(date),
  );
}

export function formatDateTime(date: Date | string, tz = "America/Chicago") {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/** "in 2h 15m", "in 3 days", "ended" */
export function timeLeft(date: Date | string, now = new Date()) {
  const ms = new Date(date).getTime() - now.getTime();
  if (ms <= 0) return "ended";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function relativeAgo(date: Date | string, now = new Date()) {
  const s = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(date);
}

/** "Mon–Thu" style compression of a set of weekday numbers. */
export function formatDays(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "0,6") return "Weekends";
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs.at(-1);
    if (last && d === last.at(-1)! + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((r) => (r.length >= 3 ? `${DOW[r[0]!]}–${DOW[r.at(-1)!]}` : r.map((d) => DOW[d]).join(", ")))
    .join(", ");
}
