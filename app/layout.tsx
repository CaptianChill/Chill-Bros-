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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-black font-sans text-white">{children}</body>
    </html>
  );
}
