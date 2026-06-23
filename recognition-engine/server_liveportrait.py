"""
Recognition Engine — LivePortrait reenactment server (real-time, back-pressured)

Drives the chosen portrait with the visitor's live expressions (mouth, blinks,
head tilt) instead of pixel-swapping a captured frame. The frontend streams
webcam frames; this server animates the portrait and streams results back.

WHY THIS REWRITE
----------------
The original streaming design lagged because it processed EVERY frame in arrival
order through a single worker. When inference is slower than the incoming frame
rate (always true on CPU), frames queue up and the portrait drifts further and
further behind real time — it ends up mirroring what you did seconds ago.

This version is BACK-PRESSURED: per station it only ever keeps the NEWEST frame
and throws away anything queued behind it. Latency becomes a constant "one
inference behind" instead of growing without bound, so the portrait always
tracks the *current* visitor — just at whatever frame rate the hardware allows.
An EMA smoother on the motion makes a low frame rate read as smooth rather than
janky.

HARDWARE REALITY
----------------
  - NVIDIA / CUDA : ~20-40 fps — genuinely smooth real-time.
  - CPU (Mac/Intel): ~0.5-2 s per frame with this stock PyTorch pipeline.
    Back-pressure stops the drift, but it is still low fps. For actually-smooth
    real-time on Mac/Intel, run an ONNX backend (FasterLivePortrait) with the
    CoreML (Mac) / OpenVINO (Intel) execution providers. The streaming protocol
    below is backend-agnostic, so that swap does not change the frontend.

SETUP
-----
1. Clone LivePortrait into the recognition-engine directory:

       git clone https://github.com/KwaiVGI/LivePortrait liveportrait
       pip install -r liveportrait/requirements.txt

2. Models download automatically from HuggingFace on first run (~600 MB).

3. Run (from recognition-engine/):

       python server_liveportrait.py

   Listens on ws://localhost:8765 — same port as server.py.

STREAMING PROTOCOL
------------------
Client → server, one JSON message per frame:
    { subject, frame(base64 JPEG), station, first(bool) }
  - first:true marks the visitor's neutral reference pose for that station.
  - The client should be REQUEST-DRIVEN: send a frame, wait for the matching
    result, then capture a FRESH frame and send that. This keeps the client
    from fire-hosing frames the server will only discard.

Server → client, one JSON message per processed frame (stale frames are dropped):
    { result(base64 JPEG), station, subject }
  or { error, station }.
"""

import asyncio
import concurrent.futures
import websockets
import json
import base64
import copy
import os
import sys
import cv2
import numpy as np

# Single worker: the model is not thread-safe and one CPU/GPU does one frame at
# a time anyway. Back-pressure (below) is what keeps us current, not parallelism.
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)

ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
LP_ROOT = os.path.join(os.path.dirname(__file__), 'liveportrait')

# Motion scales — how strongly the visitor's delta-from-neutral drives the
# portrait. Expressions are pushed hard because low frame rates wash out
# subtlety; head pose is kept moderate to avoid tearing on a still photo.
EXP_SCALE  = 4.0   # mouth / brows — most readable on a portrait
POSE_SCALE = 2.0   # yaw / pitch (turn / nod)
ROLL_SCALE = 1.0   # head tilt
T_SCALE    = 0.5   # translation — minimal, avoid drifting off-centre

# EMA smoothing of the motion delta. 0 = no smoothing (jittery, lowest latency),
# →1 = very smooth but laggy. 0.45 is a reasonable middle on low fps.
SMOOTH = 0.45

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
    from src.live_portrait_pipeline import LivePortraitPipeline
    from src.utils.crop import paste_back, prepare_paste_back
except ImportError as e:
    print(f"\n  ERROR importing LivePortrait modules: {e}")
    print("  Make sure you ran:  pip install -r liveportrait/requirements.txt\n")
    sys.exit(1)

# ---- Download model weights if missing --------------------------------------

WEIGHTS_DIR = os.path.join(LP_ROOT, 'pretrained_weights')
WEIGHTS_MARKER = os.path.join(WEIGHTS_DIR, 'liveportrait', 'base_models', 'appearance_feature_extractor.pth')

if not os.path.exists(WEIGHTS_MARKER):
    print("Model weights not found — downloading from HuggingFace (~600 MB)...")
    try:
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id='KwaiVGI/LivePortrait',
            local_dir=WEIGHTS_DIR,
            ignore_patterns=['*.git*', 'README.md', '*.DS_Store'],
        )
        print("Download complete.\n")
    except Exception as e:
        print(f"\n  ERROR downloading models: {e}")
        print("  Download manually:")
        print("    cd liveportrait")
        print("    python3 -c \"from huggingface_hub import snapshot_download; snapshot_download('KwaiVGI/LivePortrait', local_dir='pretrained_weights')\"")
        sys.exit(1)

# ---- Load pipeline ----------------------------------------------------------

print("Loading LivePortrait models...")
inference_cfg = InferenceConfig()
crop_cfg = CropConfig()
pipeline = LivePortraitPipeline(inference_cfg=inference_cfg, crop_cfg=crop_cfg)
wrapper = pipeline.live_portrait_wrapper
cropper = pipeline.cropper

# Honest device report — stock LivePortrait runs on CUDA or CPU only.
try:
    import torch
    if torch.cuda.is_available():
        print("Device: CUDA — expect smooth real-time (~20-40 fps).")
    else:
        print("Device: CPU — back-pressure stops drift, but expect LOW fps.")
        print("        For smooth real-time on Mac/Intel, switch to an ONNX")
        print("        backend (FasterLivePortrait + CoreML/OpenVINO).")
except Exception:
    pass
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
        crop_info = cropper.crop_source_image(img_rgb, crop_cfg)
        if crop_info is None:
            print(f"  WARN  {subj_id}  — no face detected in portrait")
            continue

        img_crop_256 = crop_info['img_crop_256x256']
        M_c2o = crop_info['M_c2o']
        lmk_source = crop_info['lmk_crop']

        I_s = wrapper.prepare_source(img_crop_256)
        x_s_info = wrapper.get_kp_info(I_s)
        f_s = wrapper.extract_feature_3d(I_s)
        x_s = wrapper.transform_keypoint(x_s_info)

        h_ori, w_ori = img_rgb.shape[:2]
        mask_crop = getattr(inference_cfg, 'mask_crop', None)
        if mask_crop is None:
            mask_path = os.path.join(LP_ROOT, 'assets', 'mask_template.png')
            if os.path.exists(mask_path):
                mask_crop = cv2.imread(mask_path, cv2.IMREAD_COLOR)
            else:
                mask_crop = np.ones((512, 512, 3), dtype=np.uint8) * 255
        mask_ori = prepare_paste_back(mask_crop, M_c2o, dsize=(w_ori, h_ori))

        portraits[subj_id] = {
            'img_rgb': img_rgb,
            'img_bgr': img_bgr,
            'M_c2o': M_c2o,
            'lmk_source': lmk_source,
            'x_s_info': x_s_info,
            'f_s': f_s,
            'x_s': x_s,
            'mask_ori': mask_ori,
        }
        print(f"  ok    {subj_id}")

    except Exception as e:
        print(f"  WARN  {subj_id}  — {e}")

print(f"\n{len(portraits)}/{len(PORTRAIT_FILES)} portraits ready.")
print("Listening on ws://localhost:8765  (Ctrl-C to stop)\n")


# ---- Per-station inference state -------------------------------------------

class StationState:
    """Carries the neutral reference pose and EMA smoother for one station."""
    __slots__ = ('neutral', 'ema_exp', 'ema_pose', 'ema_t')

    def __init__(self):
        self.neutral = None     # x_d_0_info — visitor's neutral keypoints
        self.ema_exp = None     # smoothed expression delta
        self.ema_pose = None    # smoothed (pitch, yaw, roll) deltas
        self.ema_t = None       # smoothed translation delta


def _infer_frame(p, driving_rgb, is_first, st):
    """Return base64 JPEG of the animated portrait, or None if no face found."""
    # PERF NOTE: crop_driving_video re-detects the visitor's face every frame,
    # which is a large slice of per-frame cost. The biggest CPU speedup left is
    # to detect once at session start and reuse a fixed crop box (the visitor
    # barely moves in a kiosk), or to switch to an ONNX backend. Left per-frame
    # here because the cropper's fixed-box API isn't wired up yet.
    ret_d = cropper.crop_driving_video([driving_rgb])
    if not ret_d or not ret_d.get('frame_crop_lst'):
        return None
    driving_crop_256 = cv2.resize(ret_d['frame_crop_lst'][0], (256, 256))

    I_d_i = wrapper.prepare_videos([driving_crop_256])[0]
    x_d_i_info = wrapper.get_kp_info(I_d_i)

    # First frame (or first ever for this station) sets the neutral reference.
    if is_first or st.neutral is None:
        st.neutral = copy.deepcopy(x_d_i_info)
        st.ema_exp = None
        st.ema_pose = None
        st.ema_t = None

    n = st.neutral

    # Raw deltas from neutral.
    d_exp   = x_d_i_info['exp']   - n['exp']
    d_pitch = x_d_i_info['pitch'] - n['pitch']
    d_yaw   = x_d_i_info['yaw']   - n['yaw']
    d_roll  = x_d_i_info['roll']  - n['roll']
    d_t     = x_d_i_info['t']     - n['t']

    # EMA smooth the deltas so low fps reads as smooth, not jittery.
    if st.ema_exp is None:
        st.ema_exp = d_exp.clone()
        st.ema_pose = (d_pitch.clone(), d_yaw.clone(), d_roll.clone())
        st.ema_t = d_t.clone()
    else:
        a = SMOOTH
        st.ema_exp = a * st.ema_exp + (1 - a) * d_exp
        st.ema_pose = (
            a * st.ema_pose[0] + (1 - a) * d_pitch,
            a * st.ema_pose[1] + (1 - a) * d_yaw,
            a * st.ema_pose[2] + (1 - a) * d_roll,
        )
        st.ema_t = a * st.ema_t + (1 - a) * d_t

    s = p['x_s_info']
    x_d_i_new = copy.deepcopy(s)
    x_d_i_new['exp']   = s['exp']   + EXP_SCALE  * st.ema_exp
    x_d_i_new['pitch'] = s['pitch'] + POSE_SCALE * st.ema_pose[0]
    x_d_i_new['yaw']   = s['yaw']   + POSE_SCALE * st.ema_pose[1]
    x_d_i_new['roll']  = s['roll']  + ROLL_SCALE * st.ema_pose[2]
    x_d_i_new['t']     = s['t']     + T_SCALE    * st.ema_t

    x_d_i_new = wrapper.transform_keypoint(x_d_i_new)

    out_dict = wrapper.warp_decode(p['f_s'], p['x_s'], x_d_i_new)
    out_rgb = wrapper.parse_output(out_dict['out'])[0]

    result_rgb = paste_back(out_rgb, p['M_c2o'], p['img_rgb'], p['mask_ori'])
    result_bgr = cv2.cvtColor(result_rgb, cv2.COLOR_RGB2BGR)

    _, buf = cv2.imencode('.jpg', result_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return base64.b64encode(buf).decode('utf-8')


# ---- WebSocket handler (back-pressured producer / consumer) ------------------

async def handle(ws):
    states = {}            # station -> StationState
    latest = {}            # station -> (subj_id, frame_b64, is_first)  newest only
    wake = asyncio.Event()
    stop = False
    loop = asyncio.get_event_loop()

    async def consumer():
        while not stop:
            await wake.wait()
            wake.clear()
            # Snapshot and clear: anything that arrives during inference will
            # repopulate `latest` and re-set `wake`, so we always pick up newest.
            jobs = list(latest.items())
            latest.clear()
            for station, (subj_id, frame_b64, is_first) in jobs:
                if subj_id not in portraits:
                    await _safe_send(ws, {'error': f'No portrait: {subj_id}', 'station': station})
                    continue
                try:
                    frame_bytes = base64.b64decode(frame_b64)
                    arr = np.frombuffer(frame_bytes, np.uint8)
                    driving_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if driving_bgr is None:
                        await _safe_send(ws, {'error': 'Bad frame data', 'station': station})
                        continue
                    driving_rgb = cv2.cvtColor(driving_bgr, cv2.COLOR_BGR2RGB)

                    st = states.setdefault(station, StationState())
                    p = portraits[subj_id]
                    result_b64 = await loop.run_in_executor(
                        _executor, _infer_frame, p, driving_rgb, is_first, st
                    )
                    if result_b64 is None:
                        await _safe_send(ws, {'error': 'No face in driving frame', 'station': station})
                        continue
                    await _safe_send(ws, {'result': result_b64, 'station': station, 'subject': subj_id})
                except websockets.exceptions.ConnectionClosed:
                    return
                except Exception as e:
                    print(f"  infer error (station={station}): {e}")

    consumer_task = asyncio.ensure_future(consumer())

    try:
        async for raw in ws:
            try:
                req = json.loads(raw)
            except Exception:
                continue
            station = req.get('station', 0)
            # Overwrite: keep only the newest frame per station, drop the rest.
            latest[station] = (req.get('subject', ''), req.get('frame', ''), req.get('first', False))
            wake.set()
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        stop = True
        wake.set()
        try:
            await consumer_task
        except Exception:
            pass


async def _safe_send(ws, obj):
    try:
        await ws.send(json.dumps(obj))
    except websockets.exceptions.ConnectionClosed:
        raise
    except Exception:
        pass


async def main():
    # ping_timeout=None: don't drop the connection while an inference is running
    # (a single frame can take 1-3 s on CPU).
    async with websockets.serve(handle, 'localhost', 8765, ping_timeout=None, max_size=None):
        await asyncio.Future()

asyncio.run(main())
