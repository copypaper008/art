#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo ""
echo " +------------------------------------------+"
echo " |  Recognition Engine  ·  Mac Launcher     |"
echo " +------------------------------------------+"
echo ""

# ── Python ────────────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo " [ERROR] python3 not found."
    echo "         Install from https://www.python.org/downloads/"
    exit 1
fi
echo " Python: $(python3 --version)"

# ── inswapper model ───────────────────────────────────────────────────────────
if [ ! -f "inswapper_128.onnx" ]; then
    echo ""
    echo " [ERROR] inswapper_128.onnx not found in recognition-engine/"
    echo "         Download it from:"
    echo "   https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx"
    echo "         Then place it in this folder and run this script again."
    exit 1
fi

# ── Python dependencies (one-time) ────────────────────────────────────────────
if [ ! -f ".deps_ok_v2" ]; then
    echo ""
    echo " [1/2]  Installing Python dependencies (first-time, ~2 min)..."
    pip3 install insightface onnxruntime websockets opencv-python numpy gfpgan
    touch .deps_ok_v2
    echo "        Done."
    echo ""
fi

# ── Start swap server ─────────────────────────────────────────────────────────
echo " [2/2]  Starting servers..."
echo ""
echo "        Swap server  >  ws://localhost:8765"

python3 server.py &
SWAP_PID=$!

# Wait for port 8765 (up to 60 s)
WAIT=0
until lsof -i :8765 &>/dev/null || [ $WAIT -ge 60 ]; do
    sleep 1
    WAIT=$((WAIT+1))
done
if ! lsof -i :8765 &>/dev/null; then
    echo " [ERROR] Swap server did not start. Check for errors above."
    kill $SWAP_PID 2>/dev/null || true
    exit 1
fi

python3 -m http.server 8080 --bind 127.0.0.1 &
HTTP_PID=$!
sleep 1

echo "        Web server   >  http://localhost:8080"
echo ""
open "http://localhost:8080/poster.html"

echo " [OK]  Browser opened."
echo ""
echo " +--------------------------------------------+"
echo " |  Recognition Engine is running.            |"
echo " |  Press Ctrl-C to stop both servers.        |"
echo " +--------------------------------------------+"
echo ""

# Keep running; clean up both servers on exit
trap "kill $SWAP_PID $HTTP_PID 2>/dev/null; echo '  Stopped.'" INT TERM
wait
