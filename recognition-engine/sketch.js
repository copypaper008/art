// Recognition Engine — Gaydar Detector (per-face edition)

// Timing constants — referenced by faceTracker.js Subject methods at runtime
const IDLE_BEFORE_SCAN = 1500;
const SCAN_DURATION    = 5000;
const STRAIGHT_HOLD    = 7500;
const ALARM_HOLD       = 9000;

// Log sequence — referenced by Subject.tick() at runtime
const HUD_LOG_SEQ = [
  "SYSTEM BOOT",
  "CAMERA LINK: OK",
  "FACE DETECTED",
  "ORIENTATION: SCANNING",
  "CROSS-REF DATABASE",
  "AWAITING CLARITY",
];

let uiScale = 1;
let cam;
let detectionGraphics;

// Global session header
let hudSessionId = "";

// Idle phrase shown when no subjects are in frame
let idlePhrase      = "";
let idlePhraseTimer = 0;
const IDLE_PHRASE_INTERVAL = 4000;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  detectionGraphics = createGraphics(320, 180);
  detectionGraphics.pixelDensity(1);
  initDetection(detectionGraphics);
  initVisuals(width, height);

  cam = createCapture(VIDEO);
  cam.elt.setAttribute('playsinline', '');
  cam.elt.setAttribute('webkit-playsinline', '');
  cam.size(640, 480);
  cam.hide();

  textFont("monospace");

  const rndId  = () => Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0');
  hudSessionId = "G4Y-" + rndId() + "-" + rndId();

  idlePhrase      = getRandomPhrase("idle");
  idlePhraseTimer = millis();
  initMediaPipe();
}

function draw() {
  background(0);
  uiScale = height / 1080;

  runDetection(cam);
  faceTracker.update(detection.faces || []);

  // Camera filter uses aggregate state across all subjects
  const anyAlarm    = faceTracker.hasAlarm();
  const allStraight = faceTracker.allStraight();
  const visualState = anyAlarm ? 'ALARM' : allStraight ? 'STRAIGHT' : 'OTHER';

  drawDistortedMirror(cam, visualState);

  if (anyAlarm) {
    drawAlarmOverlay();
    drawParticles();
  }

  if (faceTracker.subjects.length > 0) {
    drawSpectrumScan(anyAlarm);
    drawAllSubjectOverlays();
  } else {
    // No tracked subjects — show raw detection reticles
    drawFaceOverlays(detection.faces, 'IDLE', detection.personCount, false);
  }

  drawScanLines();
  drawGlobalHUD();
  drawTransitionFlash();
}

// ─────────────────────────────────────────────
// Per-face overlay: reticle + state-specific text + confidence bar

function drawSubjectOverlay(s) {
  const tlx  = s.x - s.w * 0.55;
  const tly  = s.y - s.h * 0.6;
  const brx  = tlx + s.w * 1.1;
  const bry  = tly + s.h * 1.2;
  const tick = Math.round(10 * uiScale);
  const t    = millis();

  noFill();

  if (s.state === 'ALARM') {
    const hue     = (t * 0.3 + s.id * 60) % 360;
    const flicker = random(0.7, 1.0);
    colorMode(HSB, 360, 100, 100, 255);

    stroke(hue, 80, 100, 18 * flicker);
    strokeWeight(8);
    rect(s.x - s.w * 0.6, s.y - s.h * 0.65, s.w * 1.2, s.h * 1.3, 4);

    stroke(hue, 100, 100, 80 * flicker);
    strokeWeight(2);
    rect(tlx, tly, s.w * 1.1, s.h * 1.2, 2);

    stroke((hue + 30) % 360, 100, 100, 200 * flicker);
    strokeWeight(Math.max(1, Math.round(uiScale)));
    line(tlx, tly, tlx + tick, tly);
    line(tlx, tly, tlx, tly + tick);
    line(brx - tick, bry, brx, bry);
    line(brx, bry - tick, brx, bry);
    colorMode(RGB, 255);
  } else {
    const flicker = random(0.85, 1.0);
    stroke(0, 255, 120, 18 * flicker);
    strokeWeight(8);
    rect(s.x - s.w * 0.6, s.y - s.h * 0.65, s.w * 1.2, s.h * 1.3, 4);
    stroke(0, 255, 120, 25 * flicker);
    strokeWeight(1);
    rect(tlx, tly, s.w * 1.1, s.h * 1.2, 2);
    stroke(0, 255, 120, 50 * flicker);
    strokeWeight(Math.max(1, Math.round(uiScale)));
    line(tlx, tly, tlx + tick, tly);
    line(tlx, tly, tlx, tly + tick);
    line(brx - tick, bry, brx, bry);
    line(brx, bry - tick, brx, bry);
  }
  noStroke();

  // ── Per-state text ────────────────────────────────────────────────────────
  const textAbove = tly - Math.round(10 * uiScale);
  const textBelow = bry + Math.round(8  * uiScale);
  const xl        = Math.max(12, Math.round(20 * uiScale));
  const md        = Math.max(9,  Math.round(12 * uiScale));
  const sm        = Math.max(7,  Math.round(9  * uiScale));

  textFont("monospace");
  noStroke();
  textAlign(CENTER, BOTTOM);

  if (s.state === 'SCANNING') {
    fill(0, 255, 120, 200);
    textSize(md);
    text(s.scanLine, s.x, textAbove);

    if (s.confidence > 1) {
      const barW = Math.min(s.w * 1.4, Math.round(200 * uiScale));
      const barH = Math.max(2, Math.round(3 * uiScale));
      const barX = s.x - barW * 0.5;
      noFill();
      stroke(0, 255, 120, 60);
      strokeWeight(1);
      rect(barX, textBelow, barW, barH);
      noStroke();
      fill(0, 255, 120, 160);
      rect(barX, textBelow, barW * (s.confidence / 100), barH);
      noFill();
    }
  }

  if (s.state === 'STRAIGHT') {
    const xlS  = Math.max(14, Math.round(20 * uiScale));
    const mdS  = Math.max(10, Math.round(13 * uiScale));
    const smS  = Math.max(7,  Math.round(9  * uiScale));
    const gap  = Math.round(8 * uiScale);
    const subN = (s.straightSub.match(/\n/g) || []).length + 1;
    const subH = Math.round(mdS * 1.4 * subN);

    const baseY = tly - Math.round(10 * uiScale);

    // Dismissal — closest to face
    fill(0, 255, 120, 130);
    textSize(smS);
    text(s.straightNext, s.x, baseY);

    // Middle description (1–2 lines)
    fill(0, 255, 120, 200);
    textSize(mdS);
    textLeading(Math.round(mdS * 1.4));
    text(s.straightSub, s.x, baseY - Math.round(smS * 1.4 + gap));

    // Headline — topmost, largest
    fill(0, 255, 120, 255);
    textSize(xlS);
    text(s.straightPhrase, s.x, baseY - Math.round(smS * 1.4 + gap) - subH - gap);
  }

  if (s.state === 'ALARM') {
    const flash = sin(t * 0.012) > 0;
    const textA = flash ? 255 : 190;
    const xlS   = Math.max(14, Math.round(22 * uiScale));
    const mdS   = Math.max(10, Math.round(13 * uiScale));
    const smS   = Math.max(9,  Math.round(11 * uiScale));
    const gap   = Math.round(8 * uiScale);
    const subN  = (s.alarmSub.match(/\n/g) || []).length + 1;
    const subH  = Math.round(mdS * 1.4 * subN);

    const baseY = tly - Math.round(10 * uiScale);

    // Closer — bottom, punchy, cycling rainbow
    colorMode(HSB, 360, 100, 100, 255);
    fill((t * 0.3 + s.id * 30) % 360, 95, 100, textA);
    colorMode(RGB, 255);
    textSize(smS);
    text(s.alarmNext, s.x, baseY);

    // Sub description — middle, rainbow offset
    colorMode(HSB, 360, 100, 100, 255);
    fill((t * 0.25 + s.id * 45 + 120) % 360, 90, 100, textA);
    colorMode(RGB, 255);
    textSize(mdS);
    textLeading(Math.round(mdS * 1.4));
    text(s.alarmSub, s.x, baseY - Math.round(smS * 1.4 + gap));

    // Headline — top, large, white flash
    fill(255, 255, 255, textA);
    textSize(xlS);
    text(s.alarmPrimary, s.x, baseY - Math.round(smS * 1.4 + gap) - subH - gap);
  }
}

function drawAllSubjectOverlays() {
  for (const s of faceTracker.subjects) drawSubjectOverlay(s);
}

// ─────────────────────────────────────────────
// Global HUD: header + idle phrase + multi-subject list + bottom tagline

function drawGlobalHUD() {
  const pad      = Math.round(24 * uiScale);
  const sm       = Math.max(8,  Math.round(11 * uiScale));
  const md       = Math.max(10, Math.round(14 * uiScale));
  const xs       = Math.max(7,  Math.round(9  * uiScale));
  const lh       = Math.round(20 * uiScale);
  const anyAlarm = faceTracker.hasAlarm();
  const t        = millis();

  function _hFill(a) {
    if (anyAlarm) {
      colorMode(HSB, 360, 100, 100, 255);
      fill((t * 0.2) % 360, 90, 100, a);
      colorMode(RGB, 255);
    } else {
      fill(0, 255, 120, a);
    }
  }

  // ── Header ───────────────────────────────────────────────────────────────
  noStroke();
  textFont("monospace");
  textAlign(LEFT, TOP);
  _hFill(180);
  textSize(sm);
  text("GAYDAR DETECTION SYSTEM / ACTIVE", pad, pad * 0.8);
  _hFill(100);
  textSize(xs);
  text("SESSION: " + hudSessionId, pad, pad * 0.8 + lh * 1.1);

  // Subject count — top right
  textAlign(RIGHT, TOP);
  _hFill(180);
  textSize(sm);
  text("SUBJECTS: " + String(faceTracker.subjects.length).padStart(2, '0'), width - pad, pad * 0.8);

  // ── Alarm global extras ───────────────────────────────────────────────────
  if (anyAlarm) {
    const flash  = sin(t * 0.012) > 0;
    const flash2 = sin(t * 0.018) > 0;
    textSize(sm);

    if (flash) {
      textAlign(LEFT, TOP);
      colorMode(HSB, 360, 100, 100, 255);
      fill((t * 0.3) % 360, 90, 100, 255);
      colorMode(RGB, 255);
      text("★ PRIDE ★", pad, pad * 0.8 + Math.round(lh * 1.8));
    }
    if (flash2) {
      textAlign(RIGHT, TOP);
      colorMode(HSB, 360, 100, 100, 255);
      fill((t * 0.3 + 120) % 360, 90, 100, 255);
      colorMode(RGB, 255);
      text("★ PRIDE ★", width - pad, pad * 0.8 + Math.round(lh * 1.8));
    }

    textAlign(CENTER, BOTTOM);
    colorMode(HSB, 360, 100, 100, 255);
    fill((t * 0.2 + 180) % 360, 85, 100, flash ? 180 : 80);
    colorMode(RGB, 255);
    textSize(Math.max(7, Math.round(10 * uiScale)));
    text("PRIDE RESPONSE PROTOCOL INITIATED — ALL UNITS RESPOND", width * 0.5, height - Math.round(12 * uiScale));
  }

  // ── No subjects: idle phrase ──────────────────────────────────────────────
  if (faceTracker.subjects.length === 0) {
    const now = millis();
    if (now - idlePhraseTimer > IDLE_PHRASE_INTERVAL) {
      idlePhrase      = getRandomPhrase("idle");
      idlePhraseTimer = now;
    }
    const pulse = (sin(now * 0.002) + 1) / 2;
    noStroke();
    fill(0, 255, 120, 80 + pulse * 80);
    textSize(md);
    textAlign(CENTER, CENTER);
    text(idlePhrase, width * 0.5, height * 0.44);
  }

  // ── Multi-subject state list (left panel, only when >1 subject) ───────────
  if (faceTracker.subjects.length > 1) {
    const listY = Math.round(130 * uiScale);
    const lineH = Math.round(18 * uiScale);
    _hudLabel("ACTIVE SUBJECTS", pad, listY, sm, [0, 255, 120]);
    textAlign(LEFT, TOP);
    textFont("monospace");
    for (let i = 0; i < faceTracker.subjects.length; i++) {
      const s    = faceTracker.subjects[i];
      const rowY = listY + Math.round(sm * 1.6) + Math.round(lineH * 1.2) + i * lineH;
      fill(0, 255, 120, 90);
      textSize(xs);
      text("SUBJ " + String(i + 1).padStart(2, '0') + ":", pad, rowY);
      if (s.state === 'ALARM') {
        colorMode(HSB, 360, 100, 100, 255);
        fill((t * 0.25 + i * 60) % 360, 90, 100, 220);
        colorMode(RGB, 255);
      } else {
        fill(0, 255, 120, 200);
      }
      const confStr = s.confidence > 1 ? "  " + Math.round(s.confidence) + "%" : "";
      text(s.state + confStr, pad + Math.round(55 * uiScale), rowY);
    }
  }

  // ── Bottom tagline ────────────────────────────────────────────────────────
  if (!anyAlarm) {
    noStroke();
    fill(0, 255, 120, 55);
    textSize(xs);
    textAlign(CENTER, BOTTOM);
    text("◆  NOTHING IS EVER FULLY SEEN  ◆", width * 0.5, height - Math.round(12 * uiScale));
  }

  noStroke();
  noFill();
}

// ── HUD helpers ───────────────────────────────────────────────────────────────

function _hudLabel(label, x, y, size, col) {
  noStroke();
  fill(col[0], col[1], col[2], 155);
  textSize(size);
  textAlign(LEFT, TOP);
  textFont("monospace");
  text(label, x, y);
  stroke(col[0], col[1], col[2], 55);
  strokeWeight(1);
  line(x, y + size + Math.round(3 * uiScale),
       x + Math.round(textWidth(label) + 8 * uiScale),
       y + size + Math.round(3 * uiScale));
  noStroke();
}

// Referenced by Subject.tick() — must be global
function _randomHex(n) {
  const chars = "0123456789ABCDEF ";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[floor(random(chars.length))];
  return s;
}

function _hhmmss() {
  const d = new Date();
  return "[" +
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0") + "]";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initVisuals(width, height);
  clearGhostTrails();
}
