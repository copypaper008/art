@echo off
REM Recognition Engine — launcher (Windows)
REM Starts the face-swap WebSocket server and the HTTP server, then opens the browser.

cd /d "%~dp0"

echo.
echo Recognition Engine
echo ------------------

REM Start the face-swap WebSocket server in a separate window
start "Face-Swap Server" cmd /k python server.py

REM Start the HTTP server in a separate window
start "HTTP Server" cmd /k python -m http.server 8080

REM Wait until the HTTP server is accepting connections, then open the browser last
echo Waiting for server...
:wait_loop
timeout /t 1 /nobreak > nul
powershell -NoProfile -Command "try { $t = New-Object Net.Sockets.TcpClient('localhost',8080); $t.Close(); exit 0 } catch { exit 1 }" 2>nul
if errorlevel 1 goto wait_loop

echo Server ready. Opening browser...
start "" "http://localhost:8080/poster.html"

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
