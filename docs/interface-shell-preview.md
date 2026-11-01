# Chill Pros shared interface shell

Local review route: `/interface-preview` (existing staff authentication applies).

The preview and reusable `PlatformShell` establish one visual language for owner, employee, and customer workspaces: black backgrounds, deep navy surfaces, electric-blue actions, icy cyan accents, white text, clean type, and consistent spacing. Preview content is fictional. The workspace selector has no effect on permissions.

The owner's mobile uploads were retrieved from the ChatGPT chat `Refresh Chill Pros UI` on November 1, 2026. Original JPEGs are preserved in `public/brand/chill-pros-{wordmark,texas,cp}-mobile.jpeg`. Per the owner's correction, the lettering over Texas is the platform logo, including desktop and mobile shell branding. The standalone lettering and CP artwork are not displayed in the shell. CP is reserved for browser and installed web app icons; centered square display copies at 180, 192, and 512 pixels are referenced by staff and customer metadata and manifests. The inline review uses smaller WebP display copies of the Texas logo. Its supplied white background is preserved on white logo tiles. No replacement artwork was generated.

## Current review findings

- `AppShell` and `staff-shell-nav` supply staff navigation, camouflage surfaces, and varsity headings.
- `CustomerFrame` supplies the signed-in customer account interface.
- `PortalShell` supplies secure customer document framing with legacy neon and chrome presentation.
- Root styles load starfield and staff themes, so replacing a single header will not make all pages consistent.
- Field notes has a separate layout and needs a mobile review during migration.

## Implementation boundary

This change adds the shared component, scoped styles, and a role-switching preview. Existing pages have not been migrated and this has not been deployed. Navigation and page rendering in the preview demonstrate appearance only. Billing and service actions remain in the existing application.

## Rollout after visual review

1. Use the shell's tokens and components in the staff header/sidebar and customer frame, retaining current role-filtered navigation, sessions, sign-out, notifications, draft protection, and mobile actions.
2. Migrate page headings, buttons, cards, forms, tables, empty/error/loading states, and detail pages. Audit hard-coded legacy colors before retiring the global theme.
3. Include sign-in, service requests, quotes/invoices, equipment, service plans, owner tools, employee jobs/time, and field notes in the page inventory.
4. Secure document and payment routes are covered by the repository's payment freeze. Read and follow `CLAUDE.md` before any migration affecting those routes.
5. Verify the signed-in owner, office, technician, salesperson, and customer workflows on desktop and mobile before promoting a release. A role preview is not acceptance of those workflows.

## Validation

TypeScript and changed-file ESLint passed. All 19 existing payment tests passed. Automated browser inspection of the standalone preview was blocked by the browser's local-file policy; visual browser and hosted acceptance remain outstanding.
