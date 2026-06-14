// Recognition Engine — Phase 1 (motion detection, no MediaPipe)

const STATES = {
  EMPTY:         "EMPTY",
  APPROACHING:   "APPROACHING",
  DETECTED:      "DETECTED",
  OBSERVING:     "OBSERVING",
  MISREADING:    "MISREADING",
  CONTRADICTING: "CONTRADICTING",
  RELATIONAL:    "RELATIONAL",
  FADING:        "FADING",
};

let state = STATES.EMPTY;
let prevState = null;
let stateEnteredAt = 0;

let cam;
let detectionGraphics;   // off-screen buffer used by detection.js

// Text state
let activeLabels = [];         // floating labels: {text, x, y, alpha, drift}
let diagnosticText = "";
let statusLine2 = "";
let confidence = 40;

// Phrase rotation timers
let lastPhraseUpdate = 0;
const PHRASE_INTERVAL = 3500;   // ms between phrase rotations

// Contradiction pair currently shown
let currentContradiction = null;
let contradictionTimer = 0;

// Fading state bookkeeping
let fadingStartTime = 0;
const FADING_DURATION = 5000;   // ms to show fading state before returning to EMPTY

// Font
let monoFont;

function preload() {
  // p5.js will use system monospace if no font loaded
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // Detection off-screen buffer at reduced resolution for performance
  detectionGraphics = createGraphics(320, 180);
  detectionGraphics.pixelDensity(1);
  initDetection(detectionGraphics);
  initVisuals(width, height);

  cam = createCapture(VIDEO);
  cam.size(640, 480);
  cam.hide();

  textFont("monospace");
  stateEnteredAt = millis();
}

function draw() {
  background(0);

  // --- Detection ---
  runDetection(cam);
  updateState();
  updateConfidence();

  // --- Visuals ---
  drawDistortedMirror(cam, detection.motionAmount, state);
  drawScanLines();

  // --- UI text ---
  updatePhrases();
  drawSystemHeader();
  drawFloatingLabels();
  drawDiagnosticBar();
}

// ─────────────────────────────────────────────
// State machine

function updateState() {
  const now = millis();
  const pd = detection.presenceDuration;
  const ma = detection.motionAmount;
  const present = detection.personDetected;

  prevState = state;

  if (!present && state !== STATES.FADING && state !== STATES.EMPTY) {
    enterState(STATES.FADING);
    fadingStartTime = now;
    return;
  }

  if (state === STATES.FADING) {
    if (present) {
      enterState(STATES.APPROACHING);
      return;
    }
    if (now - fadingStartTime > FADING_DURATION) {
      enterState(STATES.EMPTY);
    }
    return;
  }

  if (state === STATES.EMPTY) {
    if (present) enterState(STATES.APPROACHING);
    return;
  }

  if (state === STATES.APPROACHING) {
    if (pd >= 3) enterState(STATES.DETECTED);
    return;
  }

  if (state === STATES.DETECTED || state === STATES.OBSERVING || state === STATES.MISREADING) {
    if (pd > 12) {
      if (ma > 0.05) {
        enterState(STATES.MISREADING);
      } else {
        enterState(STATES.CONTRADICTING);
      }
      return;
    }
    if (pd > 8) {
      if (ma > 0.05) {
        enterState(STATES.MISREADING);
      } else {
        enterState(STATES.OBSERVING);
      }
      return;
    }
    if (ma > 0.06) {
      enterState(STATES.MISREADING);
      return;
    }
    if (state === STATES.MISREADING && ma < 0.03) {
      // Settle back
      enterState(pd > 8 ? STATES.OBSERVING : STATES.DETECTED);
      return;
    }
    if (state === STATES.DETECTED && pd >= 3) {
      return; // stay detected
    }
    return;
  }

  if (state === STATES.CONTRADICTING) {
    if (ma > 0.06) enterState(STATES.MISREADING);
    if (!present) enterState(STATES.FADING);
    return;
  }
}

function enterState(newState) {
  if (newState === state) return;
  state = newState;
  stateEnteredAt = millis();
  activeLabels = [];
  diagnosticText = getDiagnosticSentence(state.toLowerCase());
  currentContradiction = null;

  if (state === STATES.CONTRADICTING) {
    currentContradiction = getContradictionPair();
  }
}

// ─────────────────────────────────────────────
// Confidence score — responsive but never 100%

function updateConfidence() {
  let target = 40;
  if (detection.personDetected) target += 10;
  if (detection.stillnessDuration > 5) target += 15;
  if (detection.motionAmount > 0.06) target -= 20;
  if (detection.presenceDuration > 20) target -= 10;
  if (state === STATES.CONTRADICTING) target -= 8;
  if (state === STATES.MISREADING) target -= 15;
  if (state === STATES.OBSERVING) target += 8;

  target = constrain(target, 12, 89);
  confidence += (target - confidence) * 0.02; // smooth
}

// ─────────────────────────────────────────────
// Phrase system

function updatePhrases() {
  const now = millis();
  if (now - lastPhraseUpdate < PHRASE_INTERVAL) return;
  lastPhraseUpdate = now;

  activeLabels = [];

  const stateLow = state.toLowerCase();

  // Primary label — based on state
  let primary = "";
  if (state === STATES.EMPTY)         primary = getRandomPhrase("empty");
  if (state === STATES.APPROACHING)   primary = getRandomPhrase("approaching");
  if (state === STATES.DETECTED)      primary = getRandomPhrase("detected");
  if (state === STATES.OBSERVING)     primary = getRandomPhrase("observing");
  if (state === STATES.MISREADING)    primary = getRandomPhrase("moving");
  if (state === STATES.CONTRADICTING) primary = getRandomPhrase("detected");
  if (state === STATES.FADING)        primary = getRandomPhrase("fading");

  if (primary) pushLabel(primary, width * 0.5, height * 0.38, 220);

  // Motion qualifier
  if (detection.motionAmount > 0.04) {
    pushLabel(getRandomPhrase("moving"), width * 0.5, height * 0.46, 180);
  } else if (detection.stillnessDuration > 4 && detection.personDetected) {
    pushLabel(getRandomPhrase("still"), width * 0.5, height * 0.46, 180);
  }

  // Distance
  if (detection.personDetected) {
    if (detection.distanceEstimate < 0.3) {
      pushLabel(getRandomPhrase("close"), width * 0.5, height * 0.54, 150);
    } else if (detection.distanceEstimate > 0.7) {
      pushLabel(getRandomPhrase("distant"), width * 0.5, height * 0.54, 150);
    }
  }

  // Contradiction pair overlay
  if (state === STATES.CONTRADICTING) {
    currentContradiction = getContradictionPair();
  }

  // Refresh diagnostic
  diagnosticText = getDiagnosticSentence(
    state === STATES.MISREADING ? "misreading" :
    state === STATES.CONTRADICTING ? "contradicting" :
    stateLow
  );
}

function pushLabel(text, x, y, alpha) {
  activeLabels.push({
    text,
    x: x + random(-20, 20),
    y,
    alpha,
    drift: random(-0.3, 0.3),
  });
}

// ─────────────────────────────────────────────
// Drawing

function drawSystemHeader() {
  const flickerAlpha = state === STATES.MISREADING
    ? random(140, 255)
    : 200;

  // Top-left status block
  fill(0, 255, 120, flickerAlpha * 0.7);
  noStroke();
  textSize(11);
  textAlign(LEFT, TOP);
  text("RECOGNITION ENGINE / ACTIVE", 24, 20);
  text("SURFACE TENSION SYSTEM v1.0", 24, 36);

  // State indicator
  textSize(11);
  fill(0, 255, 120, flickerAlpha * 0.5);
  text("STATE: " + state, 24, 60);

  // Confidence — top right
  const confDisplay = Math.round(confidence);
  textAlign(RIGHT, TOP);
  textSize(13);
  fill(0, 255, 120, flickerAlpha * 0.8);
  text("CONFIDENCE: " + confDisplay + "%", width - 24, 20);

  // Confidence bar
  const barW = 160;
  const barH = 4;
  const barX = width - 24 - barW;
  const barY = 40;
  noFill();
  stroke(0, 255, 120, 60);
  strokeWeight(1);
  rect(barX, barY, barW, barH);
  noStroke();
  fill(0, 255, 120, flickerAlpha * 0.6);
  rect(barX, barY, barW * (confidence / 100), barH);

  // Motion readout
  textAlign(RIGHT, TOP);
  textSize(11);
  fill(0, 255, 120, 100);
  const motionPct = Math.round(detection.motionAmount * 1000) / 10;
  text("MOTION: " + motionPct.toFixed(1) + "%", width - 24, 54);

  textAlign(LEFT, TOP); // reset
}

function drawFloatingLabels() {
  noStroke();
  textAlign(CENTER, CENTER);

  for (const label of activeLabels) {
    const flicker = state === STATES.MISREADING ? random(0.6, 1.0) : 1.0;
    const drift = sin(frameCount * 0.01 + label.drift * 10) * 3;

    fill(255, 255, 255, label.alpha * flicker);
    textSize(18);
    text(label.text, label.x + drift, label.y);
  }

  // Contradiction pair — large, centre screen, stacked
  if (state === STATES.CONTRADICTING && currentContradiction) {
    const cy = height * 0.48;
    const flicker = random(0.85, 1.0);

    textSize(22);
    fill(255, 255, 255, 200 * flicker);
    text(currentContradiction[0], width * 0.5 - 80, cy);

    fill(180, 180, 180, 150 * flicker);
    text(currentContradiction[1], width * 0.5 + 80, cy + 28);
  }

  // FADING state: large ghost text
  if (state === STATES.FADING) {
    const elapsed = millis() - fadingStartTime;
    const alpha = map(elapsed, 0, FADING_DURATION, 200, 0, true);
    textSize(20);
    fill(255, 255, 255, alpha);
    text(getRandomPhrase("fading"), width * 0.5, height * 0.5);
  }

  textAlign(LEFT, TOP);
}

function drawDiagnosticBar() {
  if (!diagnosticText) return;

  const barAlpha = state === STATES.MISREADING ? random(160, 240) : 200;

  fill(0, 0, 0, 120);
  noStroke();
  rect(0, height - 60, width, 60);

  textAlign(CENTER, CENTER);
  textSize(13);
  fill(0, 255, 120, barAlpha * 0.9);
  text(diagnosticText, width * 0.5, height - 30);

  // Presence duration ticker bottom-left
  textAlign(LEFT, BOTTOM);
  textSize(10);
  fill(0, 255, 120, 80);
  if (detection.personDetected) {
    text("DURATION: " + detection.presenceDuration.toFixed(1) + "s", 24, height - 10);
  }

  textAlign(LEFT, TOP);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initVisuals(width, height);
  clearGhostTrails();
}
