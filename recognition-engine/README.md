# Recognition Engine (poster design)

Imported from a [Claude Design](https://claude.ai/design) handoff bundle
(`Face Animation Poster Design`). An interactive webcam kiosk: when a face is
detected it locks on, a poster-style **Subject Analysis Report** builds outward
from the live face, a randomly chosen historical figure's portrait assembles in
sections around them while a mock scan runs, and a pop-art verdict stamp slams
down — then it resets and waits for the next person. It's a critique of
automated classification: the machine reaches a confident verdict it "is unable
to explain."

This folder **is** the deployed site root. The original p5.js + MediaPipe app
is preserved (unused) under [`legacy/`](./legacy/).

## Installation layout (4 stations)

Built for a **43" 4K monitor in landscape (3840×2160)** showing **four
independent stations** side by side — four people stand on four floor marks
and each gets their own analysis at once:

```
4 panels × 945 px  +  3 gaps × 20 px  =  3840 px      (each panel 945 × 2160)
```

One webcam feeds all four: the camera frame is split into **four vertical
detection zones** (left→right = panel 1→4). Each zone independently arms,
locks onto a held face (~0.85 s), and runs its own scan with its own randomly
chosen subject. The whole 3840×2160 stage scales to fit any screen.

**Calibration / tuning knobs:**

| What | Where | Notes |
|---|---|---|
| Mirror the feed | `mirrorCam` prop | selfie mirror per panel |
| Flip zone order | `reverseZones` prop | set true if floor marks read backwards |
| Lock time | `HOLD = 850` in `startDetect()` | ms a face must hold to fire |
| Sensitivity | `> 0.30` in `sampleZone()` | lower = easier to trigger |
| Scan accent | `scanColor` prop | the red scan line / flash |
| Loop vs hold | `autoLoop` prop | reset to black & wait for the next person |
| Outer margin | the row `gap` / panel width | 3 gaps = panels flush to screen edges |

## Files

```
index.html                   the whole app (markup + logic). EDIT HERE. (the dc source of truth)
support.js                   the dc runtime. Do not edit. Auto-loads React 18 from unpkg.
assets/warhol-cutout.png     Warhol portrait, face knocked out to transparency
HANDOFF.md                   the original developer handoff (full docs)
legacy/                      the previous p5.js + MediaPipe app (not served)
```

> The original handoff named the app file `Recognition Engine.dc.html`; it was
> renamed to `index.html` so static hosts serve it at the folder root with no
> redirect. It's the same dc source — edit it here.

## Running it (camera needs a secure context)

Browsers block `getUserMedia` on `file://`, so serve the folder over
**localhost** or **https**:

```bash
# from this folder
npx serve .            # then open the printed http://localhost:… URL
# or
python3 -m http.server 8000
```

Open the printed URL, grant camera permission. It runs automatically; press
`Spacebar` or the on-screen `[ MANUAL TRIGGER ]` to force a scan for testing.
React 18 is fetched from unpkg on first load (same CDN pattern the original
engine uses for p5.js / MediaPipe), so an internet connection is needed unless
you vendor React locally.

## Adding a subject

See **HANDOFF.md §4** — drop an `assets/<id>-cutout.png` (front-facing portrait
with the face knocked out to transparency) and flip the matching block in the
`subjects` array (near the top of the `<script>` in `index.html`) to
`enabled: true`. The placeholders for Haring, Milk, and Turing are already
filled in and just need their cutout PNGs. No other code changes.
