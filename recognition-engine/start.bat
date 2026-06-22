@echo off
REM Recognition Engine — launcher (Windows)
REM Starts the face-swap WebSocket server and the HTTP server, then opens the browser.

cd /d "%~dp0"

echo.
echo Recognition Engine
echo ------------------

REM Start the face-swap WebSocket server in a new window
start "Face-Swap Server" cmd /k python server.py

REM Give the swap server a moment to initialise
timeout /t 3 /nobreak > nul

echo HTTP server starting at http://localhost:8080
echo Close this window to stop the HTTP server.
echo.

REM Open the poster in the default browser
start "" "http://localhost:8080/poster.html"

REM Serve the recognition-engine folder over HTTP
python -m http.server 8080
