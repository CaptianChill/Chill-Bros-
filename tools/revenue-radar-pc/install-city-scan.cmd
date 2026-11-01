@echo off
rem Revenue Radar PC city scan: one-time setup. Double-click this file.
rem Saves the app key for your Windows user, schedules city-scan.ps1 daily at 7:12 AM (and at sign-in if the PC
rem was off), and runs one scan right now so you can see it work.
setlocal
cd /d "%~dp0"
if not exist "radar-pc-secret.txt" (
  echo radar-pc-secret.txt is missing. Ask Claude to set it up again.
  pause
  exit /b 1
)
set /p RADARSECRET=<"radar-pc-secret.txt"
setx CHILL_RADAR_SECRET "%RADARSECRET%" >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-task.ps1"
if errorlevel 1 (
  echo Could not register the scheduled task.
  pause
  exit /b 1
)
del "radar-pc-secret.txt"
echo Running the first scan now...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0city-scan.ps1"
echo.
echo Last result:
powershell -NoProfile -Command "Get-Content -Tail 1 -LiteralPath '%~dp0city-scan.log'"
echo.
pause
