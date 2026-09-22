import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import "../styles/starfield-theme.css";
import "../styles/staff-theme.css";

// Exposed as CSS variables only; styles/staff-theme.css applies them inside
// the staff shell so customer-facing pages keep their current type.
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow", display: "swap" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700"], variable: "--font-barlow-condensed", display: "swap" });

export const metadata: Metadata = {
  title: "Chill Bros Operational Command Center",
  description: "Chill Bros internal operations, dispatch, field service, training, equipment, estimates, and customer workflow.",
  applicationName: "Chill Bros",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Chill Bros",
    statusBarStyle: "black",
  },
  icons: {
    icon: "/brand/chill-pros-badge-192.png",
    apple: "/brand/chill-pros-badge-180.png",
    shortcut: "/favicon.ico",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black",
    "apple-mobile-web-app-title": "Chill Bros",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#03060d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} h-full bg-background antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <div className="theme-starfield min-h-screen">{children}</div>
      </body>
    </html>
  );
}
