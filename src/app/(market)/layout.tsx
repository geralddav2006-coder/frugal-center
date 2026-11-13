import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { DemoBanner } from "@/components/layout/demo-banner";
import { isDemo } from "@/server/env";

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {isDemo ? <DemoBanner /> : null}
      <SiteHeader />
      <main className="min-h-[60dvh] pb-24 md:pb-0">{children}</main>
      <SiteFooter />
      <MobileTabBar />
    </>
  );
}
