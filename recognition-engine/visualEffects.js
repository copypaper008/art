// Visual effects: mirror, scan lines, ghost trails, pixel ripple

const GHOST_FRAMES = 8;
const ghostTrails = [];

let ripplePhase = 0;
let rippleBuffer = null;
let mirrorBuffer = null;

function initVisuals(w, h) {
  mirrorBuffer = createGraphics(w, h);
  rippleBuffer = createGraphics(w, h);
  mirrorBuffer.pixelDensity(1);
  rippleBuffer.pixelDensity(1);
}

// Draw the mirrored, distorted camera feed
function drawDistortedMirror(videoCapture, motionAmount, state) {
  if (!videoCapture || !mirrorBuffer) return;

  mirrorBuffer.push();
  mirrorBuffer.translate(mirrorBuffer.width, 0);
  mirrorBuffer.scale(-1, 1);
  mirrorBuffer.image(videoCapture, 0, 0, mirrorBuffer.width, mirrorBuffer.height);
  mirrorBuffer.pop();

  // Apply pixel-level ripple distortion
  const amplitude = map(motionAmount, 0, 0.15, 2, 22, true);
  ripplePhase += 0.04;
  applyRipple(mirrorBuffer, rippleBuffer, amplitude);

  // Draw base layer — ghost trails first
  for (let i = 0; i < ghostTrails.length; i++) {
    const alpha = map(i, 0, ghostTrails.length, 5, 25);
    tint(255, alpha);
    image(ghostTrails[i], 0, 0);
  }
  noTint();

  // Draw current distorted frame at low opacity
  const baseOpacity = state === "EMPTY" ? 60 : state === "FADING" ? 80 : 120;
  tint(255, baseOpacity);
  image(rippleBuffer, 0, 0);
  noTint();

  // Store this frame as ghost trail
  if (frameCount % 3 === 0) {
    if (ghostTrails.length >= GHOST_FRAMES) {
      ghostTrails.shift();
    }
    const snapshot = createGraphics(width, height);
    snapshot.image(rippleBuffer, 0, 0);
    ghostTrails.push(snapshot);
  }
}

function applyRipple(src, dst, amplitude) {
  src.loadPixels();
  dst.loadPixels();

  const w = src.width;
  const h = src.height;

  for (let y = 0; y < h; y++) {
    const offsetX = Math.floor(sin(y * 0.03 + ripplePhase) * amplitude);
    for (let x = 0; x < w; x++) {
      const srcX = constrain(x + offsetX, 0, w - 1);
      const srcIdx = (y * w + srcX) * 4;
      const dstIdx = (y * w + x) * 4;
      dst.pixels[dstIdx]     = src.pixels[srcIdx];
      dst.pixels[dstIdx + 1] = src.pixels[srcIdx + 1];
      dst.pixels[dstIdx + 2] = src.pixels[srcIdx + 2];
      dst.pixels[dstIdx + 3] = src.pixels[srcIdx + 3];
    }
  }

  dst.updatePixels();
}

function drawScanLines() {
  // uiScale is a global set each frame in sketch.js
  const lineSpacing = Math.max(2, Math.round(4 * uiScale));
  const lineAlpha = 18;
  stroke(0, lineAlpha);
  strokeWeight(1);
  for (let y = 0; y < height; y += lineSpacing) {
    line(0, y, width, y);
  }
  noStroke();

  const sweepY = ((frameCount * 0.5) % height);
  stroke(0, 255, 120, 12);
  strokeWeight(Math.max(1, Math.round(2 * uiScale)));
  line(0, sweepY, width, sweepY);
  noStroke();
}

function clearGhostTrails() {
  for (const g of ghostTrails) g.remove();
  ghostTrails.length = 0;
}

// ─────────────────────────────────────────────
// Face overlays (Phase 2)
// Draws subtle glow boundaries around detected faces and a connection
// line between subjects in the RELATIONAL state.

function drawFaceOverlays(faces, state, personCount) {
  if (!faces || faces.length === 0) return;

  noFill();
  strokeWeight(1);

  // Soft glow rectangle around each face
  for (const face of faces) {
    const flicker = state === "MISREADING" ? random(0.4, 1.0) : random(0.8, 1.0);

    // Outer soft halo
    stroke(0, 255, 120, 12 * flicker);
    strokeWeight(8);
    rect(face.x - face.w * 0.6, face.y - face.h * 0.65, face.w * 1.2, face.h * 1.3, 4);

    // Inner line
    stroke(0, 255, 120, 25 * flicker);
    strokeWeight(1);
    rect(face.x - face.w * 0.55, face.y - face.h * 0.6, face.w * 1.1, face.h * 1.2, 2);

    // Corner tick marks (top-left and bottom-right only, like a targeting reticle)
    const tlx = face.x - face.w * 0.55;
    const tly = face.y - face.h * 0.6;
    const brx = tlx + face.w * 1.1;
    const bry = tly + face.h * 1.2;
    const tick = Math.round(10 * uiScale);
    stroke(0, 255, 120, 50 * flicker);
    strokeWeight(Math.max(1, Math.round(uiScale)));
    // top-left
    line(tlx, tly, tlx + tick, tly);
    line(tlx, tly, tlx, tly + tick);
    // bottom-right
    line(brx - tick, bry, brx, bry);
    line(brx, bry - tick, brx, bry);
  }

  // RELATIONAL: connection line between face centres
  if (personCount >= 2 && faces.length >= 2) {
    const t = millis() * 0.001;
    for (let i = 0; i < faces.length - 1; i++) {
      const a = faces[i];
      const b = faces[i + 1];

      // Animated dashed connection — draw short segments that travel between faces
      const segments = 12;
      for (let s = 0; s < segments; s++) {
        const tStart = (s / segments + t * 0.1) % 1;
        const tEnd   = tStart + 0.04;
        const x1 = lerp(a.x, b.x, tStart);
        const y1 = lerp(a.y, b.y, tStart);
        const x2 = lerp(a.x, b.x, min(tEnd, 1));
        const y2 = lerp(a.y, b.y, min(tEnd, 1));
        const segAlpha = 40 * sin(s / segments * PI);
        stroke(255, 255, 255, segAlpha);
        strokeWeight(1);
        line(x1, y1, x2, y2);
      }
    }
  }

  noStroke();
}
