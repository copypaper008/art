// Visual effects — constructivist/brutalist aesthetic
// Machine state: deep red on near-black. ALARM: full rainbow eruption.

const GHOST_FRAMES = 8;
const ghostTrails  = [];

let ripplePhase = 0;
let rippleBuffer = null;
let mirrorBuffer = null;

let _flashTimer = -9999;
const _FLASH_DUR = 320;

let _particles = [];

// Primary machine red — used throughout non-alarm UI
const M_RED = [220, 20, 20];

function initVisuals(w, h) {
  mirrorBuffer = createGraphics(w, h);
  rippleBuffer = createGraphics(w, h);
  mirrorBuffer.pixelDensity(1);
  rippleBuffer.pixelDensity(1);
}

function drawDistortedMirror(videoCapture, currentState) {
  if (!videoCapture || !mirrorBuffer) return;

  // Determine color filter and camera opacity per state.
  // Filter is applied to mirrorBuffer at draw time (baked into pixels before
  // applyRipple reads them). Opacity is then applied via tint() when blitting
  // to the main canvas — this is reliable across mobile browsers, unlike
  // globalAlpha + CSS filter combined on the main context.
  let filterStr, camAlpha;
  if (currentState === "ALARM") {
    const hue = (millis() * 0.18) % 360;
    filterStr = `hue-rotate(${hue}deg) saturate(220%) brightness(1.1)`;
    camAlpha  = 0.72;
  } else if (currentState === "STRAIGHT") {
    filterStr = "grayscale(100%) brightness(0.38) contrast(1.5)";
    camAlpha  = 0.50;
  } else {
    filterStr = "saturate(8%) brightness(0.55) contrast(1.6)";
    camAlpha  = 0.45;
  }

  // Draw camera flipped into mirrorBuffer with color filter baked in
  mirrorBuffer.push();
  mirrorBuffer.translate(mirrorBuffer.width, 0);
  mirrorBuffer.scale(-1, 1);
  mirrorBuffer.drawingContext.filter = filterStr;
  mirrorBuffer.image(videoCapture, 0, 0, mirrorBuffer.width, mirrorBuffer.height);
  mirrorBuffer.drawingContext.filter = "none";
  mirrorBuffer.pop();

  const motionAmount = detection.motionAmount;
  const amplitude    = map(motionAmount, 0, 0.15, 2, 18, true);
  ripplePhase += 0.04;
  applyRipple(mirrorBuffer, rippleBuffer, amplitude);

  // Ghost motion trails — very faint, add camera persistence effect
  for (let i = 0; i < ghostTrails.length; i++) {
    const alpha = map(i, 0, ghostTrails.length, 4, 18);
    tint(255, alpha);
    image(ghostTrails[i], 0, 0);
  }
  noTint();

  // Composite camera over background image at partial opacity
  tint(255, Math.round(camAlpha * 255));
  image(rippleBuffer, 0, 0);
  noTint();

  if (frameCount % 3 === 0) {
    if (ghostTrails.length >= GHOST_FRAMES) {
      const old = ghostTrails.shift();
      old.remove(); // Free canvas/GPU resources — prevents memory crash on mobile
    }
    const snapshot = createGraphics(width, height);
    snapshot.image(rippleBuffer, 0, 0);
    ghostTrails.push(snapshot);
  }
}

function applyRipple(src, dst, amplitude) {
  src.loadPixels();
  dst.loadPixels();
  const w = src.width, h = src.height;
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

// ── Constructivist structure grid ─────────────────────────────────────────────
function drawGrid() {
  if (faceTracker.hasAlarm()) return;

  strokeWeight(1);

  // Horizontal rules at eighths of screen height
  stroke(M_RED[0], M_RED[1], M_RED[2], 18);
  const hStep = Math.round(height / 8);
  for (let y = hStep; y < height; y += hStep) {
    line(0, y, width, y);
  }

  // Vertical rules at thirds
  stroke(M_RED[0], M_RED[1], M_RED[2], 12);
  line(width * 0.333, 0, width * 0.333, height);
  line(width * 0.667, 0, width * 0.667, height);

  // One bold diagonal accent — top-right to mid-right (constructivist signature)
  stroke(M_RED[0], M_RED[1], M_RED[2], 28);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  line(width * 0.78, 0, width, height * 0.3);

  noStroke();
}

// ── Scan lines — fine horizontal CRT texture only, no sweep ──────────────────
function drawScanLines() {
  stroke(M_RED[0], 0, 0, 10);
  strokeWeight(1);
  const spacing = Math.max(3, Math.round(5 * uiScale));
  for (let y = 0; y < height; y += spacing) line(0, y, width, y);
  noStroke();
}

// ── Alarm overlay ─────────────────────────────────────────────────────────────
function drawAlarmOverlay() {
  const pulse = (sin(millis() * 0.008) + 1) / 2;
  noStroke();
  fill(0, 0, 0, 10 + pulse * 18);
  rect(0, 0, width, height);

  const borderA   = 100 + pulse * 140;
  const borderHue = (millis() * 0.3) % 360;
  colorMode(HSB, 360, 100, 100, 255);
  stroke(borderHue, 100, 100, borderA);
  colorMode(RGB, 255);
  strokeWeight(Math.max(4, Math.round(7 * uiScale)));
  noFill();
  rect(0, 0, width, height);
  noStroke();
}

function clearGhostTrails() {
  for (const g of ghostTrails) g.remove();
  ghostTrails.length = 0;
}

// ── Transition flash ──────────────────────────────────────────────────────────
function triggerFlash() { _flashTimer = millis(); }

function drawTransitionFlash() {
  const elapsed = millis() - _flashTimer;
  if (elapsed > _FLASH_DUR) return;
  const alpha = map(elapsed, 0, _FLASH_DUR, 255, 0, true);
  noStroke();
  fill(255, alpha);
  rect(0, 0, width, height);
}

// ── Confetti particles ────────────────────────────────────────────────────────
function initParticles() {
  _particles = Array.from({ length: 100 }, () => ({
    x:     random(width),
    y:     random(-height * 0.6, 0),
    vy:    random(2.0, 6.0) * uiScale,
    vx:    random(-1.5, 1.5),
    r:     random(4, 11) * uiScale,
    hue:   random(360),
    a:     random(180, 255),
    shape: floor(random(3)),
  }));
}

function drawParticles() {
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  for (const p of _particles) {
    p.y  += p.vy;
    p.x  += p.vx;
    p.hue = (p.hue + 1.4) % 360;
    if (p.y > height + p.r) { p.y = -p.r * 2; p.x = random(width); }
    fill(p.hue, 90, 100, p.a);
    if      (p.shape === 0) circle(p.x, p.y, p.r * 2);
    else if (p.shape === 1) rect(p.x - p.r * 0.4, p.y - p.r * 0.6, p.r * 0.8, p.r * 1.4);
    else triangle(p.x, p.y - p.r, p.x - p.r * 0.9, p.y + p.r * 0.7, p.x + p.r * 0.9, p.y + p.r * 0.7);
  }
  colorMode(RGB, 255);
  noFill();
}

// ── Face glow — spotlight that lifts the subject from the dark background ────
function drawFaceGlow(s) {
  const t       = millis();
  const glowR   = Math.max(s.w, s.h) * 2.0;
  const steps   = 22;

  blendMode(SCREEN);
  noStroke();

  if (s.state === 'ALARM') {
    // Rainbow halo during alarm
    colorMode(HSB, 360, 100, 100, 255);
    const hue = (t * 0.25 + s.id * 40) % 360;
    for (let i = steps; i > 0; i--) {
      const r = glowR * (i / steps);
      fill(hue, 70, 100, map(i, 0, steps, 0, 38));
      ellipse(s.x, s.y, r, r * 1.3);
    }
    colorMode(RGB, 255);
  } else {
    // Warm white spotlight — lifts face from dark bunker background
    const pulse = s.state === 'SCANNING'
      ? 0.88 + sin(t * 0.005) * 0.12   // subtle breathe during scan
      : 1.0;
    for (let i = steps; i > 0; i--) {
      const r = glowR * (i / steps);
      const a = map(i, 0, steps, 0, 52 * pulse);
      fill(255, 248, 225, a);
      ellipse(s.x, s.y, r, r * 1.3);
    }
  }

  blendMode(BLEND);
  noFill();
}

// ── Face targeting brackets — shown when no tracked subjects yet ──────────────
function drawFaceOverlays(faces, currentState, personCount, alarmMode = false) {
  if (!faces || faces.length === 0) return;
  noFill();

  for (const face of faces) {
    const tlx = face.x - face.w * 0.55;
    const tly = face.y - face.h * 0.6;
    const brx = tlx + face.w * 1.1;
    const bry = tly + face.h * 1.2;
    const len = Math.round(18 * uiScale);
    const bW  = Math.max(2, Math.round(3 * uiScale));

    strokeWeight(bW);
    if (alarmMode) {
      colorMode(HSB, 360, 100, 100, 255);
      stroke((millis() * 0.3) % 360, 100, 100, 200);
      colorMode(RGB, 255);
    } else {
      stroke(M_RED[0], M_RED[1], M_RED[2], 160);
    }

    line(tlx, tly, tlx + len, tly); line(tlx, tly, tlx, tly + len);
    line(brx, tly, brx - len, tly); line(brx, tly, brx, tly + len);
    line(tlx, bry, tlx + len, bry); line(tlx, bry, tlx, bry - len);
    line(brx, bry, brx - len, bry); line(brx, bry, brx, bry - len);
  }
  noStroke();
}
