import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chill Bros Operational Command Center",
    short_name: "Chill Bros",
    description: "Chill Bros field service, dispatch, estimates, inventory, equipment, timesheets, and owner operations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020407",
    theme_color: "#020407",
    icons: [
      {
        src: "/logo-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
