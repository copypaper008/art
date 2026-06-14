// Visual effects: mirror, scan lines, ghost trails, pixel ripple, alarm overlay

const GHOST_FRAMES = 8;
const ghostTrails = [];

let ripplePhase = 0;
let rippleBuffer = null;
let mirrorBuffer = null;

// Transition flash
let _flashTimer = -9999;
const _FLASH_DUR = 320;

// Rainbow confetti particles (ALARM state)
let _particles = [];

function initVisuals(w, h) {
  mirrorBuffer = createGraphics(w, h);
  rippleBuffer = createGraphics(w, h);
  mirrorBuffer.pixelDensity(1);
  rippleBuffer.pixelDensity(1);
}

function drawDistortedMirror(videoCapture, motionAmount, currentState) {
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

  // State-driven camera treatment
  if (currentState === "ALARM") {
    // Cycling rainbow hue — pride in full display
    const hue = (millis() * 0.18) % 360;
    drawingContext.filter = `hue-rotate(${hue}deg) saturate(170%)`;
    image(rippleBuffer, 0, 0);
    drawingContext.filter = "none";
  } else if (currentState === "STRAIGHT") {
    // Grayscale — you're boring, the world went grey
    drawingContext.filter = "grayscale(100%) brightness(0.62)";
    image(rippleBuffer, 0, 0);
    drawingContext.filter = "none";
  } else {
    tint(255, 120);
    image(rippleBuffer, 0, 0);
    noTint();
  }

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
      const srcX   = constrain(x + offsetX, 0, w - 1);
      const srcIdx = (y * w + srcX) * 4;
      const dstIdx = (y * w + x) * 4;
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

function drawAlarmOverlay() {
  // Lighter overlay — camera's rainbow should show through
  const pulse = (sin(millis() * 0.008) + 1) / 2;
  const alpha = 15 + pulse * 30;

  noStroke();
  fill(0, 0, 0, alpha);
  rect(0, 0, width, height);

  // Pulsing red border
  const borderA = 90 + pulse * 130;
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

// ── State-transition white flash ──────────────────────────────────────────────
function triggerFlash() {
  _flashTimer = millis();
}

function drawTransitionFlash() {
  const elapsed = millis() - _flashTimer;
  if (elapsed > _FLASH_DUR) return;
  const alpha = map(elapsed, 0, _FLASH_DUR, 230, 0, true);
  noStroke();
  fill(255, alpha);
  rect(0, 0, width, height);
}

// ── Rainbow confetti particles ────────────────────────────────────────────────
function initParticles() {
  _particles = Array.from({ length: 80 }, () => ({
    x:     random(width),
    y:     random(-height * 0.6, 0),
    vy:    random(1.8, 5.5) * uiScale,
    vx:    random(-1.2, 1.2),
    r:     random(3, 9) * uiScale,
    hue:   random(360),
    a:     random(170, 255),
    shape: floor(random(3)),  // 0 circle, 1 rect, 2 triangle
  }));
}

function drawParticles() {
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  for (const p of _particles) {
    p.y  += p.vy;
    p.x  += p.vx;
    p.hue = (p.hue + 1.2) % 360;
    if (p.y > height + p.r) { p.y = -p.r * 2; p.x = random(width); }
    fill(p.hue, 88, 98, p.a);
    if      (p.shape === 0) circle(p.x, p.y, p.r * 2);
    else if (p.shape === 1) rect(p.x - p.r * 0.4, p.y - p.r * 0.6, p.r * 0.8, p.r * 1.4);
    else triangle(p.x, p.y - p.r, p.x - p.r * 0.9, p.y + p.r * 0.7, p.x + p.r * 0.9, p.y + p.r * 0.7);
  }
  colorMode(RGB, 255);
  noFill();
}

// ── Rainbow triangle outline ──────────────────────────────────────────────────
function _rainbowTriangle(x1, y1, x2, y2, x3, y3, alpha, weight, hueShift) {
  const segsPerSide = 48;
  const pts = [];
  for (let i = 0; i < segsPerSide; i++) {
    const t = i / segsPerSide;
    pts.push([lerp(x1, x2, t), lerp(y1, y2, t)]);
  }
  for (let i = 0; i < segsPerSide; i++) {
    const t = i / segsPerSide;
    pts.push([lerp(x2, x3, t), lerp(y2, y3, t)]);
  }
  for (let i = 0; i < segsPerSide; i++) {
    const t = i / segsPerSide;
    pts.push([lerp(x3, x1, t), lerp(y3, y1, t)]);
  }

  strokeWeight(weight);
  noFill();
  colorMode(HSB, 360, 100, 100, 255);
  for (let i = 0; i < pts.length; i++) {
    const hue  = (hueShift + (i / pts.length) * 360) % 360;
    const next = pts[(i + 1) % pts.length];
    stroke(hue, 88, 98, alpha);
    line(pts[i][0], pts[i][1], next[0], next[1]);
  }
  colorMode(RGB, 255);
  noStroke();
}

// ── Triangle + eye: one instance per detected face ───────────────────────────
function drawPinkTriangle(alarmMode) {
  const faces = detection.faces;

  if (!faces || faces.length === 0) {
    _drawFaceFrame(alarmMode, width * 0.5, height * 0.42, Math.min(width, height) * 0.45);
  } else {
    for (const f of faces) {
      _drawFaceFrame(alarmMode, f.x, f.y, Math.max(f.w, f.h));
    }
  }
}

function _drawFaceFrame(alarmMode, fcx, fcy, faceSize) {
  const t            = millis() * 0.001;
  const scanProgress = alarmMode ? 1 : constrain((millis() - stateAt) / SCAN_DURATION, 0, 1);
  const fade         = alarmMode ? 1.0 : 0.25 + scanProgress * 0.75;

  const lr = alarmMode ? 200 : 0;
  const lg = alarmMode ? 30  : 210;
  const lb = alarmMode ? 30  : 100;

  const triHalf = faceSize * 0.90;
  const x1 = fcx - triHalf, y1 = fcy - faceSize * 1.05;
  const x2 = fcx + triHalf, y2 = fcy - faceSize * 1.05;
  const x3 = fcx,            y3 = fcy + faceSize * 0.95;

  const triWeight = Math.max(1, Math.round(2 * uiScale));

  if (alarmMode) {
    const ap = (sin(millis() * 0.008) + 1) / 2;
    noFill();
    stroke(255, 20, 80, 130 + ap * 125);
    strokeWeight(triWeight);
    triangle(x1, y1, x2, y2, x3, y3);
    noStroke();
  } else {
    const hueShift = (millis() * 0.025) % 360;
    _rainbowTriangle(x1, y1, x2, y2, x3, y3, 40 + scanProgress * 190, triWeight, hueShift);
  }

  const chSz = Math.round(16 * uiScale);
  _crosshair(x1 + triHalf * 0.18, y1 + faceSize * 0.12, chSz, lr, lg, lb, 120 * fade);
  _crosshair(x2 - triHalf * 0.18, y2 + faceSize * 0.12, chSz, lr, lg, lb, 120 * fade);
  _crosshair(fcx - faceSize * 0.72, fcy, chSz, lr, lg, lb, 90 * fade);
  _crosshair(fcx + faceSize * 0.72, fcy, chSz, lr, lg, lb, 90 * fade);

  // ── Surveillance eye ─────────────────────────────────────────────────────
  const maxR      = faceSize * 0.22;
  const irisOuter = maxR * 0.60;
  const pupilR    = maxR * 0.27;

  const driftX = sin(t * 0.18) * maxR * 0.07;
  const driftY = sin(t * 0.78) * irisOuter * 0.44;
  const px = fcx + driftX;
  const py = fcy + driftY;

  noFill();
  stroke(lr, lg, lb, 115 * fade);
  strokeWeight(Math.max(4, Math.round(6 * uiScale)));
  circle(fcx, fcy, maxR * 2);

  stroke(lr, lg, lb, 55 * fade);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  circle(fcx, fcy, maxR * 1.82);

  const rot1 = t * 0.14;
  stroke(lr, lg, lb, 100 * fade);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  for (let i = 0; i < 4; i++) {
    const sa = (i / 4) * TWO_PI + rot1 + 0.18;
    arc(fcx, fcy, maxR * 1.58, maxR * 1.58, sa, sa + TWO_PI / 4 - 0.36);
  }

  const rot2 = -t * 0.09;
  stroke(lr, lg, lb, 82 * fade);
  strokeWeight(Math.max(1, Math.round(1.5 * uiScale)));
  for (let i = 0; i < 6; i++) {
    const sa = (i / 6) * TWO_PI + rot2 + 0.12;
    arc(fcx, fcy, maxR * 1.32, maxR * 1.32, sa, sa + TWO_PI / 6 - 0.24);
  }

  stroke(lr, lg, lb, 58 * fade);
  strokeWeight(Math.max(1, Math.round(uiScale)));
  for (let i = 0; i < 32; i++) {
    const a   = (i / 32) * TWO_PI + rot1;
    const len = (i % 4 === 0) ? 0.14 : 0.06;
    const rIn = irisOuter * 1.10;
    line(
      fcx + cos(a) * rIn,             fcy + sin(a) * rIn,
      fcx + cos(a) * rIn * (1 + len), fcy + sin(a) * rIn * (1 + len)
    );
  }

  noStroke();
  fill(55, 8, 6, 100 * fade);
  circle(fcx, fcy, irisOuter * 2);

  stroke(lr, lg, lb, 44 * fade);
  strokeWeight(Math.max(1, Math.round(0.6 * uiScale)));
  for (let i = 0; i < 160; i++) {
    const a         = (i / 160) * TWO_PI;
    const innerEdge = pupilR * 1.05;
    const outerEdge = irisOuter * (0.84 + (i % 3 === 0 ? 0.16 : 0));
    line(
      fcx + cos(a) * innerEdge, fcy + sin(a) * innerEdge,
      fcx + cos(a) * outerEdge, fcy + sin(a) * outerEdge
    );
  }

  noStroke();
  fill(4, 0, 0, 242 * fade);
  circle(px, py, pupilR * 2);

  noFill();
  stroke(lr, lg, lb, 58 * fade);
  strokeWeight(Math.max(1, Math.round(1.5 * uiScale)));
  circle(px, py, pupilR * 2.15);

  noStroke();
  fill(255, 230, 230, 108 * fade);
  circle(px + pupilR * 0.38, py - pupilR * 0.38, pupilR * 0.30);
  fill(255, 200, 200, 50 * fade);
  circle(px - pupilR * 0.22, py + pupilR * 0.28, pupilR * 0.13);

  if (!alarmMode && scanProgress > 0.05) {
    noStroke();
    fill(lr, lg, lb, 165 * fade);
    textFont("monospace");
    textAlign(LEFT, CENTER);
    textSize(Math.max(8, Math.round(10 * uiScale)));
    text(Math.round(scanProgress * 94) + "%", fcx + maxR * 1.14, fcy);
    stroke(lr, lg, lb, 120 * fade);
    strokeWeight(Math.max(1, Math.round(uiScale)));
    line(fcx + maxR * 1.05, fcy, fcx + maxR * 1.10, fcy);
    noStroke();
  }

  noStroke();
  noFill();
}

function _crosshair(x, y, size, r, g, b, a) {
  stroke(r, g, b, a);
  strokeWeight(Math.max(1, Math.round(uiScale)));
  noFill();
  const hs  = size * 0.5;
  const gap = size * 0.18;
  line(x - hs, y, x - gap, y);
  line(x + gap, y, x + hs, y);
  line(x, y - hs, x, y - gap);
  line(x, y + gap, x, y + hs);
  noStroke();
}

// Face targeting reticle — IDLE only
function drawFaceOverlays(faces, currentState, personCount, alarmMode = false) {
  if (!faces || faces.length === 0) return;

  const r = alarmMode ? 255 : 0;
  const g = alarmMode ? 0   : 255;
  const b = alarmMode ? 0   : 120;

  noFill();

  for (const face of faces) {
    const flicker = alarmMode ? random(0.6, 1.0) : random(0.85, 1.0);

    stroke(r, g, b, 18 * flicker);
    strokeWeight(8);
    rect(face.x - face.w * 0.6, face.y - face.h * 0.65, face.w * 1.2, face.h * 1.3, 4);

    stroke(r, g, b, alarmMode ? 80 * flicker : 25 * flicker);
    strokeWeight(alarmMode ? 2 : 1);
    rect(face.x - face.w * 0.55, face.y - face.h * 0.6, face.w * 1.1, face.h * 1.2, 2);

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
