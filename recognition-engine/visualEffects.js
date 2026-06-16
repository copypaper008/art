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

  mirrorBuffer.push();
  mirrorBuffer.translate(mirrorBuffer.width, 0);
  mirrorBuffer.scale(-1, 1);
  mirrorBuffer.image(videoCapture, 0, 0, mirrorBuffer.width, mirrorBuffer.height);
  mirrorBuffer.pop();

  const motionAmount = detection.motionAmount;
  const amplitude    = map(motionAmount, 0, 0.15, 2, 18, true);
  ripplePhase += 0.04;
  applyRipple(mirrorBuffer, rippleBuffer, amplitude);

  for (let i = 0; i < ghostTrails.length; i++) {
    const alpha = map(i, 0, ghostTrails.length, 4, 18);
    tint(255, alpha);
    image(ghostTrails[i], 0, 0);
  }
  noTint();

  if (currentState === "ALARM") {
    const hue = (millis() * 0.18) % 360;
    drawingContext.filter = `hue-rotate(${hue}deg) saturate(200%) brightness(1.05)`;
    image(rippleBuffer, 0, 0);
    drawingContext.filter = "none";
  } else if (currentState === "STRAIGHT") {
    // Punishing: pitch-dark monochrome
    drawingContext.filter = "grayscale(100%) brightness(0.42) contrast(1.4)";
    image(rippleBuffer, 0, 0);
    drawingContext.filter = "none";
  } else {
    // Constructivist scanning: heavily desaturated so red UI elements dominate
    drawingContext.filter = "saturate(12%) brightness(0.52) contrast(1.5)";
    image(rippleBuffer, 0, 0);
    drawingContext.filter = "none";
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

// ── Scan lines — bold red sweep on fine horizontal texture ────────────────────
function drawScanLines() {
  const isAlarm = faceTracker.hasAlarm();

  // Fine horizontal texture
  stroke(isAlarm ? 0 : M_RED[0], 0, 0, 14);
  strokeWeight(1);
  const spacing = Math.max(3, Math.round(5 * uiScale));
  for (let y = 0; y < height; y += spacing) line(0, y, width, y);
  noStroke();

  // Sweep line — bold red (machine) or rainbow (alarm)
  const sweepY = (frameCount * (isAlarm ? 1.8 : 0.7)) % height;
  if (isAlarm) {
    const sweepHue = (millis() * 0.3) % 360;
    colorMode(HSB, 360, 100, 100, 255);
    stroke(sweepHue, 100, 100, 45);
    colorMode(RGB, 255);
  } else {
    stroke(M_RED[0], M_RED[1], M_RED[2], 80);
  }
  strokeWeight(Math.max(2, Math.round(3 * uiScale)));
  line(0, sweepY, width, sweepY);
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

// ── Spectrum scanner ──────────────────────────────────────────────────────────
function drawSpectrumScan(alarmMode) {
  const t = millis() * 0.001;
  let scanProgress = 1;
  if (!alarmMode) {
    let maxProg = 0;
    for (const s of faceTracker.subjects) {
      if (s.state === 'SCANNING') {
        const p = constrain((millis() - s.stateAt) / SCAN_DURATION, 0, 1);
        if (p > maxProg) maxProg = p;
      }
    }
    scanProgress = maxProg;
  }
  const fade = alarmMode ? 1.0 : 0.15 + scanProgress * 0.85;

  const pad    = Math.round(24 * uiScale);
  const barW   = Math.max(10, Math.round(14 * uiScale));
  const barX   = width - pad - barW;
  const barTop = height * 0.12;
  const barBot = height * 0.88;
  const barH   = barBot - barTop;

  // Sweeping scan line
  const speed   = alarmMode ? 1.4 : 0.72;
  const range   = alarmMode ? height * 0.44 : height * 0.36;
  const scanY   = height * 0.5 + sin(t * speed) * range;
  const glowSpan = Math.round(45 * uiScale);

  if (alarmMode) {
    colorMode(HSB, 360, 100, 100, 255);
    for (let dy = 0; dy < glowSpan; dy++) {
      const a   = map(dy, 0, glowSpan, 70, 0);
      const hue = (t * 80 + dy * 3) % 360;
      stroke(hue, 80, 100, a);
      strokeWeight(1);
      if (scanY + dy < height) line(0, scanY + dy, width, scanY + dy);
      if (scanY - dy >= 0)     line(0, scanY - dy, width, scanY - dy);
    }
    const lineHue = (t * 90) % 360;
    stroke(lineHue, 60, 100, 240);
    strokeWeight(Math.max(2, Math.round(3 * uiScale)));
    line(0, scanY, width, scanY);
    colorMode(RGB, 255);
  } else {
    // Red scan glow
    for (let dy = 0; dy < glowSpan; dy++) {
      const a = map(dy, 0, glowSpan, 70 * fade, 0);
      stroke(M_RED[0], M_RED[1], M_RED[2], a);
      strokeWeight(1);
      if (scanY + dy < height) line(0, scanY + dy, width, scanY + dy);
      if (scanY - dy >= 0)     line(0, scanY - dy, width, scanY - dy);
    }
    // Hard white scan line
    stroke(255, 255, 255, 220 * fade);
    strokeWeight(Math.max(2, Math.round(4 * uiScale)));
    line(0, scanY, width, scanY);
  }
  noStroke();

  // Right side: spectrum bar
  colorMode(HSB, 360, 100, 100, 255);
  for (let y = 0; y < barH; y++) {
    const hue  = map(y, 0, barH, 270, 0);
    const sat  = alarmMode ? 95 : 85;
    const bri  = alarmMode ? 100 : 90;
    const alph = 130 * fade;
    stroke(hue, sat, bri, alph);
    strokeWeight(1);
    line(barX, barTop + y, barX + barW, barTop + y);
  }
  colorMode(RGB, 255);

  // Spectrum bar border
  noFill();
  stroke(M_RED[0], M_RED[1], M_RED[2], 70 * fade);
  strokeWeight(1);
  rect(barX, barTop, barW, barH);
  noStroke();

  // Position indicator
  const specPos = constrain(map(scanY, height * 0.1, height * 0.9, barTop, barBot), barTop, barBot);
  stroke(255, 255, 255, 200 * fade);
  strokeWeight(Math.max(2, Math.round(2 * uiScale)));
  line(barX - Math.round(5 * uiScale), specPos, barX + barW + Math.round(5 * uiScale), specPos);
  noStroke();

  // Face markers on spectrum bar
  if (faceTracker.subjects.length > 0) {
    for (const s of faceTracker.subjects) {
      const fPos = constrain(map(s.y, height * 0.1, height * 0.9, barTop, barBot), barTop, barBot);
      if (s.state === 'ALARM') {
        colorMode(HSB, 360, 100, 100, 255);
        stroke((t * 90) % 360, 100, 100, 210 * fade);
        colorMode(RGB, 255);
      } else {
        stroke(255, 255, 255, 180 * fade);
      }
      strokeWeight(Math.max(2, Math.round(2 * uiScale)));
      const mk = Math.round(5 * uiScale);
      line(barX - mk, fPos, barX, fPos);
      line(barX + barW, fPos, barX + barW + mk, fPos);
      noStroke();
    }
  }

  // Spectrum bar label
  noStroke();
  fill(M_RED[0], M_RED[1], M_RED[2], 110 * fade);
  textFont("monospace");
  textStyle(NORMAL);
  textAlign(RIGHT, BOTTOM);
  textSize(Math.max(8, Math.round(11 * uiScale)));
  text("PRIDE", barX - Math.round(6 * uiScale), barTop + Math.round(barH * 0.4));
  text("SPECTRUM", barX - Math.round(6 * uiScale), barTop + Math.round(barH * 0.4) + Math.round(14 * uiScale));

  // Wavelength readout
  const wavelength = Math.round(map(scanY, height * 0.1, height * 0.9, 380, 700));
  noStroke();
  if (alarmMode) {
    colorMode(HSB, 360, 100, 100, 255);
    fill((t * 80) % 360, 80, 100, 200 * fade);
    colorMode(RGB, 255);
  } else {
    fill(M_RED[0], M_RED[1], M_RED[2], 200 * fade);
  }
  textFont("monospace");
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  textSize(Math.max(11, Math.round(15 * uiScale)));
  text("λ " + wavelength + "nm", pad, scanY - Math.round(20 * uiScale));
  textStyle(NORMAL);

  const chromIdx = (sin(t * 0.6) * 0.5 + 0.5);
  fill(M_RED[0], M_RED[1], M_RED[2], 130 * fade);
  textSize(Math.max(9, Math.round(12 * uiScale)));
  text("CHROMATIC INDEX  " + chromIdx.toFixed(3), pad, scanY + Math.round(22 * uiScale));

  // Bottom accumulating bar
  const readBarY = height * 0.91;
  const readBarW = width * 0.55;
  const readBarX = width * 0.5 - readBarW / 2;
  const readBarH = Math.max(4, Math.round(7 * uiScale));

  noFill();
  stroke(M_RED[0], M_RED[1], M_RED[2], 40 * fade);
  strokeWeight(1);
  rect(readBarX, readBarY, readBarW, readBarH);

  if (alarmMode) {
    colorMode(HSB, 360, 100, 100, 255);
    const filledW = readBarW * scanProgress;
    for (let x = 0; x < filledW; x++) {
      stroke(map(x, 0, readBarW, 0, 300), 90, 100, 190);
      strokeWeight(1);
      line(readBarX + x, readBarY, readBarX + x, readBarY + readBarH);
    }
    colorMode(RGB, 255);
  } else {
    stroke(M_RED[0], M_RED[1], M_RED[2], 160 * fade);
    strokeWeight(1);
    const filledW = readBarW * scanProgress;
    line(readBarX, readBarY, readBarX + filledW, readBarY);
    line(readBarX, readBarY + readBarH, readBarX + filledW, readBarY + readBarH);
    for (let x = 0; x < filledW; x += Math.round(4 * uiScale)) {
      line(readBarX + x, readBarY, readBarX + x, readBarY + readBarH);
    }
  }

  // Bottom bar label
  noStroke();
  fill(M_RED[0], M_RED[1], M_RED[2], 100 * fade);
  textFont("monospace");
  textAlign(CENTER, BOTTOM);
  textSize(Math.max(9, Math.round(12 * uiScale)));
  text("ORIENTATION SPECTRUM ANALYSIS", width * 0.5, readBarY - Math.round(6 * uiScale));

  noStroke();
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
