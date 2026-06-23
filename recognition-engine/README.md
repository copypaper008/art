# Recognition Engine

An interactive kiosk installation. One webcam. Up to four stations. When someone
steps into a panel's zone their face is locked onto, a "Subject Analysis Report"
card assembles around them while a mock scan runs — face-swapping the visitor's
features onto a randomly chosen historical figure — and a pop-art verdict stamp
slams down. It then resets automatically and waits for the next person.

The piece is a critique of automated classification: the machine reaches a
confident verdict it is "unable to explain."

---

## Installation layout

Built for a **43" 4K monitor in landscape (3840 × 2160)** showing **four
independent stations** simultaneously:

```
4 panels × 1040 px  +  3 gaps × 20 px  =  3160 px   (each card 1040 × 1560)
```

Four people stand on four floor marks; each gets their own analysis at once.

**One webcam feeds all four.** The camera frame is split into four vertical
detection zones (left → right = panel 1 → 4). Each zone independently arms,
locks onto a held face (~0.85 s), and runs its own scan with its own randomly
chosen subject. The full stage scales to fit any screen.

---

## Files

```
index.html               ← the main app. EDIT HERE.
support.js               ← DC runtime (React 18). Do not edit.
wink-portrait.js         ← <wink-portrait> custom element (auto-winks a portrait)
live-puppet.js           ← <live-puppet> custom element (in-browser real-time puppet, ?puppet=1)
server.py                ← face-swap backend (InsightFace + inswapper_128.onnx)
server_liveportrait.py   ← live reenactment backend (LivePortrait + ?mirror=1). Not wired to launchers.
start-mac.command        ← one-double-click launcher for macOS (opens 4-station view)
start-windows.bat        ← one-double-click launcher for Windows (opens 4-station view)
assets/                  ← portrait images (full B&W photos + face-cutout PNGs)
stamps/                  ← per-subject ink-stamp SVG animations (*.dc.html)
legacy/                  ← original p5.js + MediaPipe prototype (unused)
```

---

## Running it

### Quick start (double-click launcher)

**macOS:** double-click `start-mac.command`
**Windows:** double-click `start-windows.bat`

The launcher:
1. Checks Python 3 is installed
2. Checks `inswapper_128.onnx` is present (see below)
3. Installs Python deps on first run (~2 min): `insightface onnxruntime websockets opencv-python numpy gfpgan`
4. Starts the face-swap server on `ws://localhost:8765`
5. Starts a static web server on `http://localhost:8080`
6. Opens `http://localhost:8080/?stations=4` in the browser (full 4-panel installation)

**Press Ctrl-C to stop both servers.**

### Manual start (terminal)

```bash
# Navigate to the recognition-engine folder
cd path/to/art/recognition-engine

# Start the face-swap server (background)
python3 server.py &

# Start the static web server (background)
python3 -m http.server 8080 --bind 127.0.0.1 &

# Open in browser
open "http://localhost:8080/?stations=4"    # macOS
start "http://localhost:8080/?stations=4"   # Windows (in cmd)
```

To run with a single station (e.g. for testing on a laptop):

```bash
open "http://localhost:8080/?stations=1"
```

### Stopping the servers

```bash
# macOS / Linux — kill both ports at once:
kill $(lsof -ti :8765 :8080)

# Windows — close the two cmd windows, or:
taskkill /F /IM python.exe
```

### Why localhost?

Browsers block `getUserMedia` on `file://`. The page must be served over
`localhost` or `https`. Never open `index.html` directly as a file.

---

## Pulling updates from GitHub

```bash
# From the repo root (art/)
git pull origin main
```

That's it. HTML, JS, stamps, and assets all update in place. Then restart the
servers (Ctrl-C, then re-run the launcher or the manual commands above).

If new Python dependencies were added since your last pull, delete `.deps_ok_v2`
so the launcher re-runs the installer:

```bash
rm recognition-engine/.deps_ok_v2   # macOS / Linux
del recognition-engine\.deps_ok_v2  # Windows
```

---

## Required model: inswapper_128.onnx

The face-swap server requires a ~500 MB model file that is not in the repo.
Download it once and place it in `recognition-engine/`:

```
https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx
```

### Optional: GPU acceleration

Replace `onnxruntime` with `onnxruntime-gpu`:

```bash
pip3 uninstall onnxruntime
pip3 install onnxruntime-gpu
```

Reduces swap time from ~1–2 s (CPU) to ~0.3 s (GPU, CUDA).

### Optional: GFPGAN face enhancement

`gfpgan` is installed by the launcher. On first run `server.py` auto-downloads
GFPGANv1.4 (~350 MB) and uses it to sharpen swap results. No action needed.

---

## How it works (the flow)

Each panel runs independently through the same loop:

1. **Idle** — dark overlay shows live camera feed. "AWAITING SUBJECT" text +
   face-detection oval visible.

2. **Detect** — skin-presence detector samples the panel's zone at ~8 Hz.
   When a face holds still for ~0.85 s the oval glows and locks.

3. **Trigger** — a still frame is captured and sent to `server.py` via
   WebSocket: `{ subject, frame, station }`. Swap result arrives asynchronously.

4. **Pick** — a subject is chosen at random from the enabled pool, never the
   same one twice in a row per station.

5. **Scan overlay** (t = 0 → 17.5 s) — overlay stays up showing live feed,
   face-mapping dots, callout labels, COGNITION STREAM sentences, counters.

6. **Card reveal** (t = 16 → 26 s) — overlay fades out, "Subject Analysis
   Report" card appears with face-swapped portrait.

7. **Stamp** (t ≈ 24.55 s) — per-subject ink-stamp SVG slams down with a
   colour flash and card shudder.

8. **Reset** (t = 26 s) — returns to idle, re-arms for the next person.

---

## Subjects

38 subjects are defined in the `subjects` array near the top of `index.html`.

| Field | Description |
|---|---|
| `id` | short key, matches `assets/<id>-portrait.*` and `STAMP_FILES` |
| `enabled` | `true` = included in random pool |
| `line` | displayed as SUBJECT in header |
| `fileId` | displayed as FILE ID |
| `date` | displayed as DATE |
| `portrait` | B&W portrait photo |
| `cutout` | transparent-face PNG (fallback if no swap result) |
| `confidence` / `reflection` | percentage metrics that count up during scan |
| `characteristics` | 5–8 lines checked off in sequence |
| `classification` | e.g. "CULTURAL ICON" |
| `verdict` | the stamped word, e.g. "HOMOSEXUAL" |
| `disposition` | bureau instruction line below the stamp |
| `stamp` | optional `{key, a, b, c}` colour override |

The `SCAN_DATA` object holds per-subject scan overlay content: `sentences`
(COGNITION STREAM text) and `markers` (face callout labels + weight values).

### Current subject roster

Andy Warhol, Keith Haring, Harvey Milk, Alan Turing, Marlene Dietrich,
Stephen Sondheim, Audre Lorde, Divine, Ernie, Dr. Frank-N-Furter, Xena,
Armistead Maupin, Billie Holiday, Terence Stamp, Oscar Wilde, Jack McFarland,
Freddie Mercury, Elton John, James Baldwin, Marsha P. Johnson, Larry Kramer,
RuPaul, John Waters, Gore Vidal, Virginia Woolf, Sappho, Hadrian, Nathan Lane,
Peter Allen, Magda Szubanski, Bob Brown, Bruce Vilanch, Kake, Ursula,
Bugs Bunny, Tank Girl, Sylvester, Vita Sackville-West, Hannah Gadsby.

(Stephen Fry is defined but disabled until a portrait asset is added.)

---

## Adding a subject

### Step 1 — assets

Drop a portrait photo in `assets/` as `<id>-portrait.jpeg` (or `.png`).
Front-facing, head and shoulders, clear face. B&W or colour both work.

Optionally add `<id>-cutout.png` (face knocked out to transparency) as a
fallback if the swap server returns no result.

### Step 2 — subjects array entry

In `index.html`, copy an existing subject block and fill it in:

```js
{
  id: 'yourperson', enabled: true,
  line: 'LASTNAME, FIRSTNAME', fileId: 'YP-1900-0101', date: '05.06.2024',
  footer: 'FIRSTNAME LASTNAME',
  portrait: 'assets/yourperson-portrait.jpeg',
  confidence: 99.80, reflection: 98.5,
  characteristics: [
    'Five to eight short lines checked off during the scan',
    'Each line is a dry bureaucratic observation',
    'Motivations cannot be independently verified',
  ],
  classification: 'CULTURAL ICON',
  explanation: 'NOT AVAILABLE',
  verdict: 'HOMOSEXUAL',
  disposition: 'FLAG · MONITOR · RETAIN ON FILE',
}
```

### Step 3 — STAMP_FILES entry

Add one line to `STAMP_FILES` in `index.html`:

```js
yourperson: 'Firstname Lastname',
```

The matching stamp file must exist at `stamps/Firstname Lastname.dc.html`.
If none is listed the engine falls back to a plain text stamp.

### Step 4 — SCAN_DATA entry

```js
yourperson: {
  sentences: [
    'First typed cognition sentence.',
    'Second sentence.',
    'Third sentence.',
    'Confidence increased.',
  ],
  markers: [
    { name: 'MARKER ONE', v: 22 },
    { name: 'MARKER TWO', v: 17 },
    { name: 'MARKER THREE', v: 14 },
    { name: 'MARKER FOUR', v: 11 },
    { name: 'MARKER FIVE', v: 9 },
  ],
},
```

### Step 5 — commit and push

```bash
git add recognition-engine/assets/yourperson-portrait.jpeg
git add recognition-engine/index.html
git commit -m "Add Firstname Lastname subject"
git push origin main
```

Then pull on the installation machine and restart the servers.

---

## URL parameters

| Parameter | Values | Effect |
|---|---|---|
| `stations` | `1`–`4` | Number of panels to show (default: `1`) |
| `puppet` | `1` | Live-puppet mode — drive the portrait's blinks / mouth / head with the visitor's face, **in-browser, no server** (see below) |
| `mirror` | `1` | Live-mirror mode — photoreal reenactment via `server_liveportrait.py` (needs a strong machine, see below) |

- `http://localhost:8080/` — single panel (testing / laptop)
- `http://localhost:8080/?stations=4` — full 4-panel installation
- `http://localhost:8080/?stations=4&puppet=1` — full installation, in-browser live puppet
- `http://localhost:8080/?stations=4&mirror=1` — full installation, server-side reenactment

---

## Tuning knobs

Props set on the `<x-dc>` element in `index.html`:

| Prop | Default | Effect |
|---|---|---|
| `mirrorCam` | `true` | Mirror the live feed (selfie flip) |
| `reverseZones` | `false` | Flip which side panel 1 is on |
| `autoLoop` | `true` | Auto-reset to idle after verdict |
| `scanColor` | `#c0443a` | Accent colour for scan line / flash / dots |

JS timing knobs (edit in the script block):

| What | Location | Notes |
|---|---|---|
| Lock time | `HOLD = 850` | ms a face must hold before scan fires |
| Clear delay | `CLEAR = 550` | ms of absence before zone re-arms |
| Skin threshold | `> 0.28` in `sampleZone()` | lower = easier to trigger |
| Total run length | `TOTAL = 26.0` | seconds per scan cycle |
| Stamp drop time | `t=24.55` | seconds into the scan |

---

## Face-swap server (`server.py`)

Receives: `{ subject: string, frame: base64JPEG, station: number }`
Returns: `{ result: base64JPEG, station, imgW, imgH, leftEye: [rx, ry] }`

- `result` — portrait with visitor's face blended in
- `leftEye` — normalised `[x, y]` of the portrait's left eye (positions the wink)

Pre-loads all portraits at startup. Uses `inswapper_128.onnx`; GFPGAN sharpens
results automatically if installed. WebSocket reconnects if the server restarts.

---

## Live-puppet mode (`?puppet=1`) — recommended for weak hardware

A real-time portrait that mirrors the visitor **entirely in the browser** — no
Python server, no model download, no GPU. It reuses the MediaPipe face tracker
already loaded for the wink, reads the visitor's **blendshapes** (jaw-open, eye
blinks) and **head pose**, and drives the subject's own portrait with CSS
transforms + overlays: the portrait **blinks, opens its mouth, and tilts/turns**
to match the visitor during the card-reveal window.

This is the path that runs at full frame rate on the **exhibition PC** (Intel
HD integrated graphics) where server-side LivePortrait cannot keep up. It is a
**stylized** puppet — no photoreal teeth or true 3D head-turn — but it is truly
real-time with zero lag.

**Run it:** nothing extra — `?puppet=1`, e.g. `http://localhost:8080/?stations=4&puppet=1`.
The inswapper server is not used in this mode. Subjects whose portrait has no
detectable face (cartoons — Bugs, Ernie, Ursula) simply stay still.

**Tuning** (top of `live-puppet.js`, `GAINS`): `roll` / `yaw` / `pitch` (degrees
of head movement), `mouth` (jaw-open amount), `ease` (smoothing). The
perception side (visitor → signal) lives in `faceToSignal()` in `index.html`.

---

## Live-mirror mode (`server_liveportrait.py` + `?mirror=1`)

An alternative to the still face-swap: instead of pasting the visitor's captured
face onto the portrait once, the portrait is **driven live** by the visitor's
expressions (mouth, blinks, head tilt) during the card-reveal window. The
frontend streams the visitor's zone to the server one frame at a time and swaps
the returned image into the portrait each frame.

**Run it:**
1. `git clone https://github.com/KwaiVGI/LivePortrait liveportrait && pip install -r liveportrait/requirements.txt`
2. `python3 server_liveportrait.py` (same port `8765` — run instead of `server.py`)
3. Open with `?mirror=1`, e.g. `http://localhost:8080/?stations=4&mirror=1`

**Protocol** — client → server per frame: `{ subject, frame: base64JPEG, station, first }`
(`first: true` records the visitor's neutral pose). Server → client: `{ result: base64JPEG, station, subject }`.
The client keeps **one frame in flight per station** (send → await → send fresh)
and the server **drops stale queued frames**, so latency stays a constant
"one inference behind" instead of accumulating.

**Performance reality:** smooth real-time needs a CUDA GPU (~20–40 fps). On
CPU-only machines (Mac / Intel PC) the generator is ~0.5–2 s/frame, so the
mirror is responsive but low fps — and four stations share one server, so they
update in turn. For smooth real-time on Mac/Intel, swap the backend to an ONNX
build ([FasterLivePortrait](https://github.com/warmshao/FasterLivePortrait) with
CoreML on Mac / OpenVINO on Intel); the streaming protocol above is unchanged.

Tuning knobs live at the top of `server_liveportrait.py`: `EXP_SCALE` /
`POSE_SCALE` / `ROLL_SCALE` / `T_SCALE` (how strongly the visitor drives the
portrait) and `SMOOTH` (EMA smoothing of the motion).

---

## Notes / gotchas

- **Camera needs localhost or https.** Opening `index.html` as a `file://` URL
  shows "NO SIGNAL — MANUAL TRIGGER" in each panel.
- **Spacebar** triggers a manual scan on station 0 — useful for testing without
  standing in front of the camera.
- **No swap result** (server down or no face detected): card still reveals with
  the plain portrait; stamp and scan text work normally.
- **Skin detection** is intentionally simple — not facial recognition. The
  subject is always random; the machine never knows who anyone is.
- **One camera, four zones:** all panels read from the same `getUserMedia`
  stream; zones are just horizontal crops of the canvas.
- **GFPGAN** auto-downloads GFPGANv1.4 (~350 MB) on first server run.
