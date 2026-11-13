import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { env } from "@/server/env";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "Frugal Center — Good deals, close to home", template: "%s · Frugal Center" },
  description: "Discover exclusive discounts from local businesses near you. Free for customers.",
  applicationName: "Frugal Center",
  openGraph: { siteName: "Frugal Center", type: "website" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" toastOptions={{ classNames: { toast: "!rounded-2xl !font-sans !text-[15px]" } }} />
      </body>
    </html>
  );
}
