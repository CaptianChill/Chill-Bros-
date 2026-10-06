import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Barlow, Barlow_Condensed } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "../styles/starfield-theme.css";
import "../styles/staff-theme.css";

// Exposed as CSS variables only; styles/staff-theme.css applies them inside
// the staff shell so customer-facing pages keep their current type.
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700"], variable: "--font-barlow-condensed", display: "swap" });
// Graffiti bubble lettering traced from the owner's alphabet sheet: a color
// font (black outline + shadow, blue fill, light-blue shine) with A-Z;
// lowercase maps to the same letters. Used for staff page titles and headings.
// Varsity block lettering for staff titles (styled like the chenille-patch
// CHILL PROS wordmark: red / royal blue / gold letters, black / white /
// purple outlines). See components/varsity-title.tsx and staff-theme.css.
const varsity = Alfa_Slab_One({ subsets: ["latin"], weight: "400", variable: "--font-varsity", display: "swap" });
const chillBubble = localFont({ src: "./fonts/chill-bubble.woff2", variable: "--font-chill-bubble", display: "swap" });

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
    icon: "/brand/chill-pro-app-192.png",
    apple: "/brand/chill-pro-app-180.png",
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
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} ${chillBubble.variable} ${varsity.variable} h-full bg-background antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {/* Chenille fuzz for varsity titles: frays letter edges like stitched patch fabric. */}
        <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
          <filter id="cb-chenille" x="-5%" y="-10%" width="110%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className="theme-starfield min-h-screen">{children}</div>
      </body>
    </html>
  );
}
