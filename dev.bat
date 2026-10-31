@echo off
setlocal enabledelayedexpansion

:: Navigate to project root directory
cd /d "%~dp0"

echo ===================================================
echo   Starting VicPlan WebGIS Development Environment
echo ===================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in system PATH.
    echo Please install Node.js ^(v18 or higher^) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules\" (
    echo [INFO] Dependencies not found. Running "npm install"...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] "npm install" failed. Please check the logs above.
        pause
        exit /b %ERRORLEVEL%
    )
    echo.
    echo [INFO] Dependencies installed successfully.
    echo.
)

:: Start Vite dev server
echo [INFO] Launching Vite development server...
echo.

if "%~1"=="" (
    call npm run dev
) else (
    call npm run dev -- %*
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Development server exited with code %ERRORLEVEL%.
    pause
)
