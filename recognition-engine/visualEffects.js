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

// Downward-pointing triangle scan frame + camera lens eye inside
function drawPinkTriangle(alarmMode) {
  const cx       = width * 0.5;
  const topY     = height * 0.10;
  const botY     = height * 0.90;
  const halfBase = Math.min(width, height) * 0.42;

  const x1 = cx - halfBase, y1 = topY;
  const x2 = cx + halfBase, y2 = topY;
  const x3 = cx,            y3 = botY;

  const t             = millis() * 0.001;
  const scanProgress  = alarmMode ? 1 : constrain((millis() - stateAt) / SCAN_DURATION, 0, 1);
  const pulse         = (sin(t * 1.8) + 1) / 2;

  // ── Triangle frame ──────────────────────────────────────────────────────
  noFill();
  if (alarmMode) {
    const ap = (sin(millis() * 0.008) + 1) / 2;
    stroke(255, 40, 40, 100 + ap * 110);
  } else {
    stroke(0, 255, 120, 25 + scanProgress * 160);
  }
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  triangle(x1, y1, x2, y2, x3, y3);
  noStroke();

  // ── Camera lens — centroid of the triangle ───────────────────────────────
  const lcx   = cx;
  const lcy   = (topY * 2 + botY) / 3;   // visual centroid ~36% down
  const maxR  = Math.min(width, height) * 0.13;
  const fade  = alarmMode ? 1.0 : 0.35 + scanProgress * 0.65;

  // Outer housing ring
  noFill();
  stroke(160, 25, 25, 95 * fade);
  strokeWeight(Math.max(2, Math.round(3 * uiScale)));
  circle(lcx, lcy, maxR * 2);

  // Glass element rings
  const rings = [0.76, 0.52, 0.33];
  for (let i = 0; i < rings.length; i++) {
    stroke(185, 35, 35, (22 + i * 18) * fade);
    strokeWeight(Math.max(1, Math.round(1.5 * uiScale)));
    circle(lcx, lcy, maxR * rings[i] * 2);
  }

  // Rotating aperture blades
  const blades   = 8;
  const rotation = t * 0.22;
  stroke(210, 45, 45, 65 * fade);
  strokeWeight(Math.max(1, Math.round(uiScale)));
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TWO_PI + rotation;
    line(
      lcx + cos(a) * maxR * 0.16, lcy + sin(a) * maxR * 0.16,
      lcx + cos(a) * maxR * 0.70, lcy + sin(a) * maxR * 0.70
    );
  }

  // Iris — breathes gently
  noStroke();
  const irisR = maxR * (0.26 + pulse * (alarmMode ? 0.10 : 0.05));
  fill(100, 8, 8, 65 * fade);
  circle(lcx, lcy, irisR * 2);

  // Pupil — the red eye
  fill(225, 28, 28, (145 + pulse * 110) * fade);
  circle(lcx, lcy, maxR * 0.16);

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
