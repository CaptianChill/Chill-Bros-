# Chill Bros Operational Command Center

Production Next.js app for Chill Bros dispatch, manager controls, technician workflows, customers, equipment, estimates, inventory, timesheets, agreements, reporting, security, and training.

## Local verification

```bash
npm ci
npm run lint
npm run build
```

## Active branding assets

- `public/logo.png` — primary app/PWA logo
- `public/chill-bros-loader.webp` — loading screen artwork
- `public/internal/chill-bros-smiley-v4.png` — internal header smiley
- `public/internal/chill-bros-texas-v3.png` — internal header Texas mark

The loading screen uses exactly one canonical image path. No fallback logo or staging asset should be used for the loader.

## Production

Vercel deploys `main` from `CaptianChill/Chill-Bros-`. The GitHub Security audit runs dependency audit, lint, and a production build before a cleanup or code change is considered healthy.
