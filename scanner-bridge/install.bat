@echo off
title SR Billing Scanner Bridge - Setup
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found on this computer.
  echo Install it from https://nodejs.org ^(the LTS version^), then run this again.
  echo.
  pause
  exit /b 1
)

echo Installing SR Billing Scanner Bridge...
echo.
call npm install

echo.
echo Done. Double-click start.bat any time you need to scan a bill.
pause
