export function GET() {
  return Response.json({ id: "/field-notes", name: "Chill Pros Field Notes", short_name: "Field Notes", start_url: "/field-notes", scope: "/", display: "standalone", background_color: "#020407", theme_color: "#020407", prefer_related_applications: false, icons: [192, 512].map(size => ({ src: `/logo-field-notes-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })) }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
