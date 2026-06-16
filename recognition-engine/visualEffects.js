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
    camAlpha  = 0.78;
  } else if (currentState === "STRAIGHT") {
    filterStr = "grayscale(100%) brightness(0.68) contrast(1.25)";
    camAlpha  = 0.65;
  } else {
    // Scanning: desaturated but bright enough to read the face
    filterStr = "saturate(15%) brightness(0.92) contrast(1.2)";
    camAlpha  = 0.65;
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

// ── Pop-art shape helpers ─────────────────────────────────────────────────────
function _drawStar(cx, cy, r, angle) {
  beginShape();
  for (let i = 0; i < 10; i++) {
    const a  = (i * PI / 5) - HALF_PI + angle;
    const rv = i % 2 === 0 ? r : r * 0.42;
    vertex(cx + cos(a) * rv, cy + sin(a) * rv);
  }
  endShape(CLOSE);
}

function _drawHeart(cx, cy, r) {
  const sc = r / 16;
  beginShape();
  for (let a = 0; a < TWO_PI; a += 0.12) {
    const hx = 16 * pow(sin(a), 3) * sc;
    const hy = -(13*cos(a) - 5*cos(2*a) - 2*cos(3*a) - cos(4*a)) * sc;
    vertex(cx + hx, cy + hy);
  }
  endShape(CLOSE);
}

function _drawLips(cx, cy, w) {
  const h  = w * 0.52;
  const bW = Math.max(3, Math.round(5 * uiScale));
  push();
  translate(cx, cy);
  strokeWeight(bW);
  stroke(0, 0, 0, 220);
  // Bottom lip — fuller
  colorMode(HSB, 360, 100, 100, 255);
  fill((millis() * 0.05 + 330) % 360, 85, 95, 235);
  colorMode(RGB, 255);
  arc(0, h * 0.12, w * 0.92, h, 0, PI, CHORD);
  // Top lip — cupid's bow (two bumps)
  colorMode(HSB, 360, 100, 100, 255);
  fill((millis() * 0.05 + 350) % 360, 90, 90, 235);
  colorMode(RGB, 255);
  arc(-w * 0.24, -h * 0.08, w * 0.52, h * 0.72, PI, TWO_PI, CHORD);
  arc( w * 0.24, -h * 0.08, w * 0.52, h * 0.72, PI, TWO_PI, CHORD);
  // Centre divider
  stroke(0, 0, 0, 160);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  line(-w * 0.5, 0, w * 0.5, 0);
  // Gloss
  noStroke();
  fill(255, 255, 255, 55);
  ellipse(0, h * 0.28, w * 0.38, h * 0.2);
  pop();
}

// ── Alarm overlay ─────────────────────────────────────────────────────────────
function drawAlarmOverlay() {
  const t     = millis();
  const pulse = (sin(t * 0.008) + 1) / 2;

  noStroke();
  fill(0, 0, 0, 8 + pulse * 14);
  rect(0, 0, width, height);

  // Thick cycling rainbow border
  const borderHue = (t * 0.3) % 360;
  colorMode(HSB, 360, 100, 100, 255);
  stroke(borderHue, 100, 100, 130 + pulse * 120);
  colorMode(RGB, 255);
  strokeWeight(Math.max(8, Math.round(14 * uiScale)));
  noFill();
  rect(0, 0, width, height);
  noStroke();

  // ── Pop-art gay iconography ───────────────────────────────────────────────
  const starR  = Math.max(30, Math.round(72 * uiScale));
  const heartR = Math.max(22, Math.round(58 * uiScale));
  const lipW   = Math.max(55, Math.round(130 * uiScale));
  const bW     = Math.max(3,  Math.round(5   * uiScale));

  colorMode(HSB, 360, 100, 100, 255);

  // Corner stars — rotating, large
  const stars = [
    { x: width*0.10, y: height*0.12, rot:  t*0.00042, hue: (t*0.08)     %360 },
    { x: width*0.90, y: height*0.12, rot: -t*0.00038, hue: (t*0.08+90)  %360 },
    { x: width*0.10, y: height*0.88, rot:  t*0.00046, hue: (t*0.08+180) %360 },
    { x: width*0.90, y: height*0.88, rot: -t*0.00042, hue: (t*0.08+270) %360 },
  ];
  for (const st of stars) {
    fill(0, 0, 0, 200); noStroke();
    _drawStar(st.x + bW, st.y + bW, starR, st.rot);
    fill(st.hue, 95, 100, 245); stroke(0, 0, 0, 225); strokeWeight(bW);
    _drawStar(st.x, st.y, starR, st.rot);
  }

  // Pulsing hearts
  const hearts = [
    { x: width*0.18, y: height*0.22, hue: (t*0.1+300)%360, ph: 0   },
    { x: width*0.82, y: height*0.22, hue: (t*0.1+60) %360, ph: 1.1 },
    { x: width*0.50, y: height*0.82, hue: (t*0.1+180)%360, ph: 2.2 },
  ];
  for (const h of hearts) {
    const r = heartR * (1 + sin(t * 0.003 + h.ph) * 0.25);
    fill(0, 0, 0, 190); noStroke();
    _drawHeart(h.x + bW, h.y + bW, r);
    fill(h.hue, 92, 100, 235); stroke(0, 0, 0, 210); strokeWeight(bW);
    _drawHeart(h.x, h.y, r);
  }

  // Lips — left and right sides, pulsing
  colorMode(RGB, 255);
  const lipPulse = 1 + sin(t * 0.004) * 0.12;
  _drawLips(width * 0.15, height * 0.48, lipW * lipPulse);
  _drawLips(width * 0.85, height * 0.48, lipW * (1 + sin(t * 0.004 + 1.5) * 0.12));

  colorMode(RGB, 255);
  noStroke();
  noFill();
}

// ── Shooting stars ────────────────────────────────────────────────────────────
let _shootStars = [];

function _newShootStar() {
  const fromLeft = random() < 0.5;
  const spd = random(9, 18) * uiScale;
  return {
    x:     fromLeft ? random(-30, width * 0.25) : random(width * 0.75, width + 30),
    y:     random(-40, height * 0.55),
    vx:    fromLeft ?  spd * random(0.9, 1.5) : -spd * random(0.9, 1.5),
    vy:    spd * random(0.4, 0.9),
    r:     random(5, 11) * uiScale,
    hue:   random(360),
    trail: [],
  };
}

function drawShootingStars() {
  while (_shootStars.length < 7) _shootStars.push(_newShootStar());
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  _shootStars = _shootStars.filter(s => {
    s.x += s.vx; s.y += s.vy;
    s.trail.unshift({ x: s.x, y: s.y });
    if (s.trail.length > 22) s.trail.pop();
    s.hue = (s.hue + 5) % 360;
    for (let i = 0; i < s.trail.length; i++) {
      fill((s.hue + i * 16) % 360, 95, 100, map(i, 0, s.trail.length, 210, 0));
      circle(s.trail[i].x, s.trail[i].y, s.r * map(i, 0, s.trail.length, 1.8, 0.1) * 2);
    }
    fill(60, 5, 100, 255); // bright white-yellow head
    circle(s.x, s.y, s.r * 2.8);
    return s.x > -100 && s.x < width + 100 && s.y < height + 100;
  });
  colorMode(RGB, 255);
}

// ── Fireworks ─────────────────────────────────────────────────────────────────
let _fireworks   = [];
let _lastFwTime  = 0;

function _launchFirework() {
  const now = millis();
  if (now - _lastFwTime < random(450, 850)) return;
  _lastFwTime = now;
  const hue0 = random(360);
  _fireworks.push({
    x: random(width * 0.15, width * 0.85),
    y: random(height * 0.06, height * 0.52),
    parts: Array.from({ length: 28 }, (_, i) => ({
      a:   (i / 28) * TWO_PI,
      r:   0,
      spd: random(2.5, 7) * uiScale,
      hue: (hue0 + i * (360 / 28)) % 360,
    })),
    life: 1.0,
  });
}

function drawFireworks() {
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  _fireworks = _fireworks.filter(fw => fw.life > 0.04);
  for (const fw of _fireworks) {
    fw.life -= 0.015;
    const sz = map(fw.life, 0, 1, 2, 7) * uiScale;
    for (const p of fw.parts) {
      p.r += p.spd * fw.life;
      fill(p.hue, 92, 100, fw.life * 230);
      circle(fw.x + cos(p.a) * p.r, fw.y + sin(p.a) * p.r, sz);
    }
  }
  colorMode(RGB, 255);
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

// ── Pre-camera spotlight — drawn BEFORE camera so light shows through opacity ─
// Builds gradually as the scan progresses — feels like being illuminated
function drawPreCameraSpotlights() {
  noStroke();
  for (const s of faceTracker.subjects) {
    let intensity = 0;
    if (s.state === 'SCANNING') {
      intensity = constrain((millis() - s.stateAt) / SCAN_DURATION, 0, 1);
    } else if (s.state === 'STRAIGHT' || s.state === 'ALARM') {
      intensity = 1.0;
    }
    if (intensity < 0.01) continue;
    const glowR = Math.max(s.w, s.h) * 1.7;
    for (let i = 22; i > 0; i--) {
      const r = glowR * (i / 22);
      fill(255, 248, 220, map(i, 0, 22, 0, 100 * intensity));
      ellipse(s.x, s.y, r, r * 1.4);
    }
  }
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
