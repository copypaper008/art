'use strict';

// ── Subject configs ───────────────────────────────────────────────────────────
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
    dateRange: '06.01 — 09.22.2024',
    venue: 'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
    address: '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',
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
    dateRange: '10.01 — 01.15.2025',
    venue: 'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
    address: '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',
    stamp: { text: 'HOMOSEXUAL', treatment: 'haring_bold' },
  },
};

// ── Beat durations (ms) ───────────────────────────────────────────────────────
const GB_A     = 1500;
const GB_B     = 3500;
const GB_D     = 900;
const GB_HOLD  = 5000;
const GB_FADE  = 700;

const GB_A_END = GB_A;
const GB_B_END = GB_A + GB_B;
const GB_D_END = GB_B_END + GB_D;
const GB_TOTAL = GB_D_END + GB_HOLD + GB_FADE;

// ── Oval path helper ──────────────────────────────────────────────────────────
function _ovalPath(ctx, oval) {
  ctx.moveTo(oval[0].x, oval[0].y);
  for (let i = 1; i < oval.length; i++) {
    const a = oval[i];
    const b = oval[(i + 1) % oval.length];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  ctx.closePath();
}

// ── Composite captured face into the portrait oval of a poster canvas ─────────
// Knows the poster layout constants from renderer.js to find the portrait area.
function _compositeIntoPoster(posterCanvas, portImgW, portImgH, anchors, capturedSnap, faceInfo) {
  try {
    if (!capturedSnap || !capturedSnap.elt || !faceInfo) return;

    // Match renderer.js drawPortrait() layout constants exactly
    const PAD_L = 46, PAD_T = 14, PAD_B = 88;
    const BODY_Y_V = 80, LEFT_W_V = 570, BODY_H_V = 1090;
    const pw = LEFT_W_V - PAD_L - 4;   // 520
    const ph = BODY_H_V - PAD_T - PAD_B; // 988

    const scale = Math.min(pw / portImgW, ph / portImgH);
    const dw    = portImgW * scale;
    const dx    = PAD_L + (pw - dw) / 2;
    const dy    = BODY_Y_V + PAD_T;

    // Transform anchors to poster-canvas space
    const posterOval = anchors.faceOval.map(pt => ({
      x: dx + pt.x * scale, y: dy + pt.y * scale,
    }));
    const lEyePX = dx + anchors.leftEye.x  * scale;
    const lEyePY = dy + anchors.leftEye.y  * scale;
    const rEyePX = dx + anchors.rightEye.x * scale;
    const rEyePY = dy + anchors.rightEye.y * scale;

    const portEyeMidX = (lEyePX + rEyePX) / 2;
    const portEyeMidY = (lEyePY + rEyePY) / 2;
    const portEyeDist = Math.hypot(rEyePX - lEyePX, rEyePY - lEyePY);

    const captEyeX    = faceInfo.x;
    const captEyeY    = faceInfo.y - faceInfo.h * 0.18;
    const faceEyeDist = faceInfo.w * 0.46;
    const faceScale   = portEyeDist / faceEyeDist;

    const faceDX = portEyeMidX - captEyeX * faceScale;
    const faceDY = portEyeMidY - captEyeY * faceScale;

    const ctx = posterCanvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    _ovalPath(ctx, posterOval);
    ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.05)';
    ctx.drawImage(
      capturedSnap.elt,
      faceDX, faceDY,
      capturedSnap.width  * faceScale,
      capturedSnap.height * faceScale,
    );
    ctx.filter = 'none';
    ctx.restore();
  } catch (e) {
    console.warn('_compositeIntoPoster:', e);
  }
}

// ── Fallback poster: drawn directly, no dependency on renderer.js ─────────────
function _buildFallbackPoster(config, portImgCanvas, portImgW, portImgH) {
  const c   = document.createElement('canvas');
  c.width   = 1024;
  c.height  = 1536;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#eae5dc';
  ctx.fillRect(0, 0, 1024, 1536);

  // Top rule
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 2);

  // Header
  ctx.font = 'bold 38px Arial, sans-serif';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SUBJECT ANALYSIS REPORT', 22, 52);
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('FILE ID: ' + config.fileId + '   SUBJECT: ' + config.name + '   DATE: ' + config.date, 22, 68);
  ctx.fillRect(0, 80, 1024, 1);

  // Portrait
  if (portImgCanvas && portImgW > 0 && portImgH > 0) {
    const pw = 520, ph = 988, px = 46, py = 94;
    const sc = Math.min(pw / portImgW, ph / portImgH);
    const dw = portImgW * sc, dh = portImgH * sc;
    const pdx = px + (pw - dw) / 2;
    try {
      ctx.filter = 'grayscale(1) contrast(1.05)';
      ctx.drawImage(portImgCanvas, pdx, py, dw, dh);
      ctx.filter = 'none';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(pdx, py, dw, dh);
    } catch (_) {}
  }

  // Column divider
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(570, 80);
  ctx.lineTo(570, 1170);
  ctx.stroke();

  // Right column — scan status
  const rx = 588;
  ctx.font = '10px "Courier New", monospace';
  ctx.fillStyle = '#000';
  ctx.fillText('ANALYSIS METRICS', rx, 94);
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('SCAN STATUS:', rx, 122);
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.fillText('COMPLETE', rx, 152);

  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('CONFIDENCE:', rx, 196);
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillText('99%', rx, 248);

  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillStyle = '#000';
  ctx.fillRect(rx, 362, 414, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillText('OBSERVED CHARACTERISTICS', rx + 8, 380);

  const chars = [
    'Identity appears partially self-constructed',
    'Sustains public identity through repetition',
    'Occupies multiple cultural registers',
    'Exhibits fascination with visibility',
    'Demonstrates systematic cultural legibility',
    'Engages with commodity structures reflexively',
  ];
  ctx.fillStyle = '#000';
  ctx.font = '11px Arial, sans-serif';
  chars.forEach((ch, i) => {
    ctx.fillText('✓  ' + ch, rx + 8, 402 + i * 28);
  });

  // System note
  ctx.fillRect(0, 1170, 1024, 2);
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('SYSTEM NOTE:', 22, 1196);
  ctx.font = '17px Arial, sans-serif';
  ctx.fillText('The Recognition Engine has determined a result.', 22, 1222);
  ctx.fillText('The Recognition Engine is unable to explain', 22, 1244);
  ctx.fillText('how this conclusion was reached.', 22, 1266);

  // Footer
  ctx.fillRect(0, 1318, 1024, 1);
  const ftLines = config.exhibitionTitle.split('\n');
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText(ftLines[0], 22, 1352);
  ctx.font = '13px Arial, sans-serif';
  ftLines.slice(1).forEach((ln, i) => ctx.fillText(ln, 22, 1374 + i * 18));
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText(config.dateRange, 22, 1420);
  ctx.fillText(config.venue,     22, 1440);
  config.address.split('\n').forEach((ln, i) => ctx.fillText(ln, 22, 1458 + i * 16));

  // Bottom rules
  ctx.fillRect(0, 1533, 1024, 2);
  ctx.fillRect(0, 1535, 1024, 1);

  return c;
}

// ── GalleryReveal ─────────────────────────────────────────────────────────────
class GalleryReveal {
  constructor() {
    this.active         = false;
    this.posterCanvas   = null;
    this.cardKey        = null;
    this.startMs        = 0;
    this.capturedSnap   = null;
    this.faceInfo       = null;
    this._cachedPosters = {};
    this._prerendering  = false;
  }

  // Called from setup() — render both posters while user interaction hasn't started yet
  async prerender() {
    if (this._prerendering) return;
    this._prerendering = true;
    for (const key of Object.keys(GALLERY_CONFIGS)) {
      const config  = GALLERY_CONFIGS[key];
      const portImg = _portraitImages[key];
      let c = null;
      try {
        if (typeof renderPoster === 'function') {
          c = document.createElement('canvas');
          await renderPoster(c, config, generateDetermination(), null);
        }
      } catch (e) {
        console.warn('GalleryReveal: renderPoster failed for', key, '—', e.message);
        c = null;
      }
      if (!c || c.width === 0) {
        const src = portImg && portImg.canvas && portImg.width > 0 ? portImg.canvas : null;
        c = _buildFallbackPoster(config, src, portImg ? portImg.width : 0, portImg ? portImg.height : 0);
      }
      this._cachedPosters[key] = c;
    }
    this._prerendering = false;
  }

  trigger(subject) {
    if (this.active) return;

    // Freeze camera frame
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

    const config  = GALLERY_CONFIGS[this.cardKey];
    const portImg = _portraitImages[this.cardKey];
    const cached  = this._cachedPosters[this.cardKey];

    if (cached) {
      // Copy cached poster so we don't mutate the original
      const c   = document.createElement('canvas');
      c.width   = cached.width;
      c.height  = cached.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(cached, 0, 0);
      // Composite captured face into portrait oval
      if (portImg && portImg.width > 0) {
        _compositeIntoPoster(c, portImg.width, portImg.height, config.faceAnchors, snap, this.faceInfo);
      }
      this.posterCanvas = c;
    } else {
      // Pre-render not finished — show beat A while prerender completes
      this.posterCanvas = null;
    }

    this.startMs = millis();
    this.active  = true;
  }

  draw() {
    if (!this.active) return;
    const elapsed = millis() - this.startMs;

    // While active, check if prerender just finished
    if (!this.posterCanvas) {
      const cached  = this._cachedPosters[this.cardKey];
      const config  = GALLERY_CONFIGS[this.cardKey];
      const portImg = _portraitImages[this.cardKey];
      if (cached) {
        const c   = document.createElement('canvas');
        c.width   = cached.width; c.height = cached.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(cached, 0, 0);
        if (portImg && portImg.width > 0) {
          _compositeIntoPoster(c, portImg.width, portImg.height, config.faceAnchors, this.capturedSnap, this.faceInfo);
        }
        this.posterCanvas = c;
      }
    }

    // Card dimensions — poster is 1024:1536 (2:3)
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
        this._beatA(1, lx, ty, cw, ch);   // hold on Beat A while poster renders
      } else {
        this._beatB((elapsed - GB_A_END) / GB_B, lx, ty, cw, ch);
      }
    } else {
      if (this.posterCanvas) {
        drawingContext.drawImage(this.posterCanvas, lx, ty, cw, ch);
      }
      this._beatD(elapsed - GB_B_END, lx, ty, cw, ch);
    }

    drawingContext.globalAlpha = 1;

    if (elapsed >= GB_TOTAL) {
      this.active       = false;
      this.posterCanvas = null;
      if (this.capturedSnap) { this.capturedSnap.remove(); this.capturedSnap = null; }
    }
  }

  isActive() { return this.active; }

  // ── Beat A: scan / processing screen ─────────────────────────────────────
  _beatA(p, lx, ty, cw, ch) {
    const ctx    = drawingContext;
    const config = GALLERY_CONFIGS[this.cardKey] || {};

    ctx.fillStyle = 'rgba(6,6,6,0.97)';
    ctx.fillRect(lx, ty, cw, ch);

    const scanFrac = ((millis() * 0.00022) % 1);
    const scanY    = ty + ch * scanFrac;
    const sg = ctx.createLinearGradient(0, scanY - ch * 0.08, 0, scanY + 3);
    sg.addColorStop(0, 'rgba(220,20,20,0)');
    sg.addColorStop(1, `rgba(220,20,20,${0.22 * p})`);
    ctx.fillStyle = sg;
    ctx.fillRect(lx, Math.max(ty, scanY - ch * 0.08), cw, Math.min(ch * 0.08 + 3, ch));

    ctx.fillStyle = `rgba(220,20,20,${0.85 * p})`;
    ctx.fillRect(lx, ty + ch - 3, cw * _gEaseOut(p), 3);

    ctx.strokeStyle = `rgba(220,20,20,${0.65 * p})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(lx + 1, ty + 1, cw - 2, ch - 2);

    const ta  = Math.min(p * 3, 1);
    const midX = lx + cw * 0.5;
    const midY = ty + ch * 0.5;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

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

    if (this.posterCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx, ty, cw, ch * ep);
      ctx.clip();
      ctx.drawImage(this.posterCanvas, lx, ty, cw, ch);
      ctx.restore();
    }

    if (ep < 0.999) {
      ctx.fillStyle = 'rgba(6,6,6,0.97)';
      ctx.fillRect(lx, ty + ch * ep, cw, ch * (1 - ep) + 1);
    }

    if (ep > 0.01 && ep < 0.999) {
      const edgeY = ty + ch * ep;
      const eg    = ctx.createLinearGradient(0, edgeY - 24, 0, edgeY + 4);
      eg.addColorStop(0, 'rgba(220,20,20,0)');
      eg.addColorStop(1, `rgba(220,20,20,${0.65 * (1 - p)})`);
      ctx.fillStyle = eg;
      ctx.fillRect(lx, Math.max(ty, edgeY - 24), cw, 28);
    }
  }

  // ── Beat D: stamp ─────────────────────────────────────────────────────────
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

const galleryReveal = new GalleryReveal();
