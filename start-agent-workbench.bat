@echo off
setlocal

cd /d "%~dp0"
title Melody Album - Agent Workbench
set "WORKBENCH_PUBLIC_ORIGIN=http://localhost:3001"
set "WORKBENCH_DEV_SERVER=1"

echo Starting Agent Workbench...
echo URL: http://localhost:3001/internal/agent-workbench
echo.

powershell.exe -NoProfile -Command "try { $wbResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3001/internal/agent-workbench' -TimeoutSec 3; if ($wbResponse.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
  echo Agent Workbench is already running. Opening the workbench page...
  start "" "http://localhost:3001/internal/agent-workbench"
  exit /b 0
)

rem Open the workbench only after the development server is ready.
start "" /b powershell.exe -NoProfile -Command "$wbUrl = 'http://localhost:3001/internal/agent-workbench'; for ($wbAttempt = 0; $wbAttempt -lt 90; $wbAttempt++) { try { $wbResponse = Invoke-WebRequest -UseBasicParsing -Uri $wbUrl -TimeoutSec 3; if ($wbResponse.StatusCode -eq 200) { Start-Process $wbUrl; exit 0 } } catch {}; Start-Sleep -Seconds 2 }; exit 1" >nul 2>&1

call npm.cmd run dev -- --port 3001

if errorlevel 1 (
  echo.
  echo Agent Workbench failed to start.
  pause
)

endlocal
