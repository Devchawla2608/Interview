@echo off
title Interview Arena Dev Server
set "PATH=C:\Users\devch\.gemini\antigravity\tools\node20;%PATH%"
echo ===================================================
echo   Interview Arena - Production-Grade SaaS Platform
echo ===================================================
echo [1/2] Node.js Version:
node -v
echo [2/2] Starting server at http://localhost:3000 ...
npx tsx server.ts
pause
