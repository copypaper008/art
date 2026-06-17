// Animation layer — easing, springs, timelines, and a Kalman tracker.
//
// This is the engine that makes state transitions land instead of pop. Three
// tools, each for a different job:
//
//   Easing    — named curves (the vocabulary every motion below speaks in).
//   Spring    — a critically-damped value that chases a moving target. Used for
//               continuous channels (spotlight intensity, box size) that must
//               survive interruption gracefully when people enter / leave frame.
//   Timeline  — an orchestrated one-shot: multiple channels, each with its own
//               delay / duration / easing. Used for the verdict reveals so the
//               rule, sub-line, headline and closer cascade in with weight.
//   Kalman1D  — constant-velocity filter, smooths + predicts face position so
//               the reticle stops lagging behind and IDs stop swapping.
//
// Loaded before faceTracker.js / sketch.js; everything here is global on purpose
// (the rest of the codebase shares one script scope — no modules).

// ─────────────────────────────────────────────────────────────────────────────
// Easing — t is normalised 0..1; back / elastic intentionally over/undershoot.

const Easing = {
  linear:    t => t,
  inQuad:    t => t * t,
  outQuad:   t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic:   t => t * t * t,
  outCubic:  t => 1 - Math.pow(1 - t, 3),
  inOutCubic:t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart:  t => 1 - Math.pow(1 - t, 4),
  outExpo:   t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  // Overshoot — lands past the target then settles. The "weight" curves.
  outBack:   (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic:t => {
    if (t === 0 || t === 1) return t;
    const p = 0.35;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d)       return n * t * t;
    if (t < 2 / d)       return n * (t -= 1.5  / d) * t + 0.75;
    if (t < 2.5 / d)     return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Spring — critically-damped chase toward a target. dt is in seconds.
//
// Retargets cleanly mid-flight (no restart pop), which is what we want when a
// subject jumps state or a face reappears. stiffness/damping tuned for a quick
// settle with a faint, expensive-feeling overshoot.

class Spring {
  constructor(value = 0, { stiffness = 120, damping = 18 } = {}) {
    this.value     = value;
    this.target    = value;
    this.velocity  = 0;
    this.stiffness = stiffness;
    this.damping   = damping;
  }

  set(value) { this.value = value; this.target = value; this.velocity = 0; }

  update(dt) {
    // Clamp dt so a stalled tab / first frame can't fling the spring.
    dt = Math.min(dt, 0.05);
    const a = this.stiffness * (this.target - this.value) - this.damping * this.velocity;
    this.velocity += a * dt;
    this.value    += this.velocity * dt;
    return this.value;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline — orchestrated one-shot reveal over named channels.
//
// Writes eased values straight into a target object (the Subject's `fx`).
// Tracks may overlap; each has its own start offset + duration + easing, so a
// verdict can cascade: rule wipes, sub fades up, headline drops in with bounce.
// Channel values can exceed [0,1] when the easing overshoots — drawing code
// clamps for alpha but uses the raw value for position to keep the overshoot.

class Timeline {
  constructor(target) {
    this.target = target;
    this.tracks = [];
    this.t      = 0;
    this.span   = 0;
  }

  // key on target, from→to, start & duration in ms, easing fn.
  add(key, from, to, start, duration, easing = Easing.outCubic) {
    this.tracks.push({ key, from, to, start, duration, easing });
    this.target[key] = from;               // seed so frame 0 reads correctly
    this.span = Math.max(this.span, start + duration);
    return this;                           // chainable
  }

  update(dtMs) {
    this.t += dtMs;
    for (const tr of this.tracks) {
      const local = this.t - tr.start;
      if (local <= 0) { this.target[tr.key] = tr.from; continue; }
      const p = Math.min(local / tr.duration, 1);
      this.target[tr.key] = tr.from + (tr.to - tr.from) * tr.easing(p);
    }
    return this;
  }

  get done() { return this.t >= this.span; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tween — a single global one-shot, for screen-wide effects (the flash).
// A tiny manager ticks all live tweens once per frame from sketch.js.

const _activeTweens = [];

function tween({ from = 0, to = 1, duration = 400, delay = 0,
                 easing = Easing.outCubic, onUpdate, onComplete }) {
  const tw = { from, to, duration, delay, easing, onUpdate, onComplete,
               t: 0, value: from, done: false };
  _activeTweens.push(tw);
  return tw;
}

function updateTweens(dtMs) {
  for (let i = _activeTweens.length - 1; i >= 0; i--) {
    const tw = _activeTweens[i];
    tw.t += dtMs;
    const local = tw.t - tw.delay;
    if (local < 0) continue;
    const p = Math.min(local / tw.duration, 1);
    tw.value = tw.from + (tw.to - tw.from) * tw.easing(p);
    if (tw.onUpdate) tw.onUpdate(tw.value);
    if (p >= 1) {
      tw.done = true;
      if (tw.onComplete) tw.onComplete();
      _activeTweens.splice(i, 1);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Kalman1D — constant-velocity filter (state = [position, velocity]).
//
// One per spatial axis. predict() coasts the estimate forward by dt; correct()
// folds in a fresh measurement. Because MediaPipe only reports every 3rd frame,
// predict() runs every frame and correct() only on measurement frames — so the
// reticle glides smoothly between detections and even leads fast motion slightly
// instead of snapping. Velocity also makes frame-to-frame matching robust to
// people crossing paths.

class Kalman1D {
  constructor(value = 0, { processNoise = 80, measurementNoise = 6 } = {}) {
    this.x = value;   // position estimate
    this.v = 0;       // velocity estimate
    // Covariance matrix P (2x2), error in [pos, vel].
    this.P = [[1, 0], [0, 1]];
    this.q = processNoise;       // trust in the motion model (higher = more agile)
    this.r = measurementNoise;   // trust in measurements   (higher = smoother)
  }

  predict(dt) {
    dt = Math.min(dt, 0.1);
    // State: x += v*dt
    this.x += this.v * dt;
    // P = F P Fᵀ + Q,  F = [[1,dt],[0,1]]
    const [[p00, p01], [p10, p11]] = this.P;
    const n00 = p00 + dt * (p10 + p01) + dt * dt * p11;
    const n01 = p01 + dt * p11;
    const n10 = p10 + dt * p11;
    const n11 = p11;
    this.P = [
      [n00 + this.q * dt, n01],
      [n10,               n11 + this.q * dt],
    ];
  }

  correct(z) {
    // Measure position only: H = [1, 0]
    const S = this.P[0][0] + this.r;       // innovation covariance
    const k0 = this.P[0][0] / S;           // Kalman gain (position)
    const k1 = this.P[1][0] / S;           // Kalman gain (velocity)
    const y  = z - this.x;                 // innovation
    this.x += k0 * y;
    this.v += k1 * y;
    // P = (I - K H) P
    const [[p00, p01], [p10, p11]] = this.P;
    this.P = [
      [(1 - k0) * p00, (1 - k0) * p01],
      [p10 - k1 * p00, p11 - k1 * p01],
    ];
  }
}
