<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Payment code is frozen

Customer card payments are frozen by the owner. Before editing anything in
`lib/chillbros/square-*.ts`, `lib/chillbros/*payment*.ts`,
`app/api/portal/[token]/square-checkout/`, `app/api/payments/square/`,
`app/portal/[token]/`, or the payment tests, read the "PAYMENT CODE IS
FROZEN" section of `CLAUDE.md` and follow it. Never remove
`npm run test:payments` from the `build` script.
