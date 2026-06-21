#!/usr/bin/env bash
# Recognition Engine — double-click launcher (macOS)
# Starts the face-swap WebSocket server and the HTTP server, then opens the browser.

DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Recognition Engine"
echo "------------------"

# Start the face-swap WebSocket server in a separate Terminal window
osascript -e "tell application \"Terminal\" to do script \"echo 'Face-swap server'; cd '$DIR' && python3 server.py\""

# Give the swap server a moment to initialise
sleep 3

echo "HTTP server starting at http://localhost:8080"
echo "Press Ctrl-C to stop."
echo ""

# Open the poster in the default browser after a short delay
(sleep 1 && open "http://localhost:8080/poster.html") &

# Serve the recognition-engine folder over HTTP
cd "$DIR"
python3 -m http.server 8080
