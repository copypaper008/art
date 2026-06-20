@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Recognition Engine — Launcher

echo.
echo  +------------------------------------------+
echo  ^|  Recognition Engine  ·  Windows Launcher ^|
echo  +------------------------------------------+
echo.

:: ── Python ──────────────────────────────────────────────────────────────────
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found.
    echo          Download from https://www.python.org/downloads/
    echo          Make sure "Add Python to PATH" is checked during install.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  Python: %%v

:: ── Git ─────────────────────────────────────────────────────────────────────
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] git not found.
    echo          Download from https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
echo.

:: ── Clone LivePortrait (one-time) ────────────────────────────────────────────
if not exist "liveportrait" (
    echo  [1/3]  Cloning LivePortrait ^(first-time setup^)...
    git clone https://github.com/KwaiVGI/LivePortrait liveportrait
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Clone failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo         Done.
    echo.
)

:: ── Python dependencies (one-time) ───────────────────────────────────────────
if not exist ".deps_ok" (
    echo  [2/3]  Installing Python dependencies ^(first-time, ~5 min^)...
    pip install -r liveportrait\requirements.txt websockets
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] pip install failed.
        echo          Try running manually: pip install -r liveportrait\requirements.txt websockets
        pause
        exit /b 1
    )
    echo. > .deps_ok
    echo         Done.
    echo.
)

:: ── Start LivePortrait WebSocket server ──────────────────────────────────────
echo  [3/3]  Starting servers...
echo.
echo         LivePortrait  ^>  ws://localhost:8765
echo         NOTE: First run downloads AI models ^(~600 MB^). May take several
echo         minutes before the browser opens.
echo.

start "LivePortrait Server" cmd /k "cd /d "%~dp0" && python server_liveportrait.py"

:: Wait for the LivePortrait server to be ready (poll port 8765, up to 5 min)
set WAIT=0
:POLL
powershell -Command "try { $c = New-Object Net.Sockets.TcpClient('localhost',8765); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 goto READY
timeout /t 3 /nobreak >nul
set /a WAIT+=3
if %WAIT% lss 300 goto POLL
echo  [ERROR] Server did not start within 5 minutes.
echo          Check the LivePortrait Server window for errors.
pause
exit /b 1

:READY

:: ── Start web server ─────────────────────────────────────────────────────────
start "Web Server" cmd /k "cd /d "%~dp0" && python -m http.server 8080 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul

echo         Web server     ^>  http://localhost:8080
echo.

:: ── Open browser ─────────────────────────────────────────────────────────────
start http://localhost:8080
echo  [OK]  Browser opened.
echo.
echo  +--------------------------------------------+
echo  ^|  Recognition Engine is running.            ^|
echo  ^|  Close the two server windows to stop.     ^|
echo  +--------------------------------------------+
echo.
pause
