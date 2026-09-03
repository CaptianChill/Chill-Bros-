import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chill Bros Operational Command Center",
  description: "Chill Bros branded internal operations dashboard for manager, technician, and client workflows.",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
    shortcut: "/logo-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020407",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full bg-background antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
