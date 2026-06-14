// Detection layer: pixel-diff motion (Phase 1) + MediaPipe face detection (Phase 2)
// Both systems run concurrently. Face detection overrides personCount/groupState
// when MediaPipe is ready; motion diff always supplies motionAmount/stillnessDuration.

const MOTION_THRESHOLD = 30;
const MOTION_PIXEL_RATIO = 0.02;
const MOTION_HIGH = 0.06;
const PRESENCE_ZONE_MARGIN = 0.1;

// Two-tier presence detection:
// INIT_THRESHOLD  — needs real movement to first register someone entering
// SUSTAIN_THRESHOLD — much lower; keeps a still person present via micro-movements
//   (breathing, gaze shifts, hair, fabric). Mobile cameras with noise reduction
//   produce very low diff when still, so this must be well below INIT.
const PRESENCE_INIT_THRESHOLD    = MOTION_PIXEL_RATIO * 0.3; // 0.6% of pixels
const PRESENCE_SUSTAIN_THRESHOLD = MOTION_PIXEL_RATIO * 0.08; // 0.16% of pixels
const PRESENCE_TIMEOUT = 8; // seconds of sub-sustain motion before declaring empty

let prevPixels = null;
let detectionBuffer = null;

const detection = {
  personDetected: false,
  personCount: 0,
  faceDetected: false,
  motionAmount: 0,
  presenceDuration: 0,
  stillnessDuration: 0,
  centreX: 0.5,
  centreY: 0.5,
  distanceEstimate: 0.5,
  gazeApproximation: "uncertain",
  groupState: "none",
  faces: [],                // [{x, y, w, h}] in canvas-space, mirrored coords

  _presenceStartTime: null,
  _lastMotionTime: null,
  _facePresentUntil: 0,    // grace period after last face detection
};

// ─────────────────────────────────────────────
// Phase 1: pixel diff

function initDetection(pg) {
  detectionBuffer = pg;
}

function runDetection(videoCapture) {
  if (!videoCapture || !detectionBuffer) return;
  // Wait for camera to be ready (important on mobile — stream takes a moment)
  if (videoCapture.elt && videoCapture.elt.readyState < 2) return;

  const w = detectionBuffer.width;
  const h = detectionBuffer.height;

  detectionBuffer.image(videoCapture, 0, 0, w, h);
  detectionBuffer.loadPixels();
  const currentPixels = detectionBuffer.pixels;

  if (!prevPixels || prevPixels.length !== currentPixels.length) {
    prevPixels = new Uint8ClampedArray(currentPixels);
    return;
  }

  const marginX = Math.floor(w * PRESENCE_ZONE_MARGIN);
  const marginY = Math.floor(h * PRESENCE_ZONE_MARGIN);
  let changedPixels = 0;
  let totalPixels = 0;
  let motionSumX = 0;
  let motionSumY = 0;

  for (let y = marginY; y < h - marginY; y += 2) {
    for (let x = marginX; x < w - marginX; x += 2) {
      const idx = (y * w + x) * 4;
      const diff = (
        Math.abs(currentPixels[idx]     - prevPixels[idx]) +
        Math.abs(currentPixels[idx + 1] - prevPixels[idx + 1]) +
        Math.abs(currentPixels[idx + 2] - prevPixels[idx + 2])
      ) / 3;

      totalPixels++;
      if (diff > MOTION_THRESHOLD) {
        changedPixels++;
        motionSumX += x;
        motionSumY += y;
      }
    }
  }

  prevPixels.set(currentPixels);

  const motionRatio = totalPixels > 0 ? changedPixels / totalPixels : 0;
  detection.motionAmount = motionRatio;

  if (motionRatio > MOTION_HIGH) {
    detection.stillnessDuration = 0;
  } else {
    detection.stillnessDuration += deltaTime / 1000;
  }

  const now = millis() / 1000;

  if (motionRatio > PRESENCE_INIT_THRESHOLD) {
    // Enough motion to register a new presence
    detection._lastMotionTime = now;
    if (!detection._presenceStartTime) detection._presenceStartTime = now;
  } else if (detection.personDetected && motionRatio > PRESENCE_SUSTAIN_THRESHOLD) {
    // Person is already present — even very slight motion (breathing, micro-shifts)
    // keeps the timer alive. Only fires when already detected, so empty-room
    // camera noise never bootstraps a false presence.
    detection._lastMotionTime = now;
  }

  const timeSinceMotion = detection._lastMotionTime ? now - detection._lastMotionTime : 999;

  // When MediaPipe is active, it owns personDetected/personCount.
  // Motion detection only owns those fields when MediaPipe isn't ready.
  const mpOwnsPresence = mediaPipeReady && now < detection._facePresentUntil + PRESENCE_TIMEOUT;

  if (!mpOwnsPresence) {
    if (timeSinceMotion < PRESENCE_TIMEOUT) {
      detection.personDetected = true;
      detection.personCount = 1;
      detection.presenceDuration = detection._presenceStartTime
        ? now - detection._presenceStartTime
        : 0;
    } else {
      detection.personDetected = false;
      detection.personCount = 0;
      detection._presenceStartTime = null;
      detection.presenceDuration = 0;
    }

    if (changedPixels > 0) {
      detection.centreX = 1 - (motionSumX / changedPixels / w); // mirror x
      detection.centreY = motionSumY / changedPixels / h;
    }
    detection.distanceEstimate = 1 - Math.min(motionRatio * 10, 1);
    detection.groupState = detection.personDetected ? "single" : "none";
    detection.faceDetected = false;
    detection.faces = [];
  }

  // Phase 2 face detection
  runFaceDetection(videoCapture.elt);
}

// ─────────────────────────────────────────────
// Phase 2: MediaPipe face detection

let faceDetector = null;
let mediaPipeReady = false;
let _mpFrameCounter = 0;

// Promise bridge: detection.js (sync script) sets the resolver;
// the type="module" script in index.html calls it once MediaPipe imports.
const _mpReadyPromise = new Promise(resolve => { window._mp_resolve = resolve; });

async function initMediaPipe() {
  try {
    await _mpReadyPromise;

    const FaceDetector = window._mp_FaceDetector;
    const FilesetResolver = window._mp_FilesetResolver;

    if (!FaceDetector || !FilesetResolver) {
      console.warn("Recognition Engine: MediaPipe globals not found, running motion-only.");
      return;
    }

    const _cdnBase = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
    const wasmPath  = window._mp_localVendor
      ? "./vendor/mediapipe/wasm"
      : _cdnBase + "/wasm";
    const modelPath = window._mp_localVendor
      ? "./vendor/mediapipe/models/blaze_face_short_range.tflite"
      : "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });

    mediaPipeReady = true;
    console.log("Recognition Engine: MediaPipe face detection active.");
  } catch (err) {
    console.warn("Recognition Engine: MediaPipe failed, running motion-only.", err);
  }
}

function runFaceDetection(videoEl) {
  if (!mediaPipeReady || !faceDetector || !videoEl) return;
  if (!videoEl.videoWidth || videoEl.readyState < 2) return;

  // Run every 3rd frame — face detection is fast but pixel ops are already heavy
  _mpFrameCounter++;
  if (_mpFrameCounter % 3 !== 0) return;

  let results;
  try {
    results = faceDetector.detectForVideo(videoEl, performance.now());
  } catch (_) {
    return;
  }

  const faces = results.detections || [];
  const vidW = videoEl.videoWidth;
  const vidH = videoEl.videoHeight;
  const now = millis() / 1000;

  detection.personCount = faces.length;
  detection.faceDetected = faces.length > 0;

  if (faces.length > 0) {
    detection._facePresentUntil = now;

    if (!detection._presenceStartTime) detection._presenceStartTime = now;
    detection.personDetected = true;
    detection.presenceDuration = now - detection._presenceStartTime;

    // Build canvas-space face array with mirrored x coordinates
    detection.faces = faces.map(f => {
      const bb = f.boundingBox;
      const cx = 1 - (bb.originX + bb.width  / 2) / vidW; // mirror
      const cy =      (bb.originY + bb.height / 2) / vidH;
      return {
        x: cx * width,
        y: cy * height,
        w: (bb.width  / vidW) * width,
        h: (bb.height / vidH) * height,
      };
    });

    // Use primary (largest) face for position/distance
    const primary = faces.reduce((a, b) =>
      b.boundingBox.width * b.boundingBox.height > a.boundingBox.width * a.boundingBox.height
        ? b : a
    );
    const pb = primary.boundingBox;
    detection.centreX = 1 - (pb.originX + pb.width  / 2) / vidW;
    detection.centreY =      (pb.originY + pb.height / 2) / vidH;
    detection.distanceEstimate = 1 - constrain((pb.height / vidH) * 3, 0, 1);

    // Gaze: use eye + nose keypoints if available
    const kps = primary.keypoints;
    if (kps && kps.length >= 3) {
      const eyeMidX   = (kps[0].x + kps[1].x) / 2;
      const eyeSpan   = Math.abs(kps[1].x - kps[0].x) || 0.01;
      const noseOffset = Math.abs(kps[2].x - eyeMidX) / eyeSpan;
      detection.gazeApproximation =
        noseOffset < 0.3 ? "toward" : noseOffset < 0.6 ? "uncertain" : "away";
    } else {
      detection.gazeApproximation =
        detection.centreX > 0.25 && detection.centreX < 0.75 ? "toward" : "uncertain";
    }

    detection.groupState =
      faces.length === 1 ? "single" :
      faces.length === 2 ? "pair"   : "group";

  } else {
    // No faces — presence decays after a grace period
    const timeSinceFace = now - (detection._facePresentUntil || 0);
    if (timeSinceFace > PRESENCE_TIMEOUT) {
      detection.personDetected = false;
      detection.personCount = 0;
      detection._presenceStartTime = null;
      detection.presenceDuration = 0;
      detection.groupState = "none";
      detection.faces = [];
      detection.gazeApproximation = "uncertain";
    }
  }
}
