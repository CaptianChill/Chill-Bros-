# Vehicle Radar

Standalone automotive lead app (PPF, vinyl, fleet branding). Separate from the Chill Bros app:
its own Vercel project (`sa-ppf-wrap-quotes`) and its own Neon database (`sa-ppf-wrap-quotes`).

- `/` neutral customer quote page (local + commercial)
- `/vperformance` V Performance branded customer page (racing theme)
- `/owner` owner console (PIN in `ADMIN_PIN` env var)
- `/p/<token>` buyer (mechanic) portal, one private link per buyer
- `api/` Vercel functions: `lead` (public form), `owner` (PIN), `portal` (token)
