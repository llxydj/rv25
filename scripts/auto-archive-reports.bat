@echo off
REM Automated Report Archiving Script
REM This script runs the auto-archiving process on Windows systems

echo Starting automated report archiving...

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js to run this script
    pause
    exit /b 1
)

REM Check if the script file exists
if not exist "%~dp0auto-archive-reports.ts" (
    echo Error: auto-archive-reports.ts script not found
    echo Please ensure the script is in the scripts directory
    pause
    exit /b 1
)

REM Run the auto-archiving script
node "%~dp0auto-archive-reports.ts"

if %errorlevel% equ 0 (
    echo Auto-archiving completed successfully
) else (
    echo Auto-archiving failed
    pause
    exit /b %errorlevel%
)

echo.
echo Press any key to exit...
pause >nul