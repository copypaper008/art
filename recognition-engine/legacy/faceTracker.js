// Per-face subject tracking with individual state machines
// Constants IDLE_BEFORE_SCAN, SCAN_DURATION, etc. are defined in sketch.js
// and are available at call time (both files share global scope).

const STALE_FRAMES    = 90;   // frames before removing a subject no longer in frame (~3s at 30fps)
const MATCH_DIST_MULT = 1.8;  // max matching distance = face.w * this

class Subject {
  constructor(id, face) {
    this.id  = id;
    this.age = 0;
    this.x = face.x; this.y = face.y;
    this.w = face.w; this.h = face.h;

    this.state   = 'IDLE';
    this.stateAt = millis();

    // Scan counter + gay threshold (TESTING: every 2nd scan; change to floor(random(10,16)) for exhibition)
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
  }

  updateFace(face) {
    this.age = 0;
    this.x = lerp(this.x, face.x, 0.35);
    this.y = lerp(this.y, face.y, 0.35);
    this.w = lerp(this.w, face.w, 0.35);
    this.h = lerp(this.h, face.h, 0.35);
  }

  enterState(s) {
    this.state   = s;
    this.stateAt = millis();

    if (s === 'SCANNING') {
      this.scanLine       = getRandomPhrase('scanning');
      this.scanLineTimer  = millis();
      this.targetConfidence = 0;
      this.hudLogLines    = [];
      this.hudLogTimer    = millis();
      this.hudExpression  = random(['UNREADABLE', 'NEUTRAL', 'TENSE', 'AMBIGUOUS']);
      this.hudDataTicker  = _randomHex(80);
      this.hudDataTimer   = millis();
    }
    if (s === 'STRAIGHT') {
      this.straightPhrase   = getRandomPhrase('straight');
      this.straightSub      = getRandomPhrase('straightSub');
      this.straightNext     = getRandomPhrase('straightNext');
      this.targetConfidence = floor(random(92, 98));
      triggerFlash();
    }
    if (s === 'ALARM') {
      this.alarmPrimary     = getRandomPhrase('alarm');
      this.alarmSub         = getRandomPhrase('alarmSub');
      this.alarmNext        = getRandomPhrase('alarmNext');
      this.alarmSubTimer    = millis();
      this.targetConfidence = 99;
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
    const present = this.age === 0;

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
        if (this.scanCount >= this.nextGayAt) {
          this.nextGayAt = this.scanCount + 2; // TESTING — change to + floor(random(10,16)) for exhibition
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
}

class FaceTracker {
  constructor() {
    this.subjects = [];
    this._nextId  = 1;
  }

  update(detectedFaces) {
    // Age all subjects — those not matched this frame will eventually be removed
    for (const s of this.subjects) s.age++;

    // Match each detected face to the nearest existing subject
    const matched = new Set();
    for (const face of detectedFaces) {
      let best = null, bestDist = Infinity;
      for (const s of this.subjects) {
        if (matched.has(s.id)) continue;
        const dx = s.x - face.x, dy = s.y - face.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        const threshold = Math.max(face.w, face.h) * MATCH_DIST_MULT;
        if (d < threshold && d < bestDist) { bestDist = d; best = s; }
      }
      if (best) {
        matched.add(best.id);
        best.updateFace(face);
      } else {
        const s = new Subject(this._nextId++, face);
        this.subjects.push(s);
        matched.add(s.id);
      }
    }

    // Remove subjects that have been absent too long
    this.subjects = this.subjects.filter(s => s.age < STALE_FRAMES);

    // Advance each subject's state machine
    for (const s of this.subjects) {
      s.tick();
      s.updateConfidence();
    }
  }

  hasAlarm()    { return this.subjects.some(s => s.state === 'ALARM');    }
  hasScanning() { return this.subjects.some(s => s.state === 'SCANNING'); }
  allStraight() {
    return this.subjects.length > 0 && this.subjects.every(s => s.state === 'STRAIGHT');
  }
}

const faceTracker = new FaceTracker();
