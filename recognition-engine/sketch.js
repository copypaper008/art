// Recognition Engine — Phase 2 (motion detection + MediaPipe face detection)

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
let detectionGraphics;

let activeLabels = [];
let diagnosticText = "";
let confidence = 40;

let lastPhraseUpdate = 0;
const PHRASE_INTERVAL = 3500;

let currentContradiction = null;

let fadingStartTime = 0;
const FADING_DURATION = 5000;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  detectionGraphics = createGraphics(320, 180);
  detectionGraphics.pixelDensity(1);
  initDetection(detectionGraphics);
  initVisuals(width, height);

  cam = createCapture(VIDEO);
  cam.size(640, 480);
  cam.hide();

  textFont("monospace");
  stateEnteredAt = millis();

  // Start async MediaPipe load — runs in background, detection falls back
  // to motion-only until it resolves
  initMediaPipe();
}

function draw() {
  background(0);

  runDetection(cam);
  updateState();
  updateConfidence();

  drawDistortedMirror(cam, detection.motionAmount, state);
  drawFaceOverlays(detection.faces, state, detection.personCount);
  drawScanLines();

  updatePhrases();
  drawSystemHeader();
  drawFloatingLabels();
  drawDiagnosticBar();
}

// ─────────────────────────────────────────────
// State machine

function updateState() {
  const now = millis();
  const pd  = detection.presenceDuration;
  const ma  = detection.motionAmount;
  const present = detection.personDetected;
  const count   = detection.personCount;

  prevState = state;

  // RELATIONAL overrides most states — checked first
  if (count >= 2 && present && state !== STATES.FADING) {
    if (state !== STATES.RELATIONAL) enterState(STATES.RELATIONAL);
    return;
  }

  // Drop out of RELATIONAL if person count falls
  if (state === STATES.RELATIONAL) {
    if (!present) {
      enterState(STATES.FADING);
      fadingStartTime = now;
    } else {
      enterState(STATES.DETECTED);
    }
    return;
  }

  // FADING / EMPTY
  if (!present && state !== STATES.FADING && state !== STATES.EMPTY) {
    enterState(STATES.FADING);
    fadingStartTime = now;
    return;
  }

  if (state === STATES.FADING) {
    if (present) { enterState(STATES.APPROACHING); return; }
    if (now - fadingStartTime > FADING_DURATION) enterState(STATES.EMPTY);
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

  // Active presence states
  if (
    state === STATES.DETECTED  ||
    state === STATES.OBSERVING ||
    state === STATES.MISREADING
  ) {
    if (pd > 12) {
      enterState(ma > 0.05 ? STATES.MISREADING : STATES.CONTRADICTING);
      return;
    }
    if (pd > 8) {
      enterState(ma > 0.05 ? STATES.MISREADING : STATES.OBSERVING);
      return;
    }
    if (ma > 0.06) { enterState(STATES.MISREADING); return; }
    if (state === STATES.MISREADING && ma < 0.03) {
      enterState(pd > 8 ? STATES.OBSERVING : STATES.DETECTED);
    }
    return;
  }

  if (state === STATES.CONTRADICTING) {
    if (ma > 0.06)  { enterState(STATES.MISREADING); return; }
    if (!present)   { enterState(STATES.FADING); fadingStartTime = now; }
    return;
  }
}

function enterState(newState) {
  if (newState === state) return;
  state = newState;
  stateEnteredAt = millis();
  activeLabels = [];
  diagnosticText = getDiagnosticSentence(state.toLowerCase());
  currentContradiction = state === STATES.CONTRADICTING ? getContradictionPair() : null;
}

// ─────────────────────────────────────────────
// Confidence

function updateConfidence() {
  let target = 40;
  if (detection.personDetected)       target += 10;
  if (detection.personCount >= 2)     target += 8;
  if (detection.faceDetected)         target += 6;
  if (detection.stillnessDuration > 5) target += 15;
  if (detection.motionAmount > 0.06)  target -= 20;
  if (detection.presenceDuration > 20) target -= 10;
  if (detection.gazeApproximation === "away") target -= 12;
  if (state === STATES.CONTRADICTING) target -= 8;
  if (state === STATES.MISREADING)    target -= 15;
  if (state === STATES.OBSERVING)     target += 8;
  if (state === STATES.RELATIONAL)    target += 5;

  target = constrain(target, 12, 89);
  confidence += (target - confidence) * 0.02;
}

// ─────────────────────────────────────────────
// Phrase system

function updatePhrases() {
  const now = millis();
  if (now - lastPhraseUpdate < PHRASE_INTERVAL) return;
  lastPhraseUpdate = now;

  activeLabels = [];

  // Primary centred label
  let primary = "";
  if (state === STATES.EMPTY)         primary = getRandomPhrase("empty");
  if (state === STATES.APPROACHING)   primary = getRandomPhrase("approaching");
  if (state === STATES.DETECTED)      primary = getRandomPhrase("detected");
  if (state === STATES.OBSERVING)     primary = getRandomPhrase("observing");
  if (state === STATES.MISREADING)    primary = getRandomPhrase("moving");
  if (state === STATES.CONTRADICTING) primary = getRandomPhrase("detected");
  if (state === STATES.RELATIONAL)    primary = getRandomPhrase("relational");
  if (state === STATES.FADING)        primary = getRandomPhrase("fading");

  if (primary) pushLabel(primary, width * 0.5, height * 0.38, 220);

  // Motion / stillness qualifier
  if (detection.motionAmount > 0.04) {
    pushLabel(getRandomPhrase("moving"), width * 0.5, height * 0.46, 180);
  } else if (detection.stillnessDuration > 4 && detection.personDetected) {
    pushLabel(getRandomPhrase("still"), width * 0.5, height * 0.46, 180);
  }

  // Distance qualifier (only when we have face data for reliability)
  if (detection.faceDetected) {
    if (detection.distanceEstimate < 0.3) {
      pushLabel(getRandomPhrase("close"), width * 0.5, height * 0.54, 150);
    } else if (detection.distanceEstimate > 0.7) {
      pushLabel(getRandomPhrase("distant"), width * 0.5, height * 0.54, 150);
    }
  }

  // Face-anchored labels — positioned near each detected face
  for (let i = 0; i < detection.faces.length; i++) {
    const face = detection.faces[i];
    let facePhrase = "";
    if (i === 0) {
      facePhrase = state === STATES.RELATIONAL
        ? getRandomPhrase("relational")
        : getRandomPhrase("still");
    } else {
      // Second person gets a different phrase to emphasise distributed reading
      facePhrase = getRandomPhrase("relational");
    }
    if (facePhrase) {
      pushLabel(facePhrase, face.x, face.y - face.h * 0.7, 160);
    }
  }

  if (state === STATES.CONTRADICTING) {
    currentContradiction = getContradictionPair();
  }

  // Gaze-reactive secondary label
  if (detection.gazeApproximation === "away" && detection.personDetected) {
    pushLabel("GAZE UNCONFIRMED", width * 0.5, height * 0.62, 120);
  }

  diagnosticText = getDiagnosticSentence(
    state === STATES.MISREADING    ? "misreading"    :
    state === STATES.CONTRADICTING ? "contradicting" :
    state === STATES.RELATIONAL    ? "relational"    :
    state.toLowerCase()
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
  const flicker = state === STATES.MISREADING ? random(140, 255) : 200;

  noStroke();
  textAlign(LEFT, TOP);

  fill(0, 255, 120, flicker * 0.7);
  textSize(11);
  text("RECOGNITION ENGINE / ACTIVE", 24, 20);
  text("SURFACE TENSION SYSTEM v2.0", 24, 36);

  fill(0, 255, 120, flicker * 0.5);
  text("STATE: " + state, 24, 60);

  // Person count — shown when MediaPipe is active
  if (mediaPipeReady) {
    fill(0, 255, 120, flicker * 0.45);
    text("SUBJECTS: " + detection.personCount, 24, 76);
    text("GAZE: " + detection.gazeApproximation.toUpperCase(), 24, 92);
  }

  // Confidence block — top right
  textAlign(RIGHT, TOP);
  textSize(13);
  fill(0, 255, 120, flicker * 0.8);
  text("CONFIDENCE: " + Math.round(confidence) + "%", width - 24, 20);

  const barW = 160, barH = 4;
  const barX = width - 24 - barW, barY = 40;
  noFill();
  stroke(0, 255, 120, 60);
  strokeWeight(1);
  rect(barX, barY, barW, barH);
  noStroke();
  fill(0, 255, 120, flicker * 0.6);
  rect(barX, barY, barW * (confidence / 100), barH);

  fill(0, 255, 120, 100);
  textSize(11);
  const motionPct = (detection.motionAmount * 1000 / 10).toFixed(1);
  text("MOTION: " + motionPct + "%", width - 24, 54);

  textAlign(LEFT, TOP);
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

  // Contradiction pair — centred, stacked, large
  if (state === STATES.CONTRADICTING && currentContradiction) {
    const cy = height * 0.48;
    const flicker = random(0.85, 1.0);
    textSize(22);
    fill(255, 255, 255, 200 * flicker);
    text(currentContradiction[0], width * 0.5 - 80, cy);
    fill(180, 180, 180, 150 * flicker);
    text(currentContradiction[1], width * 0.5 + 80, cy + 28);
  }

  // RELATIONAL — secondary contradiction-style pairing
  if (state === STATES.RELATIONAL && detection.faces.length >= 2) {
    const f0 = detection.faces[0];
    const f1 = detection.faces[1];
    // Midpoint label
    const mx = (f0.x + f1.x) / 2;
    const my = (f0.y + f1.y) / 2;
    fill(255, 255, 255, 160 * random(0.9, 1.0));
    textSize(14);
    text("BOUNDARY UNSTABLE", mx, my);
  }

  // FADING — decaying ghost text
  if (state === STATES.FADING) {
    const alpha = map(millis() - fadingStartTime, 0, FADING_DURATION, 200, 0, true);
    fill(255, 255, 255, alpha);
    textSize(20);
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

  if (detection.personDetected) {
    textAlign(LEFT, BOTTOM);
    textSize(10);
    fill(0, 255, 120, 80);
    text("DURATION: " + detection.presenceDuration.toFixed(1) + "s", 24, height - 10);
  }

  textAlign(LEFT, TOP);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initVisuals(width, height);
  clearGhostTrails();
}
