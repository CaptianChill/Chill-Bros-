import type { Metadata } from "next";
export const metadata: Metadata = { title: "Chill Pros Field Notes", manifest: "/field-notes/manifest.webmanifest", appleWebApp: { capable: true, title: "Field Notes", statusBarStyle: "black" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
