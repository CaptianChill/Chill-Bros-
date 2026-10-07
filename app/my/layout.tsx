import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Chill Pros · Your account",
  description: "Request service, pay invoices, approve estimates, and see your equipment history with Chill Pros.",
  applicationName: "Chill Pros",
  manifest: "/my/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Chill Pros", statusBarStyle: "black" },
  icons: { icon: "/brand/customer-app-192.png", apple: "/brand/customer-app-180.png" },
  other: { "apple-mobile-web-app-title": "Chill Pros" },
  openGraph: {
    title: "Chill Pros · Your account",
    description: "Request service, pay invoices, and see your equipment history.",
    images: [{ url: "/brand/chill-pros-texas-chrome.png", width: 1200, height: 1200, alt: "Chill Pros" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05070A",
  colorScheme: "light",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
