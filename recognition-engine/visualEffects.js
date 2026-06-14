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

function drawDistortedMirror(videoCapture, currentState) {
  if (!videoCapture || !mirrorBuffer) return;

  mirrorBuffer.push();
  mirrorBuffer.translate(mirrorBuffer.width, 0);
  mirrorBuffer.scale(-1, 1);
  mirrorBuffer.image(videoCapture, 0, 0, mirrorBuffer.width, mirrorBuffer.height);
  mirrorBuffer.pop();

  const motionAmount = detection.motionAmount;
  const amplitude    = map(motionAmount, 0, 0.15, 2, 22, true);
  ripplePhase += 0.04;
  applyRipple(mirrorBuffer, rippleBuffer, amplitude);

  for (let i = 0; i < ghostTrails.length; i++) {
    const alpha = map(i, 0, ghostTrails.length, 5, 25);
    tint(255, alpha);
    image(ghostTrails[i], 0, 0);
  }
  noTint();

  if (currentState === "ALARM") {
    // Full rainbow hue-rotate — the camera becomes a pride light show
    const hue = (millis() * 0.18) % 360;
    drawingContext.filter = `hue-rotate(${hue}deg) saturate(170%)`;
    image(rippleBuffer, 0, 0);
    drawingContext.filter = "none";
  } else if (currentState === "STRAIGHT") {
    // World goes grey — boring, colourless, nothing to see here
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
    const sweepHue = (millis() * 0.3) % 360;
    colorMode(HSB, 360, 100, 100, 255);
    stroke(sweepHue, 100, 100, 25);
    colorMode(RGB, 255);
  } else {
    stroke(0, 255, 120, 12);
  }
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  line(0, sweepY, width, sweepY);
  noStroke();
}

function drawAlarmOverlay() {
  const pulse   = (sin(millis() * 0.008) + 1) / 2;
  // Light overlay — let the rainbow camera feed show through
  noStroke();
  fill(0, 0, 0, 12 + pulse * 20);
  rect(0, 0, width, height);

  const borderA   = 90 + pulse * 130;
  const borderHue = (millis() * 0.3) % 360;
  colorMode(HSB, 360, 100, 100, 255);
  stroke(borderHue, 100, 100, borderA);
  colorMode(RGB, 255);
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
function triggerFlash() { _flashTimer = millis(); }

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
    shape: floor(random(3)),
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

// ── Spectrum scanner — replaces triangle/eye ──────────────────────────────────
function drawSpectrumScan(alarmMode) {
  const t            = millis() * 0.001;
  const scanProgress = alarmMode ? 1 : constrain((millis() - stateAt) / SCAN_DURATION, 0, 1);
  const fade         = alarmMode ? 1.0 : 0.15 + scanProgress * 0.85;

  const pad    = Math.round(24 * uiScale);
  const barW   = Math.max(10, Math.round(14 * uiScale));
  const barX   = width - pad - barW;
  const barTop = height * 0.12;
  const barBot = height * 0.88;
  const barH   = barBot - barTop;

  // ── Sweeping scan line ────────────────────────────────────────────────────
  // Oscillates gently; in alarm it sweeps faster and more wildly
  const speed    = alarmMode ? 1.4 : 0.72;
  const range    = alarmMode ? height * 0.44 : height * 0.36;
  const scanY    = height * 0.5 + sin(t * speed) * range;

  const glowSpan = Math.round(55 * uiScale);

  if (alarmMode) {
    // Rainbow scan glow
    colorMode(HSB, 360, 100, 100, 255);
    for (let dy = 0; dy < glowSpan; dy++) {
      const a   = map(dy, 0, glowSpan, 75, 0);
      const hue = (t * 80 + dy * 3) % 360;
      stroke(hue, 80, 100, a);
      strokeWeight(1);
      if (scanY + dy < height) line(0, scanY + dy, width, scanY + dy);
      if (scanY - dy >= 0)     line(0, scanY - dy, width, scanY - dy);
    }
    // Bright scan line — rainbow
    const lineHue = (t * 90) % 360;
    stroke(lineHue, 60, 100, 230);
    strokeWeight(Math.max(2, Math.round(3 * uiScale)));
    line(0, scanY, width, scanY);
    colorMode(RGB, 255);
  } else {
    // Green scan glow
    for (let dy = 0; dy < glowSpan; dy++) {
      const a = map(dy, 0, glowSpan, 70 * fade, 0);
      stroke(0, 255, 120, a);
      strokeWeight(1);
      if (scanY + dy < height) line(0, scanY + dy, width, scanY + dy);
      if (scanY - dy >= 0)     line(0, scanY - dy, width, scanY - dy);
    }
    // Bright scan line
    stroke(220, 255, 230, 200 * fade);
    strokeWeight(Math.max(2, Math.round(3 * uiScale)));
    line(0, scanY, width, scanY);
  }
  noStroke();

  // ── Right side: PRIDE SPECTRUM bar ───────────────────────────────────────
  colorMode(HSB, 360, 100, 100, 255);
  for (let y = 0; y < barH; y++) {
    // Map top→bottom to violet→red (visible spectrum direction)
    const hue  = map(y, 0, barH, 270, 0);
    const sat  = alarmMode ? 95 : 85;
    const bri  = alarmMode ? 100 : 90;
    const alph = 140 * fade;
    stroke(hue, sat, bri, alph);
    strokeWeight(1);
    line(barX, barTop + y, barX + barW, barTop + y);
  }
  colorMode(RGB, 255);

  // Spectrum bar border
  noFill();
  stroke(0, 255, 120, 55 * fade);
  strokeWeight(1);
  rect(barX, barTop, barW, barH);
  noStroke();

  // Position indicator on spectrum bar
  const specPos = constrain(map(scanY, height * 0.1, height * 0.9, barTop, barBot), barTop, barBot);
  stroke(255, 255, 255, 210 * fade);
  strokeWeight(Math.max(2, Math.round(2 * uiScale)));
  line(barX - Math.round(5 * uiScale), specPos,
       barX + barW + Math.round(5 * uiScale), specPos);
  noStroke();

  // Face markers on spectrum bar — where each detected face sits
  if (detection.faces && detection.faces.length > 0) {
    for (const f of detection.faces) {
      const fPos = constrain(map(f.y, height * 0.1, height * 0.9, barTop, barBot), barTop, barBot);
      const hue  = map(fPos, barTop, barBot, 270, 0);
      colorMode(HSB, 360, 100, 100, 255);
      stroke(hue, 100, 100, 200 * fade);
      colorMode(RGB, 255);
      strokeWeight(Math.max(2, Math.round(2 * uiScale)));
      const mk = Math.round(4 * uiScale);
      line(barX - mk, fPos, barX,        fPos);
      line(barX + barW, fPos, barX + barW + mk, fPos);
      noStroke();
    }
  }

  // Spectrum bar label
  noStroke();
  fill(0, 255, 120, 100 * fade);
  textFont("monospace");
  textAlign(RIGHT, BOTTOM);
  textSize(Math.max(6, Math.round(8 * uiScale)));
  text("PRIDE", barX - Math.round(6 * uiScale), barTop + Math.round(barH * 0.4));
  text("SPECTRUM", barX - Math.round(6 * uiScale), barTop + Math.round(barH * 0.4) + Math.round(10 * uiScale));

  // ── Wavelength readout beside scan line ───────────────────────────────────
  // Map scan position to a wavelength in the visible spectrum (380–700nm)
  const wavelength = Math.round(map(scanY, height * 0.1, height * 0.9, 380, 700));

  noStroke();
  fill(0, 255, 120, 170 * fade);
  textFont("monospace");
  textAlign(LEFT, CENTER);
  textSize(Math.max(8, Math.round(10 * uiScale)));
  text("λ " + wavelength + "nm", pad, scanY - Math.round(18 * uiScale));

  // Chromatic index — fake but believable
  const chromIdx = (sin(t * 0.6) * 0.5 + 0.5);
  fill(0, 255, 120, 100 * fade);
  textSize(Math.max(7, Math.round(9 * uiScale)));
  text("CHROMATIC INDEX  " + chromIdx.toFixed(3), pad, scanY + Math.round(20 * uiScale));

  // ── Bottom: accumulating spectrum readout bar ─────────────────────────────
  const readBarY = height * 0.91;
  const readBarW = width * 0.55;
  const readBarX = width * 0.5 - readBarW / 2;
  const readBarH = Math.max(3, Math.round(5 * uiScale));

  // Track border
  noFill();
  stroke(0, 255, 120, 35 * fade);
  strokeWeight(1);
  rect(readBarX, readBarY, readBarW, readBarH);

  // Fill with progress-driven rainbow
  colorMode(HSB, 360, 100, 100, 255);
  const filledW = readBarW * scanProgress;
  for (let x = 0; x < filledW; x++) {
    const hue = map(x, 0, readBarW, 0, 300);
    stroke(hue, 85, 95, 180 * fade);
    strokeWeight(1);
    line(readBarX + x, readBarY, readBarX + x, readBarY + readBarH);
  }
  colorMode(RGB, 255);

  // Label above readout bar
  noStroke();
  fill(0, 255, 120, 80 * fade);
  textFont("monospace");
  textAlign(CENTER, BOTTOM);
  textSize(Math.max(6, Math.round(8 * uiScale)));
  text("ORIENTATION SPECTRUM ANALYSIS", width * 0.5, readBarY - Math.round(4 * uiScale));

  noStroke();
  noFill();
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
