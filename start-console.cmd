@echo off
rem Dev launcher: Kumvwa management console (Vite) on http://localhost:5173
rem Calls node directly on Vite's entry point — `pnpm` is not on the raw cmd PATH.
title Kumvwa Console (dev)
cd /d "%~dp0apps\console"
echo Starting console dev server on http://localhost:5173 ...
node node_modules\vite\bin\vite.js
echo.
echo Console dev server exited.
pause
