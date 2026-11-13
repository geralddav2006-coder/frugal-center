"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Keyboard, Loader2, RotateCcw, ScanLine, ShieldAlert, User } from "lucide-react";
import { confirmRedemptionAction, lookupVoucherAction } from "@/app/actions/merchant";
import type { VoucherLookup } from "@/server/services/redemption";
import { DEAL_TYPE_META, expectedFinalCents, windowLabel } from "@/lib/deals";
import { formatDateTime, formatDayTime } from "@/lib/time";
import { formatMoney } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QrScanner } from "./qr-scanner";

type Method = "qr" | "code";
type Done = { savingsCents: number; originalCents: number; finalCents: number; title: string };

const CODE_RE = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

function formatCodeInput(raw: string) {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

export function Redeemer({ initialToken }: { initialToken: string | null }) {
  const [tab, setTab] = useState<Method>(initialToken ? "qr" : "qr");
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<{ v: VoucherLookup; method: Method } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [orig, setOrig] = useState("");
  const [final, setFinal] = useState("");
  const [pending, start] = useTransition();
  const lastScan = useRef<{ text: string; at: number } | null>(null);

  const doLookup = useCallback((method: Method, input: string) => {
    start(async () => {
      setError(null);
      const res = await lookupVoucherAction(method, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLookup({ v: res.voucher, method });
      setOrig("");
      setFinal("");
    });
  }, []);

  useEffect(() => {
    if (initialToken) doLookup("qr", initialToken);
  }, [initialToken, doLookup]);

  const onScan = (text: string) => {
    const now = Date.now();
    if (pending || lookup || done) return;
    if (lastScan.current && lastScan.current.text === text && now - lastScan.current.at < 4000) return;
    lastScan.current = { text, at: now };
    navigator.vibrate?.(40);
    doLookup("qr", text);
  };

  const reset = () => {
    setLookup(null);
    setDone(null);
    setError(null);
    setCode("");
    lastScan.current = null;
  };

  const confirm = () => {
    if (!lookup) return;
    const v = lookup.v;
    const toCents = (s: string) => Math.round(Number(s) * 100);
    if (v.requiresAmounts) {
      const o = toCents(orig);
      if (!orig || !Number.isFinite(o) || o <= 0) return setError("Enter the bill total before the discount.");
      const f = final ? toCents(final) : expectedFinalCents(v.terms, o);
      if (f > o) return setError("The discounted total can't be more than the original total.");
    }
    start(async () => {
      setError(null);
      const o = v.requiresAmounts ? toCents(orig) : null;
      const res = await confirmRedemptionAction({
        claimId: v.claimId,
        method: lookup.method,
        originalCents: o,
        finalCents: v.requiresAmounts ? (final ? toCents(final) : expectedFinalCents(v.terms, o!)) : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      navigator.vibrate?.([30, 40, 30]);
      setDone({ savingsCents: res.savingsCents, originalCents: res.originalCents, finalCents: res.finalCents, title: res.title });
    });
  };

  if (done) {
    return (
      <div className="rounded-[28px] bg-lime p-8 text-center" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto size-16" aria-hidden />
        <h2 className="mt-3 text-3xl font-extrabold">Redemption Successful</h2>
        <p className="mt-1 text-lg font-semibold">{done.title}</p>
        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/70 p-4"><p className="text-xs font-semibold">Collect from customer</p><p className="text-2xl font-extrabold tabular">{formatMoney(done.finalCents, { exact: true })}</p></div>
          <div className="rounded-2xl bg-white/70 p-4"><p className="text-xs font-semibold">Customer saved</p><p className="text-2xl font-extrabold tabular">{formatMoney(done.savingsCents, { exact: true })}</p></div>
        </div>
        <p className="mt-4 text-sm">The voucher is now used and can&apos;t be redeemed again.</p>
        <Button size="lg" className="mt-6" onClick={reset}><RotateCcw /> Redeem another</Button>
      </div>
    );
  }

  if (lookup) {
    const v = lookup.v;
    const t = v.terms;
    const o = Number(orig) > 0 ? Math.round(Number(orig) * 100) : null;
    const expected = o ? expectedFinalCents(t, o) : null;
    return (
      <div className="overflow-hidden rounded-[24px] border border-line bg-white" aria-live="polite">
        <div className={`flex items-center gap-3 p-5 ${v.canRedeem ? "bg-ink text-white" : "bg-[#fde8e7] text-danger"}`}>
          {v.canRedeem ? <CheckCircle2 className="size-6 text-lime" aria-hidden /> : <ShieldAlert className="size-6" aria-hidden />}
          <div>
            <p className="font-extrabold">{v.canRedeem ? "Valid voucher" : "Can't redeem"}</p>
            <p className={`text-sm ${v.canRedeem ? "text-white/70" : ""}`}>{v.canRedeem ? `Found by ${lookup.method === "qr" ? "QR scan" : "code"}. Check the details, then confirm.` : v.blockReason}</p>
          </div>
          <Badge variant={v.status === "active" ? "lime" : v.status === "redeemed" ? "success" : "danger"} className="ml-auto capitalize">{v.status}</Badge>
        </div>
        <div className="grid gap-4 p-5">
          <div>
            <p className="text-xs font-semibold text-muted">{DEAL_TYPE_META[t.type].label}</p>
            <p className="text-xl font-extrabold">{t.title}</p>
            <p className="text-[15px] font-semibold">{v.priceLabel}</p>
          </div>
          <dl className="grid gap-2 rounded-2xl bg-paper p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-muted"><User className="size-4" aria-hidden />Customer</dt><dd className="font-semibold">{v.customerName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Claimed</dt><dd className="font-semibold">{formatDateTime(v.claimedAt, t.timezone)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Valid until</dt><dd className="font-semibold">{formatDateTime(v.expiresAt, t.timezone)}</dd></div>
            {t.slot_starts_at ? <div className="flex justify-between gap-3"><dt className="flex items-center gap-1.5 text-muted"><CalendarClock className="size-4" aria-hidden />Appointment</dt><dd className="font-semibold">{formatDayTime(t.slot_starts_at, t.timezone)}</dd></div> : null}
            {t.type === "slow_hours" ? <div className="flex justify-between gap-3"><dt className="text-muted">Valid hours</dt><dd className="font-semibold">{windowLabel(t)}</dd></div> : null}
            {v.redeemedAt ? <div className="flex justify-between gap-3"><dt className="text-muted">Redeemed</dt><dd className="font-semibold">{formatDateTime(v.redeemedAt, t.timezone)}</dd></div> : null}
            {v.redemption ? <div className="flex justify-between gap-3"><dt className="text-muted">Paid / saved</dt><dd className="font-semibold">{formatMoney(v.redemption.final_amount_cents, { exact: true })} / {formatMoney(v.redemption.savings_cents, { exact: true })}</dd></div> : null}
          </dl>
          {t.restrictions ? <p className="text-sm text-muted">{t.restrictions}</p> : null}

          {v.canRedeem && v.requiresAmounts ? (
            <div className="grid gap-3 rounded-2xl border border-line p-4">
              <p className="text-sm font-bold">Confirm the transaction amounts</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bill before discount" htmlFor="r-orig">
                  <Input id="r-orig" inputMode="decimal" value={orig} placeholder="0.00" onChange={(e) => setOrig(e.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
                <Field label="Customer pays" htmlFor="r-final" hint={expected != null ? `Expected ${formatMoney(expected, { exact: true })}` : undefined}>
                  <Input id="r-final" inputMode="decimal" value={final} placeholder={expected != null ? (expected / 100).toFixed(2) : "0.00"} onChange={(e) => setFinal(e.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
              </div>
            </div>
          ) : null}
          {v.canRedeem && v.fixedAmounts ? (
            <p className="rounded-2xl bg-lime-soft p-4 text-[15px]">Collect <strong>{formatMoney(v.fixedAmounts.finalCents, { exact: true })}</strong> from the customer (regular {formatMoney(v.fixedAmounts.originalCents, { exact: true })}).</p>
          ) : null}

          {error ? <p className="flex gap-2 rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert"><AlertTriangle className="size-4 shrink-0" aria-hidden />{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" onClick={reset}>{v.canRedeem ? "Cancel" : "Scan another"}</Button>
            {v.canRedeem ? (
              <Button variant="lime" size="lg" className="flex-1" disabled={pending} onClick={confirm}>
                {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Confirm redemption
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const codeOk = CODE_RE.test(code);
  return (
    <Tabs value={tab} onValueChange={(x) => { setTab(x as Method); setError(null); }}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="qr"><ScanLine /> Scan QR</TabsTrigger>
        <TabsTrigger value="code"><Keyboard /> Enter Code</TabsTrigger>
      </TabsList>
      <TabsContent value="qr" className="mt-5">
        {tab === "qr" ? <QrScanner onResult={onScan} paused={pending} /> : null}
        {pending ? <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> Checking voucher…</p> : null}
      </TabsContent>
      <TabsContent value="code" className="mt-5">
        <form
          className="grid gap-4 rounded-[24px] border border-line bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!codeOk) {
              setError(code.length < 9 ? "Codes have 8 characters, like K7QM-X2PA." : "Codes never contain 0, 1, I, L or O — check for look-alike characters.");
              return;
            }
            doLookup("code", code);
          }}
        >
          <label htmlFor="code" className="text-sm font-bold">Customer&apos;s code</label>
          <input
            id="code"
            value={code}
            onChange={(e) => { setCode(formatCodeInput(e.target.value)); setError(null); }}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder="XXXX-XXXX"
            aria-describedby="code-help"
            className="h-20 w-full rounded-2xl border border-line text-center font-mono text-4xl font-bold tracking-[0.15em] uppercase outline-none placeholder:text-mist focus:border-ink focus:ring-4 focus:ring-ink/10"
          />
          <p id="code-help" className="text-center text-sm text-muted">Shown under the QR code on the customer&apos;s phone.</p>
          <Button type="submit" size="lg" disabled={pending || code.length < 9}>
            {pending ? <Loader2 className="animate-spin" /> : null} Look up voucher
          </Button>
        </form>
      </TabsContent>
      {error ? <p className="mt-4 flex gap-2 rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert"><AlertTriangle className="size-4 shrink-0" aria-hidden />{error}</p> : null}
    </Tabs>
  );
}
