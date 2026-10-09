@echo off
setlocal
rem  LicenseForge release launcher (Windows)
rem
rem  Why this file exists: the site uses absolute asset paths (/_next/..., /data/...)
rem  and fetch() to load its data, so opening index.html directly with file:// does NOT
rem  work - browsers refuse file:// fetch with a CORS error. A local HTTP server is
rem  required. This script picks a runtime and starts one.
rem
rem  Content is kept ASCII-only on purpose: cmd.exe parses a batch file using the
rem  console codepage, and Chinese text written as UTF-8 would be mis-decoded and could
rem  break parsing. Keep this file ASCII.

cd /d "%~dp0"

if not exist "index.html" (
  echo [ERROR] index.html not found in this folder.
  echo This launcher must live in the extracted release folder.
  echo.
  pause
  exit /b 1
)
if not exist "server.mjs" (
  echo [ERROR] server.mjs not found.
  echo It ships with the release archive and must stay next to index.html.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if not errorlevel 1 goto :node

where python >nul 2>nul
if not errorlevel 1 goto :python
where py >nul 2>nul
if not errorlevel 1 goto :pyLauncher

echo [ERROR] Neither Node.js nor Python was found on this computer.
echo.
echo Install one of them, then run this file again:
echo    Node.js   https://nodejs.org/
echo    Python    https://www.python.org/
echo.
echo No internet? Node.js only needs to be on PATH - the server has no dependencies.
echo.
pause
exit /b 1

:node
echo Starting with Node.js.
echo The server opens your browser automatically.
echo Close this window to stop the server.
echo.
node server.mjs 8080
goto :done

:python
start "" /min cmd /c "python -m http.server 8080 --bind 127.0.0.1"
goto :openBrowser

:pyLauncher
start "" /min cmd /c "py -m http.server 8080 --bind 127.0.0.1"
goto :openBrowser

:openBrowser
rem  Wait for Python to bind, then open the browser ourselves - the Python fallback
rem  cannot report its port back here, so 8080 must be free (start.cmd chose it).
ping -n 4 127.0.0.1 >nul
start "" http://127.0.0.1:8080/
echo Server is running in a minimized window.
echo Close that window to stop the server.
echo.
pause

:done
endlocal
