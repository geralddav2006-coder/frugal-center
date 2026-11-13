"use client";
import { useActionState, useRef } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { googleSignInAction, signInAction, signUpAction } from "@/app/actions/auth";

type State = { ok: boolean; error?: string; needsEmailConfirmation?: boolean } | null;

export function AuthForm({
  mode,
  next,
  googleEnabled,
  demoAccounts,
  demoPassword,
}: {
  mode: "login" | "signup";
  next: string;
  googleEnabled: boolean;
  demoAccounts?: { label: string; email: string }[];
  demoPassword?: string;
}) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<State, FormData>(action as never, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  if (state?.ok && state.needsEmailConfirmation) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-lime"><MailCheck className="size-6" /></div>
        <h1 className="mt-4 text-2xl font-extrabold">Check your email</h1>
        <p className="mt-2 text-muted">We sent you a confirmation link. Open it on this device to finish creating your account.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[32px] leading-tight font-extrabold">{mode === "login" ? "Welcome back" : "Create your free account"}</h1>
      <p className="mt-2 text-muted">
        {mode === "login" ? "Sign in to claim deals and track your savings." : "Claim deals, follow your favorite places and see how much you save."}
      </p>

      {googleEnabled ? (
        <>
          <Button type="button" variant="outline" size="lg" className="mt-7 w-full" onClick={() => googleSignInAction(next)}>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.9A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6L19.4 4A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        </>
      ) : <div className="mt-7" />}

      <form action={formAction} className="grid gap-4" noValidate={false}>
        <input type="hidden" name="next" value={next} />
        {mode === "signup" ? (
          <Field label="Your name" htmlFor="fullName">
            <Input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={80} placeholder="Maya Chen" />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email">
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <Input ref={passRef} id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
        </Field>
        {state && !state.ok ? <p className="rounded-xl bg-[#fde8e7] p-3 text-sm font-medium text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[15px] text-muted">
        {mode === "login" ? "New to Frugal Center? " : "Already have an account? "}
        <Link className="font-bold text-ink underline-offset-4 hover:underline" href={`/${mode === "login" ? "signup" : "login"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>

      {demoAccounts?.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-paper p-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Demo accounts · local demo only</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                className="rounded-xl border border-line bg-white px-3 py-2 text-left text-sm font-semibold hover:border-ink"
                onClick={() => {
                  if (emailRef.current) emailRef.current.value = a.email;
                  if (passRef.current) passRef.current.value = demoPassword ?? "";
                }}
              >
                {a.label}
                <span className="block truncate text-xs font-normal text-muted">{a.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Password: <code className="font-mono">{demoPassword}</code></p>
        </div>
      ) : null}
    </div>
  );
}
