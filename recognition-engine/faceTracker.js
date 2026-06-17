// Per-face subject tracking with individual state machines.
//
// Spatial layer: each subject's centre is run through a Kalman1D filter (one per
// axis) and its size through springs. predict() coasts the estimate forward
// every render frame; correct() folds in MediaPipe's measurement only on the
// frames it actually produces one (every 3rd). Result: the reticle glides and
// slightly leads motion instead of snapping, and frame-to-frame matching uses
// predicted position + velocity so two people crossing no longer swap IDs.
//
// Animation layer: every state entrance builds a Timeline (see anim.js) that
// cascades the reveal channels in `fx`, and a spotlight Spring ramps the light
// up on a verdict and back down smoothly when the subject leaves.
//
// Timing constants (IDLE_BEFORE_SCAN, SCAN_DURATION, …) and helpers
// (getRandomPhrase, triggerFlash, initParticles, HUD_LOG_SEQ) live in sketch.js
// and other files; we share one global script scope, so they resolve at runtime.

const STALE_MS        = 3000; // ms a subject may stay unmatched before removal (~3s)
const MATCH_DIST_MULT = 1.8;  // gating radius for a match = face size * this

class Subject {
  constructor(id, face) {
    this.id  = id;

    // ── Spatial filters ──────────────────────────────────────────────────────
    this.kx = new Kalman1D(face.x);
    this.ky = new Kalman1D(face.y);
    this.wSpring = new Spring(face.w, { stiffness: 90, damping: 16 });
    this.hSpring = new Spring(face.h, { stiffness: 90, damping: 16 });
    // Smoothed values mirrored here so drawing code can read s.x/s.y/s.w/s.h.
    this.x = face.x; this.y = face.y; this.w = face.w; this.h = face.h;

    this.present  = true;
    this.lastSeen = millis();

    this.state   = 'IDLE';
    this.stateAt = millis();

    // Scan counter + threshold (TESTING: every 2nd scan; for exhibition change
    // nextGayAt increment below to + floor(random(10,16))).
    this.scanCount = 0;
    this.nextGayAt = 2;

    // Text slots
    this.scanLine       = '';
    this.scanLineTimer  = 0;
    this.alarmPrimary   = '';
    this.alarmSub       = '';
    this.alarmNext      = '';
    this.alarmSubTimer  = 0;
    this.straightPhrase = '';
    this.straightSub    = '';
    this.straightNext   = '';

    // Confidence
    this.confidence       = 0;
    this.targetConfidence = 0;

    // Scanning HUD data
    this.hudExpression = '';
    this.hudLogLines   = [];
    this.hudLogTimer   = 0;
    this.hudDataTicker = '';
    this.hudDataTimer  = 0;

    // ── Animation channels ───────────────────────────────────────────────────
    // `fx` holds reveal progress values written by the active Timeline (0→1,
    // may overshoot). `spotSpring` drives the pre-camera spotlight intensity.
    this.fx        = {};
    this.tl        = null;
    this.spotSpring = new Spring(0, { stiffness: 60, damping: 14 });
  }

  // ── Spatial updates ────────────────────────────────────────────────────────

  predict(dt) {            // dt in seconds — runs every render frame
    this.kx.predict(dt);
    this.ky.predict(dt);
  }

  measure(face) {          // runs only on a fresh MediaPipe frame
    this.present  = true;
    this.lastSeen = millis();
    this.kx.correct(face.x);
    this.ky.correct(face.y);
    this.wSpring.target = face.w;
    this.hSpring.target = face.h;
  }

  syncFromFilters() {
    this.x = this.kx.x;
    this.y = this.ky.x;
    this.w = this.wSpring.value;
    this.h = this.hSpring.value;
  }

  // ── State machine ──────────────────────────────────────────────────────────

  enterState(s) {
    this.state   = s;
    this.stateAt = millis();
    this.fx      = {};      // reset reveal channels for the new state
    this.tl      = null;

    if (s === 'SCANNING') {
      this.scanLine         = getRandomPhrase('scanning');
      this.scanLineTimer    = millis();
      this.targetConfidence = 0;
      this.hudLogLines      = [];
      this.hudLogTimer      = millis();
      this.hudExpression    = random(['UNREADABLE', 'NEUTRAL', 'TENSE', 'AMBIGUOUS']);
      this.hudDataTicker    = _randomHex(80);
      this.hudDataTimer     = millis();
      // Reticle + analysis grid wipe in.
      this.tl = new Timeline(this.fx)
        .add('rScan', 0, 1, 0, 520, Easing.outCubic);
    }

    if (s === 'STRAIGHT') {
      this.straightPhrase   = getRandomPhrase('straight');
      this.straightSub      = getRandomPhrase('straightSub');
      this.straightNext     = getRandomPhrase('straightNext');
      this.targetConfidence = floor(random(92, 98));
      // Verdict cascade: rule wipes, sub rises, headline drops in with weight,
      // dismissal fades in last.
      this.tl = new Timeline(this.fx)
        .add('rRule', 0, 1,   0, 360, Easing.outQuart)
        .add('rSub',  0, 1, 140, 380, Easing.outCubic)
        .add('rHead', 0, 1, 220, 540, Easing.outBack)
        .add('rNext', 0, 1, 560, 320, Easing.outCubic);
      triggerFlash();
    }

    if (s === 'ALARM') {
      this.alarmPrimary     = getRandomPhrase('alarm');
      this.alarmSub         = getRandomPhrase('alarmSub');
      this.alarmNext        = getRandomPhrase('alarmNext');
      this.alarmSubTimer    = millis();
      this.targetConfidence = 99;
      // Brief on-canvas eruption before the HTML poster fades over the top.
      this.tl = new Timeline(this.fx)
        .add('rHead',   0, 1,   0, 380, Easing.outBack)
        .add('rRule',   0, 1, 120, 300, Easing.outQuart)
        .add('rSub',    0, 1, 200, 340, Easing.outCubic)
        .add('rCloser', 0, 1, 240, 620, Easing.outBack);
      initParticles();
      triggerFlash();
    }

    if (s === 'IDLE') {
      this.targetConfidence = 0;
    }
  }

  tick() {
    const now     = millis();
    const elapsed = now - this.stateAt;
    const present = this.present;

    if (this.state === 'IDLE') {
      if (present && elapsed > IDLE_BEFORE_SCAN) this.enterState('SCANNING');
      return;
    }

    if (this.state === 'SCANNING') {
      if (elapsed > SCAN_DURATION * 0.85) {
        this.scanLine = 'RESULT IMMINENT';
      } else if (now - this.scanLineTimer > 2200) {
        this.scanLine      = getRandomPhrase('scanning');
        this.scanLineTimer = now;
      }

      if (this.hudLogLines.length < HUD_LOG_SEQ.length && now - this.hudLogTimer > 750) {
        this.hudLogLines.push(_hhmmss() + ' ' + HUD_LOG_SEQ[this.hudLogLines.length]);
        this.hudLogTimer = now;
      }
      if (now - this.hudDataTimer > 320) {
        this.hudDataTicker = _randomHex(80);
        this.hudDataTimer  = now;
      }

      if (!present && elapsed > 2500) { this.enterState('IDLE'); return; }

      if (elapsed > SCAN_DURATION) {
        if (!present) { this.enterState('IDLE'); return; }
        this.scanCount++;
        if (FORCE_ALARM || this.scanCount >= this.nextGayAt) {
          this.nextGayAt = this.scanCount + 2; // TESTING — exhibition: + floor(random(10,16))
          this.enterState('ALARM');
        } else {
          this.enterState('STRAIGHT');
        }
      }
      return;
    }

    if (this.state === 'STRAIGHT') {
      if (elapsed > STRAIGHT_HOLD) this.enterState('IDLE');
      return;
    }

    if (this.state === 'ALARM') {
      if (now - this.alarmSubTimer > 3500) {
        this.alarmSub      = getRandomPhrase('alarmSub');
        this.alarmNext     = getRandomPhrase('alarmNext');
        this.alarmSubTimer = now;
      }
      if (elapsed > ALARM_HOLD) this.enterState('IDLE');
      return;
    }
  }

  updateConfidence() {
    if (this.state === 'SCANNING') {
      const progress = constrain((millis() - this.stateAt) / SCAN_DURATION, 0, 1);
      this.targetConfidence = floor(progress * 94);
    }
    this.confidence += (this.targetConfidence - this.confidence) * 0.06;
  }

  updateFx(dtMs, dt) {
    // Size springs settle toward the latest measurement every frame.
    this.wSpring.update(dt);
    this.hSpring.update(dt);

    // Reveal timeline.
    if (this.tl) this.tl.update(dtMs);

    // Spotlight: ramps with scan progress, full on a verdict, off when idle —
    // the spring smooths the ramp-down so the light fades as someone walks away.
    let spotTarget = 0;
    if (this.state === 'SCANNING') {
      spotTarget = constrain((millis() - this.stateAt) / SCAN_DURATION, 0, 1);
    } else if (this.state === 'STRAIGHT' || this.state === 'ALARM') {
      spotTarget = 1;
    }
    this.spotSpring.target = spotTarget;
    this.spotSpring.update(dt);
  }
}

class FaceTracker {
  constructor() {
    this.subjects = [];
    this._nextId  = 1;
    this._lastFaceFrameId = -1;
  }

  update(detectedFaces, dtMs) {
    const dt = Math.min((dtMs || 16) / 1000, 0.1);

    // 1. Coast every subject forward — smooth motion between measurements.
    for (const s of this.subjects) s.predict(dt);

    // 2. Only re-assign on a fresh MediaPipe measurement. Between those frames
    //    the predicted positions carry the motion, so nothing jitters.
    const fresh = typeof detection !== 'undefined' &&
                  detection.faceFrameId !== this._lastFaceFrameId;
    if (fresh) {
      this._lastFaceFrameId = detection.faceFrameId;
      this._assign(detectedFaces || []);
      this.subjects = this.subjects.filter(s => millis() - s.lastSeen < STALE_MS);
    }

    // 3. Advance filters + state machines + animation every frame.
    for (const s of this.subjects) {
      s.updateFx(dtMs, dt);
      s.syncFromFilters();
      s.tick();
      s.updateConfidence();
    }
  }

  // Greedy predictive assignment: score every subject↔face pair within the
  // gating radius by distance + size mismatch, then take the cheapest pairs
  // first. Using the Kalman-predicted centre makes this robust to crossings.
  _assign(faces) {
    for (const s of this.subjects) s.present = false;

    const pairs = [];
    for (let fi = 0; fi < faces.length; fi++) {
      const f    = faces[fi];
      const size = Math.max(f.w, f.h);
      const gate = size * MATCH_DIST_MULT;
      for (const s of this.subjects) {
        const dx = s.kx.x - f.x, dy = s.ky.x - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > gate) continue;
        const sizeDiff = Math.abs(s.w - f.w) / Math.max(s.w, f.w, 1);
        pairs.push({ s, fi, cost: dist / size + sizeDiff * 0.5 });
      }
    }
    pairs.sort((a, b) => a.cost - b.cost);

    const takenSubj = new Set();
    const takenFace = new Set();
    for (const p of pairs) {
      if (takenSubj.has(p.s.id) || takenFace.has(p.fi)) continue;
      takenSubj.add(p.s.id);
      takenFace.add(p.fi);
      p.s.measure(faces[p.fi]);
    }

    // Unmatched detections become new subjects.
    for (let fi = 0; fi < faces.length; fi++) {
      if (takenFace.has(fi)) continue;
      this.subjects.push(new Subject(this._nextId++, faces[fi]));
    }
  }

  hasAlarm()    { return this.subjects.some(s => s.state === 'ALARM');    }
  hasScanning() { return this.subjects.some(s => s.state === 'SCANNING'); }
  allStraight() {
    return this.subjects.length > 0 && this.subjects.every(s => s.state === 'STRAIGHT');
  }
}

const faceTracker = new FaceTracker();
