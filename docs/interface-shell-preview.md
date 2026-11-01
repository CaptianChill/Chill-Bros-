# Chill Pros shared interface shell

Local review route: `/interface-preview` (existing staff authentication applies).

The preview and reusable `PlatformShell` establish one visual language for owner, employee, and customer workspaces: black backgrounds, deep navy surfaces, electric-blue actions, icy cyan accents, white text, clean type, and consistent spacing. Preview content is fictional. The workspace selector has no effect on permissions.

The owner's mobile uploads were retrieved from the ChatGPT chat `Refresh Chill Pros UI` on November 1, 2026. Original JPEGs are preserved in `public/brand/chill-pros-{wordmark,texas,cp}-mobile.jpeg`. Per the owner's correction, the lettering over Texas is the platform logo, including desktop and mobile shell branding. The standalone lettering and CP artwork are not displayed in the shell. CP is reserved for browser and installed web app icons; centered square display copies at 180, 192, and 512 pixels are referenced by staff and customer metadata and manifests. The inline review uses smaller WebP display copies of the Texas logo. Its supplied white background is preserved on white logo tiles. No replacement artwork was generated.

## Applied interface

- Staff headers, desktop navigation, mobile tabs, and account menus share the navy/ice palette and approved Texas artwork.
- Customer account and shared portal frames use the same artwork, typography, surfaces, and controls.
- Sign-in and field notes share the platform foundation. Browser, customer, staff, and field-note app icons use CP.
- Camouflage, varsity lettering, the old starfield overrides, and the frosted-glass remapping layer are retired from the loaded application styles.
- Exact legacy color-class mappings bring existing forms, cards, details, and tables onto shared tokens without replacing their data or actions. Semantic warning, error, and success colors remain distinct.

## Implementation boundary

The shared foundation is connected to existing pages, with the role-switching concept retained at `/interface-preview`. Existing role-filtered navigation, live refresh, notifications, sign-out, drafts, form actions, and customer sign-in logic are retained. Frozen payment files and business-data logic are unchanged. Publication and deployment remain pending explicit approval after the upload was rejected by automatic approval review.

## Remaining release checks

1. Publish the approved commit to `CaptianChill/Chill-Bros-` and require a successful hosted build in the existing `chill-bros-` Vercel project.
2. Inspect desktop and mobile pages, including navigation, forms, detail tables, warnings, and empty states, in the hosted build.
3. Verify authenticated owner, office, technician, salesperson, and customer views using their existing sessions; the role preview does not establish role acceptance.
4. After release to `chill-bros.vercel.app`, repeat authenticated workflow and visual checks and inspect runtime errors.

## Validation

TypeScript and changed-file ESLint passed. Repository ESLint passed with zero errors and existing warnings. All 19 payment tests passed. Local production compilation and TypeScript passed; page-data collection stopped because this checkout has no `NEON_AUTH_COOKIE_SECRET`. Navigation tests returned seven passes and three failures; the identical failures were independently reproduced against `origin/main`, so they are not introduced by this change. Browser and direct HTTP requests could not reach the local development server; hosted visual and authenticated acceptance remain outstanding.
