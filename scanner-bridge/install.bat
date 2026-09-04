@echo off
title SR Billing Scanner Bridge - Setup
setlocal
cd /d "%~dp0"

if not exist "scanner-bridge.exe" (
  echo.
  echo scanner-bridge.exe was not found in this folder.
  echo Make sure install.bat and scanner-bridge.exe are in the same folder, then try again.
  echo.
  pause
  exit /b 1
)

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Installing SR Billing Scanner Bridge...
echo.

rem A plain .exe placed directly in the Startup folder is launched by
rem Windows automatically on every login — no shortcut, registry, or admin
rem rights needed. Overwrites any previous install so re-running this after
rem an update just replaces it.
copy /Y "scanner-bridge.exe" "%STARTUP%\SRBillingScannerBridge.exe" >nul
if errorlevel 1 (
  echo Could not copy the program into the Startup folder. Try running this
  echo as Administrator, or check that no antivirus is blocking it.
  pause
  exit /b 1
)

echo Installed. It will now start automatically every time this computer
echo turns on.
echo.
echo Starting it now...
start "" "%STARTUP%\SRBillingScannerBridge.exe"

echo.
echo Done! A "SR Billing Scanner Bridge" window should have opened — leave
echo it running (it can be minimized, just don't close it). Go to SR Billing
echo and click "Scan from Scanner" to test it.
echo.
pause
