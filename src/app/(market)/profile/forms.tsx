"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { removePushSubscriptionAction, savePushSubscriptionAction, updateNameAction, updatePreferencesAction } from "@/app/actions/customer";

type Prefs = { in_app_new_deals: boolean; email_new_deals: boolean; push_new_deals: boolean; max_emails_per_day: number };

export function NameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateNameAction(name);
          if (res.ok) toast.success("Name updated");
          else toast.error(res.error);
        });
      }}
    >
      <label htmlFor="name" className="sr-only">Your name</label>
      <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      <Button type="submit" className="h-12" disabled={pending || name === initial}>Save</Button>
    </form>
  );
}

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PreferencesForm({
  initial,
  pushConfigured,
  vapidKey,
  emailConfigured,
}: {
  initial: Prefs;
  pushConfigured: boolean;
  vapidKey: string | null;
  emailConfigured: boolean;
}) {
  const [p, setP] = useState(initial);
  const [pending, start] = useTransition();
  const [pushBusy, setPushBusy] = useState(false);

  const save = (next: Prefs) =>
    start(async () => {
      setP(next);
      const res = await updatePreferencesAction(next);
      if (!res.ok) {
        toast.error(res.error);
        setP(p);
      } else toast.success("Preferences saved");
    });

  const togglePush = async (on: boolean) => {
    if (!pushConfigured || !vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("This browser doesn't support push notifications. On iPhone, add Frugal Center to your Home Screen first.");
      return;
    }
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (on) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notifications are blocked for this site. You can allow them in your browser settings.");
          return;
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const res = await savePushSubscriptionAction(json);
        if (!res.ok) throw new Error(res.error);
        setP((x) => ({ ...x, push_new_deals: true }));
        toast.success("Push notifications on for this device");
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscriptionAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setP((x) => ({ ...x, push_new_deals: false }));
        toast.success("Push notifications off");
      }
    } catch (err) {
      toast.error((err as Error).message || "Couldn't update push notifications");
    } finally {
      setPushBusy(false);
    }
  };

  const row = (id: string, label: string, hint: string, control: React.ReactNode) => (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <label htmlFor={id} className="font-semibold">{label}</label>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {control}
    </div>
  );

  return (
    <div className="mt-2 divide-y divide-line">
      {row("in-app", "In-app", "Show new deals in your notification center.",
        <Switch id="in-app" checked={p.in_app_new_deals} disabled={pending} onCheckedChange={(v) => save({ ...p, in_app_new_deals: v })} />)}
      {row("email", "Email", emailConfigured ? "One email per new deal, with an unsubscribe link in every message." : "Email delivery isn't connected on this server yet; your choice is saved for when it is.",
        <Switch id="email" checked={p.email_new_deals} disabled={pending} onCheckedChange={(v) => save({ ...p, email_new_deals: v })} />)}
      {p.email_new_deals
        ? row("cap", "Max deal emails per day", "We also cap emails from any one business at 2 per day.",
            <NativeSelect id="cap" className="h-10 w-24" value={p.max_emails_per_day} disabled={pending} onChange={(e) => save({ ...p, max_emails_per_day: Number(e.target.value) })}>
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>)
        : null}
      {row("push", "Browser push", pushConfigured ? "Alerts on this device, even when Frugal Center is closed." : "Push notifications aren't configured on this server.",
        <div className="flex items-center gap-2">
          {pushBusy ? <Loader2 className="size-4 animate-spin" /> : null}
          <Switch id="push" checked={p.push_new_deals} disabled={!pushConfigured || pushBusy} onCheckedChange={togglePush} />
        </div>)}
    </div>
  );
}
