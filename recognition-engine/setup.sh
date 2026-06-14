#!/usr/bin/env bash
# Recognition Engine — one-time asset setup
# Run this once on any machine before opening the piece.
# Requires: curl, npm (or just curl if npm unavailable)
# After this runs, the piece works fully offline.

set -e

VENDOR="$(cd "$(dirname "$0")" && pwd)/vendor/mediapipe"
BASE_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"

echo ""
echo "Recognition Engine — downloading vendor assets"
echo "----------------------------------------------"

mkdir -p "$VENDOR/wasm" "$VENDOR/models"

download() {
  local url="$1"
  local dest="$2"
  local label="$3"
  if [ -f "$dest" ]; then
    echo "  [skip] $label already present"
  else
    echo "  [get]  $label"
    curl -L --silent --show-error --progress-bar "$url" -o "$dest"
  fi
}

download "$BASE_URL/vision_bundle.mjs" \
         "$VENDOR/vision_bundle.mjs" \
         "vision_bundle.mjs"

download "$BASE_URL/wasm/vision_wasm_internal.js" \
         "$VENDOR/wasm/vision_wasm_internal.js" \
         "wasm/vision_wasm_internal.js"

download "$BASE_URL/wasm/vision_wasm_internal.wasm" \
         "$VENDOR/wasm/vision_wasm_internal.wasm" \
         "wasm/vision_wasm_internal.wasm  (~9 MB)"

download "$BASE_URL/wasm/vision_wasm_nosimd_internal.js" \
         "$VENDOR/wasm/vision_wasm_nosimd_internal.js" \
         "wasm/vision_wasm_nosimd_internal.js"

download "$BASE_URL/wasm/vision_wasm_nosimd_internal.wasm" \
         "$VENDOR/wasm/vision_wasm_nosimd_internal.wasm" \
         "wasm/vision_wasm_nosimd_internal.wasm  (~9 MB)"

download "$MODEL_URL" \
         "$VENDOR/models/blaze_face_short_range.tflite" \
         "models/blaze_face_short_range.tflite  (~225 KB)"

echo ""
echo "Done. Run ./server.sh to start the piece."
echo ""
