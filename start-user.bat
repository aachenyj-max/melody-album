@echo off
setlocal

cd /d "%~dp0"
title Melody Album - User App

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm were not found. Install Node.js 22.19.0 or newer.
  pause
  exit /b 1
)

if not exist "node_modules\next\package.json" (
  echo Dependencies are missing. Run npm install in this folder first.
  pause
  exit /b 1
)

echo Starting Melody Album...
echo Open this URL after the server is ready: http://localhost:3000/
echo Keep this window open. Press Ctrl+C to stop the server.
echo.

call npm.cmd run dev -- --port 3000

if errorlevel 1 (
  echo.
  echo User app failed to start. See the error above.
  echo If port 3000 is in use, stop the existing server first.
  pause
  exit /b 1
)

endlocal
