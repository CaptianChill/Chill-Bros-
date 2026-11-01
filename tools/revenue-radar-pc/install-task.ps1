# Registers the daily Revenue Radar city scan (called by install-city-scan.cmd).
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here "city-scan.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$triggers = @((New-ScheduledTaskTrigger -Daily -At 7:12am), (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "Chill Pros Revenue Radar City Scan" -Action $action -Trigger $triggers -Settings $settings -Force | Out-Null
Write-Host "Scheduled task registered: daily at 7:12 AM and at sign-in."
