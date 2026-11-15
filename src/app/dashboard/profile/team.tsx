"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { inviteTeamAction, removeTeamAction, revokeInviteAction } from "@/app/actions/merchant";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function TeamManager({
  currentUserId, members, invites,
}: {
  currentUserId: string;
  members: { id: string; name: string; email: string; role: string; since: string }[];
  invites: { id: string; email: string; role: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      router.refresh();
    });
  return (
    <div className="mt-5 grid gap-5">
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.name}{m.id === currentUserId ? " (you)" : ""}</p>
              <p className="truncate text-sm text-muted">{m.email} · since {m.since}</p>
            </div>
            <Badge variant={m.role === "owner" ? "ink" : "soft"} size="sm" className="capitalize">{m.role}</Badge>
            {m.role !== "owner" && m.id !== currentUserId ? (
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} disabled={pending}
                onClick={() => window.confirm(`Remove ${m.name} from your team?`) && act(() => removeTeamAction(m.id), "Removed from team")}>
                <X className="size-4" />
              </Button>
            ) : null}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-4 py-3">
            <Mail className="size-4 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{i.email}</p>
              <p className="text-sm text-muted">Invited — joins automatically when they sign up with this email</p>
            </div>
            <Badge variant="outline" size="sm" className="capitalize">{i.role}</Badge>
            <Button variant="ghost" size="icon-sm" aria-label={`Revoke invite for ${i.email}`} disabled={pending} onClick={() => act(() => revokeInviteAction(i.id), "Invite revoked")}><X className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_130px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const r = await inviteTeamAction(email, role);
            if (r.ok) setEmail("");
            return r;
          }, "Team member added");
        }}
      >
        <label htmlFor="invite-email" className="sr-only">Email</label>
        <Input id="invite-email" type="email" required placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="invite-role" className="sr-only">Role</label>
        <NativeSelect id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "staff" | "manager")}>
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </NativeSelect>
        <Button type="submit" className="h-12" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add</Button>
      </form>
      <p className="text-xs text-muted">Existing Frugal Center users are added right away. Anyone else is added automatically when they create an account with that email.</p>
    </div>
  );
}
