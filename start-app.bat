@echo off
cd /d "%~dp0"
echo Campus Hub - starting server...
echo.
if not exist ".env.dev" (
  echo ERROR: Missing .env.dev file.
  echo Copy env.dev.example to .env.dev and add your DATABASE_URL.
  echo See PRESENTATION_SETUP.md
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found. Install Node.js LTS from https://nodejs.org/
  echo Then restart this window and run again.
  pause
  exit /b 1
)
echo Open in browser: http://localhost:3000/home.html
echo Press Ctrl+C to stop the server.
echo.
call npm start
pause
