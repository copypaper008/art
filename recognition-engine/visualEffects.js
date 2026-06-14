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
  const lineSpacing = 4;
  const lineAlpha = 18;
  stroke(0, lineAlpha);
  strokeWeight(1);
  for (let y = 0; y < height; y += lineSpacing) {
    line(0, y, width, y);
  }
  noStroke();

  // Slow moving brighter scan sweep
  const sweepY = ((frameCount * 0.5) % height);
  stroke(0, 255, 120, 12);
  strokeWeight(2);
  line(0, sweepY, width, sweepY);
  noStroke();
}

function clearGhostTrails() {
  for (const g of ghostTrails) g.remove();
  ghostTrails.length = 0;
}
