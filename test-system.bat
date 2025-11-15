@echo off
echo RVOIS System Testing Suite
echo =========================

REM Check if we're in the correct directory
if not exist "package.json" (
    echo Error: package.json not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

echo 1. Running unit tests...
call pnpm test
if %errorlevel% neq 0 (
    echo Error: Unit tests failed!
    pause
    exit /b 1
)

echo 2. Running TypeScript type checking...
call pnpm check:types
if %errorlevel% neq 0 (
    echo Error: Type checking failed!
    pause
    exit /b 1
)

echo 3. Running code linting...
call pnpm lint
if %errorlevel% neq 0 (
    echo Error: Code linting failed!
    pause
    exit /b 1
)

echo 4. Checking build...
call pnpm build
if %errorlevel% neq 0 (
    echo Error: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo All automated tests passed successfully!
echo ========================================
echo.
echo Next steps:
echo - Run manual testing using SYSTEM_TESTING_CHECKLIST.md
echo - Execute comprehensive test script with: node scripts/system-test-executor.ts
echo - Review COMPREHENSIVE_SYSTEM_TESTING_SCRIPT.md for detailed testing procedures
echo.
pause