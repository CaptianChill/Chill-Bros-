/* Discovery only: downloads a public city report and uploads it to the existing authenticated importer. */
const PAGE = 'https://www.sa.gov/Directory/Departments/SAMHD/Reports-Statistics/Food-Establishment-Inspections';
const ENDPOINT = 'https://chill-bros.vercel.app/api/cron/radar-city-import';
const MAX_BYTES = 2_000_000;
function latestReport(html, now = new Date()) {
  const candidates = [];
  for (const match of html.matchAll(/href=["']([^"']+\.xlsx)["']/gi)) {
    let url;
    try { url = new URL(match[1], PAGE); } catch { continue; }
    if (url.origin !== 'https://www.sa.gov') continue;
    const period = /\/samhd\/documents\/health-data-statistics\/fe\/(\d{4})\/(\d{2})(\d{2})-(\d{2})(\d{2})\.xlsx$/.exec(url.pathname);
    if (!period) continue;
    const date = Date.UTC(Number(period[1]), Number(period[2])-1, Number(period[3]));
    if (date > now.getTime() || now.getTime()-date > 45*86400000) continue;
    candidates.push({ url: url.toString(), date });
  }
  return candidates.sort((a,b)=>b.date-a.date)[0]?.url ?? null;
}
async function boundedGet(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Public source returned HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Source exceeds size limit');
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_BYTES) throw new Error('Source exceeds size limit');
  return data;
}
async function main() {
  const secret = process.env.CHILL_RADAR_SECRET;
  if (!secret) throw new Error('CHILL_RADAR_SECRET is not configured');
  const report = latestReport((await boundedGet(PAGE)).toString('utf8'));
  if (!report) throw new Error('No current official city report is available');
  const bytes = await boundedGet(report);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Public source did not return an XLSX file');
  const response = await fetch(ENDPOINT, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000),
    headers: { authorization: `Bearer ${secret}`, 'x-report-url': report, 'content-type': 'application/octet-stream' }, body: bytes });
  if (!response.ok) throw new Error(`Production importer returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.ok !== true) throw new Error('Production importer did not confirm success');
  console.log(JSON.stringify({ ok: true, report, inReport: result.inReport, added: result.added, skippedCustomers: result.skippedCustomers }));
}
module.exports = { latestReport, boundedGet, main };
if (require.main === module) main().catch(error => { console.error(`FAILED: ${error.message}`); process.exitCode = 1; });
