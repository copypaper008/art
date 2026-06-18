# Recognition Engine (poster design)

Imported from a [Claude Design](https://claude.ai/design) handoff bundle
(`Face Animation Poster Design`). An interactive webcam kiosk: when a face is
detected it locks on, a poster-style **Subject Analysis Report** builds outward
from the live face, a randomly chosen historical figure's portrait assembles in
sections around them while a mock scan runs, and a pop-art verdict stamp slams
down — then it resets and waits for the next person. It's a critique of
automated classification: the machine reaches a confident verdict it "is unable
to explain."

This lives alongside the original p5.js + MediaPipe `recognition-engine/`; it
does not change that app or the site's root deployment.

## Files

```
index.html                   convenience redirect → the .dc.html
Recognition Engine.dc.html   the whole app (markup + logic). EDIT HERE.
support.js                   the dc runtime. Do not edit. Auto-loads React 18 from unpkg.
assets/warhol-cutout.png     Warhol portrait, face knocked out to transparency
HANDOFF.md                   the original developer handoff (full docs)
```

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
`subjects` array (near the top of the `<script>` in the `.dc.html`) to
`enabled: true`. The placeholders for Haring, Milk, and Turing are already
filled in and just need their cutout PNGs. No other code changes.
