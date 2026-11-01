# Revenue Radar: PC city scan

The City of San Antonio's site blocks cloud servers (Vercel gets HTTP 403), so the official food-establishment
inspection report is fetched from the owner's PC instead and posted to `POST /api/cron/radar-city-import`
(bearer `RADAR_PC_SECRET`, report URL in `X-Report-Url`, must be a current official sa.gov report).

- `city-scan.ps1`: finds the newest report on the city page, downloads it, posts it, logs to `city-scan.log`.
- `install-city-scan.cmd` (+ `install-task.ps1`): one-time setup on the PC: stores the key as the user env var `CHILL_RADAR_SECRET`
  (read from `radar-pc-secret.txt`, which it then deletes), registers the scheduled task
  "Chill Pros Revenue Radar City Scan" (daily 7:12 AM, plus at sign-in if the PC was off), and runs one scan.
- Vercel env: `RADAR_PC_SECRET` (same key), `RADAR_CITY_FROM_PC=1` (the cloud scan stops trying the blocked site).
- Discovery only: imported businesses land as `new` prospects for office review; outreach rules are unchanged.


The PC runner uses the installed Node.js runtime (20+) for HTTPS downloads and uploads; no npm packages are needed.
`city-scan.ps1` reads the existing user key and supplies it only through the child environment, never command arguments.
`city-scan.cjs` uses ordinary HTTPS requests, checks official/current report URLs and XLSX signatures, limits source size,
and sends the bearer key only to the fixed Chill Pros import endpoint. The production source blocks cloud requests;
this local task therefore runs daily at 7:12 AM and at sign-in, while cloud map discovery/Autopilot retain their 15-minute schedules.
The laptop must be on and have internet access; StartWhenAvailable catches missed runs. Logs are in `city-scan.log`.
