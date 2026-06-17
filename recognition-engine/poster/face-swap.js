'use strict';

/**
 * Part 2 — Face Superimposition Pipeline
 *
 * Takes the scanned face from the user's webcam capture and composites
 * it onto the active subject's portrait using the subject's faceAnchors
 * as the target.  Returns a canvas the same size as the original portrait.
 *
 * Pipeline
 *  1. Detect scanned face landmarks → eye centres
 *  2. Compute similarity transform (scale + rotate + translate) so
 *     the scanned eyes land on config.faceAnchors.{left,right}Eye
 *  3. Warp the scanned image onto a canvas sized to the portrait
 *  4. Convert warped face to greyscale; histogram-match to portrait tones
 *  5. Add light film grain
 *  6. Composite through a feathered oval mask derived from faceAnchors.faceOval
 *  7. Return the composited portrait canvas
 */

// ── MediaPipe bootstrapping ──────────────────────────────────────────────

let _faceLandmarker = null;
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const LOCAL_VENDOR  = '../vendor/mediapipe';

async function getFaceLandmarker() {
  if (_faceLandmarker) return _faceLandmarker;

  const { FaceLandmarker, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  ).catch(async () => {
    // Local offline fallback
    const mod = await import(`${LOCAL_VENDOR}/vision_bundle.mjs`);
    return mod;
  });

  const wasmBase = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN).catch(() =>
    FilesetResolver.forVisionTasks(LOCAL_VENDOR)
  );

  _faceLandmarker = await FaceLandmarker.createFromOptions(wasmBase, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    },
    runningMode:         'IMAGE',
    numFaces:            1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  return _faceLandmarker;
}

// ── Eye detection ─────────────────────────────────────────────────────────

// MediaPipe FaceLandmarker landmark indices for iris centres (approx)
const LEFT_IRIS_CENTER  = 468; // left iris centre  (from viewer's perspective = subject's right)
const RIGHT_IRIS_CENTER = 473; // right iris centre (from viewer's perspective = subject's left)

/**
 * @param {HTMLCanvasElement} faceCanvas
 * @returns {Promise<{ leftEye: {x,y}, rightEye: {x,y} } | null>}
 */
async function detectEyes(faceCanvas) {
  let landmarker;
  try {
    landmarker = await getFaceLandmarker();
  } catch {
    return detectEyesFallback(faceCanvas);
  }

  const result = landmarker.detect(faceCanvas);
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;

  const lm = result.faceLandmarks[0];
  const w  = faceCanvas.width;
  const h  = faceCanvas.height;

  // Mirror the x-axis because the webcam is front-facing (mirrored)
  const lc = lm[LEFT_IRIS_CENTER]  ?? lm[33];   // fallback: eye corner
  const rc = lm[RIGHT_IRIS_CENTER] ?? lm[263];

  return {
    leftEye:  { x: (1 - lc.x) * w, y: lc.y * h },
    rightEye: { x: (1 - rc.x) * w, y: rc.y * h },
  };
}

/** Fallback: use simple face-detector keypoints if FaceLandmarker unavailable. */
async function detectEyesFallback(faceCanvas) {
  try {
    const { FaceDetector, FilesetResolver } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    );
    const wasmBase = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);
    const detector = await FaceDetector.createFromOptions(wasmBase, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
      runningMode: 'IMAGE',
    });
    const result = detector.detect(faceCanvas);
    if (!result.detections?.length) return null;

    const kp = result.detections[0].keypoints;
    const w  = faceCanvas.width;
    const h  = faceCanvas.height;
    const le = kp.find(k => k.label === 'leftEye')  ?? kp[0];
    const re = kp.find(k => k.label === 'rightEye') ?? kp[1];
    return {
      leftEye:  { x: (1 - le.x) * w, y: le.y * h },
      rightEye: { x: (1 - re.x) * w, y: re.y * h },
    };
  } catch {
    return null;
  }
}

// ── Geometry ─────────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Compute the similarity transform that maps (srcLeft, srcRight) → (tgtLeft, tgtRight).
 * Returns { scale, rotation, tx, ty } where the transform is:
 *   ctx.translate(tx, ty); ctx.rotate(rotation); ctx.scale(scale, scale);
 *   ctx.drawImage(src, -srcMidX, -srcMidY)
 */
function computeSimilarityTransform(srcLeft, srcRight, tgtLeft, tgtRight) {
  const srcMid = midpoint(srcLeft, srcRight);
  const tgtMid = midpoint(tgtLeft, tgtRight);
  const scale    = dist(tgtLeft, tgtRight) / dist(srcLeft, srcRight);
  const rotation = angle(tgtLeft, tgtRight) - angle(srcLeft, srcRight);
  return { scale, rotation, tx: tgtMid.x, ty: tgtMid.y, srcMidX: srcMid.x, srcMidY: srcMid.y };
}

// ── Image processing ──────────────────────────────────────────────────────

/** Convert all pixels of canvas to greyscale in-place. */
function toGreyscale(canvas) {
  const ctx = canvas.getContext('2d');
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d  = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(id, 0, 0);
}

/** Build a CDF (cumulative distribution function) of pixel luminances 0-255. */
function buildCDF(imageData, mask) {
  const counts = new Float32Array(256);
  const d = imageData.data;
  const hasMask = mask instanceof ImageData;
  let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    const px = i / 4;
    if (hasMask && mask.data[px * 4 + 3] < 128) continue;
    counts[d[i]]++;
    total++;
  }
  const cdf = new Float32Array(256);
  let cum = 0;
  for (let v = 0; v < 256; v++) { cum += counts[v]; cdf[v] = cum / total; }
  return cdf;
}

/** Match the luminance histogram of `src` canvas to `ref` canvas inside faceOval. */
function histogramMatch(srcCanvas, refCanvas, faceOvalPts) {
  const sCtx = srcCanvas.getContext('2d');
  const rCtx = refCanvas.getContext('2d');
  const sData = sCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const rData = rCtx.getImageData(0, 0, refCanvas.width, refCanvas.height);

  const srcCDF = buildCDF(sData);
  const refCDF = buildCDF(rData);

  // Build inverse CDF of reference
  const lut = new Uint8Array(256);
  for (let sv = 0; sv < 256; sv++) {
    let best = 0, bestDiff = Infinity;
    for (let rv = 0; rv < 256; rv++) {
      const diff = Math.abs(refCDF[rv] - srcCDF[sv]);
      if (diff < bestDiff) { bestDiff = diff; best = rv; }
    }
    lut[sv] = best;
  }

  const d = sData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = lut[d[i]];
  }
  sCtx.putImageData(sData, 0, 0);
}

/** Add subtle film grain to canvas. */
function addGrain(canvas, amount = 18) {
  const ctx  = canvas.getContext('2d');
  const id   = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d    = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const noise = (Math.random() - 0.5) * amount;
    d[i]     = Math.min(255, Math.max(0, d[i]     + noise));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
  }
  ctx.putImageData(id, 0, 0);
}

// ── Feathered oval mask ───────────────────────────────────────────────────

/**
 * Create an offscreen canvas containing a soft-edged mask from faceOvalPts.
 * White (fully opaque) at the interior, black (transparent) outside, ~15px feather.
 */
function createFaceMask(w, h, faceOvalPts) {
  const mc = document.createElement('canvas');
  mc.width = w; mc.height = h;
  const mCtx = mc.getContext('2d');

  mCtx.fillStyle = 'black';
  mCtx.fillRect(0, 0, w, h);

  mCtx.beginPath();
  mCtx.moveTo(faceOvalPts[0].x, faceOvalPts[0].y);
  for (let i = 1; i < faceOvalPts.length; i++) {
    const a = faceOvalPts[i];
    const b = faceOvalPts[(i + 1) % faceOvalPts.length];
    mCtx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  mCtx.closePath();
  mCtx.fillStyle = 'white';
  mCtx.fill();

  // Feather by blurring the whole mask canvas
  const blurred = document.createElement('canvas');
  blurred.width = w; blurred.height = h;
  const bCtx = blurred.getContext('2d');
  bCtx.filter = 'blur(15px)';
  bCtx.drawImage(mc, 0, 0);
  bCtx.filter = 'none';

  return blurred;
}

// ── Main pipeline ──────────────────────────────────────────────────────────

/**
 * Swap the user's face onto config's portrait using config.faceAnchors.
 * @param {HTMLCanvasElement} faceCanvas  - Canvas with the user's webcam frame
 * @param {SubjectConfig} config
 * @returns {Promise<HTMLCanvasElement>}  - Composited portrait canvas
 */
async function swapFace(faceCanvas, config) {
  // 1. Detect eye positions in the scanned face
  const eyes = await detectEyes(faceCanvas);
  if (!eyes) throw new Error('NO_FACE_DETECTED');

  // 2. Load the subject portrait
  const portrait = await new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => res(img);
    img.onerror = () => rej(new Error(`Cannot load portrait: ${config.portrait}`));
    img.src = config.portrait;
  });

  const pw = portrait.width;
  const ph = portrait.height;

  // Draw portrait to working canvas
  const portraitCanvas = document.createElement('canvas');
  portraitCanvas.width  = pw;
  portraitCanvas.height = ph;
  const pCtx = portraitCanvas.getContext('2d');
  pCtx.drawImage(portrait, 0, 0);

  // 3. Compute similarity transform
  const T = computeSimilarityTransform(
    eyes.leftEye, eyes.rightEye,
    config.faceAnchors.leftEye, config.faceAnchors.rightEye,
  );

  // 4. Warp scanned face onto a canvas sized to the portrait
  const warpCanvas = document.createElement('canvas');
  warpCanvas.width  = pw;
  warpCanvas.height = ph;
  const wCtx = warpCanvas.getContext('2d');
  wCtx.save();
  wCtx.translate(T.tx, T.ty);
  wCtx.rotate(T.rotation);
  wCtx.scale(T.scale, T.scale);
  wCtx.drawImage(faceCanvas, -T.srcMidX, -T.srcMidY);
  wCtx.restore();

  // 5. Greyscale + histogram match
  toGreyscale(warpCanvas);
  histogramMatch(warpCanvas, portraitCanvas, config.faceAnchors.faceOval);
  addGrain(warpCanvas, 14);

  // 6. Build feathered oval mask
  const maskCanvas = createFaceMask(pw, ph, config.faceAnchors.faceOval);

  // Apply mask to warped face (destination-in clips to mask shape)
  const maskedCanvas = document.createElement('canvas');
  maskedCanvas.width  = pw;
  maskedCanvas.height = ph;
  const mfCtx = maskedCanvas.getContext('2d');
  mfCtx.drawImage(warpCanvas, 0, 0);
  mfCtx.globalCompositeOperation = 'destination-in';
  mfCtx.drawImage(maskCanvas, 0, 0);
  mfCtx.globalCompositeOperation = 'source-over';

  // 7. Composite masked face onto the portrait
  pCtx.drawImage(maskedCanvas, 0, 0);

  return portraitCanvas;
}
