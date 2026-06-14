// Recognition Engine — Phase 2

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
let confidence = 40;
let uiScale = 1;

// ── Text timing ───────────────────────────────────────────────────────────────
// One phrase at a time. Fades in, holds, fades out. No label arrays.

const PHRASE_HOLD  = 8000;  // ms each primary phrase stays on screen
const PHRASE_FADE  = 1800;  // ms for fade in and out
const DIAG_HOLD    = 20000; // diagnostic sentence lasts much longer than phrases

// Primary phrase slot
let phrase   = { text: "", born: 0 };

// Diagnostic sentence (smaller, below phrase, changes slowly)
let diagLine = { text: "", born: -DIAG_HOLD };

// CONTRADICTING: two words revealed with a gap between them
let contraA  = { text: "", born: 0 };
let contraB  = { text: "", born: 0 };
const CONTRA_DELAY = 4000;  // ms after A before B appears
const CONTRA_HOLD  = 12000; // how long each pair stays before refreshing

// FADING: one phrase that decays with the state timer
let fadingPhrase  = "";
let fadingStartTime = 0;
const FADING_DURATION = 6000;

// ─────────────────────────────────────────────────────────────────────────────

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
  stateEnteredAt = millis();
  initMediaPipe();
}

function draw() {
  background(0);
  uiScale = height / 1080;

  runDetection(cam);
  updateState();
  updateConfidence();

  drawDistortedMirror(cam, detection.motionAmount, state);
  drawFaceOverlays(detection.faces, state, detection.personCount);
  drawScanLines();

  updatePhrases();
  drawSystemHeader();
  drawPhraseText();
  drawDiagnosticLine();
}

// ─────────────────────────────────────────────────────────────────────────────
// State machine

function updateState() {
  const now  = millis();
  const pd   = detection.presenceDuration;
  const ma   = detection.motionAmount;
  const present = detection.personDetected;
  const count   = detection.personCount;

  prevState = state;

  if (count >= 2 && present && state !== STATES.FADING) {
    if (state !== STATES.RELATIONAL) enterState(STATES.RELATIONAL);
    return;
  }

  if (state === STATES.RELATIONAL) {
    if (!present) { enterState(STATES.FADING); return; }
    if (count < 2) enterState(STATES.DETECTED);
    return;
  }

  if (!present && state !== STATES.FADING && state !== STATES.EMPTY) {
    enterState(STATES.FADING);
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

  if (state === STATES.DETECTED || state === STATES.OBSERVING || state === STATES.MISREADING) {
    if (pd > 12) { enterState(ma > 0.05 ? STATES.MISREADING : STATES.CONTRADICTING); return; }
    if (pd > 8)  { enterState(ma > 0.05 ? STATES.MISREADING : STATES.OBSERVING); return; }
    if (ma > 0.06) { enterState(STATES.MISREADING); return; }
    if (state === STATES.MISREADING && ma < 0.03) {
      enterState(pd > 8 ? STATES.OBSERVING : STATES.DETECTED);
    }
    return;
  }

  if (state === STATES.CONTRADICTING) {
    if (ma > 0.06) { enterState(STATES.MISREADING); return; }
    if (!present)  { enterState(STATES.FADING); }
    return;
  }
}

function enterState(newState) {
  if (newState === state) return;
  state = newState;
  stateEnteredAt = millis();

  // Reset primary phrase so a new one fades in immediately
  phrase = { text: "", born: 0 };

  // Diagnostic always refreshes on state change
  diagLine = { text: pickDiagnostic(), born: millis() };

  if (state === STATES.CONTRADICTING) {
    const pair = getContradictionPair();
    contraA = { text: pair[0], born: millis() };
    contraB = { text: pair[1], born: millis() + CONTRA_DELAY };
  }

  if (state === STATES.FADING) {
    fadingStartTime = millis();
    fadingPhrase = getRandomPhrase("fading");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phrase cycling — only one phrase active at a time

function updatePhrases() {
  // APPROACHING, CONTRADICTING, and FADING have their own drawing logic
  if (state === STATES.APPROACHING ||
      state === STATES.CONTRADICTING ||
      state === STATES.FADING) return;

  const age = millis() - phrase.born;
  if (age > PHRASE_HOLD || phrase.text === "") {
    phrase = { text: pickPhrase(), born: millis() };
  }

  // Refresh contradiction pair when its hold time expires
  if (state === STATES.CONTRADICTING) {
    if (millis() - contraA.born > CONTRA_HOLD) {
      const pair = getContradictionPair();
      contraA = { text: pair[0], born: millis() };
      contraB = { text: pair[1], born: millis() + CONTRA_DELAY };
    }
  }

  // Diagnostic refreshes on its own slower schedule
  if (millis() - diagLine.born > DIAG_HOLD) {
    diagLine = { text: pickDiagnostic(), born: millis() };
  }
}

function pickPhrase() {
  switch (state) {
    case STATES.EMPTY:         return getRandomPhrase("empty");
    case STATES.DETECTED:      return getRandomPhrase("detected");
    case STATES.OBSERVING:     return getRandomPhrase("observing");
    case STATES.MISREADING:    return getRandomPhrase("moving");
    case STATES.RELATIONAL:    return getRandomPhrase("relational");
    default: return "";
  }
}

function pickDiagnostic() {
  const key = state === STATES.MISREADING    ? "misreading"    :
              state === STATES.CONTRADICTING ? "contradicting" :
              state === STATES.RELATIONAL    ? "relational"    :
              state.toLowerCase();
  return getDiagnosticSentence(key);
}

// Alpha for a phrase: fade in → hold → fade out
function phraseAlpha(born, hold = PHRASE_HOLD) {
  const age = millis() - born;
  if (age <= 0)             return 0;
  if (age < PHRASE_FADE)    return (age / PHRASE_FADE) * 255;
  if (age > hold - PHRASE_FADE) return max(0, ((hold - age) / PHRASE_FADE) * 255);
  return 255;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence

function updateConfidence() {
  let target = 40;
  if (detection.personDetected)        target += 10;
  if (detection.personCount >= 2)      target += 8;
  if (detection.faceDetected)          target += 6;
  if (detection.stillnessDuration > 5) target += 15;
  if (detection.motionAmount > 0.06)   target -= 20;
  if (detection.presenceDuration > 20) target -= 10;
  if (detection.gazeApproximation === "away") target -= 12;
  if (state === STATES.CONTRADICTING)  target -= 8;
  if (state === STATES.MISREADING)     target -= 15;
  if (state === STATES.OBSERVING)      target += 8;
  if (state === STATES.RELATIONAL)     target += 5;
  target = constrain(target, 12, 89);
  confidence += (target - confidence) * 0.02;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawing

function drawSystemHeader() {
  const flicker = state === STATES.MISREADING ? random(140, 255) : 200;
  const pad = Math.round(24 * uiScale);
  const sm  = Math.round(11 * uiScale);
  const med = Math.round(13 * uiScale);
  const lh  = Math.round(18 * uiScale);

  noStroke();
  textAlign(LEFT, TOP);

  fill(0, 255, 120, flicker * 0.6);
  textSize(sm);
  text("RECOGNITION ENGINE / ACTIVE", pad, pad * 0.8);

  fill(0, 255, 120, flicker * 0.4);
  text("STATE: " + state, pad, pad * 0.8 + lh * 1.4);

  // Confidence — top right
  textAlign(RIGHT, TOP);
  textSize(med);
  fill(0, 255, 120, flicker * 0.8);
  text("CONFIDENCE: " + Math.round(confidence) + "%", width - pad, pad * 0.8);

  const barW = Math.round(160 * uiScale);
  const barH = Math.max(2, Math.round(3 * uiScale));
  const barX = width - pad - barW;
  const barY = Math.round(pad * 0.8 + lh * 1.4);
  noFill();
  stroke(0, 255, 120, 50);
  strokeWeight(1);
  rect(barX, barY, barW, barH);
  noStroke();
  fill(0, 255, 120, flicker * 0.5);
  rect(barX, barY, barW * (confidence / 100), barH);

  textAlign(LEFT, TOP);
}

function drawPhraseText() {
  noStroke();
  textAlign(CENTER, CENTER);

  // ── APPROACHING: scanning animation ─────────────────────────────────────
  if (state === STATES.APPROACHING) {
    const elapsed = millis() - stateEnteredAt;
    const progress = constrain(elapsed / 3000, 0, 1);

    // Pulsing label
    const pulse = (sin(elapsed * 0.004) + 1) / 2;
    fill(0, 255, 120, 120 + pulse * 100);
    textSize(Math.round(13 * uiScale));
    const dots = ".".repeat(floor(elapsed / 450) % 4);
    text("SCANNING" + dots, width * 0.5, height * 0.42);

    // Progress bar
    const barW = Math.round(180 * uiScale);
    const barH = Math.max(1, Math.round(2 * uiScale));
    const barX = width * 0.5 - barW / 2;
    const barY = height * 0.42 + Math.round(22 * uiScale);
    noFill();
    stroke(0, 255, 120, 40);
    strokeWeight(1);
    rect(barX, barY, barW, barH);
    noStroke();
    fill(0, 255, 120, 160);
    rect(barX, barY, barW * progress, barH);

    textAlign(LEFT, TOP);
    return;
  }

  // ── CONTRADICTING: two words revealed with a gap ──────────────────────────
  if (state === STATES.CONTRADICTING) {
    const sz = Math.round(38 * uiScale);
    const gap = Math.round(60 * uiScale);
    const cy  = height * 0.42;

    if (contraA.text) {
      const a = phraseAlpha(contraA.born, CONTRA_HOLD);
      const flicker = random(0.9, 1.0);
      fill(255, 255, 255, a * flicker);
      textSize(sz);
      text(contraA.text, width * 0.5 - gap, cy);
    }

    if (contraB.text) {
      const a = phraseAlpha(contraB.born, CONTRA_HOLD - CONTRA_DELAY);
      const flicker = random(0.88, 1.0);
      fill(200, 200, 200, a * flicker);
      textSize(Math.round(30 * uiScale));
      text(contraB.text, width * 0.5 + gap, cy + Math.round(20 * uiScale));
    }

    // Refresh pair when expired
    if (millis() - contraA.born > CONTRA_HOLD) {
      const pair = getContradictionPair();
      contraA = { text: pair[0], born: millis() };
      contraB = { text: pair[1], born: millis() + CONTRA_DELAY };
    }

    textAlign(LEFT, TOP);
    return;
  }

  // ── FADING: single phrase that decays ─────────────────────────────────────
  if (state === STATES.FADING) {
    const a = map(millis() - fadingStartTime, 0, FADING_DURATION, 220, 0, true);
    fill(255, 255, 255, a);
    textSize(Math.round(32 * uiScale));
    text(fadingPhrase, width * 0.5, height * 0.42);
    textAlign(LEFT, TOP);
    return;
  }

  // ── RELATIONAL: midpoint label between faces (if detected) ─────────────────
  if (state === STATES.RELATIONAL && detection.faces.length >= 2) {
    const a = phraseAlpha(phrase.born);
    const flicker = random(0.92, 1.0);
    fill(255, 255, 255, a * flicker);
    textSize(Math.round(32 * uiScale));
    text(phrase.text, width * 0.5, height * 0.42);
    textAlign(LEFT, TOP);
    return;
  }

  // ── Default: single primary phrase ────────────────────────────────────────
  if (phrase.text) {
    const a = phraseAlpha(phrase.born);
    const flicker = state === STATES.MISREADING ? random(0.65, 1.0) : random(0.96, 1.0);
    const drift   = sin(frameCount * 0.008) * (state === STATES.MISREADING ? 10 : 2);
    fill(255, 255, 255, a * flicker);
    textSize(Math.round(34 * uiScale));
    text(phrase.text, width * 0.5 + drift, height * 0.42);
  }

  textAlign(LEFT, TOP);
}

function drawDiagnosticLine() {
  if (!diagLine.text) return;

  // Diagnostic sits below the phrase, smaller, green
  const a = phraseAlpha(diagLine.born, DIAG_HOLD);
  if (a <= 0) return;

  const barAlpha = state === STATES.MISREADING ? random(0.7, 1.0) : 1.0;
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(Math.round(14 * uiScale));
  fill(0, 255, 120, a * barAlpha * 0.85);
  text(diagLine.text, width * 0.5, height * 0.60);

  // Presence duration — bottom-left, very quiet
  if (detection.personDetected) {
    const pad = Math.round(24 * uiScale);
    textAlign(LEFT, BOTTOM);
    textSize(Math.round(10 * uiScale));
    fill(0, 255, 120, 50);
    text("DURATION: " + detection.presenceDuration.toFixed(1) + "s", pad, height - pad * 0.4);
  }

  textAlign(LEFT, TOP);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initVisuals(width, height);
  clearGhostTrails();
}
