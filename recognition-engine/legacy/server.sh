#!/usr/bin/env bash
# Recognition Engine — local server
# Starts a minimal HTTP server so MediaPipe WASM loads correctly.
# Open http://localhost:8080 in Chrome or Firefox.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8080

# Check vendor assets are present
if [ ! -f "$DIR/vendor/mediapipe/vision_bundle.mjs" ]; then
  echo ""
  echo "  Vendor assets missing. Run ./setup.sh first."
  echo ""
  exit 1
fi

echo ""
echo "Recognition Engine"
echo "------------------"
echo "Serving at:  http://localhost:$PORT"
echo "Press Ctrl-C to stop."
echo ""

# Open browser after a short delay (works on macOS and most Linux desktops)
(sleep 1 && \
  (open "http://localhost:$PORT" 2>/dev/null || \
   xdg-open "http://localhost:$PORT" 2>/dev/null || true)) &

# Python 3 built-in server — no install required
cd "$DIR"
python3 -m http.server $PORT
