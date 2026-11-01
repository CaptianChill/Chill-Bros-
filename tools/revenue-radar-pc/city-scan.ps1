# Runs the reviewed Node client without putting the existing importer key in process arguments or logs.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $here 'city-scan.log'
$secret = [Environment]::GetEnvironmentVariable('CHILL_RADAR_SECRET','User')
if (-not $secret) { throw 'CHILL_RADAR_SECRET is not configured.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$previousSecret = $env:CHILL_RADAR_SECRET
try {
  $env:CHILL_RADAR_SECRET = $secret
  & $node (Join-Path $here 'city-scan.cjs') 2>&1 | ForEach-Object { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $_" | Out-File -LiteralPath $log -Append -Encoding utf8 }
  $scanExit = $LASTEXITCODE
} finally { $env:CHILL_RADAR_SECRET = $previousSecret; $secret = $null }
if ($scanExit -ne 0) { throw 'City scanner failed; see city-scan.log.' }
