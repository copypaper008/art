// Recognition Engine — Gaydar Detector (per-face edition)

// Timing constants — referenced by faceTracker.js Subject methods at runtime
const IDLE_BEFORE_SCAN = 800;
const SCAN_DURATION    = 5000;
const STRAIGHT_HOLD    = 7500;
const ALARM_HOLD       = 9000;

// TESTING: when true, every scan resolves to ALARM (skips the STRAIGHT path)
// so the alarm reveal can be exercised on every face. Set false for exhibition.
const FORCE_ALARM = true;

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
let bgImage;

let hudSessionId = "";

let idlePhrase      = "";
let idlePhraseTimer = 0;
const IDLE_PHRASE_INTERVAL = 4000;

function preload() {
  bgImage = loadImage('./bg.png');
}

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

  // Background architecture — the bunker the machine inhabits
  if (bgImage) {
    const bScale = Math.max(width / bgImage.width, height / bgImage.height);
    const bw = bgImage.width  * bScale;
    const bh = bgImage.height * bScale;
    image(bgImage, (width - bw) * 0.5, (height - bh) * 0.5, bw, bh);
  }

  runDetection(cam);
  updateTweens(deltaTime);                       // advance global one-shots (flash)
  faceTracker.update(detection.faces || [], deltaTime);

  const anyAlarm    = faceTracker.hasAlarm();
  const allStraight = faceTracker.allStraight();
  const visualState = anyAlarm ? 'ALARM' : allStraight ? 'STRAIGHT' : 'OTHER';

  if (faceTracker.subjects.length > 0) drawPreCameraSpotlights();
  drawDistortedMirror(cam, visualState);
  drawGrid();

  // ALARM → drop the B&W poster overlay (poster/ engine, kiosk iframe) growing
  // out of the subject's face; clear it once everyone is back below threshold.
  const alarmSubject = faceTracker.subjects.find(s => s.state === 'ALARM');
  if (alarmSubject && !alarmOverlayActive) showAlarmScreen(alarmSubject);
  if (!anyAlarm && alarmOverlayActive)     hideAlarmScreen();

  if (faceTracker.subjects.length > 0) {
    drawAllSubjectOverlays();
  } else {
    drawFaceOverlays(detection.faces, 'IDLE', detection.personCount, false);
  }

  drawScanLines();
  drawGlobalHUD();
  drawTransitionFlash();
}

// ─────────────────────────────────────────────
// Per-face overlay: reticle + state text + confidence readout

function drawSubjectOverlay(s) {
  // ALARM is rendered by the poster overlay — suppress the per-face overlay
  if (s.state === 'ALARM') return;

  const tlx  = s.x - s.w * 0.55;
  const tly  = s.y - s.h * 0.6;
  const brx  = tlx + s.w * 1.1;
  const bry  = tly + s.h * 1.2;
  const t    = millis();
  const fx       = s.fx || {};
  const clamp01  = v => Math.max(0, Math.min(1, v));
  // Reticle wipes in over the scan entrance; full strength in every other state.
  const reticleReveal = s.state === 'SCANNING' ? clamp01(fx.rScan == null ? 1 : fx.rScan) : 1;
  const tick = Math.max(16, Math.round(22 * uiScale)) * (0.45 + 0.55 * reticleReveal);

  noFill();

  // ── Reticle: angular L-brackets ──────────────────────────────────────────
  {
    const flicker = random(0.88, 1.0);
    const bW = Math.max(2, Math.round(4 * uiScale));
    strokeWeight(bW);
    stroke(M_RED[0], M_RED[1], M_RED[2], 150 * flicker * reticleReveal);
    line(tlx, tly, tlx + tick, tly); line(tlx, tly, tlx, tly + tick);
    line(brx - tick, tly, brx, tly); line(brx, tly, brx, tly + tick);
    line(tlx, bry - tick, tlx, bry); line(tlx, bry, tlx + tick, bry);
    line(brx - tick, bry, brx, bry); line(brx, bry - tick, brx, bry);
    stroke(M_RED[0], M_RED[1], M_RED[2], 14 * flicker * reticleReveal);
    strokeWeight(1);
    rect(tlx, tly, s.w * 1.1, s.h * 1.2);
  }
  noStroke();

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (s.state === 'IDLE') {
    const pulse = (sin(t * 0.004) + 1) / 2;
    fill(M_RED[0], M_RED[1], M_RED[2], 55 + pulse * 80);
    textFont("monospace");
    textAlign(CENTER, BOTTOM);
    textSize(Math.max(9, Math.round(12 * uiScale)));
    text("STAND BY", s.x, tly - Math.round(10 * uiScale));
  }

  // ── SCANNING ─────────────────────────────────────────────────────────────
  if (s.state === 'SCANNING') {
    const scanProgress = constrain((t - s.stateAt) / SCAN_DURATION, 0, 1);
    const imminent     = scanProgress > 0.85;
    const sR = imminent ? 255 : M_RED[0];
    const sG = imminent ? 80  : M_RED[1];
    const sB = imminent ? 0   : M_RED[2];

    // Fine analysis grid within face box
    strokeWeight(1);
    stroke(sR, sG, sB, 20 * reticleReveal);
    for (let col = 1; col < 6; col++) {
      const gx = lerp(tlx, brx, col / 6);
      line(gx, tly, gx, bry);
    }
    for (let row = 1; row < 9; row++) {
      const gy = lerp(tly, bry, row / 9);
      line(tlx, gy, brx, gy);
    }

    // Primary vertical sweep — loops 3× through the scan
    const sweepFrac = (scanProgress * 3) % 1;
    const sweepY    = lerp(tly, bry, sweepFrac);
    for (let dy = 1; dy <= 22; dy++) {
      stroke(sR, sG, sB, map(dy, 0, 22, imminent ? 100 : 60, 0));
      strokeWeight(1);
      if (sweepY - dy >= tly) line(tlx, sweepY - dy, brx, sweepY - dy);
    }
    stroke(sR, sG, sB, imminent ? 255 : 210);
    strokeWeight(Math.max(1, Math.round(2 * uiScale)));
    line(tlx, sweepY, brx, sweepY);

    // Secondary horizontal sweep — different rate, crosses the primary
    const hFrac  = (scanProgress * 1.8 + 0.25) % 1;
    const hSweepX = lerp(tlx, brx, hFrac);
    for (let dx = 1; dx <= 14; dx++) {
      stroke(sR, sG, sB, map(dx, 0, 14, 35, 0));
      strokeWeight(1);
      if (hSweepX - dx >= tlx) line(hSweepX - dx, tly, hSweepX - dx, bry);
    }
    stroke(sR, sG, sB, 100);
    strokeWeight(1);
    line(hSweepX, tly, hSweepX, bry);

    noStroke();

    // Gapped crosshair at face centre with small centre box
    const cHalf = Math.round(16 * uiScale);
    const cGap  = Math.round(5  * uiScale);
    stroke(sR, sG, sB, 80);
    strokeWeight(1);
    line(s.x - cHalf, s.y, s.x - cGap, s.y);
    line(s.x + cGap,  s.y, s.x + cHalf, s.y);
    line(s.x, s.y - cHalf, s.x, s.y - cGap);
    line(s.x, s.y + cGap,  s.x, s.y + cHalf);
    noFill();
    stroke(sR, sG, sB, 100);
    const boxH = Math.round(4 * uiScale);
    rect(s.x - boxH, s.y - boxH, boxH * 2, boxH * 2);
    noStroke();

    // Corner micro-labels
    const microS = Math.max(6, Math.round(8 * uiScale));
    textFont("monospace");
    textSize(microS);
    const pad2 = Math.round(3 * uiScale);
    fill(sR, sG, sB, 90);
    textAlign(LEFT, TOP);
    text("ID:" + String(s.id).padStart(2, '0'), tlx + pad2, tly + pad2);
    textAlign(RIGHT, TOP);
    text(Math.round(s.w) + "×" + Math.round(s.h), brx - pad2, tly + pad2);
    textAlign(LEFT, BOTTOM);
    text("X:" + Math.round(s.x) + " Y:" + Math.round(s.y), tlx + pad2, bry - pad2);
    textAlign(RIGHT, BOTTOM);
    fill(sR, sG, sB, imminent ? 220 : 90);
    text(Math.round(s.confidence) + "%", brx - pad2, bry - pad2);

    // Scan phrase / RESULT IMMINENT above face
    textAlign(CENTER, BOTTOM);
    if (imminent) {
      const flashA = sin(t * 0.022) > 0 ? 255 : 120;
      textFont("Arial");
      textStyle(BOLD);
      fill(255, 80, 0, flashA);
      textSize(Math.max(18, Math.round(30 * uiScale)));
      text("RESULT IMMINENT", s.x, tly - Math.round(12 * uiScale));
      textStyle(NORMAL);
      textFont("monospace");
    } else {
      const charsShow = Math.min(s.scanLine.length, Math.floor((t - s.scanLineTimer) / 65));
      const typedLine = s.scanLine.substring(0, charsShow);
      const cursor    = charsShow < s.scanLine.length ? '_' : '';
      fill(sR, sG, sB, 230);
      textFont("monospace");
      textSize(Math.max(14, Math.round(22 * uiScale)));
      text(typedLine + cursor, s.x, tly - Math.round(16 * uiScale));
    }

    // Below face: hex ticker + big confidence %
    textAlign(CENTER, TOP);
    const belowY = bry + Math.round(8 * uiScale);
    if (s.hudDataTicker) {
      fill(sR, sG, sB, 45);
      textFont("monospace");
      textSize(Math.max(6, Math.round(8 * uiScale)));
      text(s.hudDataTicker.substring(0, 36), s.x, belowY);
    }
    if (s.confidence > 1) {
      fill(sR, sG, sB, imminent ? 255 : 210);
      textFont("monospace");
      textStyle(BOLD);
      textSize(Math.max(22, Math.round(38 * uiScale)));
      text(Math.round(s.confidence) + "%", s.x, belowY + Math.round(14 * uiScale));
      textStyle(NORMAL);
    }

    textAlign(CENTER, BOTTOM);
    textFont("monospace");
  }

  // ── STRAIGHT ─────────────────────────────────────────────────────────────
  if (s.state === 'STRAIGHT') {
    const xlS   = Math.max(20, Math.round(36 * uiScale));
    const mdS   = Math.max(13, Math.round(18 * uiScale));
    const smS   = Math.max(10, Math.round(14 * uiScale));
    const gap   = Math.round(12 * uiScale);
    const subN  = (s.straightSub.match(/\n/g) || []).length + 1;
    const subH  = Math.round(mdS * 1.45 * subN);
    const ruleW = Math.min(s.w * 2.6, Math.round(340 * uiScale));

    const baseY  = tly - Math.round(14 * uiScale);
    const ruleY  = baseY - Math.round(smS * 1.5) - Math.round(gap * 0.5);
    const subBot = ruleY - gap;
    const headBot = subBot - subH - gap;

    // Reveal channels (driven by the verdict Timeline in faceTracker.js).
    const rNext    = clamp01(fx.rNext == null ? 1 : fx.rNext);
    const rRule    = clamp01(fx.rRule == null ? 1 : fx.rRule);
    const rSub     = clamp01(fx.rSub  == null ? 1 : fx.rSub);
    const rHeadRaw = fx.rHead == null ? 1 : fx.rHead;     // may overshoot >1
    const rHead    = clamp01(rHeadRaw);

    // Dismissal — dim, cold; fades in last
    fill(160, 160, 160, 80 * rNext);
    textFont("monospace");
    textAlign(CENTER, BOTTOM);
    textSize(smS);
    text(s.straightNext, s.x, baseY);

    // Red rule — wipes out from the centre
    const sRuleW = ruleW * rRule;
    stroke(M_RED[0], M_RED[1], M_RED[2], 90 * rRule);
    strokeWeight(1);
    line(s.x - sRuleW * 0.5, ruleY, s.x + sRuleW * 0.5, ruleY);
    noStroke();

    // Sub description — red monospace; rises into place
    const subRise = (1 - rSub) * Math.round(14 * uiScale);
    fill(M_RED[0], M_RED[1], M_RED[2], 195 * rSub);
    textFont("monospace");
    textSize(mdS);
    textLeading(Math.round(mdS * 1.4));
    text(s.straightSub, s.x, subBot + subRise);

    // Headline — bold white Arial; drops in from above with overshoot
    const headDrop = (1 - rHeadRaw) * Math.round(46 * uiScale);
    textFont("Arial");
    textStyle(BOLD);
    fill(255, 255, 255, 250 * rHead);
    textSize(xlS);
    text(s.straightPhrase, s.x, headBot - headDrop);
    textStyle(NORMAL);
    textFont("monospace");
  }
  // ALARM is rendered by the poster overlay (early-returned at the top of this fn).
}

function drawAllSubjectOverlays() {
  for (const s of faceTracker.subjects) drawSubjectOverlay(s);
}

// ─────────────────────────────────────────────
// Global HUD

function drawGlobalHUD() {
  const pad      = Math.round(28 * uiScale);
  const headerS  = Math.max(11, Math.round(18 * uiScale));
  const sm       = Math.max(10, Math.round(14 * uiScale));
  const md       = Math.max(12, Math.round(20 * uiScale));
  const xs       = Math.max(9,  Math.round(11 * uiScale));
  const lh       = Math.round(24 * uiScale);
  const anyAlarm = faceTracker.hasAlarm();
  const t        = millis();

  function _hFill(a)   { fill(M_RED[0], M_RED[1], M_RED[2], a); }
  function _hStroke(a) { stroke(M_RED[0], M_RED[1], M_RED[2], a); }

  noStroke();
  textAlign(LEFT, TOP);
  textFont("monospace");

  textStyle(BOLD);
  _hFill(220);
  textSize(headerS);
  text("RECOGNITION ENGINE", pad, pad * 0.7);
  textStyle(NORMAL);

  _hFill(85);
  textSize(xs);
  text("GAYDAR DETECTION SYSTEM  /  SESSION: " + hudSessionId, pad, pad * 0.7 + lh * 1.2);

  _hStroke(38);
  strokeWeight(1);
  line(pad, pad * 0.7 + lh * 2.1, Math.round(width * 0.45), pad * 0.7 + lh * 2.1);
  noStroke();

  textAlign(RIGHT, TOP);
  textStyle(BOLD);
  _hFill(210);
  textSize(sm);
  text("SUBJECTS: " + String(faceTracker.subjects.length).padStart(2, '0'), width - pad, pad * 0.7);
  textStyle(NORMAL);

  if (anyAlarm) {
    noStroke();
    fill(M_RED[0], M_RED[1], M_RED[2], 50);
    textFont("monospace");
    textSize(Math.max(10, Math.round(14 * uiScale)));
    textAlign(CENTER, BOTTOM);
    text("CLASSIFICATION CONFIRMED", width * 0.5, height - Math.round(14 * uiScale));
  }

  if (faceTracker.subjects.length === 0) {
    const now = millis();
    if (now - idlePhraseTimer > IDLE_PHRASE_INTERVAL) {
      idlePhrase      = getRandomPhrase("idle");
      idlePhraseTimer = now;
    }
    const pulse = (sin(now * 0.002) + 1) / 2;
    noStroke();
    fill(M_RED[0], M_RED[1], M_RED[2], 60 + pulse * 100);
    textFont("monospace");
    textSize(md);
    textAlign(CENTER, CENTER);
    text(idlePhrase, width * 0.5, height * 0.44);
  }

  if (faceTracker.subjects.length > 1) {
    const listY = Math.round(150 * uiScale);
    const lineH = Math.round(22 * uiScale);
    _hudLabel("ACTIVE SUBJECTS", pad, listY, sm, M_RED);
    textAlign(LEFT, TOP);
    textFont("monospace");
    for (let i = 0; i < faceTracker.subjects.length; i++) {
      const s    = faceTracker.subjects[i];
      const rowY = listY + Math.round(sm * 1.6) + Math.round(lineH * 1.2) + i * lineH;
      fill(M_RED[0], M_RED[1], M_RED[2], 70);
      textSize(xs);
      text("SUBJ " + String(i + 1).padStart(2, '0') + ":", pad, rowY);
      if (s.state === 'ALARM') {
        fill(255, 255, 255, 200);
      } else {
        fill(M_RED[0], M_RED[1], M_RED[2], 190);
      }
      const confStr = s.confidence > 1 ? "  " + Math.round(s.confidence) + "%" : "";
      text(s.state + confStr, pad + Math.round(60 * uiScale), rowY);
    }
  }

  if (!anyAlarm) {
    noStroke();
    fill(M_RED[0], M_RED[1], M_RED[2], 30);
    textFont("monospace");
    textSize(xs);
    textAlign(CENTER, BOTTOM);
    text("◆  NOTHING IS EVER FULLY SEEN  ◆", width * 0.5, height - Math.round(14 * uiScale));
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
