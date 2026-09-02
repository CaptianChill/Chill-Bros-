# Chill Bros Operational Command Center

A Next.js App Router prototype for the Chill Bros internal operational app brief. The app includes a neon-branded command center, manager controls, technician workflow pages, a mobile timesheet view, inventory and CRM screens, and a customer portal route.

## Getting started

```bash
npm install
npm run dev
```

## Included routes

- `/` — operational overview dashboard
- `/manager` — manager / owner controls
- `/technician` — technician service and quote workflow
- `/timesheet` — mobile timesheet form
- `/inventory` — parts catalog and fee controls
- `/crm` — customer directory and email logs
- `/portal/INV-2409` — client-facing quote / invoice portal

## Branding assets

Production artwork should live in these public paths:

- `public/logo.png`
- `public/logo-text.png`
- `public/logo-icon.png`

This repository currently wires those exact PNG paths into the app shell and metadata so the assets can be replaced directly without further code changes.

## Commands

- `npm run lint`
- `npm run build`
