# Revenue Radar - PC city scan (Chill Pros)
# The City of San Antonio blocks cloud servers, so this runs on the owner's PC (home internet) once a day:
# it finds the newest official food-establishment inspection report on sa.gov, downloads the .xlsx, and sends it
# to the Chill Pros app, which adds the new businesses to Revenue Radar (discovery only; it never sends outreach).
# Installed by install-city-scan.cmd as a daily Windows scheduled task. Log: city-scan.log next to this file.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $here "city-scan.log"
function Log($message) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message" | Out-File -FilePath $log -Append -Encoding utf8 }

$page = "https://www.sa.gov/Directory/Departments/SAMHD/Reports-Statistics/Food-Establishment-Inspections"
$endpoint = "https://chill-bros.vercel.app/api/cron/radar-city-import"
$agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ChillPros-RevenueRadar/1.0"
$secret = [Environment]::GetEnvironmentVariable("CHILL_RADAR_SECRET", "User")
if (-not $secret) { Log "STOP: CHILL_RADAR_SECRET is not set. Run install-city-scan.cmd again."; exit 1 }

try {
  $html = (Invoke-WebRequest -UseBasicParsing -Uri $page -UserAgent $agent -TimeoutSec 60).Content
  $today = (Get-Date).Date
  $best = $null; $bestDate = $null
  foreach ($match in [regex]::Matches($html, 'href=["'']([^"'']+\.xlsx)["'']', 'IgnoreCase')) {
    $url = [Uri]::new([Uri]$page, $match.Groups[1].Value)
    if ($url.Host -ne "www.sa.gov" -or $url.Scheme -ne "https") { continue }
    $period = [regex]::Match($url.AbsolutePath.ToLower(), '/samhd/documents/health-data-statistics/fe/(\d{4})/(\d{2})(\d{2})-(\d{2})(\d{2})\.xlsx$')
    if (-not $period.Success) { continue }
    $date = Get-Date -Year ([int]$period.Groups[1].Value) -Month ([int]$period.Groups[2].Value) -Day ([int]$period.Groups[3].Value)
    $date = $date.Date
    if ($date -gt $today -or ($today - $date).TotalDays -gt 45) { continue }
    if (-not $bestDate -or $date -gt $bestDate) { $best = $url.AbsoluteUri; $bestDate = $date }
  }
  if (-not $best) { Log "No current report on the city page (nothing posted in the last 45 days)."; exit 0 }

  $file = Join-Path $env:TEMP "chill-radar-city-report.xlsx"
  Invoke-WebRequest -UseBasicParsing -Uri $best -UserAgent $agent -OutFile $file -TimeoutSec 120
  $result = Invoke-RestMethod -Method Post -Uri $endpoint -InFile $file -ContentType "application/octet-stream" -TimeoutSec 90 `
    -Headers @{ Authorization = "Bearer $secret"; "X-Report-Url" = $best }
  Remove-Item $file -ErrorAction SilentlyContinue
  Log "OK  report=$best  in-report=$($result.inReport)  added=$($result.added)  skipped-customers=$($result.skippedCustomers)"
} catch {
  Log "FAILED: $($_.Exception.Message)"
  exit 1
}
