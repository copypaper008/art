// Recognition Engine — Gaydar Detector

const STATES = {
  IDLE:     "IDLE",      // waiting for subject
  SCANNING: "SCANNING",  // active scan in progress
  STRAIGHT: "STRAIGHT",  // result: heterosexual
  ALARM:    "ALARM",     // result: HOMOSEXUAL DETECTED
};

const IDLE_BEFORE_SCAN = 1500;  // ms of presence before scan triggers
const SCAN_DURATION    = 5000;  // ms the scan takes
const STRAIGHT_HOLD    = 7500;  // ms STRAIGHT result stays on screen
const ALARM_HOLD       = 9000;  // ms ALARM stays on screen

let state   = STATES.IDLE;
let stateAt = 0;
let uiScale = 1;

// Scan counter — gay detection fires every 2 scans (TESTING — change to random(10,16) for exhibition)
let scanCount       = 0;
let nextGayAt       = 0; // set in setup()

// Fallback: if too many idle cycles pass without a completed scan triggering
// the alarm naturally, force the next completed scan to be gay.
let idlesSinceAlarm = 0;
const FORCE_GAY_AFTER_IDLES = 15;

// Rotating status line during scanning
let scanLine      = "";
let scanLineTimer = 0;
const SCAN_LINE_INTERVAL = 2200;

// Alarm text slots
let alarmPrimary  = "";
let alarmSub      = "";
let alarmSubTimer = 0;
const ALARM_SUB_INTERVAL = 3500;

// Result text slots — picked on state entry, held for full duration
let straightPhrase = "";
let straightSub    = "";

// Idle phrase — held for several seconds, then quietly swapped
let idlePhrase      = "";
let idlePhraseTimer = 0;
const IDLE_PHRASE_INTERVAL = 4000;

// Confidence displayed with result
let displayedConfidence = 0;
let targetConfidence    = 0;

// ── Scanning HUD state (populated on SCANNING entry) ──────────────────────
let hudSessionId  = "";
let hudExpression = "";
let hudLogLines   = [];
let hudLogTimer   = 0;
let hudDataTicker = "";
let hudDataTimer  = 0;

const HUD_LOG_SEQ = [
  "SYSTEM BOOT",
  "CAMERA LINK: OK",
  "FACE DETECTED",
  "ORIENTATION: SCANNING",
  "CROSS-REF DATABASE",
  "AWAITING CLARITY",
];

let cam;
let detectionGraphics;

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
  stateAt = millis();

  nextGayAt       = 2; // TESTING — change to floor(random(10, 16)) for exhibition
  scanLine        = getRandomPhrase("scanning");
  alarmSub        = getRandomPhrase("alarmSub");
  idlePhrase      = getRandomPhrase("idle");
  idlePhraseTimer = millis();
  initMediaPipe();
}

function draw() {
  background(0);
  uiScale = height / 1080;

  runDetection(cam);
  updateState();
  updateConfidence();

  drawDistortedMirror(cam, state);

  if (state === STATES.ALARM) {
    drawAlarmOverlay();
    drawParticles();
    drawSpectrumScan(true);
  } else if (state === STATES.SCANNING) {
    drawSpectrumScan(false);
  } else if (state === STATES.IDLE) {
    drawFaceOverlays(detection.faces, state, detection.personCount, false);
  }

  drawScanLines();
  drawUI();
  drawTransitionFlash(); // always on top
}

// ─────────────────────────────────────────────
// State machine

function updateState() {
  const now     = millis();
  const elapsed = now - stateAt;
  const present = detection.personDetected;

  if (state === STATES.IDLE) {
    if (now - idlePhraseTimer > IDLE_PHRASE_INTERVAL) {
      idlePhrase      = getRandomPhrase("idle");
      idlePhraseTimer = now;
    }
    if (present && elapsed > IDLE_BEFORE_SCAN) {
      enterState(STATES.SCANNING);
    }
    return;
  }

  if (state === STATES.SCANNING) {
    // Lock to RESULT IMMINENT in the final 15% for tension
    if (elapsed > SCAN_DURATION * 0.85) {
      scanLine = "RESULT IMMINENT";
    } else if (now - scanLineTimer > SCAN_LINE_INTERVAL) {
      scanLine      = getRandomPhrase("scanning");
      scanLineTimer = now;
    }

    // Progress log lines
    if (hudLogLines.length < HUD_LOG_SEQ.length && now - hudLogTimer > 750) {
      hudLogLines.push(_hhmmss() + " " + HUD_LOG_SEQ[hudLogLines.length]);
      hudLogTimer = now;
    }

    // Refresh data stream ticker
    if (now - hudDataTimer > 320) {
      hudDataTicker = _randomHex(120);
      hudDataTimer  = now;
    }

    if (!present && elapsed > 1000) {
      enterState(STATES.IDLE);
      return;
    }

    if (elapsed > SCAN_DURATION) {
      if (!present) { enterState(STATES.IDLE); return; }
      scanCount++;
      if (scanCount >= nextGayAt) {
        nextGayAt = scanCount + 2; // TESTING — change to + floor(random(10, 16)) for exhibition
        enterState(STATES.ALARM);
      } else {
        enterState(STATES.STRAIGHT);
      }
    }
    return;
  }

  if (state === STATES.STRAIGHT) {
    if (elapsed > STRAIGHT_HOLD) enterState(STATES.IDLE);
    return;
  }

  if (state === STATES.ALARM) {
    if (now - alarmSubTimer > ALARM_SUB_INTERVAL) {
      alarmSub      = getRandomPhrase("alarmSub");
      alarmSubTimer = now;
    }
    if (elapsed > ALARM_HOLD) enterState(STATES.IDLE);
    return;
  }
}

function enterState(newState) {
  state   = newState;
  stateAt = millis();

  if (newState === STATES.SCANNING) {
    scanLine      = getRandomPhrase("scanning");
    scanLineTimer = millis();
    targetConfidence = 0;

    // Populate HUD panels
    const rndId   = () => hex(floor(random(65536)), 4);
    hudSessionId  = "G4Y-" + rndId() + "-" + rndId();
    hudExpression = random(["UNREADABLE", "NEUTRAL", "TENSE", "AMBIGUOUS"]);
    hudLogLines   = [];
    hudLogTimer   = millis();
    hudDataTicker = _randomHex(120);
    hudDataTimer  = millis();
  }

  if (newState === STATES.STRAIGHT) {
    straightPhrase   = getRandomPhrase("straight");
    straightSub      = getRandomPhrase("straightSub");
    targetConfidence = floor(random(92, 98));
    triggerFlash();
  }

  if (newState === STATES.ALARM) {
    alarmPrimary     = getRandomPhrase("alarm");
    alarmSub         = getRandomPhrase("alarmSub");
    alarmSubTimer    = millis();
    targetConfidence = 99;
    idlesSinceAlarm  = 0;
    initParticles();
    triggerFlash();
  }

  if (newState === STATES.IDLE) {
    idlePhrase       = getRandomPhrase("idle");
    idlePhraseTimer  = millis();
    targetConfidence = 0;
    idlesSinceAlarm++;
    if (idlesSinceAlarm >= FORCE_GAY_AFTER_IDLES) {
      nextGayAt = scanCount;
    }
  }
}

function updateConfidence() {
  if (state === STATES.SCANNING) {
    const progress = constrain((millis() - stateAt) / SCAN_DURATION, 0, 1);
    targetConfidence = floor(progress * 94);
  }
  displayedConfidence += (targetConfidence - displayedConfidence) * 0.06;
}

// ─────────────────────────────────────────────
// Drawing

function drawUI() {
  const pad = Math.round(24 * uiScale);
  const sm  = Math.round(11 * uiScale);
  const md  = Math.round(14 * uiScale);
  const xl  = Math.round(44 * uiScale);
  const lh  = Math.round(20 * uiScale);

  const isAlarm   = state === STATES.ALARM;
  const headerCol = isAlarm ? color(255, 60, 60) : color(0, 255, 120);
  const hR = red(headerCol), hG = green(headerCol), hB = blue(headerCol);

  // ── Header ───────────────────────────────────────────────────────────────
  noStroke();
  textAlign(LEFT, TOP);
  fill(hR, hG, hB, 180);
  textSize(sm);
  text("GAYDAR DETECTION SYSTEM / ACTIVE", pad, pad * 0.8);

  if (state === STATES.SCANNING) {
    fill(hR, hG, hB, 100);
    textSize(Math.max(7, Math.round(9 * uiScale)));
    text("SESSION ID: " + hudSessionId, pad, pad * 0.8 + lh * 1.1);
    text("BUILD: 2.7.9 // OS: GDS-CORE",   pad, pad * 0.8 + lh * 1.85);
  }

  // Confidence — top right
  if (displayedConfidence > 1) {
    textAlign(RIGHT, TOP);
    textSize(md);
    fill(hR, hG, hB, 220);
    text("CONFIDENCE: " + Math.round(displayedConfidence) + "%", width - pad, pad * 0.8);

    const barW = Math.round(160 * uiScale);
    const barH = Math.max(2, Math.round(3 * uiScale));
    const barX = width - pad - barW;
    const barY = Math.round(pad * 0.8 + lh * 1.4);
    noFill();
    stroke(hR, hG, hB, 50);
    strokeWeight(1);
    rect(barX, barY, barW, barH);
    noStroke();
    fill(hR, hG, hB, 180);
    rect(barX, barY, barW * (displayedConfidence / 100), barH);
  }

  noStroke();
  textAlign(CENTER, CENTER);

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (state === STATES.IDLE) {
    const pulse = (sin(millis() * 0.002) + 1) / 2;
    fill(0, 255, 120, 80 + pulse * 80);
    textSize(md);
    text(idlePhrase, width * 0.5, height * 0.44);
    textAlign(LEFT, TOP);
    return;
  }

  // ── SCANNING ─────────────────────────────────────────────────────────────
  if (state === STATES.SCANNING) {
    fill(0, 255, 120, 200);
    textSize(md);
    text(scanLine, width * 0.5, height * 0.25);

    drawScanningHUD();
    textAlign(LEFT, TOP);
    return;
  }

  // ── STRAIGHT RESULT ───────────────────────────────────────────────────────
  if (state === STATES.STRAIGHT) {
    fill(0, 255, 120, 255);
    textSize(xl);
    text(straightPhrase, width * 0.5, height * 0.40);

    fill(0, 255, 120, 180);
    textSize(md);
    text(straightSub, width * 0.5, height * 0.54);

    textAlign(LEFT, TOP);
    return;
  }

  // ── ALARM ─────────────────────────────────────────────────────────────────
  if (state === STATES.ALARM) {
    const flash  = sin(millis() * 0.012) > 0;
    const flash2 = sin(millis() * 0.018) > 0;
    const textA  = flash ? 255 : 190;

    // Primary headline — extra large
    fill(255, 255, 255, textA);
    textSize(Math.round(52 * uiScale));
    text(alarmPrimary, width * 0.5, height * 0.36);

    // Rotating sub-line
    fill(255, 55, 55, textA);
    textSize(Math.round(24 * uiScale));
    text(alarmSub, width * 0.5, height * 0.51);

    // Confidence
    fill(255, 55, 55, flash2 ? 230 : 140);
    textSize(md);
    text("CONFIDENCE: 99%", width * 0.5, height * 0.62);

    // Corner alerts — both flash independently
    textAlign(LEFT, TOP);
    textSize(sm);
    if (flash) {
      fill(255, 55, 55, 255);
      text("⚠ ALERT ⚠", pad, pad * 0.8 + Math.round(lh * 1.8));
    }
    if (flash2) {
      textAlign(RIGHT, TOP);
      fill(255, 55, 55, 255);
      text("⚠ ALERT ⚠", width - pad, pad * 0.8 + Math.round(lh * 1.8));
    }

    // Bottom — protocol line
    textAlign(CENTER, BOTTOM);
    fill(255, 55, 55, flash ? 180 : 80);
    textSize(Math.round(10 * uiScale));
    text("PRIDE RESPONSE PROTOCOL INITIATED — ALL UNITS RESPOND", width * 0.5, height - Math.round(12 * uiScale));

    textAlign(LEFT, TOP);
    return;
  }
}

// ─────────────────────────────────────────────
// Scanning HUD — streamlined: orientation panel + status box + tagline

function drawScanningHUD() {
  const pad      = Math.round(24 * uiScale);
  const sm       = Math.round(10 * uiScale);
  const xs       = Math.round(9  * uiScale);
  const lh       = Math.round(17 * uiScale);
  const col      = [0, 255, 120];
  const panelW   = Math.min(Math.round(195 * uiScale), width * 0.20);
  const progress = constrain((millis() - stateAt) / SCAN_DURATION, 0, 1);

  // ── LEFT: ORIENTATION ANALYSIS ──────────────────────────────────────────
  const oriY    = Math.round(130 * uiScale);
  const certainty = progress < 0.3 ? "LOW" : progress < 0.7 ? "PARTIAL" : "BUILDING";
  _hudLabel("ORIENTATION ANALYSIS", pad, oriY, sm, col);
  _hudRows([
    ["SUBJECTS",   String(detection.personCount).padStart(2, "0")],
    ["EXPRESSION", hudExpression],
    ["FLUIDITY",   "??"],
    ["CERTAINTY",  certainty],
    ["ALIGNMENT",  "UNDETERMINED"],
  ], pad, oriY + lh * 1.4, xs, lh, col, panelW);

  // ── LEFT BOTTOM: LOG OUTPUT ──────────────────────────────────────────────
  const logY = Math.round(430 * uiScale);
  _hudLabel("LOG OUTPUT", pad, logY, sm, col);
  fill(0, 255, 120, 90);
  textSize(xs);
  textAlign(LEFT, TOP);
  hudLogLines.slice(-6).forEach((ln, i) => {
    text(ln, pad, logY + lh * 1.4 + i * lh);
  });

  // ── BOTTOM CENTER: STATUS BOX ────────────────────────────────────────────
  const stW = Math.round(300 * uiScale);
  const stX = width * 0.5 - stW / 2;
  const stY = Math.round(860 * uiScale);
  const stH = Math.round(90 * uiScale);
  noFill();
  stroke(0, 255, 120, 50);
  strokeWeight(1);
  rect(stX, stY, stW, stH);
  noStroke();
  textAlign(CENTER, TOP);
  fill(0, 255, 120, 90);
  textSize(xs);
  text("STATUS", width * 0.5, stY + Math.round(10 * uiScale));
  fill(0, 255, 120, 215);
  textSize(Math.round(18 * uiScale));
  text("IDENTITY UNRESOLVED", width * 0.5, stY + Math.round(27 * uiScale));
  fill(0, 255, 120, 115);
  textSize(xs);
  text("CONTINUING OBSERVATION", width * 0.5, stY + Math.round(54 * uiScale));

  // Small pink triangle icon
  const triSz = Math.round(10 * uiScale);
  const triY  = height - Math.round(38 * uiScale);
  noFill();
  stroke(255, 20, 147, 75);
  strokeWeight(1);
  triangle(width * 0.5, triY + triSz, width * 0.5 - triSz, triY, width * 0.5 + triSz, triY);
  noStroke();

  // ── BOTTOM TAGLINE ───────────────────────────────────────────────────────
  textAlign(CENTER, BOTTOM);
  fill(0, 255, 120, 55);
  textSize(xs);
  text("◆  NOTHING IS EVER FULLY SEEN  ◆", width * 0.5, height - Math.round(12 * uiScale));
}

// ── HUD helpers ──────────────────────────────────────────────────────────────

function _hudLabel(label, x, y, size, col) {
  noStroke();
  fill(col[0], col[1], col[2], 155);
  textSize(size);
  textAlign(LEFT, TOP);
  text(label, x, y);
  stroke(col[0], col[1], col[2], 55);
  strokeWeight(1);
  line(x, y + size + Math.round(3 * uiScale),
       x + Math.round(textWidth(label) + 8 * uiScale),
       y + size + Math.round(3 * uiScale));
  noStroke();
}

function _hudRows(rows, x, y, size, lh, col, panelW) {
  const keyX = x;
  const valX = x + Math.round(panelW * 0.58);
  textSize(size);
  textAlign(LEFT, TOP);
  for (let i = 0; i < rows.length; i++) {
    const ry = y + i * lh;
    fill(col[0], col[1], col[2], 90);
    text(rows[i][0] + ":", keyX, ry);
    fill(col[0], col[1], col[2], 195);
    text(rows[i][1], valX, ry);
  }
}

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
