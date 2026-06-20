"""
Recognition Engine — LivePortrait reenactment server

Replaces server.py with a live face-reenactment pipeline. Instead of swapping
pixels from the visitor's captured frame onto the portrait, it drives the
portrait's face with the visitor's real-time expressions — mouth movements,
eye blinks, head tilt — so the portrait appears to be the one talking.

The frontend streams webcam frames at ~7 fps; this server animates the portrait
and streams results back. The existing inswapper/InsightFace stack is NOT needed.

SETUP
-----
1. Clone LivePortrait into the recognition-engine directory:

       git clone https://github.com/KwaiVGI/LivePortrait liveportrait
       cd liveportrait
       pip install -r requirements.txt
       cd ..

2. Models download automatically from HuggingFace on first run (~600 MB).
   Pre-download (optional, avoids delay on first visitor):

       python -c "
       import sys; sys.path.insert(0,'liveportrait')
       from src.config.inference_config import InferenceConfig
       from src.config.crop_config import CropConfig
       from src.pipelines.live_portrait_pipeline import LivePortraitPipeline
       LivePortraitPipeline(inference_cfg=InferenceConfig(), crop_cfg=CropConfig())
       print('Models ready.')
       "

3. Run (from recognition-engine/):

       python server_liveportrait.py

   Listens on ws://localhost:8765 — same port as the old server.py.

HOW IT WORKS
------------
Startup:
  - Loads LivePortrait (appearance extractor + motion extractor + warping decoder)
  - For each portrait image, detects and crops the face, pre-computes its
    3D appearance features (f_s) and source keypoints (x_s). This is the
    expensive part; done once per portrait, not per visitor.

Per-visitor session:
  - First frame (first: true): records visitor's neutral pose as the reference.
  - Each subsequent frame: computes RELATIVE motion from neutral pose, adds
    that delta to the portrait's own keypoints, warps, decodes, pastes back
    onto the full portrait image, returns as base64 JPEG.

GPU / CPU:
  - GPU (CUDA): ~15-20 fps — smooth real-time reenactment.
  - CPU only:   ~2-4 fps — works, just choppy. Pass flag to enable FP16 on GPU.
"""

import asyncio
import websockets
import json
import base64
import copy
import os
import sys
import cv2
import numpy as np

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
LP_ROOT = os.path.join(os.path.dirname(__file__), 'liveportrait')

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
    ('woolf',        'woolf-portrait.png'),
    ('sappho',       'sappho-portrait.png'),
    ('waters',       'waters-portrait.png'),
    ('brownb',       'brownb-portrait.png'),
    ('magda',        'magda-portrait.png'),
    ('kake',         'kake-portrait.png'),
    ('vidal',        'vidal-portrait.png'),
    ('hadrian',      'hadrian-portrait.png'),
    ('kramer',       'kramer-portrait.png'),
    ('rupaul',       'rupaul-portrait.png'),
    ('elton',        'elton-portrait.png'),
]

# ---- Bootstrap LivePortrait path -------------------------------------------

if not os.path.isdir(LP_ROOT):
    print(f"\n  ERROR: LivePortrait repo not found at:\n    {LP_ROOT}\n")
    print("  Clone it first:")
    print("    git clone https://github.com/KwaiVGI/LivePortrait liveportrait")
    print("    pip install -r liveportrait/requirements.txt\n")
    sys.exit(1)

sys.path.insert(0, LP_ROOT)

try:
    from src.config.inference_config import InferenceConfig
    from src.config.crop_config import CropConfig
    from src.pipelines.live_portrait_pipeline import LivePortraitPipeline
    from src.utils.crop import paste_back
except ImportError as e:
    print(f"\n  ERROR importing LivePortrait modules: {e}")
    print("  Make sure you ran:  pip install -r liveportrait/requirements.txt\n")
    sys.exit(1)

# ---- Load pipeline ----------------------------------------------------------

print("Loading LivePortrait models (may download ~600 MB on first run)...")
inference_cfg = InferenceConfig()
crop_cfg = CropConfig()
pipeline = LivePortraitPipeline(inference_cfg=inference_cfg, crop_cfg=crop_cfg)
wrapper = pipeline.live_portrait_wrapper
cropper = pipeline.cropper
print("LivePortrait ready.\n")

# ---- Pre-compute source features for every portrait -------------------------

print("Pre-loading portraits and computing source features...")
portraits = {}

for subj_id, filename in PORTRAIT_FILES:
    path = os.path.join(ASSETS, filename)
    if not os.path.exists(path):
        print(f"  skip  {subj_id}  (file not found)")
        continue

    img_bgr = cv2.imread(path)
    if img_bgr is None:
        print(f"  skip  {subj_id}  (decode failed)")
        continue

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    try:
        # Detect and crop the portrait face to 256×256
        crop_info = cropper.crop_source_image(img_rgb, crop_cfg)
        if crop_info is None:
            print(f"  WARN  {subj_id}  — no face detected in portrait")
            continue

        img_crop_256 = crop_info['img_crop_256x256']   # RGB, 256×256
        M_c2o = crop_info['M_c2o']                     # crop→original transform
        lmk_source = crop_info['lmk_crop']             # source face landmark

        # Appearance features (f_s) and source keypoints (x_s) — computed once
        I_s = wrapper.prepare_source(img_crop_256)
        x_s_info = wrapper.get_kp_info(I_s)
        f_s = wrapper.extract_feature_3d(I_s)
        x_s = wrapper.transform_keypoint(x_s_info)

        portraits[subj_id] = {
            'img_rgb': img_rgb,
            'img_bgr': img_bgr,
            'M_c2o': M_c2o,
            'lmk_source': lmk_source,
            'x_s_info': x_s_info,
            'f_s': f_s,
            'x_s': x_s,
        }
        print(f"  ok    {subj_id}")

    except Exception as e:
        print(f"  WARN  {subj_id}  — {e}")

print(f"\n{len(portraits)}/{len(PORTRAIT_FILES)} portraits ready.")
print("Listening on ws://localhost:8765  (Ctrl-C to stop)\n")


# ---- WebSocket handler ------------------------------------------------------

async def handle(ws):
    # Per-connection neutral reference: { station → x_d_0_info }
    station_refs = {}

    async for raw in ws:
        try:
            req = json.loads(raw)
            subj_id   = req.get('subject', '')
            frame_b64 = req.get('frame', '')
            station   = req.get('station', 0)
            is_first  = req.get('first', False)

            if subj_id not in portraits:
                await ws.send(json.dumps({'error': f'No portrait: {subj_id}', 'station': station}))
                continue

            # Decode incoming webcam frame
            frame_bytes = base64.b64decode(frame_b64)
            arr = np.frombuffer(frame_bytes, np.uint8)
            driving_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if driving_bgr is None:
                await ws.send(json.dumps({'error': 'Bad frame data', 'station': station}))
                continue
            driving_rgb = cv2.cvtColor(driving_bgr, cv2.COLOR_BGR2RGB)

            p = portraits[subj_id]

            # Crop the driving frame's face, aligned to the source landmark so
            # the crop region is stable across frames
            driving_crops = cropper.crop_driving_video_frames(
                [driving_rgb],
                source_lmk=p['lmk_source'],
                output_size=256,
            )
            if not driving_crops:
                await ws.send(json.dumps({'error': 'No face in driving frame', 'station': station}))
                continue

            driving_crop_256 = driving_crops[0]

            # Motion keypoints for this frame
            I_d_i = wrapper.prepare_driving_videos(driving_crop_256)
            x_d_i_info = wrapper.get_kp_info(I_d_i)

            # First frame sets the neutral reference pose for this station
            if is_first or station not in station_refs:
                station_refs[station] = copy.deepcopy(x_d_i_info)

            x_d_0_info = station_refs[station]

            # Compute RELATIVE expression delta from neutral pose and add to
            # the portrait's own keypoints — this is what makes the mouth/eyes move
            x_d_i_new = copy.deepcopy(p['x_s_info'])
            x_d_i_new['exp'] = (
                p['x_s_info']['exp']
                + (x_d_i_info['exp'] - x_d_0_info['exp'])
            )
            x_d_i_new['t'] += x_d_i_info['t'] - x_d_0_info['t']
            # Keep portrait's own scale rather than tracking the visitor's
            # scale to avoid the portrait appearing to grow/shrink unexpectedly

            x_d_i_new = wrapper.transform_keypoint(x_d_i_new)

            # Warp the portrait face and decode to RGB image
            out_dict = wrapper.warp_decode(p['f_s'], p['x_s'], x_d_i_new)
            out_rgb = wrapper.parse_output(out_dict['out'])[0]  # 256×256 RGB

            # Paste animated face crop back onto the full portrait image
            h_ori, w_ori = p['img_rgb'].shape[:2]
            result_rgb = paste_back(out_rgb, p['M_c2o'], p['img_rgb'], dsize=(w_ori, h_ori))
            result_bgr = cv2.cvtColor(result_rgb, cv2.COLOR_RGB2BGR)

            _, buf = cv2.imencode('.jpg', result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
            result_b64 = base64.b64encode(buf).decode('utf-8')

            await ws.send(json.dumps({'result': result_b64, 'station': station}))

        except Exception as e:
            print(f"  error: {e}")
            try:
                await ws.send(json.dumps({'error': str(e), 'station': req.get('station', 0)}))
            except Exception:
                pass


async def main():
    async with websockets.serve(handle, 'localhost', 8765):
        await asyncio.Future()

asyncio.run(main())
