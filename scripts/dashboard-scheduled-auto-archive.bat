@echo off
REM Dashboard-Based Scheduled Auto Archive Script
REM This script can be executed from the admin dashboard

echo 🚀 Starting Dashboard-Based Scheduled Auto Archive...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js to run this script
    pause
    exit /b 1
)

REM Check if the script file exists
if not exist "%~dp0dashboard-scheduled-auto-archive.ts" (
    echo ❌ Error: dashboard-scheduled-auto-archive.ts script not found
    echo Please ensure the script is in the scripts directory
    pause
    exit /b 1
)

echo 🔍 Checking for scheduled auto-archive tasks...
echo.

REM Run the scheduled auto-archiving script
node "%~dp0dashboard-scheduled-auto-archive.ts"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Dashboard-based scheduled auto-archive completed successfully
) else (
    echo.
    echo ❌ Dashboard-based scheduled auto-archive failed
    pause
    exit /b %errorlevel%
)

echo.
echo 🏁 Process completed
echo.
echo Press any key to exit...
pause >nul