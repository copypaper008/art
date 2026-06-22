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

echo "Starting HTTP server at http://localhost:8080"
python3 -m http.server 8080 &
HTTP_PID=$!

# Wait until the HTTP server is actually accepting connections before opening the browser
printf "Waiting for server"
until nc -z localhost 8080 2>/dev/null; do
  printf "."
  sleep 0.3
done
echo " ready."

# Pre-fetch the page and portrait assets so the browser finds them immediately
curl -s "http://localhost:8080/" -o /dev/null
curl -s "http://localhost:8080/assets/" -o /dev/null

echo "Opening browser..."
open "http://localhost:8080/?stations=4"

echo "Press Ctrl-C to stop."
echo ""

trap "kill $SWAP_PID $HTTP_PID 2>/dev/null" EXIT
wait
