// Recognition Engine — Gaydar Detector

const STATES = {
  IDLE:     "IDLE",      // waiting for subject
  SCANNING: "SCANNING",  // active scan in progress
  STRAIGHT: "STRAIGHT",  // result: heterosexual
  ALARM:    "ALARM",     // result: HOMOSEXUAL DETECTED
};

const IDLE_BEFORE_SCAN = 1500;  // ms of presence before scan triggers
const SCAN_DURATION    = 5000;  // ms the scan takes
const STRAIGHT_HOLD    = 6000;  // ms STRAIGHT result stays on screen
const ALARM_HOLD       = 9000;  // ms ALARM stays on screen

let state   = STATES.IDLE;
let stateAt = 0;
let uiScale = 1;

// Scan counter — gay detection fires every 20–25 scans
let scanCount = 0;
let nextGayAt = 0; // set in setup()

// Rotating text during scanning
let scanLine      = "";
let scanLineTimer = 0;
const SCAN_LINE_INTERVAL = 750;

// Rotating sub-line during alarm
let alarmSub      = "";
let alarmSubTimer = 0;
const ALARM_SUB_INTERVAL = 2200;

// Result held across state
let resultIsStraight = true;
let straightSub      = "";

// Confidence displayed with result
let displayedConfidence = 0;
let targetConfidence    = 0;

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

  nextGayAt = floor(random(10, 16));
  scanLine  = getRandomPhrase("scanning");
  alarmSub  = getRandomPhrase("alarmSub");
  initMediaPipe();
}

function draw() {
  background(0);
  uiScale = height / 1080;

  runDetection(cam);
  updateState();
  updateConfidence();

  // Mirror + overlays
  drawDistortedMirror(cam, detection.motionAmount, state);

  if (state === STATES.ALARM) {
    drawAlarmOverlay();
    drawFaceOverlays(detection.faces, state, detection.personCount, true);
  } else {
    drawFaceOverlays(detection.faces, state, detection.personCount, false);
  }

  drawScanLines();
  drawUI();
}

// ─────────────────────────────────────────────
// State machine

function updateState() {
  const now     = millis();
  const elapsed = now - stateAt;
  const present = detection.personDetected;

  if (state === STATES.IDLE) {
    if (present && elapsed > IDLE_BEFORE_SCAN) {
      enterState(STATES.SCANNING);
    }
    return;
  }

  if (state === STATES.SCANNING) {
    // Rotate scanning text
    if (now - scanLineTimer > SCAN_LINE_INTERVAL) {
      scanLine      = getRandomPhrase("scanning");
      scanLineTimer = now;
    }

    // Abort if subject left before scan completed — doesn't count
    if (!present && elapsed > 1000) {
      enterState(STATES.IDLE);
      return;
    }

    if (elapsed > SCAN_DURATION) {
      // Only count as a completed scan if subject is still present
      if (!present) {
        enterState(STATES.IDLE);
        return;
      }
      scanCount++;
      if (scanCount >= nextGayAt) {
        nextGayAt = scanCount + floor(random(10, 16));
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
    // Rotate alarm sub-line
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
  }

  if (newState === STATES.STRAIGHT) {
    straightSub      = getRandomPhrase("straightSub");
    targetConfidence = floor(random(92, 98));
  }

  if (newState === STATES.ALARM) {
    alarmSub      = getRandomPhrase("alarmSub");
    alarmSubTimer = millis();
    targetConfidence = 99;
  }

  if (newState === STATES.IDLE) {
    targetConfidence = 0;
  }
}

function updateConfidence() {
  // During scan: confidence builds with progress
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
  const lg  = Math.round(36 * uiScale);
  const xl  = Math.round(44 * uiScale);
  const lh  = Math.round(20 * uiScale);

  const isAlarm = state === STATES.ALARM;

  // ── Header ───────────────────────────────────────────────────────────────
  noStroke();
  textAlign(LEFT, TOP);

  const headerCol = isAlarm ? color(255, 60, 60) : color(0, 255, 120);

  fill(red(headerCol), green(headerCol), blue(headerCol), 180);
  textSize(sm);
  text("GAYDAR DETECTION SYSTEM / ACTIVE", pad, pad * 0.8);

  // Confidence — top right
  if (displayedConfidence > 1) {
    textAlign(RIGHT, TOP);
    textSize(md);
    fill(red(headerCol), green(headerCol), blue(headerCol), 220);
    text("CONFIDENCE: " + Math.round(displayedConfidence) + "%", width - pad, pad * 0.8);

    const barW = Math.round(160 * uiScale);
    const barH = Math.max(2, Math.round(3 * uiScale));
    const barX = width - pad - barW;
    const barY = Math.round(pad * 0.8 + lh * 1.4);
    noFill();
    stroke(red(headerCol), green(headerCol), blue(headerCol), 50);
    strokeWeight(1);
    rect(barX, barY, barW, barH);
    noStroke();
    fill(red(headerCol), green(headerCol), blue(headerCol), 180);
    rect(barX, barY, barW * (displayedConfidence / 100), barH);
  }

  noStroke();
  textAlign(CENTER, CENTER);

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (state === STATES.IDLE) {
    const pulse = (sin(millis() * 0.002) + 1) / 2;
    fill(0, 255, 120, 80 + pulse * 80);
    textSize(md);
    text(getRandomPhrase("idle"), width * 0.5, height * 0.44);
    textAlign(LEFT, TOP);
    return;
  }

  // ── SCANNING ─────────────────────────────────────────────────────────────
  if (state === STATES.SCANNING) {
    const elapsed  = millis() - stateAt;
    const progress = constrain(elapsed / SCAN_DURATION, 0, 1);

    // Rotating status line
    fill(0, 255, 120, 220);
    textSize(md);
    text(scanLine, width * 0.5, height * 0.38);

    // Progress bar
    const barW = Math.round(320 * uiScale);
    const barH = Math.max(3, Math.round(4 * uiScale));
    const barX = width * 0.5 - barW / 2;
    const barY = height * 0.46;
    noFill();
    stroke(0, 255, 120, 50);
    strokeWeight(1);
    rect(barX, barY, barW, barH);
    noStroke();
    fill(0, 255, 120, 200);
    rect(barX, barY, barW * progress, barH);

    // Percentage ticker
    fill(0, 255, 120, 140);
    textSize(sm);
    text(Math.round(progress * 94) + "%", width * 0.5, height * 0.46 + barH + Math.round(16 * uiScale));

    textAlign(LEFT, TOP);
    return;
  }

  // ── STRAIGHT RESULT ───────────────────────────────────────────────────────
  if (state === STATES.STRAIGHT) {
    fill(0, 255, 120, 255);
    textSize(xl);
    text(getRandomPhrase("straight"), width * 0.5, height * 0.40);

    fill(0, 255, 120, 180);
    textSize(md);
    text(straightSub, width * 0.5, height * 0.54);

    textAlign(LEFT, TOP);
    return;
  }

  // ── ALARM ─────────────────────────────────────────────────────────────────
  if (state === STATES.ALARM) {
    const flash = sin(millis() * 0.012) > 0; // ~1Hz flash
    const textA = flash ? 255 : 200;

    // Primary alarm line
    fill(255, 255, 255, textA);
    textSize(xl);
    text(getRandomPhrase("alarm"), width * 0.5, height * 0.38);

    // Rotating sub-line
    fill(255, 60, 60, textA * 0.9);
    textSize(Math.round(22 * uiScale));
    text(alarmSub, width * 0.5, height * 0.52);

    // CONFIDENCE: 99%
    fill(255, 60, 60, 200);
    textSize(md);
    text("CONFIDENCE: 99%", width * 0.5, height * 0.62);

    // Flashing ALERT in corners
    if (flash) {
      textAlign(LEFT, TOP);
      textSize(sm);
      fill(255, 60, 60, 255);
      text("⚠ ALERT ⚠", pad, pad * 0.8 + Math.round(lh * 1.8));
      textAlign(RIGHT, TOP);
      text("⚠ ALERT ⚠", width - pad, pad * 0.8 + Math.round(lh * 1.8));
    }

    textAlign(LEFT, TOP);
    return;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initVisuals(width, height);
  clearGhostTrails();
}
