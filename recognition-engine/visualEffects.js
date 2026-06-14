// Visual effects: mirror, scan lines, ghost trails, pixel ripple, alarm overlay

const GHOST_FRAMES = 8;
const ghostTrails = [];

let ripplePhase = 0;
let rippleBuffer = null;
let mirrorBuffer = null;

function initVisuals(w, h) {
  mirrorBuffer = createGraphics(w, h);
  rippleBuffer = createGraphics(w, h);
  mirrorBuffer.pixelDensity(1);
  rippleBuffer.pixelDensity(1);
}

function drawDistortedMirror(videoCapture, motionAmount, state) {
  if (!videoCapture || !mirrorBuffer) return;

  mirrorBuffer.push();
  mirrorBuffer.translate(mirrorBuffer.width, 0);
  mirrorBuffer.scale(-1, 1);
  mirrorBuffer.image(videoCapture, 0, 0, mirrorBuffer.width, mirrorBuffer.height);
  mirrorBuffer.pop();

  const amplitude = map(motionAmount, 0, 0.15, 2, 22, true);
  ripplePhase += 0.04;
  applyRipple(mirrorBuffer, rippleBuffer, amplitude);

  for (let i = 0; i < ghostTrails.length; i++) {
    const alpha = map(i, 0, ghostTrails.length, 5, 25);
    tint(255, alpha);
    image(ghostTrails[i], 0, 0);
  }
  noTint();

  // In alarm mode, tint the mirror red
  const isAlarm = state === "ALARM";
  if (isAlarm) {
    tint(255, 80, 80, 130);
  } else {
    tint(255, 120);
  }
  image(rippleBuffer, 0, 0);
  noTint();

  if (frameCount % 3 === 0) {
    if (ghostTrails.length >= GHOST_FRAMES) ghostTrails.shift();
    const snapshot = createGraphics(width, height);
    snapshot.image(rippleBuffer, 0, 0);
    ghostTrails.push(snapshot);
  }
}

function applyRipple(src, dst, amplitude) {
  src.loadPixels();
  dst.loadPixels();

  const w = src.width;
  const h = src.height;

  for (let y = 0; y < h; y++) {
    const offsetX = Math.floor(sin(y * 0.03 + ripplePhase) * amplitude);
    for (let x = 0; x < w; x++) {
      const srcX    = constrain(x + offsetX, 0, w - 1);
      const srcIdx  = (y * w + srcX) * 4;
      const dstIdx  = (y * w + x) * 4;
      dst.pixels[dstIdx]     = src.pixels[srcIdx];
      dst.pixels[dstIdx + 1] = src.pixels[srcIdx + 1];
      dst.pixels[dstIdx + 2] = src.pixels[srcIdx + 2];
      dst.pixels[dstIdx + 3] = src.pixels[srcIdx + 3];
    }
  }

  dst.updatePixels();
}

function drawScanLines() {
  const isAlarm     = state === "ALARM";
  const lineSpacing = Math.max(2, Math.round(4 * uiScale));

  stroke(0, isAlarm ? 30 : 18);
  strokeWeight(1);
  for (let y = 0; y < height; y += lineSpacing) {
    line(0, y, width, y);
  }
  noStroke();

  // Sweep line — red in alarm mode, green otherwise
  const sweepY = (frameCount * (isAlarm ? 1.5 : 0.5)) % height;
  if (isAlarm) {
    stroke(255, 0, 0, 25);
  } else {
    stroke(0, 255, 120, 12);
  }
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  line(0, sweepY, width, sweepY);
  noStroke();
}

// Full-screen pulsing red overlay for ALARM state
function drawAlarmOverlay() {
  const pulse = (sin(millis() * 0.008) + 1) / 2; // 0→1 at ~0.8Hz
  const alpha = 30 + pulse * 50;

  noStroke();
  fill(180, 0, 0, alpha);
  rect(0, 0, width, height);

  // Red border flash
  const borderA = 80 + pulse * 120;
  stroke(255, 0, 0, borderA);
  strokeWeight(Math.max(3, Math.round(6 * uiScale)));
  noFill();
  rect(0, 0, width, height);
  noStroke();
}

function clearGhostTrails() {
  for (const g of ghostTrails) g.remove();
  ghostTrails.length = 0;
}

// Pink triangle scan frame + sci-fi surveillance eye — tracks detected face
function drawPinkTriangle(alarmMode) {
  const faces   = detection.faces;
  const hasFace = faces && faces.length > 0;

  let fcx, fcy, faceSize;
  if (hasFace) {
    const f  = faces[0];
    fcx      = f.x;
    fcy      = f.y;
    faceSize = Math.max(f.w, f.h);
  } else {
    fcx      = width  * 0.5;
    fcy      = height * 0.42;
    faceSize = Math.min(width, height) * 0.45;
  }

  const t            = millis() * 0.001;
  const pulse        = (sin(t * 1.8) + 1) / 2;
  const scanProgress = alarmMode ? 1 : constrain((millis() - stateAt) / SCAN_DURATION, 0, 1);
  const fade         = alarmMode ? 1.0 : 0.25 + scanProgress * 0.75;

  // ── Pink triangle frame ───────────────────────────────────────────────────
  const triHalf = faceSize * 0.90;
  const x1 = fcx - triHalf, y1 = fcy - faceSize * 1.05;
  const x2 = fcx + triHalf, y2 = fcy - faceSize * 1.05;
  const x3 = fcx,            y3 = fcy + faceSize * 0.95;

  noFill();
  if (alarmMode) {
    const ap = (sin(millis() * 0.008) + 1) / 2;
    stroke(255, 20, 80, 120 + ap * 120);
  } else {
    stroke(255, 20, 147, 35 + scanProgress * 185);
  }
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  triangle(x1, y1, x2, y2, x3, y3);
  noStroke();

  // ── Sci-fi surveillance eye ───────────────────────────────────────────────
  const maxR      = faceSize * 0.19;   // smaller
  const irisOuter = maxR * 0.60;
  const pupilR    = maxR * 0.27;

  // Pupil scans up and down — deliberate surveillance sweep (~8s cycle)
  // Tiny horizontal sway to feel alive; dominant vertical scan
  const driftX = sin(t * 0.18) * maxR * 0.07;
  const driftY = sin(t * 0.78) * irisOuter * 0.44;
  const px = fcx + driftX;
  const py = fcy + driftY;

  // Outer barrel ring — thick, dark
  noFill();
  stroke(160, 20, 20, 125 * fade);
  strokeWeight(Math.max(4, Math.round(6 * uiScale)));
  circle(fcx, fcy, maxR * 2);

  // Inner barrel edge — glowing rim
  stroke(220, 50, 50, 70 * fade);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  circle(fcx, fcy, maxR * 1.82);

  // Tech ring 1 — 4 arc segments, slow clockwise rotation
  const rot1 = t * 0.14;
  stroke(200, 45, 45, 105 * fade);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  for (let i = 0; i < 4; i++) {
    const sa = (i / 4) * TWO_PI + rot1 + 0.18;
    const ea = sa + TWO_PI / 4 - 0.36;
    arc(fcx, fcy, maxR * 1.58, maxR * 1.58, sa, ea);
  }

  // Tech ring 2 — 6 arc segments, counter-rotating
  const rot2 = -t * 0.09;
  stroke(185, 38, 38, 88 * fade);
  strokeWeight(Math.max(1, Math.round(1.5 * uiScale)));
  for (let i = 0; i < 6; i++) {
    const sa = (i / 6) * TWO_PI + rot2 + 0.12;
    const ea = sa + TWO_PI / 6 - 0.24;
    arc(fcx, fcy, maxR * 1.32, maxR * 1.32, sa, ea);
  }

  // Tick marks around iris edge
  stroke(200, 45, 45, 65 * fade);
  strokeWeight(Math.max(1, Math.round(uiScale)));
  for (let i = 0; i < 32; i++) {
    const a    = (i / 32) * TWO_PI + rot1;
    const len  = (i % 4 === 0) ? 0.15 : 0.07; // longer every 4th
    const rIn  = irisOuter * 1.10;
    const rOut = irisOuter * (1.10 + len);
    line(
      fcx + cos(a) * rIn,  fcy + sin(a) * rIn,
      fcx + cos(a) * rOut, fcy + sin(a) * rOut
    );
  }

  // Iris background fill
  noStroke();
  fill(55, 6, 6, 95 * fade);
  circle(fcx, fcy, irisOuter * 2);

  // Dense radial iris fibers — 160 lines
  stroke(185, 32, 32, 48 * fade);
  strokeWeight(Math.max(1, Math.round(0.6 * uiScale)));
  for (let i = 0; i < 160; i++) {
    const a        = (i / 160) * TWO_PI;
    const innerEdge = pupilR * 1.05;
    const outerEdge = irisOuter * (0.85 + (i % 3 === 0 ? 0.15 : 0)); // stagger
    line(
      fcx + cos(a) * innerEdge, fcy + sin(a) * innerEdge,
      fcx + cos(a) * outerEdge, fcy + sin(a) * outerEdge
    );
  }

  // Pupil — large, black, with drift
  noStroke();
  fill(4, 0, 0, 238 * fade);
  circle(px, py, pupilR * 2);

  // Pupil rim glow
  noFill();
  stroke(185, 28, 28, 65 * fade);
  strokeWeight(Math.max(1, Math.round(1.5 * uiScale)));
  circle(px, py, pupilR * 2.15);

  // Primary catchlight — bright offset spot
  noStroke();
  fill(255, 215, 215, 100 * fade);
  circle(px + pupilR * 0.38, py - pupilR * 0.38, pupilR * 0.28);

  // Secondary catchlight
  fill(255, 180, 180, 45 * fade);
  circle(px - pupilR * 0.22, py + pupilR * 0.28, pupilR * 0.12);

  noStroke();
  noFill();
}

// Face targeting reticle — green normally, red in alarm mode
function drawFaceOverlays(faces, state, personCount, alarmMode = false) {
  if (!faces || faces.length === 0) return;

  const r = alarmMode ? 255 : 0;
  const g = alarmMode ? 0   : 255;
  const b = alarmMode ? 0   : 120;

  noFill();

  for (const face of faces) {
    const flicker = alarmMode ? random(0.6, 1.0) : random(0.85, 1.0);

    // Outer halo
    stroke(r, g, b, 18 * flicker);
    strokeWeight(8);
    rect(face.x - face.w * 0.6, face.y - face.h * 0.65, face.w * 1.2, face.h * 1.3, 4);

    // Inner box
    stroke(r, g, b, alarmMode ? 80 * flicker : 25 * flicker);
    strokeWeight(alarmMode ? 2 : 1);
    rect(face.x - face.w * 0.55, face.y - face.h * 0.6, face.w * 1.1, face.h * 1.2, 2);

    // Corner ticks
    const tlx  = face.x - face.w * 0.55;
    const tly  = face.y - face.h * 0.6;
    const brx  = tlx + face.w * 1.1;
    const bry  = tly + face.h * 1.2;
    const tick = Math.round(10 * uiScale);
    stroke(r, g, b, (alarmMode ? 200 : 50) * flicker);
    strokeWeight(Math.max(1, Math.round(uiScale)));
    line(tlx, tly, tlx + tick, tly);
    line(tlx, tly, tlx, tly + tick);
    line(brx - tick, bry, brx, bry);
    line(brx, bry - tick, brx, bry);
  }

  noStroke();
}
