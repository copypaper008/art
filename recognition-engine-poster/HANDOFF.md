# Recognition Engine — Developer Handoff

An interactive kiosk. One webcam. When a face is detected it locks on, the
"Subject Analysis Report" builds outward from the live face, a portrait of a
**randomly chosen historical figure** assembles in sections around them while a
mock scan runs, and a pop-art verdict stamp slams down. It then resets to a
black screen and waits for the next person — fully automatic, no operator.

---

## 1. Files

```
Recognition Engine.dc.html   ← the whole app (markup + logic). EDIT HERE.
support.js                   ← runtime. Must sit next to the .dc.html. Do not edit.
assets/
  warhol-cutout.png          ← Warhol portrait, FACE KNOCKED OUT to transparency
  haring-cutout.png          ← (add these as you enable subjects)
  milk-cutout.png
  turing-cutout.png
```

`Recognition Engine.dc.html` opens directly in a browser. Keep `support.js` in
the same folder.

---

## 2. Running it (IMPORTANT: camera needs a secure context)

Browsers block `getUserMedia` on `file://`. You must SERVE the folder over
**https** or **localhost**:

```bash
# from the project folder
npx serve .            # then open the printed http://localhost:… URL
# or
python3 -m http.server 8000
```

For a permanent installation, host it behind https (or run the local server on
the kiosk machine and open `localhost`). On first load the browser asks for
camera permission — grant it. In kiosk/installation mode, launch the browser
with camera permission pre-granted for the site.

Controls: it's automatic. `Spacebar` or the on-screen `[ MANUAL TRIGGER ]`
forces a scan for testing.

---

## 3. How it works (the flow)

1. **Idle** — black screen, a face-shaped reticle, "STEP INTO FRAME".
2. **Detect** — a lightweight skin-presence check samples the webcam ~8×/sec.
   When a face holds for ~0.85s the reticle locks and the scan fires.
3. **Pick** — one **enabled** subject is chosen at **random** (never the same
   one twice in a row).
4. **Build** — the report + the person's live face reveal outward from the face.
5. **Scan** — scan-line sweep, confidence/reflection count up, characteristics
   check off one by one, classification resolves.
6. **Assemble** — the chosen portrait grows in around the live face in 6
   sections, finishing last (top of the hair).
7. **Verdict** — the pop-art stamp slams down with a shake + colour flash.
8. **Reset** — holds, then returns to black. It re-arms once the person steps
   away, so the next person triggers a fresh scan with a new random subject.

The live camera feed stays running inside the face the whole time (it is not a
freeze-frame).

---

## 4. ADDING A PERSON  ← the main repeatable task

Everything lives in the `subjects` array near the top of the `<script>` block
in `Recognition Engine.dc.html`. Two steps per person:

### Step 1 — the portrait PNG
Supply a **face-cutout PNG** and save it as `assets/<id>-cutout.png`:
- Front-facing, centred, head-and-shoulders (hair top → upper chest), like the
  Warhol one.
- The **face must be transparent** (knocked out) so the visitor's live face
  shows through. Everything else (hair, ears, collar) stays opaque.
- Portrait aspect (taller than wide), reasonable resolution (~500×700+).
- Grayscale works best (the engine desaturates it anyway).

### Step 2 — the data block
Copy an existing block in `subjects` and fill it in:

```js
{
  id: 'haring',
  enabled: true,                       // include in the random pool
  line: 'HARING, KEITH',               // header  SUBJECT:
  fileId: 'KH-1958-0504',              // header  FILE ID:
  date: '05.06.2024',                  // header  DATE:
  footer: 'KEITH HARING',              // footer exhibition title
  cutout: 'assets/haring-cutout.png',  // the PNG from Step 1
  confidence: 99.94,                   // big % that counts up
  reflection: 97.9,                    // second metric
  characteristics: [                   // 5–8 short lines, checked off in order
    'Produces high volumes of publicly legible imagery',
    'Motivations cannot be independently verified'
  ],
  classification: 'CULTURAL ICON',     // bottom band
  explanation: 'NOT AVAILABLE',        // bottom band
  verdict: 'HOMOSEXUAL',               // the stamped word
  // stamp: { key:'#141009', a:'#FFD400', b:'#00B7D4', c:'#EC1E79' }  // optional per-subject colours
}
```

That's the whole job. No animation or layout code changes — the engine reads
the data and renders. The three placeholders (Haring / Milk / Turing) already
have copy filled in; they're `enabled: false` until you add their PNG, then
flip to `true`.

> Random pool = every subject with `enabled: true`. With only one enabled, it
> always picks that one (useful while you build out the set).

---

## 5. Tuning knobs (all in the `<script>` of the .dc.html)

| What | Where | Notes |
|---|---|---|
| Scan accent colour | `scanColor` prop (top of file) | the red scan line / flash |
| Mirror the camera | `mirrorCam` prop | true = selfie mirror |
| Loop vs. hold | `autoLoop` prop | true = reset to black & wait |
| Detection sensitivity | `HOLD` / `CLEAR` in `startDetect()` | ms to lock / ms to re-arm |
| Skin threshold | `> 0.30` in `sampleFace()` | raise if it false-triggers |
| Total run length | `TOTAL = 17` in `run()` | seconds |
| Beat timing | the `seg(start,end)` calls in `renderVals()` | seconds into the run |
| Camera zoom | `scale(1.45)` in `videoStyle` | bigger = tighter on the face |
| Face oval size/position | `ovalStyle` (`width/height/left/top`) | align to your cutouts' face hole |
| Section order/timing | `chunkDefs` in `renderVals()` | each piece's clip + `start` time |
| Stamp colours | `STAMP = {…}` (default) or a subject's `stamp` | pop-art palette |

If a new portrait's face hole doesn't line up with the live face, nudge
`ovalStyle` (position/size) and the camera `scale()` together.

---

## 6. Working in Claude Code / other tooling

- This is a self-contained front-end. Ship the folder (`.dc.html` +
  `support.js` + `assets/`) and serve it (section 2).
- A **single-file build** (everything inlined, works offline) can be produced
  from this project — ask for the "standalone HTML" export. That single file is
  the easiest thing to drop into another repo, but the editable source of truth
  is `Recognition Engine.dc.html`.
- No build step, no npm dependencies, no backend. Plain browser APIs
  (`getUserMedia`, canvas, CSS).

---

## 7. Notes / gotchas

- **Camera = https or localhost.** Plain `file://` will show "NO SIGNAL".
- Detection is intentionally simple (skin-presence), not face *recognition* —
  identity is random by design, so it never needs to know who anyone is.
- One person at a time per scan; the next person re-triggers after the frame
  clears. (The camera can see several people, but each scan locks one face.)
- Concept/intent: the piece is a critique of automated classification — the
  machine reaches a confident verdict it "is unable to explain." Keep copy in
  that dry, bureaucratic register.
