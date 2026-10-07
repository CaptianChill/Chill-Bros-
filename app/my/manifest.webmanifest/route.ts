// Home-screen app for customers ("Add to Home Screen" / "Install"). Separate
// from the staff app manifest so it opens straight to the customer homepage.
export function GET() {
  return Response.json(
    {
      id: "/my",
      name: "Chill Pros",
      short_name: "Chill Pros",
      description: "Your Chill Pros account: request service, pay invoices, approve estimates, and see your equipment history.",
      start_url: "/my",
      scope: "/my",
      display: "standalone",
      background_color: "#05070A",
      theme_color: "#05070A",
      prefer_related_applications: false,
      icons: [192, 512].map((size) => ({ src: `/brand/customer-app-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
