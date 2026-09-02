# Chill Bros Operational Command Center

A Next.js App Router operational app for Chill Bros. The app includes a fully branded command center, manager controls, technician workflow pages, a mobile timesheet view, inventory and CRM screens, and a customer portal route.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser after the dev server starts.

## Included routes

- `/` — operational overview dashboard
- `/manager` — manager / owner controls
- `/technician` — technician service and quote workflow
- `/timesheet` — mobile timesheet form
- `/inventory` — parts catalog and fee controls
- `/crm` — customer directory and email logs
- `/portal/INV-2409` — client-facing quote / invoice portal

## Branding assets

The active Chill Bros artwork is served from these public paths:

- `public/logo.png`
- `public/logo-text.png`
- `public/logo-icon.png`

These PNG assets are wired into the app shell and metadata for consistent branding across all routes.

## Commands

- `npm run lint`
- `npm run build`

## Deploy on Vercel

This app is ready to deploy as a standard Next.js project.

1. Push the repository to GitHub.
2. Go to [Vercel](https://vercel.com/new) and import `CaptianChill/Chill-Bros-`.
3. Keep the detected Next.js build settings.
4. Deploy the project.
5. After deployment, use the generated `*.vercel.app` URL or connect a custom domain in the Vercel project settings.

## Production checklist

Before deploying, verify the app from the repository root:

```bash
npm run lint
npm run build
```
