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
echo.

:: ── inswapper model ──────────────────────────────────────────────────────────
if not exist "inswapper_128.onnx" (
    echo  [ERROR] inswapper_128.onnx not found in recognition-engine\
    echo.
    echo          Download it from:
    echo    https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx
    echo.
    echo          Then place it in this folder and run this script again.
    echo.
    pause
    exit /b 1
)

:: ── Python dependencies (one-time) ───────────────────────────────────────────
if not exist ".deps_ok_v2" (
    echo  [1/2]  Installing Python dependencies ^(first-time, ~2 min^)...
    pip install insightface onnxruntime websockets opencv-python numpy gfpgan
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] pip install failed.
        echo          Try running manually:
        echo            pip install insightface onnxruntime websockets opencv-python numpy gfpgan
        pause
        exit /b 1
    )
    echo. > .deps_ok_v2
    echo         Done.
    echo.
)

:: ── Start swap server ─────────────────────────────────────────────────────────
echo  [2/2]  Starting servers...
echo.
echo         Swap server  ^>  ws://localhost:8765
echo.

start "Swap Server" cmd /k "cd /d "%~dp0" && python server.py"

:: Wait for port 8765 (up to 60 s)
set WAIT=0
:POLL
powershell -Command "try { $c = New-Object Net.Sockets.TcpClient('localhost',8765); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 goto READY
timeout /t 2 /nobreak >nul
set /a WAIT+=2
if %WAIT% lss 60 goto POLL
echo  [ERROR] Swap server did not start within 60 seconds.
echo          Check the Swap Server window for errors.
pause
exit /b 1

:READY

:: ── Start web server ─────────────────────────────────────────────────────────
start "Web Server" cmd /k "cd /d "%~dp0" && python -m http.server 8080 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul

echo         Web server   ^>  http://localhost:8080
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
