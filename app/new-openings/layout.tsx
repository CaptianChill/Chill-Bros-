import type { Metadata } from "next";
import type { ReactNode } from "react";

// Neutral icon/app name for every lead-business page, so the browser tab or home-screen
// shortcut never shows the HVAC company's logo or name.
const LEADBIZ_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0B1E33"/><path d="M14 46V18h6l12 17V18h6v28h-6L20 29v17z" fill="#FF7A59"/><circle cx="48" cy="20" r="5" fill="#F5C542"/></svg>')}`;

export const metadata: Metadata = {
  title: "San Antonio New Openings",
  applicationName: "San Antonio New Openings",
  manifest: null,
  appleWebApp: { capable: false, title: "SA New Openings" },
  icons: { icon: LEADBIZ_ICON, apple: LEADBIZ_ICON, shortcut: LEADBIZ_ICON },
  other: { "apple-mobile-web-app-title": "SA New Openings", "mobile-web-app-capable": "no", "apple-mobile-web-app-capable": "no" },
};

export default function NewOpeningsLayout({ children }: { children: ReactNode }) {
  return children;
}
