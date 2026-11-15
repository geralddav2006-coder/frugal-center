import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,520px)]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span]:text-white" />
        <div>
          <p className="text-[64px] leading-[0.95] font-extrabold tracking-[-0.02em]">
            Your neighborhood,<br /><span className="text-lime">on sale.</span>
          </p>
          <p className="mt-5 max-w-md text-lg text-white/70">Claim deals from local businesses in seconds. Always free for customers.</p>
        </div>
        <p className="text-sm text-white/50">Bakeries · salons · studios · cafés · and more near you</p>
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full bg-lime/15 blur-3xl" />
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto my-auto w-full max-w-sm py-10">{children}</div>
      </div>
    </div>
  );
}
