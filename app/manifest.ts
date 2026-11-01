import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chill Pros",
    short_name: "Chill Pros",
    description: "Chill Pros service, dispatch, customers, equipment, quotes, and invoices.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020407",
    theme_color: "#020407",
    icons: [
      {
        src: "/brand/chill-pros-cp-app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/chill-pros-cp-app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
