@echo off
title SR Billing Scanner Bridge
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

if not exist node_modules (
  echo First run - installing dependencies, this only happens once...
  echo.
  call npm install
  echo.
)

echo Starting SR Billing Scanner Bridge...
echo Leave this window open while scanning bills in SR Billing.
echo Closing this window stops it.
echo.
call npm start

echo.
echo Scanner Bridge stopped.
pause
