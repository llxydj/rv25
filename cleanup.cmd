@echo off
REM === SAFE CLEANUP SCRIPT ===
echo Cleaning project safely...

REM Remove folders
rmdir /s /q node_modules
rmdir /s /q .next
rmdir /s /q node-v22.21.0-win-x64

REM Remove files
del /f /q tsconfig.tsbuildinfo
del /f /q *.log

echo ✅ Cleanup complete! Safe to upload or version.

REM === CREATE ZIP WITH STANDARDIZED FILENAME ON DESKTOP ===
REM Get date and time in readable format
for /f "tokens=2 delims==" %%i in ('"wmic os get LocalDateTime /value"') do set ldt=%%i

set month=%ldt:~4,2%
set day=%ldt:~6,2%
set hour=%ldt:~8,2%
set min=%ldt:~10,2%

REM Convert hour to 12-hour format with AM/PM
set /a hh=1%hour%-100
if %hh% GEQ 12 (
    set ampm=PM
    if %hh% GTR 12 set /a hh=hh-12
) else (
    set ampm=AM
    if %hh% EQU 0 set hh=12
)

REM Format filename
set zipfile=rv-%month%%day%-%hh%-%min%%ampm%.zip

REM Set Desktop path
set desktop=%USERPROFILE%\Desktop
set fullpath=%desktop%\%zipfile%

REM Create ZIP using PowerShell (built-in)
powershell -command "Compress-Archive -Path * -DestinationPath '%fullpath%' -Force"

echo 📦 Project zipped as %fullpath%
pause