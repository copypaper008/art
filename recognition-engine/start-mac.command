#!/bin/bash
# Recognition Engine — Mac launcher
# Double-click this file in Finder to start everything.
# First run: installs deps and downloads AI models (~600 MB). Takes a few minutes.
# Subsequent runs: starts in seconds.

cd "$(dirname "$0")"

echo ""
echo "┌────────────────────────────────────────┐"
echo "│   Recognition Engine  ·  Mac Launcher  │"
echo "└────────────────────────────────────────┘"
echo ""

# ── Python ──────────────────────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
    PY=python3; PIP=pip3
elif command -v python &>/dev/null; then
    PY=python;  PIP=pip
else
    echo "  ✗  Python not found."
    echo "     Download from https://www.python.org/downloads/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi
echo "  Python: $($PY --version 2>&1)"

# ── Git ─────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    echo ""
    echo "  ✗  git not found."
    echo "     Install Xcode Command Line Tools: xcode-select --install"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""

# ── Clone LivePortrait (one-time, ~5 MB repo; models download later) ─────────
if [ ! -d "liveportrait" ]; then
    echo "  [1/3]  Cloning LivePortrait (first-time setup)..."
    if ! git clone https://github.com/KwaiVGI/LivePortrait liveportrait; then
        echo ""
        echo "  ✗  Clone failed. Check your internet connection."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "         Done."
    echo ""
fi

# ── Python dependencies (one-time) ───────────────────────────────────────────
if [ ! -f ".deps_ok" ]; then
    echo "  [2/3]  Installing Python dependencies (first-time, ~5 min)..."
    # Use the macOS-specific requirements when available — it installs the
    # correct (CPU/MPS) PyTorch build instead of a CUDA-only one.
    if [ -f "liveportrait/requirements_macOS.txt" ]; then
        REQS="liveportrait/requirements_macOS.txt"
    else
        REQS="liveportrait/requirements.txt"
    fi
    echo "         Using $REQS"
    # Use python -m pip so packages land in the same env that runs the server
    $PY -m pip install -r "$REQS" websockets
    if [ $? -ne 0 ]; then
        echo ""
        echo "  ✗  pip install failed. Try running manually:"
        echo "     $PY -m pip install -r $REQS websockets"
        read -p "Press Enter to exit..."
        exit 1
    fi
    touch .deps_ok
    echo "         Done."
    echo ""
fi

# ── Start LivePortrait WebSocket server ──────────────────────────────────────
echo "  [3/3]  Starting servers..."
echo ""
echo "         LivePortrait  →  ws://localhost:8765"
echo "         NOTE: First run downloads AI models (~600 MB). May take several"
echo "         minutes. The browser will open once they're ready."
echo ""

$PY server_liveportrait.py &
LP_PID=$!

# Poll until server is accepting connections (or give up after 5 min)
WAIT=0
until nc -z localhost 8765 2>/dev/null || [ $WAIT -ge 300 ]; do
    sleep 2; WAIT=$((WAIT + 2))
done

if ! nc -z localhost 8765 2>/dev/null; then
    echo "  ✗  LivePortrait server didn't start in time."
    echo "     Check the output above for errors."
    kill $LP_PID 2>/dev/null
    read -p "Press Enter to exit..."
    exit 1
fi

# ── Start web server ──────────────────────────────────────────────────────────
$PY -m http.server 8080 --bind 127.0.0.1 >/dev/null 2>&1 &
WEB_PID=$!
sleep 1

echo "         Web server     →  http://localhost:8080"
echo ""

# ── Open browser ─────────────────────────────────────────────────────────────
open http://localhost:8080
echo "  ✓  Browser opened."
echo ""
echo "─────────────────────────────────────────"
echo "  Recognition Engine is running."
echo "  Keep this window open."
echo "  Close it (or press Ctrl-C) to stop."
echo "─────────────────────────────────────────"
echo ""

# Shut down cleanly on exit
cleanup() {
    echo ""
    echo "  Shutting down..."
    kill $LP_PID  2>/dev/null
    kill $WEB_PID 2>/dev/null
    exit
}
trap cleanup INT TERM

# Block until the LP server exits (which keeps this window alive)
wait $LP_PID
cleanup
