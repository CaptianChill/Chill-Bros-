import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import "../styles/staff-theme.css";
import "../styles/platform-theme.css";
import "../styles/platform-compat.css";

// One readable font across customer and staff workspaces.
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });
export const metadata: Metadata = {
  title: "Chill Pros",
  description: "Chill Pros service, dispatch, equipment, quotes, invoices, and customer accounts.",
  applicationName: "Chill Pros",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Chill Pros",
    statusBarStyle: "black",
  },
  icons: {
    icon: "/brand/chill-pros-cp-app-192.png",
    apple: "/brand/chill-pros-cp-app-180.png",
    shortcut: "/brand/chill-pros-cp-app-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black",
    "apple-mobile-web-app-title": "Chill Pros",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#03060d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${barlow.variable} h-full bg-background antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <div className="cp-root cb-platform min-h-screen">{children}</div>
      </body>
    </html>
  );
}
