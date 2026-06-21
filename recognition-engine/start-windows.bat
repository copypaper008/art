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

:: ── git (required for LivePortrait clone) ────────────────────────────────────
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] git not found.
    echo          Download from https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

:: ── LivePortrait repo + dependencies (one-time) ──────────────────────────────
if not exist ".deps_ok_liveportrait" (
    echo  [1/2]  Setting up LivePortrait ^(first-time, ~5 min^)...
    echo.

    if not exist "liveportrait" (
        echo         Cloning LivePortrait...
        git clone https://github.com/KwaiVGI/LivePortrait liveportrait
        if %errorlevel% neq 0 (
            echo.
            echo  [ERROR] git clone failed. Check your internet connection.
            pause
            exit /b 1
        )
    )

    echo         Installing Python dependencies...
    pip install -r liveportrait\requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] pip install failed.
        echo          Try running manually:
        echo            pip install -r liveportrait\requirements.txt
        pause
        exit /b 1
    )

    echo         Pre-downloading models from HuggingFace ^(~600 MB^)...
    python -c "import sys; sys.path.insert(0,'liveportrait'); from src.config.inference_config import InferenceConfig; from src.config.crop_config import CropConfig; from src.live_portrait_pipeline import LivePortraitPipeline; LivePortraitPipeline(inference_cfg=InferenceConfig(), crop_cfg=CropConfig()); print('  Models ready.')"
    if %errorlevel% neq 0 (
        echo.
        echo  [WARN] Model pre-download may have failed. Will retry on first run.
    )

    echo. > .deps_ok_liveportrait
    echo         Done.
    echo.
)

:: ── Start LivePortrait server ─────────────────────────────────────────────────
echo  [2/2]  Starting servers...
echo.
echo         LivePortrait server  ^>  ws://localhost:8765
echo.

start "LivePortrait Server" cmd /k "cd /d "%~dp0" && python server_liveportrait.py"

:: Wait for port 8765 (up to 60 s)
set WAIT=0
:POLL
powershell -Command "try { $c = New-Object Net.Sockets.TcpClient('localhost',8765); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 goto READY
timeout /t 2 /nobreak >nul
set /a WAIT+=2
if %WAIT% lss 60 goto POLL
echo  [ERROR] LivePortrait server did not start within 60 seconds.
echo          Check the LivePortrait Server window for errors.
pause
exit /b 1

:READY

:: ── Start web server ─────────────────────────────────────────────────────────
start "Web Server" cmd /k "cd /d "%~dp0" && python -m http.server 8080 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul

echo         Web server          ^>  http://localhost:8080
echo.

:: ── Open browser ─────────────────────────────────────────────────────────────
start http://localhost:8080/poster.html
echo  [OK]  Browser opened.
echo.
echo  +--------------------------------------------+
echo  ^|  Recognition Engine is running.            ^|
echo  ^|  Close the two server windows to stop.     ^|
echo  +--------------------------------------------+
echo.
pause
