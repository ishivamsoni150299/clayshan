@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Usage:
REM   set SILVERBENE_ACCESS_TOKEN=YOUR_TOKEN && scripts\run-ssr.bat
REM   or create silverbene.token (single line) in project root

set ROOT_DIR=%~dp0..
pushd "%ROOT_DIR%" >NUL

set TOKEN=%SILVERBENE_ACCESS_TOKEN%
if "%TOKEN%"=="" (
  if exist "silverbene.token" (
    for /f "usebackq delims=" %%A in ("silverbene.token") do set TOKEN=%%A
  )
)
if "%TOKEN%"=="" (
  echo SILVERBENE token not provided. Set SILVERBENE_ACCESS_TOKEN or create silverbene.token
  exit /b 1
)

set NO_DB_CATALOG=1
if "%PORT%"=="" set PORT=4000
if "%EXCHANGE_RATE_USD_INR%"=="" set EXCHANGE_RATE_USD_INR=83
if "%SUPPLIER_CACHE_TTL_MS%"=="" set SUPPLIER_CACHE_TTL_MS=300000
set SILVERBENE_ACCESS_TOKEN=%TOKEN%

echo Building app (SSR)...
npx ng build || goto :error

set SERVER=dist\clayshan\server\server.mjs
if not exist "%SERVER%" (
  echo Server bundle not found: %SERVER%
  exit /b 1
)

echo Starting SSR/API on http://localhost:%PORT%
node "%SERVER%"
goto :eof

:error
echo Build failed
exit /b 1

