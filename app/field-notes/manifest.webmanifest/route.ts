export function GET() {
  return Response.json({ id: "/field-notes", name: "Chill Pros Field Notes", short_name: "Field Notes", start_url: "/field-notes", scope: "/", display: "standalone", background_color: "#020407", theme_color: "#020407", icons: [{ src: "/logo.png", sizes: "any", type: "image/png", purpose: "any" }] }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
