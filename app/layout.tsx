import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chill Bros Operational Command Center",
  description: "Chill Bros branded internal operations dashboard for manager, technician, and client workflows.",
  applicationName: "Chill Bros",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Chill Bros",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
    shortcut: "/logo-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Chill Bros",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020407",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full bg-background antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
