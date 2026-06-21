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

# ── git (required for LivePortrait clone) ─────────────────────────────────────
if ! command -v git &>/dev/null; then
    echo ""
    echo " [ERROR] git not found."
    echo "         Install Xcode Command Line Tools:  xcode-select --install"
    exit 1
fi

# ── LivePortrait repo + dependencies (one-time) ───────────────────────────────
if [ ! -f ".deps_ok_liveportrait" ]; then
    echo ""
    echo " [1/2]  Setting up LivePortrait (first-time, ~5 min)..."
    echo ""

    if [ ! -d "liveportrait" ]; then
        echo "        Cloning LivePortrait..."
        git clone https://github.com/KwaiVGI/LivePortrait liveportrait
    fi

    echo "        Installing Python dependencies..."
    pip3 install -r liveportrait/requirements.txt

    echo "        Pre-downloading models from HuggingFace (~600 MB)..."
    python3 - <<'PYEOF'
import sys
sys.path.insert(0, 'liveportrait')
from src.config.inference_config import InferenceConfig
from src.config.crop_config import CropConfig
from src.live_portrait_pipeline import LivePortraitPipeline
LivePortraitPipeline(inference_cfg=InferenceConfig(), crop_cfg=CropConfig())
print("  Models ready.")
PYEOF

    touch .deps_ok_liveportrait
    echo "        Done."
    echo ""
fi

# ── Start LivePortrait server ─────────────────────────────────────────────────
echo " [2/2]  Starting servers..."
echo ""
echo "        LivePortrait server  >  ws://localhost:8765"

python3 server_liveportrait.py &
SWAP_PID=$!

# Wait for port 8765 (up to 60 s)
WAIT=0
until lsof -i :8765 &>/dev/null || [ $WAIT -ge 60 ]; do
    sleep 1
    WAIT=$((WAIT+1))
done
if ! lsof -i :8765 &>/dev/null; then
    echo " [ERROR] LivePortrait server did not start. Check for errors above."
    kill $SWAP_PID 2>/dev/null || true
    exit 1
fi

python3 -m http.server 8080 --bind 127.0.0.1 &
HTTP_PID=$!
sleep 1

echo "        Web server          >  http://localhost:8080"
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
