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

// Triangle scan frame + realistic camera eye — tracks detected face position
function drawPinkTriangle(alarmMode) {
  const faces   = detection.faces;
  const hasFace = faces && faces.length > 0;

  // Anchor to face center if detected, else screen center
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

  // ── Triangle frame sized to face ─────────────────────────────────────────
  const triHalf = faceSize * 0.90;
  const x1 = fcx - triHalf, y1 = fcy - faceSize * 1.05;
  const x2 = fcx + triHalf, y2 = fcy - faceSize * 1.05;
  const x3 = fcx,            y3 = fcy + faceSize * 0.95;

  noFill();
  if (alarmMode) {
    const ap = (sin(millis() * 0.008) + 1) / 2;
    stroke(255, 40, 40, 110 + ap * 120);
  } else {
    stroke(0, 255, 120, 28 + scanProgress * 165);
  }
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  triangle(x1, y1, x2, y2, x3, y3);
  noStroke();

  // ── Realistic camera / surveillance eye at face centre ───────────────────
  const maxR = faceSize * 0.30;
  const fade = alarmMode ? 1.0 : 0.28 + scanProgress * 0.72;

  // Slow pupil drift — looks like the lens is tracking
  const driftX = sin(t * 0.28) * maxR * 0.09;
  const driftY = cos(t * 0.37) * maxR * 0.06;
  const px = fcx + driftX;
  const py = fcy + driftY;

  // Outer lens barrel
  noFill();
  stroke(130, 18, 18, 105 * fade);
  strokeWeight(Math.max(2, Math.round(3 * uiScale)));
  circle(fcx, fcy, maxR * 2);

  // Glass element rings (3 inner rings)
  const glassRings = [0.78, 0.54, 0.35];
  glassRings.forEach((r, i) => {
    stroke(165, 28, 28, (18 + i * 16) * fade);
    strokeWeight(Math.max(1, Math.round(1.5 * uiScale)));
    circle(fcx, fcy, maxR * r * 2);
  });

  // Rotating aperture blades (8 blades)
  stroke(195, 40, 40, 58 * fade);
  strokeWeight(Math.max(1, Math.round(uiScale)));
  const rot = t * 0.20;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TWO_PI + rot;
    line(
      fcx + cos(a) * maxR * 0.20, fcy + sin(a) * maxR * 0.20,
      fcx + cos(a) * maxR * 0.68, fcy + sin(a) * maxR * 0.68
    );
  }

  // Iris fill — dark red, breathes
  noStroke();
  const irisR = maxR * (0.29 + pulse * (alarmMode ? 0.09 : 0.04));
  fill(65, 4, 4, 75 * fade);
  circle(fcx, fcy, irisR * 2);

  // Iris radial texture — 24 fine lines
  stroke(145, 18, 18, 38 * fade);
  strokeWeight(Math.max(1, Math.round(0.7 * uiScale)));
  for (let i = 0; i < 24; i++) {
    const a     = (i / 24) * TWO_PI;
    const inner = irisR * 0.38;
    line(
      fcx + cos(a) * inner, fcy + sin(a) * inner,
      fcx + cos(a) * irisR, fcy + sin(a) * irisR
    );
  }

  // Pupil — drifts with the tracking motion
  noStroke();
  fill(8, 0, 0, (190 + pulse * 65) * fade);
  circle(px, py, maxR * 0.20);

  // Catchlight — tiny bright spot offset from pupil centre
  fill(255, 210, 210, 85 * fade);
  circle(px + maxR * 0.06, py - maxR * 0.06, maxR * 0.06);

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
