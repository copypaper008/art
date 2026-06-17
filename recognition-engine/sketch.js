// Recognition Engine — Gaydar Detector (per-face edition)

// Timing constants — referenced by faceTracker.js Subject methods at runtime
const IDLE_BEFORE_SCAN = 800;
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
let bgImage;
let _portraitImages = {};

let hudSessionId = "";

// ── Subject configs used by the canvas morphing sequence ─────────────────────
const SUBJECT_CONFIGS = {
  warhol: {
    name: 'WARHOL, ANDY',
    faceAnchors: {
      leftEye:  { x: 175, y: 298 },
      rightEye: { x: 300, y: 293 },
      faceOval: [
        { x: 248, y: 165 }, { x: 325, y: 190 }, { x: 360, y: 295 },
        { x: 350, y: 390 }, { x: 315, y: 480 }, { x: 248, y: 525 },
        { x: 180, y: 480 }, { x: 140, y: 390 }, { x: 133, y: 295 },
        { x: 168, y: 190 },
      ],
    },
  },
  haring: {
    name: 'HARING, KEITH',
    faceAnchors: {
      leftEye:  { x: 175, y: 330 },
      rightEye: { x: 297, y: 326 },
      faceOval: [
        { x: 246, y: 205 }, { x: 325, y: 225 }, { x: 355, y: 335 },
        { x: 345, y: 435 }, { x: 310, y: 530 }, { x: 246, y: 575 },
        { x: 182, y: 530 }, { x: 145, y: 435 }, { x: 140, y: 335 },
        { x: 168, y: 225 },
      ],
    },
  },
};

const _CHARACTERISTICS = [
  "Demonstrates systematic cultural legibility",
  "Displays advanced understanding of image production",
  "Output suggests preoccupation with surface and depth",
  "Occupies multiple cultural registers simultaneously",
  "Engages with commodity structures reflexively",
  "Identity appears partially self-constructed",
  "Sustains public identity through repetition and variation",
  "Aesthetic sensibility reads as culturally inflected",
  "Subjectivity exceeds dominant symbolic parameters",
  "Behavioural signatures indicate non-normative alignment",
];

function _generateAlarmData() {
  const shuffled = [..._CHARACTERISTICS].sort(() => Math.random() - 0.5);
  return {
    characteristics: shuffled.slice(0, 6),
    scanDepth: (95.0 + Math.random() * 4.5).toFixed(1) + '%',
  };
}

let idlePhrase      = "";
let idlePhraseTimer = 0;
const IDLE_PHRASE_INTERVAL = 4000;

function preload() {
  bgImage = loadImage('./bg.png');
  _portraitImages.warhol = loadImage('./poster/portraits/warhol.jpg');
  _portraitImages.haring = loadImage('./poster/portraits/haring.jpg');
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
  faceTracker.update(detection.faces || []);

  const anyAlarm    = faceTracker.hasAlarm();
  const allStraight = faceTracker.allStraight();
  const visualState = anyAlarm ? 'ALARM' : allStraight ? 'STRAIGHT' : 'OTHER';

  if (faceTracker.subjects.length > 0) drawPreCameraSpotlights();
  drawDistortedMirror(cam, visualState);
  drawGrid();

  // Canvas portrait morphing — grows around each ALARM subject's face
  for (const s of faceTracker.subjects) {
    if (s.state === 'ALARM') drawAlarmTransformation(s);
  }

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
  // ALARM state is handled entirely by drawAlarmTransformation()
  if (s.state === 'ALARM') return;

  const tlx  = s.x - s.w * 0.55;
  const tly  = s.y - s.h * 0.6;
  const brx  = tlx + s.w * 1.1;
  const bry  = tly + s.h * 1.2;
  const tick = Math.max(16, Math.round(22 * uiScale));
  const t    = millis();

  noFill();

  // ── Reticle: angular L-brackets ──────────────────────────────────────────
  {
    const flicker = random(0.88, 1.0);
    const bW = Math.max(2, Math.round(4 * uiScale));
    strokeWeight(bW);
    stroke(M_RED[0], M_RED[1], M_RED[2], 150 * flicker);
    line(tlx, tly, tlx + tick, tly); line(tlx, tly, tlx, tly + tick);
    line(brx - tick, tly, brx, tly); line(brx, tly, brx, tly + tick);
    line(tlx, bry - tick, tlx, bry); line(tlx, bry, tlx + tick, bry);
    line(brx - tick, bry, brx, bry); line(brx, bry - tick, brx, bry);
    stroke(M_RED[0], M_RED[1], M_RED[2], 14 * flicker);
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
    stroke(sR, sG, sB, 20);
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

    // Dismissal — dim, cold
    fill(160, 160, 160, 80);
    textFont("monospace");
    textAlign(CENTER, BOTTOM);
    textSize(smS);
    text(s.straightNext, s.x, baseY);

    // Red rule
    stroke(M_RED[0], M_RED[1], M_RED[2], 90);
    strokeWeight(1);
    line(s.x - ruleW * 0.5, ruleY, s.x + ruleW * 0.5, ruleY);
    noStroke();

    // Sub description — red monospace
    fill(M_RED[0], M_RED[1], M_RED[2], 195);
    textFont("monospace");
    textSize(mdS);
    textLeading(Math.round(mdS * 1.4));
    text(s.straightSub, s.x, subBot);

    // Headline — bold white Arial
    textFont("Arial");
    textStyle(BOLD);
    fill(255, 255, 255, 250);
    textSize(xlS);
    text(s.straightPhrase, s.x, headBot);
    textStyle(NORMAL);
    textFont("monospace");
  }

}

// ── HOMOSEXUAL stamp — animated, styled per subject, the only colour on screen ──
function drawHomosexualStamp(s, fadeMultiplier = 1.0) {
  const t        = millis();
  const stampAge = t - s.stateAt;
  const ANIM_DUR = 650;

  // Stamp "thwack" animation: plummets in, tiny bounce, settles
  const p = min(stampAge / ANIM_DUR, 1);
  let stampScale;
  if      (p < 0.28) stampScale = map(p, 0,    0.28, 4.2, 0.84);
  else if (p < 0.52) stampScale = map(p, 0.28, 0.52, 0.84, 1.07);
  else if (p < 0.72) stampScale = map(p, 0.52, 0.72, 1.07, 1.00);
  else               stampScale = 1.00;

  const alpha = min(p / 0.12, 1) * 255 * fadeMultiplier;
  if (alpha < 2) return;

  const isWarhol   = (s.subjectKey ?? 'warhol') === 'warhol';
  const stampAngle = isWarhol ? -0.17 : 0.12;   // radians: Warhol tilts left, Haring right
  const baseFontSz = max(28, round(s.w * 1.05));
  const fontSize   = baseFontSz * stampScale;

  push();
  translate(s.x, s.y + s.h * 0.08);
  rotate(stampAngle);
  textAlign(CENTER, CENTER);
  textFont("Arial");
  textStyle(BOLD);
  textSize(fontSize);

  if (isWarhol) {
    // Warhol: official red rubber-stamp — bureaucratic, unadorned
    noStroke();
    fill(185, 8, 8, alpha);
    text("HOMOSEXUAL", 0, 0);
  } else {
    // Haring: thick black outline + bright yellow fill (his characteristic line art)
    const sw = max(2, fontSize * 0.065);
    strokeWeight(sw);
    stroke(0, 0, 0, alpha);
    fill(255, 210, 0, alpha);
    text("HOMOSEXUAL", 0, 0);
    noStroke();
  }

  textStyle(NORMAL);
  pop();
}

// ── Portrait morphing sequence — Warhol/Haring materialises around the live face ─
function drawAlarmTransformation(s) {
  const age    = millis() - s.stateAt;
  const config = SUBJECT_CONFIGS[s.subjectKey] || SUBJECT_CONFIGS.warhol;
  const portImg = _portraitImages[s.subjectKey];
  if (!portImg || portImg.width === 0) return;

  const anchors = config.faceAnchors;

  // Scale: map portrait eye distance to estimated canvas eye distance
  const portEyeDist = Math.hypot(
    anchors.rightEye.x - anchors.leftEye.x,
    anchors.rightEye.y - anchors.leftEye.y
  );
  const faceEyeDist = s.w * 0.46;
  const sc = faceEyeDist / portEyeDist;

  // Portrait image natural dims
  const iw = portImg.width, ih = portImg.height;

  // Anchor: portrait eye midpoint
  const portEyeMidX = (anchors.leftEye.x + anchors.rightEye.x) / 2;
  const portEyeMidY = (anchors.leftEye.y + anchors.rightEye.y) / 2;

  // s.y is roughly nose/midface; eyes are ~18% of face height above centre
  const eyeCanvasY = s.y - s.h * 0.18;

  const portX = s.x        - portEyeMidX * sc;
  const portY = eyeCanvasY - portEyeMidY * sc;
  const portW = iw * sc;
  const portH = ih * sc;

  // Face oval in canvas space (matches portrait positioning)
  const oval = anchors.faceOval.map(pt => ({
    x: portX + pt.x * sc,
    y: portY + pt.y * sc,
  }));

  function traceOval(ctx) {
    ctx.beginPath();
    ctx.moveTo(oval[0].x, oval[0].y);
    for (let i = 1; i < oval.length; i++) {
      const a = oval[i];
      const b = oval[(i + 1) % oval.length];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.closePath();
  }

  // Timings (ms from stateAt)
  const T_HAIR_FULL  = 900;    // hair + clothing fully visible
  const T_FACE_START = 800;    // face area begins fading in
  const T_FACE_FULL  = 2000;   // face area fully visible
  const T_INFO_START = 1000;   // analysis panel starts
  const T_INFO_FULL  = 2200;   // analysis panel fully visible
  const T_STAMP      = 3200;   // stamp thwacks in
  const T_FADE_START = 7200;   // begin global fade
  const T_FADE_END   = 8800;   // fully faded (IDLE resets at ALARM_HOLD=9000)

  const fade = age > T_FADE_START
    ? constrain(map(age, T_FADE_START, T_FADE_END, 1.0, 0.0), 0, 1)
    : 1.0;

  // Phase 1 — hair, ears, clothing: portrait OUTSIDE face oval
  const hairA = constrain(map(age, 0, T_HAIR_FULL, 0, 245), 0, 245) * fade;
  if (hairA > 2) {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, 0, width, height);
    traceOval(drawingContext);
    drawingContext.clip('evenodd');
    tint(255, Math.round(hairA));
    image(portImg, portX, portY, portW, portH);
    noTint();
    drawingContext.restore();
  }

  // Phase 2 — face structure: portrait INSIDE face oval, camera fades out beneath
  const faceA = constrain(map(age, T_FACE_START, T_FACE_FULL, 0, 255), 0, 255) * fade;
  if (faceA > 2) {
    drawingContext.save();
    traceOval(drawingContext);
    drawingContext.clip();
    tint(255, Math.round(faceA));
    image(portImg, portX, portY, portW, portH);
    noTint();
    drawingContext.restore();
  }

  // Analysis panel — builds in while face settles
  if (age > T_INFO_START && s.determination) {
    const infoA = constrain(map(age, T_INFO_START, T_INFO_FULL, 0, 255), 0, 255) * fade;
    if (infoA > 2) drawSubjectInfo(s, config, infoA);
  }

  // HOMOSEXUAL stamp — offset stateAt so stamp timer begins at T_STAMP
  if (age > T_STAMP) {
    const fakeS = Object.assign({}, s, { stateAt: s.stateAt + T_STAMP });
    drawHomosexualStamp(fakeS, fade);
  }
}

// ── Analysis panel drawn alongside the morphing portrait ─────────────────────
function drawSubjectInfo(s, config, alpha) {
  const pad  = Math.round(36 * uiScale);
  const rX   = width - pad;

  push();
  noStroke();
  textAlign(RIGHT, TOP);
  textFont("monospace");

  // Report header
  const hdrS = Math.max(8, Math.round(11 * uiScale));
  fill(255, 255, 255, alpha * 0.5);
  textStyle(BOLD);
  textSize(hdrS);
  text("SUBJECT ANALYSIS REPORT", rX, pad);
  textStyle(NORMAL);

  let curY = pad + Math.round(hdrS * 2.5);

  // Subject name
  const nameS = Math.max(18, Math.round(28 * uiScale));
  fill(255, 255, 255, alpha);
  textStyle(BOLD);
  textSize(nameS);
  text(config.name, rX, curY);
  textStyle(NORMAL);
  curY += Math.round(nameS * 1.7);

  // Confidence
  const lblS = Math.max(8, Math.round(10 * uiScale));
  fill(255, 255, 255, alpha * 0.5);
  textSize(lblS);
  text("CONFIDENCE:", rX, curY);
  curY += Math.round(lblS * 1.4);

  const confS = Math.max(24, Math.round(42 * uiScale));
  fill(M_RED[0], M_RED[1], M_RED[2], alpha);
  textStyle(BOLD);
  textSize(confS);
  text(s.confidence.toFixed(2) + "%", rX, curY);
  textStyle(NORMAL);
  curY += Math.round(confS * 1.9);

  // Divider
  const divW = Math.min(width * 0.38, Math.round(380 * uiScale));
  stroke(255, 255, 255, alpha * 0.18);
  strokeWeight(1);
  line(rX - divW, curY, rX, curY);
  noStroke();
  curY += Math.round(14 * uiScale);

  // Observed characteristics
  fill(255, 255, 255, alpha * 0.5);
  textSize(lblS);
  text("OBSERVED CHARACTERISTICS:", rX, curY);
  curY += Math.round(lblS * 2.4);

  const charS = Math.max(9, Math.round(12 * uiScale));
  fill(255, 255, 255, alpha * 0.82);
  textSize(charS);
  for (const ch of (s.determination?.characteristics || [])) {
    text("✓  " + ch, rX, curY);
    curY += Math.round(charS * 1.9);
  }
  curY += Math.round(16 * uiScale);

  // Divider
  stroke(255, 255, 255, alpha * 0.18);
  strokeWeight(1);
  line(rX - divW, curY, rX, curY);
  noStroke();
  curY += Math.round(12 * uiScale);

  // Classification
  fill(255, 255, 255, alpha * 0.5);
  textSize(lblS);
  text("CLASSIFICATION:", rX, curY);
  curY += Math.round(lblS * 1.5);

  const clsS = Math.max(14, Math.round(22 * uiScale));
  fill(255, 255, 255, alpha);
  textStyle(BOLD);
  textSize(clsS);
  text("HOMOSEXUAL", rX, curY);
  textStyle(NORMAL);

  pop();
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

  // ── Header ───────────────────────────────────────────────────────────────
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

  // Subject count — top right
  textAlign(RIGHT, TOP);
  textStyle(BOLD);
  _hFill(210);
  textSize(sm);
  text("SUBJECTS: " + String(faceTracker.subjects.length).padStart(2, '0'), width - pad, pad * 0.7);
  textStyle(NORMAL);

  // ── Alarm status (monochrome — stamp is the only colour) ─────────────────
  if (anyAlarm) {
    noStroke();
    fill(M_RED[0], M_RED[1], M_RED[2], 50);
    textFont("monospace");
    textSize(Math.max(10, Math.round(14 * uiScale)));
    textAlign(CENTER, BOTTOM);
    text("CLASSIFICATION CONFIRMED", width * 0.5, height - Math.round(14 * uiScale));
  }

  // ── Idle phrase (no subjects) ─────────────────────────────────────────────
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

  // ── Multi-subject list (>1 subject) ──────────────────────────────────────
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

  // ── Bottom tagline ────────────────────────────────────────────────────────
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
