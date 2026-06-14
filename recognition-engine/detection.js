// Motion detection and presence tracking via pixel diff
// Phase 1: no MediaPipe — pure pixel analysis

const MOTION_THRESHOLD = 30;      // per-channel diff to count as changed pixel
const MOTION_PIXEL_RATIO = 0.02;  // fraction of pixels that must change to register motion
const MOTION_HIGH = 0.06;         // fraction above which motion is "high"
const PRESENCE_ZONE_MARGIN = 0.1; // ignore outer 10% of frame edges for presence detection

let prevPixels = null;
let detectionBuffer = null;       // off-screen graphics for pixel sampling

const detection = {
  personDetected: false,
  motionAmount: 0,          // 0–1 normalised
  presenceDuration: 0,      // seconds
  stillnessDuration: 0,     // seconds
  centreX: 0.5,             // normalised 0–1
  centreY: 0.5,
  distanceEstimate: 0.5,    // 0=close 1=distant (rough: based on motion zone size)
  groupState: "none",       // "none" | "single" | "pair" | "group"

  // internal
  _presenceStartTime: null,
  _lastMotionTime: null,
  _motionPixelCount: 0,
  _totalComparedPixels: 0,
};

function initDetection(pg) {
  detectionBuffer = pg;
}

function runDetection(videoCapture) {
  if (!videoCapture || !detectionBuffer) return;

  const w = detectionBuffer.width;
  const h = detectionBuffer.height;

  // Draw video into buffer and load pixels
  detectionBuffer.image(videoCapture, 0, 0, w, h);
  detectionBuffer.loadPixels();
  const currentPixels = detectionBuffer.pixels;

  if (!prevPixels || prevPixels.length !== currentPixels.length) {
    prevPixels = new Uint8ClampedArray(currentPixels);
    return;
  }

  // Pixel diff — compare only the inner zone to ignore edge noise
  const marginX = Math.floor(w * PRESENCE_ZONE_MARGIN);
  const marginY = Math.floor(h * PRESENCE_ZONE_MARGIN);
  let changedPixels = 0;
  let totalPixels = 0;
  let motionSumX = 0;
  let motionSumY = 0;

  for (let y = marginY; y < h - marginY; y += 2) {
    for (let x = marginX; x < w - marginX; x += 2) {
      const idx = (y * w + x) * 4;
      const dr = Math.abs(currentPixels[idx]     - prevPixels[idx]);
      const dg = Math.abs(currentPixels[idx + 1] - prevPixels[idx + 1]);
      const db = Math.abs(currentPixels[idx + 2] - prevPixels[idx + 2]);
      const diff = (dr + dg + db) / 3;

      totalPixels++;
      if (diff > MOTION_THRESHOLD) {
        changedPixels++;
        motionSumX += x;
        motionSumY += y;
      }
    }
  }

  // Save current pixels for next frame
  prevPixels.set(currentPixels);

  const motionRatio = totalPixels > 0 ? changedPixels / totalPixels : 0;
  detection.motionAmount = motionRatio;
  detection._motionPixelCount = changedPixels;
  detection._totalComparedPixels = totalPixels;

  // Presence: anyone is there if motion ratio exceeds a minimum threshold
  // (they don't need to move — we check accumulated presence over time)
  const someonePresent = motionRatio > MOTION_PIXEL_RATIO * 0.3
    || (detection.presenceDuration > 0 && motionRatio > 0.001);

  const now = millis() / 1000;

  if (motionRatio > MOTION_PIXEL_RATIO * 0.3) {
    // Motion seen — someone is in frame
    detection._lastMotionTime = now;
    if (!detection._presenceStartTime) {
      detection._presenceStartTime = now;
    }
  }

  // Decay presence if no motion for 3 seconds
  const timeSinceMotion = detection._lastMotionTime ? now - detection._lastMotionTime : 999;

  if (timeSinceMotion < 3) {
    detection.personDetected = true;
    detection.presenceDuration = detection._presenceStartTime
      ? now - detection._presenceStartTime
      : 0;
  } else {
    // Fading out
    if (detection.personDetected && timeSinceMotion > 3) {
      detection.personDetected = false;
      detection._presenceStartTime = null;
      detection.presenceDuration = 0;
    }
  }

  // Stillness: time since last high motion
  if (motionRatio > MOTION_HIGH) {
    detection.stillnessDuration = 0;
  } else {
    detection.stillnessDuration += deltaTime / 1000;
  }

  // Rough centre of motion
  if (changedPixels > 0) {
    detection.centreX = motionSumX / changedPixels / w;
    detection.centreY = motionSumY / changedPixels / h;
  }

  // Rough distance: if motion occupies a large horizontal span, person is close
  detection.distanceEstimate = 1 - Math.min(motionRatio * 10, 1);

  // Group state — Phase 1 heuristic: if motion is bimodal (two clusters) → pair
  // Simple version: just use single for now; Phase 2 MediaPipe handles multi-person
  detection.groupState = detection.personDetected ? "single" : "none";
}
