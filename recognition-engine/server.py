"""
Recognition Engine — face swap server
Runs locally alongside the browser. The browser sends a captured video frame
via WebSocket; this server swaps the visitor's face onto the chosen portrait
and returns the result as a base64 JPEG.

SETUP
-----
1. Install Python deps:
       pip install insightface onnxruntime websockets opencv-python numpy

   For GPU (much faster, ~0.3s per swap):
       pip install onnxruntime-gpu   (instead of onnxruntime)

2. Download the swap model (one-time, ~500MB):
       https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx
   Place it in THIS directory (recognition-engine/).

3. Run:
       python server.py

   The server listens on ws://localhost:8765
   Leave it running while the browser page is open.
"""

import asyncio
import websockets
import json
import base64
import os
import sys
import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'inswapper_128.onnx')

PORTRAIT_FILES = [
    ('warhol',       'warhol-portrait.jpeg'),
    ('haring',       'haring-portrait.jpeg'),
    ('milk',         'milk-portrait.jpeg'),
    ('turing',       'turing-portrait.jpeg'),
    ('dietrich',     'dietrich-portrait.jpeg'),
    ('sondheim',     'sondheim-portrait.jpeg'),
    ('lorde',        'lorde-portrait.jpeg'),
    ('divine',       'divine-portrait.jpeg'),
    ('ernie',        'ernie-portrait.jpeg'),
    ('franknfurter', 'franknfurter-portrait.jpeg'),
    ('xena',         'xena-portrait.jpeg'),
    ('maupin',       'maupin-portrait.jpeg'),
    ('holiday',      'holiday-portrait.jpeg'),
    ('stamp',        'stamp-portrait.jpeg'),
    ('wilde',        'wilde-portrait.jpeg'),
    ('jack',         'jack-portrait.jpeg'),
]

# ---- startup ----------------------------------------------------------------

if not os.path.exists(MODEL_PATH):
    print(f"\n  ERROR: inswapper_128.onnx not found at:\n  {MODEL_PATH}\n")
    print("  Download it from:")
    print("  https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx\n")
    sys.exit(1)

print("Loading face analysis models (buffalo_l)...")
fa = FaceAnalysis(
    name='buffalo_l',
    providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
)
fa.prepare(ctx_id=0, det_size=(640, 640))

print("Loading inswapper_128...")
swapper = insightface.model_zoo.get_model(MODEL_PATH)

print("Pre-loading portraits...")
portraits = {}
for subj_id, filename in PORTRAIT_FILES:
    path = os.path.join(ASSETS, filename)
    if not os.path.exists(path):
        print(f"  skip  {subj_id} (file not found)")
        continue
    img = cv2.imread(path)
    if img is None:
        print(f"  skip  {subj_id} (failed to decode)")
        continue
    faces = fa.get(img)
    if not faces:
        print(f"  WARN  {subj_id} — no face detected in portrait, will skip swaps")
        continue
    # keep the largest detected face
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    portraits[subj_id] = (img, face)
    print(f"  ok    {subj_id}")

print(f"\n{len(portraits)}/{len(PORTRAIT_FILES)} portraits ready.")
print("Listening on ws://localhost:8765  (Ctrl-C to stop)\n")


# ---- WebSocket handler ------------------------------------------------------

async def handle(ws):
    async for msg in ws:
        try:
            req = json.loads(msg)
            subj_id = req.get('subject', '')
            frame_b64 = req.get('frame', '')
            station = req.get('station', 0)

            if subj_id not in portraits:
                await ws.send(json.dumps({'error': f'No portrait for: {subj_id}', 'station': station}))
                continue

            # Decode visitor frame
            frame_bytes = base64.b64decode(frame_b64)
            arr = np.frombuffer(frame_bytes, np.uint8)
            visitor_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if visitor_img is None:
                await ws.send(json.dumps({'error': 'Bad frame data', 'station': station}))
                continue

            # Detect visitor faces
            visitor_faces = fa.get(visitor_img)
            if not visitor_faces:
                await ws.send(json.dumps({'error': 'No face detected in visitor frame', 'station': station}))
                continue

            portrait_img, portrait_face = portraits[subj_id]
            visitor_face = max(visitor_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

            # Swap: visitor's face → portrait body
            result = swapper.get(portrait_img.copy(), portrait_face, visitor_face, paste_back=True)

            _, buf = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 92])
            result_b64 = base64.b64encode(buf).decode('utf-8')

            await ws.send(json.dumps({'result': result_b64, 'station': station}))
            print(f"  swapped station={station} subject={subj_id}")

        except Exception as e:
            print(f"  error: {e}")
            try:
                await ws.send(json.dumps({'error': str(e), 'station': req.get('station', 0)}))
            except Exception:
                pass


async def main():
    async with websockets.serve(handle, 'localhost', 8765):
        await asyncio.Future()  # run forever

asyncio.run(main())
