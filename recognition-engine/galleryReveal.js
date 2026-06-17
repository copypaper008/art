'use strict';

// ── Full subject configs (mirrors poster/subjects/*.js) ───────────────────────
const GALLERY_CONFIGS = {
  warhol: {
    fileId: 'AW-1928-0601', name: 'WARHOL, ANDY', date: '05.06.2024',
    portrait: './poster/portraits/warhol.jpg',
    imageResolution: '8192 × 10240', mode: 'B&W',
    source: 'ARCHIVAL PHOTOGRAPH c. 1967', scanDepth: '97.2%',
    faceAnchors: {
      leftEye:  { x: 175, y: 298 },
      rightEye: { x: 300, y: 293 },
      faceOval: [
        { x: 248, y: 165 }, { x: 325, y: 190 }, { x: 360, y: 295 },
        { x: 350, y: 390 }, { x: 315, y: 480 }, { x: 248, y: 525 },
        { x: 180, y: 480 }, { x: 140, y: 390 }, { x: 133, y: 295 },
        { x: 168, y: 190 },
      ],
    },
    exhibitionTitle: 'ANDY WARHOL\nRECOGNITION & SIMULATION\nA SOLO EXHIBITION',
    dateRange:       '06.01 — 09.22.2024',
    venue:           'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
    address:         '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',
    stamp: { text: 'HOMOSEXUAL', treatment: 'warhol_pop' },
  },
  haring: {
    fileId: 'KH-1958-0504', name: 'HARING, KEITH', date: '05.06.2024',
    portrait: './poster/portraits/haring.jpg',
    imageResolution: '8192 × 10240', mode: 'B&W',
    source: 'ARCHIVAL PHOTOGRAPH c. 1985', scanDepth: '96.8%',
    faceAnchors: {
      leftEye:  { x: 175, y: 330 },
      rightEye: { x: 297, y: 326 },
      faceOval: [
        { x: 246, y: 205 }, { x: 325, y: 225 }, { x: 355, y: 335 },
        { x: 345, y: 435 }, { x: 310, y: 530 }, { x: 246, y: 575 },
        { x: 182, y: 530 }, { x: 145, y: 435 }, { x: 140, y: 335 },
        { x: 168, y: 225 },
      ],
    },
    exhibitionTitle: 'KEITH HARING\nLINES OF RECOGNITION\nA SOLO EXHIBITION',
    dateRange:       '10.01 — 01.15.2025',
    venue:           'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
    address:         '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',
    stamp: { text: 'HOMOSEXUAL', treatment: 'haring_bold' },
  },
};

// ── Beat durations (ms) ───────────────────────────────────────────────────────
const GB_A     = 1500;   // scan / processing screen
const GB_B     = 3500;   // poster wipes in top-to-bottom
const GB_D     = 900;    // HOMOSEXUAL stamp slams
const GB_HOLD  = 5000;   // dwell on finished poster
const GB_FADE  = 700;    // fade to black

const GB_A_END = GB_A;
const GB_B_END = GB_A + GB_B;
const GB_D_END = GB_B_END + GB_D;
const GB_TOTAL = GB_D_END + GB_HOLD + GB_FADE;

// ── Oval path helper (caller must call ctx.beginPath() first) ─────────────────
function _ovalPath(ctx, oval) {
  ctx.moveTo(oval[0].x, oval[0].y);
  for (let i = 1; i < oval.length; i++) {
    const a = oval[i];
    const b = oval[(i + 1) % oval.length];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  ctx.closePath();
}

// ── Build composited portrait: captured face composited into face oval ────────
// Returns null on any failure — renderPoster will fall back to the portrait URL.
function _buildCompositedPortrait(portImg, anchors, capturedSnap, faceInfo) {
  try {
    // p5.Image stores pixel data on .canvas (HTMLCanvasElement)
    const portSrc = portImg.canvas || portImg.elt || null;
    if (!portSrc) return null;

    const c   = document.createElement('canvas');
    c.width   = portImg.width;
    c.height  = portImg.height;
    const ctx = c.getContext('2d');

    // Portrait base — greyscale + slight contrast
    ctx.filter = 'grayscale(1) contrast(1.05)';
    ctx.drawImage(portSrc, 0, 0);
    ctx.filter = 'none';

    if (capturedSnap && faceInfo && capturedSnap.elt) {
      // Align captured face eyes to portrait face-anchor eyes
      const portEyeMidX = (anchors.leftEye.x + anchors.rightEye.x) / 2;
      const portEyeMidY = (anchors.leftEye.y + anchors.rightEye.y) / 2;
      const portEyeDist = Math.hypot(
        anchors.rightEye.x - anchors.leftEye.x,
        anchors.rightEye.y - anchors.leftEye.y,
      );

      const captEyeX    = faceInfo.x;
      const captEyeY    = faceInfo.y - faceInfo.h * 0.18;
      const faceEyeDist = faceInfo.w * 0.46;
      const faceScale   = portEyeDist / faceEyeDist;

      const dx = portEyeMidX - captEyeX * faceScale;
      const dy = portEyeMidY - captEyeY * faceScale;

      ctx.save();
      ctx.beginPath();
      _ovalPath(ctx, anchors.faceOval);
      ctx.clip();
      ctx.filter = 'grayscale(1) contrast(1.05)';
      ctx.drawImage(
        capturedSnap.elt,
        dx, dy,
        capturedSnap.width  * faceScale,
        capturedSnap.height * faceScale,
      );
      ctx.filter = 'none';
      ctx.restore();
    }

    return c;
  } catch (e) {
    console.warn('GalleryReveal: portrait compositing failed, using plain portrait.', e);
    return null;
  }
}

// ── GalleryReveal ─────────────────────────────────────────────────────────────
class GalleryReveal {
  constructor() {
    this.active       = false;
    this._rendering   = false;
    this.posterCanvas = null;
    this.cardKey      = null;
    this.startMs      = 0;
    this.capturedSnap = null;
    this.faceInfo     = null;
  }

  trigger(subject) {
    if (this.active || this._rendering) return;

    // Freeze a mirrored camera frame so face coords match tracking space
    if (this.capturedSnap) { this.capturedSnap.remove(); this.capturedSnap = null; }
    const snap = createGraphics(width, height);
    snap.pixelDensity(1);
    if (typeof cam !== 'undefined' && cam && cam.elt && cam.elt.readyState >= 2) {
      const sctx = snap.drawingContext;
      sctx.save();
      sctx.translate(width, 0);
      sctx.scale(-1, 1);
      sctx.drawImage(cam.elt, 0, 0, width, height);
      sctx.restore();
    }
    this.capturedSnap = snap;
    this.faceInfo     = { x: subject.x, y: subject.y, w: subject.w, h: subject.h };
    this.cardKey      = subject.subjectKey;
    this.posterCanvas = null;
    this._rendering   = true;

    // Start Beat A immediately — don't wait for the poster to render
    this.startMs = millis();
    this.active  = true;

    // Render poster in the background; Beat A holds until posterCanvas is set
    const config  = GALLERY_CONFIGS[this.cardKey];
    const portImg = _portraitImages[this.cardKey];
    let composited = null;
    if (portImg && portImg.width > 0) {
      composited = _buildCompositedPortrait(portImg, config.faceAnchors, snap, this.faceInfo);
    }
    this._renderPosterAsync(config, composited);
  }

  async _renderPosterAsync(config, composited) {
    try {
      const canvas = document.createElement('canvas');
      await renderPoster(canvas, config, generateDetermination(), composited);
      this.posterCanvas = canvas;
    } catch (err) {
      console.error('GalleryReveal: poster render failed.', err);
    } finally {
      this._rendering = false;
    }
  }

  draw() {
    if (!this.active) return;
    const elapsed = millis() - this.startMs;

    // Poster is 1024:1536 (2:3). Fit to screen with 4% margin on each side.
    const aspect = 1536 / 1024;
    const cw     = Math.min(height * 0.92 / aspect, width * 0.92);
    const ch     = cw * aspect;
    const lx     = (width  - cw) * 0.5;
    const ty     = (height - ch) * 0.5;

    const fadeStart = GB_TOTAL - GB_FADE;
    const fade = elapsed > fadeStart
      ? constrain(map(elapsed, fadeStart, GB_TOTAL, 1, 0), 0, 1)
      : 1;

    drawingContext.globalAlpha = fade;

    if (elapsed < GB_A_END) {
      this._beatA(elapsed / GB_A, lx, ty, cw, ch);
    } else if (elapsed < GB_B_END) {
      if (!this.posterCanvas) {
        // Poster not ready yet — hold on Beat A
        this._beatA(1, lx, ty, cw, ch);
      } else {
        this._beatB((elapsed - GB_A_END) / GB_B, lx, ty, cw, ch);
      }
    } else {
      // Full poster visible
      if (this.posterCanvas) {
        drawingContext.drawImage(this.posterCanvas, lx, ty, cw, ch);
      }
      // Stamp overlaid on top
      this._beatD(elapsed - GB_B_END, lx, ty, cw, ch);
    }

    drawingContext.globalAlpha = 1;

    if (elapsed >= GB_TOTAL) {
      this.active       = false;
      this._rendering   = false;
      this.posterCanvas = null;
      if (this.capturedSnap) { this.capturedSnap.remove(); this.capturedSnap = null; }
    }
  }

  isActive() { return this.active || this._rendering; }

  // ── Beat A: scan / processing screen ─────────────────────────────────────
  _beatA(p, lx, ty, cw, ch) {
    const ctx    = drawingContext;
    const config = GALLERY_CONFIGS[this.cardKey] || {};

    // Dark card
    ctx.fillStyle = 'rgba(6,6,6,0.97)';
    ctx.fillRect(lx, ty, cw, ch);

    // Animated scan line crawling down
    const scanFrac = ((millis() * 0.00022) % 1);
    const scanY    = ty + ch * scanFrac;
    const sg = ctx.createLinearGradient(0, scanY - ch * 0.08, 0, scanY + 3);
    sg.addColorStop(0, 'rgba(220,20,20,0)');
    sg.addColorStop(1, `rgba(220,20,20,${0.22 * p})`);
    ctx.fillStyle = sg;
    ctx.fillRect(lx, Math.max(ty, scanY - ch * 0.08), cw, Math.min(ch * 0.08 + 3, ch));

    // Progress bar at bottom
    ctx.fillStyle = `rgba(220,20,20,${0.85 * p})`;
    ctx.fillRect(lx, ty + ch - 3, cw * _gEaseOut(p), 3);

    // Card border
    ctx.strokeStyle = `rgba(220,20,20,${0.65 * p})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(lx + 1, ty + 1, cw - 2, ch - 2);

    // Center text
    const ta = Math.min(p * 3, 1);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const midX = lx + cw * 0.5;
    const midY = ty + ch * 0.5;

    ctx.font = `bold ${Math.round(cw * 0.038)}px monospace`;
    ctx.fillStyle = `rgba(220,20,20,${ta * 0.9})`;
    ctx.fillText('PROCESSING', midX, midY - ch * 0.04);

    ctx.font = `${Math.round(cw * 0.024)}px monospace`;
    ctx.fillStyle = `rgba(220,20,20,${ta * 0.55})`;
    ctx.fillText(config.name || '', midX, midY + ch * 0.02);

    ctx.font = `bold ${Math.round(cw * 0.065)}px monospace`;
    ctx.fillStyle = `rgba(220,20,20,${ta * 0.45})`;
    ctx.fillText(Math.round(p * 100) + '%', midX, midY + ch * 0.1);
  }

  // ── Beat B: poster wipes in top-to-bottom ────────────────────────────────
  _beatB(p, lx, ty, cw, ch) {
    const ctx = drawingContext;
    const ep  = _gEaseOut(p);

    // Revealed section (clipped)
    if (this.posterCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx, ty, cw, ch * ep);
      ctx.clip();
      ctx.drawImage(this.posterCanvas, lx, ty, cw, ch);
      ctx.restore();
    }

    // Unrevealed section — dark
    if (ep < 0.999) {
      ctx.fillStyle = 'rgba(6,6,6,0.97)';
      ctx.fillRect(lx, ty + ch * ep, cw, ch * (1 - ep) + 1);
    }

    // Glowing wipe edge
    if (ep > 0.01 && ep < 0.999) {
      const edgeY = ty + ch * ep;
      const eg    = ctx.createLinearGradient(0, edgeY - 24, 0, edgeY + 4);
      eg.addColorStop(0, 'rgba(220,20,20,0)');
      eg.addColorStop(1, `rgba(220,20,20,${0.65 * (1 - p)})`);
      ctx.fillStyle = eg;
      ctx.fillRect(lx, Math.max(ty, edgeY - 24), cw, 28);
    }
  }

  // ── Beat D: HOMOSEXUAL stamp slams down ───────────────────────────────────
  _beatD(stampAge, lx, ty, cw, ch) {
    const ANIM = 650;
    const p    = Math.min(stampAge / ANIM, 1);
    if (p <= 0) return;

    let sc;
    if      (p < 0.28) sc = map(p, 0,    0.28, 4.2,  0.84);
    else if (p < 0.52) sc = map(p, 0.28, 0.52, 0.84, 1.07);
    else if (p < 0.72) sc = map(p, 0.52, 0.72, 1.07, 1.00);
    else               sc = 1.00;

    const alpha = Math.min(p / 0.12, 1) * 255;
    if (alpha < 2) return;

    const config    = GALLERY_CONFIGS[this.cardKey];
    const treatment = config.stamp.treatment;
    const fontSize  = cw * 0.95 * sc;
    const angle     = treatment === 'warhol_pop' ? -0.07 : 0.065;

    push();
    translate(lx + cw * 0.5, ty + ch * 0.5);
    rotate(angle);
    textAlign(CENTER, CENTER);
    textFont('Arial');
    textStyle(BOLD);
    textSize(fontSize);

    if (treatment === 'warhol_pop') {
      noStroke();
      fill(0, 200, 220, alpha * 0.55);
      text('HOMOSEXUAL', round(-fontSize * 0.036), round( fontSize * 0.036));
      fill(255, 0, 180, alpha * 0.48);
      text('HOMOSEXUAL', round( fontSize * 0.030), round(-fontSize * 0.026));
      fill(185, 8, 8, alpha * 0.88);
      text('HOMOSEXUAL', 0, 0);
    } else {
      // haring_bold: radiant lines + yellow fill + black outline
      strokeWeight(max(3, fontSize * 0.028));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TWO_PI;
        stroke(220, 40, 40, alpha * 0.28);
        line(cos(a) * fontSize * 0.55, sin(a) * fontSize * 0.28,
             cos(a) * fontSize * 1.5,  sin(a) * fontSize * 0.9);
      }
      strokeWeight(max(2, fontSize * 0.065));
      stroke(0, 0, 0, alpha);
      fill(255, 210, 0, alpha);
      text('HOMOSEXUAL', 0, 0);
      noStroke();
    }

    textStyle(NORMAL);
    pop();
  }
}

function _gEaseOut(t) {
  return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 2.5);
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const galleryReveal = new GalleryReveal();
