# Recognition Engine

An interactive kiosk installation. One webcam. Four stations. When someone
steps into a panel's zone their face is locked onto, a "Subject Analysis
Report" card assembles around them while a mock scan runs — face-swapping
the visitor's features onto a randomly chosen historical figure — and a
pop-art verdict stamp slams down. It then resets automatically and waits for
the next person.

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
poster.html              ← the main app. EDIT HERE.
index.html               ← secondary dark surveillance display (4-panel scan feed)
support.js               ← DC runtime (React 18). Do not edit.
server.py                ← face-swap backend (InsightFace + inswapper_128.onnx)
server_liveportrait.py   ← alternative reenactment backend (LivePortrait). Not wired to launchers.
start-mac.command        ← one-double-click launcher for macOS
start-windows.bat        ← one-double-click launcher for Windows
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
6. Opens `http://localhost:8080/poster.html` in the browser

**Press Ctrl-C to stop both servers.**

### Manual start

```bash
# from recognition-engine/
python3 server.py &
python3 -m http.server 8080 --bind 127.0.0.1 &
open http://localhost:8080/poster.html   # macOS; use 'start' on Windows
```

### Why localhost?

Browsers block `getUserMedia` on `file://`. The page must be served over
`localhost` or `https`. Never open `poster.html` directly as a file.

---

## Required model: inswapper_128.onnx

The face-swap server requires a ~500 MB model file that is not in the repo.
Download it once and place it in `recognition-engine/`:

```
https://huggingface.co/deepinsight/insightface/resolve/main/models/inswapper_128.onnx
```

### Optional: GPU acceleration

Replace `onnxruntime` with `onnxruntime-gpu` after installing:

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

Each of the four panels runs independently through the same loop:

1. **Idle** — dark overlay shows live camera feed for the panel's zone.
   "AWAITING SUBJECT" text + face-detection oval visible. Engine text explains
   the piece: _"Step into the frame. The engine will record your face, decide
   what you are, and file the verdict."_

2. **Detect** — the skin-presence detector (`sampleZone`) samples the panel's
   camera zone at ~8 Hz. When a face holds still for ~0.85 s the oval glows
   and locks.

3. **Trigger** — a still frame is captured the instant the lock fires. It is
   immediately sent to `server.py` via WebSocket (`ws://localhost:8765`):
   `{ subject, frame, station }`. The swap result arrives asynchronously.

4. **Pick** — a subject is chosen at random from the enabled pool, never the
   same one twice in a row per station. The matching stamp SVG is pre-fetched.

5. **Scan overlay** (t = 0 → 17.5 s) — the dark overlay stays up showing:
   - Live camera feed (darkened)
   - "HOLD STILL" banner at t ≈ 0
   - Scanning status + confidence/reflection counters
   - Face-mapping dots and callout labels with per-subject markers
   - Typed "COGNITION STREAM" sentences
   - Rolling camera thumbnail

6. **Card reveal** (t = 16 → 26 s) — overlay fades out revealing the
   "Subject Analysis Report" card beneath:
   - Header: SUBJECT ANALYSIS REPORT + file/date metadata
   - Face window: face-swapped portrait (from `server.py`) with floating
     animation + eyelid wink using the `leftEye` landmark returned by the server
   - Scan status: COMPLETE + confidence and prediction interval bars
   - Tables: PRIMARY CONTRIBUTING VARIABLES + CONFIDENCE SOURCE ANALYSIS
   - NOTICE footer with disclaimer

7. **Stamp** (t ≈ 24.55 s) — per-subject ink-stamp SVG slams down with
   a colour flash and card shudder. Stamp reads the verdict (e.g. "HOMOSEXUAL")
   with per-subject colour palette.

8. **Reset** (t = 26 s) — returns to idle. Camera is live again; re-arms
   once the subject steps away (clear delay ~550 ms).

---

## Subjects

38 subjects are defined in the `subjects` array near the top of `poster.html`.
Each has:

| Field | Description |
|---|---|
| `id` | short key, matches `assets/<id>-portrait.*` and `STAMP_FILES` |
| `enabled` | `true` = included in random pool |
| `line` | displayed as SUBJECT in header |
| `fileId` | displayed as FILE ID |
| `date` | displayed as DATE |
| `portrait` | B&W portrait photo (used with multiply-blend composite) |
| `cutout` | transparent-face PNG (fallback if no portrait) |
| `confidence` / `reflection` | the two percentage metrics that count up |
| `characteristics` | 5–8 lines checked off in sequence during the scan |
| `classification` | e.g. "CULTURAL ICON", "LITERARY FIGURE" |
| `verdict` | the stamped word, e.g. "HOMOSEXUAL" |
| `disposition` | bureau instruction line below the stamp |
| `stamp` | optional `{key, a, b, c}` colour override for this subject's stamp |

The `SCAN_DATA` object (further down in the script) holds per-subject
scan overlay content: `sentences` (COGNITION STREAM typed text) and
`markers` (face callout labels + weight values).

### Current subject roster

Andy Warhol, Keith Haring, Harvey Milk, Alan Turing, Marlene Dietrich,
Stephen Sondheim, Audre Lorde, Divine, Ernie, Dr. Frank-N-Furter, Xena,
Armistead Maupin, Billie Holiday, Terence Stamp, Oscar Wilde, Jack McFarland,
Freddie Mercury, Elton John, James Baldwin, Marsha P. Johnson, Larry Kramer,
RuPaul, John Waters, Gore Vidal, Virginia Woolf, Sappho, Hadrian, Nathan Lane,
Peter Allen, Magda Szubanski, Bob Brown, Bruce Vilanch, Kake, Ursula,
Bugs Bunny, Tank Girl, Sylvester, Vita Sackville-West, Hannah Gadsby,
Stephen Fry.

---

## Adding a subject

### Step 1 — assets

Drop a portrait photo in `assets/` as `<id>-portrait.jpeg` (or `.png`).
Best results: front-facing, head and shoulders, clear face, good contrast.
B&W is fine; colour is automatically multiplied through the card's warm-grey
background with `mix-blend-mode: multiply`.

Optionally add `<id>-cutout.png` (face knocked out to transparency) as a
fallback for subjects where the server swap doesn't load.

### Step 2 — subjects array entry

Copy an existing block and fill it in:

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

Add one line to `STAMP_FILES`:

```js
yourperson: 'Firstname Lastname',
```

The matching stamp file must exist at `stamps/Firstname Lastname.dc.html`.
If no stamp file is listed the engine falls back to a plain text stamp.

### Step 4 — SCAN_DATA entry

Add one entry to `SCAN_DATA`:

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

---

## Tuning knobs

All props are set on the `<x-dc>` element in `poster.html`. To change a prop,
add it to the opening tag: `<x-dc mirrorCam="false">`.

| Prop | Default | Effect |
|---|---|---|
| `mirrorCam` | `true` | Mirror the live feed (selfie flip) |
| `reverseZones` | `false` | Reverse zone order (flip which side panel 1 is on) |
| `autoLoop` | `true` | Auto-reset to idle after verdict; false = hold on final card |
| `scanColor` | `#c0443a` | Accent colour for scan line / flash / dots |

Other timing/behaviour knobs (edit in the JS):

| What | Where | Notes |
|---|---|---|
| Lock time | `HOLD = 850` in `startDetect()` | ms a face must hold before scan fires |
| Clear delay | `CLEAR = 550` | ms of absence before zone re-arms |
| Skin threshold | `> 0.28` in `sampleZone()` | lower = easier to trigger |
| Total run length | `TOTAL = 26.0` in `ensureRaf()` | seconds per scan cycle |
| Stamp drop time | `t=24.55` in `panel()` | seconds into the scan |

---

## Face-swap server (`server.py`)

Receives: `{ subject: string, frame: base64JPEG, station: number }`  
Returns: `{ result: base64JPEG, station, imgW, imgH, leftEye: [rx, ry] }`

- `result` — the portrait with the visitor's face blended in
- `leftEye` — normalised `[x, y]` of the portrait's left eye, used to
  position the eyelid wink animation over the correct spot

The server pre-loads all portrait images and detects faces at startup.
Portraits missing from `assets/` are silently skipped. The swap uses
`inswapper_128.onnx` (InsightFace); if GFPGAN is available the result is
sharpened automatically.

WebSocket reconnects automatically if the server restarts.

---

## index.html — secondary surveillance display

`index.html` is a companion dark-aesthetic scanning display. It shows four
945 × 2160 panels (3840 × 2160 total) with:
- Live camera feed per panel, darkened + grayscale + scanline filter
- Zone-cropped video: each panel shows its own horizontal slice of the camera
  via CSS `object-position`, so four people in front of the monitor each see
  themselves in their own panel
- MediaPipe FaceMesh tracking: 468-landmark mesh driving animated red dots +
  connecting lines overlaid on each face
- Scrolling COGNITION STREAM text and confidence counters

This page runs standalone (no server needed beyond `python3 -m http.server`).
Open it at `http://localhost:8080/index.html`. It is **not** opened by the
launchers — `poster.html` is the primary kiosk app.

---

## Notes / gotchas

- **Camera needs localhost or https.** Opening `poster.html` as a `file://`
  URL will show "NO SIGNAL — MANUAL TRIGGER" in each panel.
- **Spacebar** triggers a manual scan on station 0, useful for testing
  without standing in front of the camera.
- **No swap result** (server unreachable or no face detected in the captured
  frame): the card still reveals with the plain portrait photo (multiply-blend)
  and no eyelid wink. The stamp and all scan text work normally.
- **Skin detection** is intentionally simple — it is not facial recognition.
  The subject picked is always random; the machine never knows who anyone is.
- **One camera, four zones:** all four panels read from the same `getUserMedia`
  stream. The zone is selected by cropping the canvas before skin sampling.
- **GFPGAN** auto-downloads GFPGANv1.4 (~350 MB) on first server run if the
  model isn't present. This adds a few seconds to the first startup.
