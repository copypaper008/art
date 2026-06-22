"""
Recognition Engine — face swap server
Runs locally alongside the browser. The browser sends a captured video frame
via WebSocket; this server swaps the visitor's face onto the chosen portrait
and returns the result as a base64 JPEG.

SETUP
-----
1. Install Python deps:
       pip install insightface onnxruntime websockets opencv-python numpy gfpgan

   For GPU (much faster, ~0.3s per swap):
       pip install onnxruntime-gpu   (instead of onnxruntime)

2. Download the swap model (one-time, ~500MB):
       https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx
   Place it in THIS directory (recognition-engine/).

3. Run:
       python server.py

   The server listens on ws://localhost:8765
   Leave it running while the browser page is open.

FACE ENHANCEMENT
----------------
If gfpgan is installed, each swap result is automatically sharpened with
GFPGANv1.4 (~350 MB, downloaded on first run). This removes the soft/blurry
artefacts produced by the 128×128 inswapper model.
"""

import asyncio
import urllib.request
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
GFPGAN_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'GFPGANv1.4.pth')

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
    ('franknfurter', 'franknfurter-portrait.png'),
    ('xena',         'xena-portrait.jpeg'),
    ('maupin',       'maupin-portrait.png'),
    ('holiday',      'holiday-portrait.png'),
    ('stamp',        'stamp-portrait.png'),
    ('wilde',        'wilde-portrait.jpeg'),
    ('jack',         'jack-portrait.jpeg'),
    ('freddie',      'freddie-portrait.jpeg'),
    ('elton',        'elton-portrait.png'),
    ('baldwin',      'baldwin-portrait.jpeg'),
    ('marsha',       'marsha-portrait.jpeg'),
    ('kramer',       'kramer-portrait.png'),
    ('rupaul',       'rupaul-portrait.png'),
    ('waters',       'waters-portrait.png'),
    ('vidal',        'vidal-portrait.png'),
    ('woolf',        'woolf-portrait.png'),
    ('sappho',       'sappho-portrait.png'),
    ('hadrian',      'hadrian-portrait.png'),
    ('nathan',       'nathan-portrait.jpeg'),
    ('peterallen',   'peterallen-portrait.jpeg'),
    ('magda',        'magda-portrait.png'),
    ('brownb',       'brownb-portrait.png'),
    ('vilanch',      'vilanch-portrait.jpeg'),
    ('kake',         'kake-portrait.png'),
    ('ursula',       'ursula-portrait.jpeg'),
    ('bugs',         'bugs-portrait.jpeg'),
    ('tankgirl',     'tankgirl-portrait.jpeg'),
    ('sylvester',    'sylvester-portrait.jpeg'),
    ('vita',         'vita-portrait.jpeg'),
    ('gadsby',       'gadsby-portrait.jpeg'),
    ('kameny',       'kameny-portrait.png'),
    ('gittings',     'gittings-portrait.png'),
    ('basquiat',     'basquiat-portrait.png'),
    ('etheridge',    'etheridge-portrait.png'),
    ('stein',        'stein-portrait.png'),
    ('bechdel',      'bechdel-portrait.jpeg'),
    ('dusty',        'dusty-portrait.png'),
    ('mapplethorpe', 'mapplethorpe-portrait.png'),
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

# ---- GFPGAN face enhancer (optional) ----------------------------------------

enhancer = None
try:
    from gfpgan import GFPGANer
    if not os.path.exists(GFPGAN_MODEL_PATH):
        print("Downloading GFPGANv1.4 face enhancement model (~350 MB)...")
        urllib.request.urlretrieve(
            'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth',
            GFPGAN_MODEL_PATH,
        )
    enhancer = GFPGANer(
        model_path=GFPGAN_MODEL_PATH,
        upscale=1,
        arch='clean',
        channel_multiplier=2,
        bg_upsampler=None,
    )
    print("GFPGAN face enhancer ready.")
except Exception as e:
    print(f"  GFPGAN not available — swap results will not be enhanced ({e})")

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

            # Sharpen the swapped face with GFPGAN (removes 128×128 blur artefacts)
            if enhancer is not None:
                try:
                    _, _, enhanced = enhancer.enhance(
                        result,
                        has_aligned=False,
                        only_center_face=False,
                        paste_back=True,
                    )
                    if enhanced is not None:
                        result = enhanced
                except Exception as enh_err:
                    print(f"  enhance error (using raw swap): {enh_err}")

            _, buf = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 97])
            result_b64 = base64.b64encode(buf).decode('utf-8')

            h_img, w_img = portrait_img.shape[:2]
            kps = portrait_face.kps  # [[rx,ry],[lx,ly],[nx,ny],[rmx,rmy],[lmx,lmy]]
            left_eye_norm = [float(kps[1][0]) / w_img, float(kps[1][1]) / h_img]

            await ws.send(json.dumps({
                'result': result_b64,
                'station': station,
                'imgW': w_img,
                'imgH': h_img,
                'leftEye': left_eye_norm,
            }))
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
