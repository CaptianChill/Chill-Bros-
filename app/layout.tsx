import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";

const bodyFont = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-chill-body",
  display: "swap",
});

const brandFont = Orbitron({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-chill-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chill Bros Operational Command Center",
  description: "Chill Bros branded internal operations dashboard for manager, technician, and client workflows.",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
    shortcut: "/logo-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${bodyFont.variable} ${brandFont.variable}`}>
      <body className="min-h-full bg-black font-sans text-white">{children}</body>
    </html>
  );
}
