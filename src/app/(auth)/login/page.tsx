import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth";
import { env, integrations, isDemo } from "@/server/env";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/server/db/seed";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: raw } = await searchParams;
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  if (await getViewer()) redirect(next);
  return (
    <AuthForm
      mode="login"
      next={next}
      googleEnabled={integrations.supabase && env.googleAuthEnabled}
      demoPassword={isDemo ? DEMO_PASSWORD : undefined}
      demoAccounts={
        isDemo
          ? [
              { label: "Customer", email: DEMO_ACCOUNTS.customer.email },
              { label: "Business owner", email: DEMO_ACCOUNTS.owner.email },
              { label: "Staff", email: DEMO_ACCOUNTS.staff.email },
              { label: "Admin", email: DEMO_ACCOUNTS.admin.email },
            ]
          : undefined
      }
    />
  );
}
