@echo off
title Kumvwa Dev
cd /d "%~dp0"

echo [1/3] Starting Docker services (Postgres, Redis, MinIO, MailHog)...
docker compose -f docker-compose.dev.yml up -d
if errorlevel 1 (echo ERROR: Docker failed. Is Docker Desktop running? & pause & exit /b 1)

echo [2/3] Starting API on http://localhost:8080 ...
start "Kumvwa API" cmd /k "pnpm dev:api"

echo [3/3] Starting Console on http://localhost:5173 ...
start "Kumvwa Console" cmd /k "pnpm dev:console"

echo.
echo All services started.
echo   API      ^> http://localhost:8080
echo   Console  ^> http://localhost:5173
echo   MailHog  ^> http://localhost:8025
echo.
echo Close the API and Console windows to stop them.
echo Run: docker compose -f docker-compose.dev.yml down   to stop Docker services.
pause
