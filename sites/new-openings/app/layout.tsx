import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} · Commercial lead packs for San Antonio trades`,
  description: "Verified new San Antonio restaurant, retail and auto build-outs from Texas state construction filings, with the owner or tenant contact and phone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-dvh bg-[#0B1E33] font-sans text-white antialiased">{children}</body></html>;
}
