#!/usr/bin/env bash
# Recognition Engine — double-click launcher (macOS)

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "Recognition Engine"
echo "------------------"
echo "Starting face-swap server..."
python3 server.py &
SWAP_PID=$!

sleep 3

echo "Starting HTTP server at http://localhost:8080"
echo "Press Ctrl-C to stop both servers."
echo ""

(sleep 1 && open "http://localhost:8080/poster.html") &

trap "kill $SWAP_PID 2>/dev/null" EXIT
python3 -m http.server 8080
