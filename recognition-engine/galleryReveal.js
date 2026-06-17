'use strict';

// ── Subject pool ─────────────────────────────────────────────────────────────
// Add 'milk', 'baldwin' here (+ portrait in poster/portraits/ + config below)
const GALLERY_POOL = ['warhol', 'haring'];

const GALLERY_CONFIGS = {
  warhol: {
    name:    'WARHOL, ANDY',
    fileId:  'AW-1928-0806',
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
    stamp: {
      text:      'HOMOSEXUAL',
      treatment: 'warhol_pop',
    },
  },
  haring: {
    name:    'HARING, KEITH',
    fileId:  'KH-1958-0504',
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
    stamp: {
      text:      'HOMOSEXUAL',
      treatment: 'haring_bold',
    },
  },
};

// ── Layout ────────────────────────────────────────────────────────────────────
const GALLERY_N     = GALLERY_POOL.length;  // 2 until more portraits are added
const GALLERY_CW    = 0.22;                 // card width as fraction of canvas width
const GALLERY_SLOTS = [
  { x: 0.28, y: 0.50, rot: -2.0 },
  { x: 0.72, y: 0.50, rot:  1.5 },
];

// ── Beat durations (ms) ───────────────────────────────────────────────────────
const GB_A       = 900;    // scan vignette
const GB_B       = 1500;   // portrait builds outside-in
const GB_C       = 1800;   // report assembles
const GB_D       = 700;    // stamp lands
const GB_HOLD    = 2800;   // dwell on finished card
const GB_STAGGER = 450;    // delay between successive card starts

const GB_A_END     = GB_A;
const GB_B_END     = GB_A + GB_B;
const GB_C_END     = GB_A + GB_B + GB_C;
const GB_PER_CARD  = GB_A + GB_B + GB_C + GB_D + GB_HOLD;
const GB_TOTAL     = (GALLERY_N - 1) * GB_STAGGER + GB_PER_CARD;

// ── Oval path helper — caller must call ctx.beginPath() first ─────────────────
function _ovalPath(ctx, oval) {
  ctx.moveTo(oval[0].x, oval[0].y);
  for (let i = 1; i < oval.length; i++) {
    const a = oval[i];
    const b = oval[(i + 1) % oval.length];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  ctx.closePath();
}

// ── Build oval array in card-local coords ─────────────────────────────────────
function _buildOval(anchors, sc, lx, ty) {
  return anchors.faceOval.map(pt => ({
    x: lx + pt.x * sc,
    y: ty + pt.y * sc,
  }));
}

// ── GalleryReveal ─────────────────────────────────────────────────────────────
class GalleryReveal {
  constructor() {
    this.active       = false;
    this.cards        = [];
    this.startMs      = 0;
    this.capturedSnap = null;  // p5.Graphics: mirrored camera freeze
    this.faceInfo     = null;  // { x, y, w, h } in canvas-space (mirrored)
  }

  trigger(subject) {
    if (this.active) return;

    // Freeze a mirrored camera frame — face coords match tracking space
    if (this.capturedSnap) { this.capturedSnap.remove(); this.capturedSnap = null; }
    const snap = createGraphics(width, height);
    snap.pixelDensity(1);
    if (cam && cam.elt && cam.elt.readyState >= 2) {
      const sctx = snap.drawingContext;
      sctx.save();
      sctx.translate(width, 0);
      sctx.scale(-1, 1);
      sctx.drawImage(cam.elt, 0, 0, width, height);
      sctx.restore();
    }
    this.capturedSnap = snap;
    this.faceInfo     = { x: subject.x, y: subject.y, w: subject.w, h: subject.h };

    const shuffled = [...GALLERY_POOL].sort(() => Math.random() - 0.5);
    this.cards = shuffled.slice(0, GALLERY_N).map((key, i) => ({
      key,
      slot:          GALLERY_SLOTS[i] || GALLERY_SLOTS[0],
      startOffset:   i * GB_STAGGER,
      determination: _generateAlarmData(),
    }));

    this.startMs = millis();
    this.active  = true;
  }

  draw() {
    if (!this.active) return;
    const elapsed = millis() - this.startMs;

    const fadeStart = GB_TOTAL - 600;
    const fade = elapsed > fadeStart
      ? constrain(map(elapsed, fadeStart, GB_TOTAL, 1, 0), 0, 1)
      : 1;

    for (const card of this.cards) {
      const age = elapsed - card.startOffset;
      if (age < 0) continue;
      const portImg = _portraitImages[card.key];
      if (!portImg || portImg.width === 0) continue;
      this._drawCard(card, Math.min(age, GB_PER_CARD), portImg, fade);
    }

    if (elapsed >= GB_TOTAL) this.active = false;
  }

  isActive() { return this.active; }

  // ── Card dispatcher ───────────────────────────────────────────────────────
  _drawCard(card, age, portImg, fade) {
    const config  = GALLERY_CONFIGS[card.key];
    const cw      = width  * GALLERY_CW;
    const ch      = cw * 1.5;
    const lx      = -cw / 2;
    const ty      = -ch / 2;
    const sc      = cw / portImg.width;
    const oval    = _buildOval(config.faceAnchors, sc, lx, ty);

    push();
    translate(card.slot.x * width, card.slot.y * height);
    rotate(card.slot.rot * PI / 180);
    drawingContext.globalAlpha = fade;

    if (age < GB_A_END) {
      this._beatA(card, age / GB_A,              lx, ty, cw, ch, config, portImg, sc, oval);
    } else if (age < GB_B_END) {
      this._beatB(card, (age - GB_A_END) / GB_B, lx, ty, cw, ch, config, portImg, sc, oval);
    } else if (age < GB_C_END) {
      this._beatC(card, (age - GB_B_END) / GB_C, lx, ty, cw, ch, config, portImg, sc, oval);
    } else {
      this._beatC(card, 1,                        lx, ty, cw, ch, config, portImg, sc, oval);
      this._beatD(card, age - GB_C_END,           lx, ty, cw, ch, config);
    }

    drawingContext.globalAlpha = 1;
    pop();
  }

  // ── Beat A: scan vignette ─────────────────────────────────────────────────
  _beatA(card, p, lx, ty, cw, ch, config, portImg, sc, oval) {
    const ctx = drawingContext;

    // Dark card background
    ctx.fillStyle = 'rgba(10,10,10,0.92)';
    ctx.fillRect(lx, ty, cw, ch);

    // Vignette circle growing to reveal the captured face
    const r = cw * 0.42 * p;
    if (r > 4 && this.capturedSnap) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -ch * 0.05, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = 'grayscale(1) contrast(1.1)';
      this._drawFace(portImg, sc, lx, ty, config.faceAnchors);
      ctx.filter = 'none';
      ctx.restore();

      // Vignette fade edge
      const grad = ctx.createRadialGradient(0, -ch * 0.05, r * 0.55, 0, -ch * 0.05, r);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.88)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, -ch * 0.05, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red card border, grows in with p
    ctx.strokeStyle = `rgba(${M_RED[0]},${M_RED[1]},${M_RED[2]},${0.55 * p})`;
    ctx.lineWidth   = 1;
    ctx.strokeRect(lx + 1, ty + 1, cw - 2, ch - 2);

    // Subject name + progress
    const a = floor(min(p * 4, 1) * 210);
    noStroke();
    fill(M_RED[0], M_RED[1], M_RED[2], a);
    textFont('monospace');
    textAlign(CENTER, TOP);
    textSize(max(7, cw * 0.048));
    text('PROCESSING  ' + config.name, 0, ty + ch * 0.06);

    textStyle(BOLD);
    textSize(max(16, cw * 0.13));
    textAlign(CENTER, BOTTOM);
    text(floor(p * 100) + '%', 0, ty + ch - ch * 0.05);
    textStyle(NORMAL);

    // Crosshair
    const cg = max(4, cw * 0.04);
    const cl = max(8, cw * 0.1);
    stroke(M_RED[0], M_RED[1], M_RED[2], a * 0.6);
    strokeWeight(1);
    line(-cl, -ch * 0.05, -cg, -ch * 0.05);
    line( cg, -ch * 0.05,  cl, -ch * 0.05);
    line(0, -ch * 0.05 - cl, 0, -ch * 0.05 - cg);
    line(0, -ch * 0.05 + cg, 0, -ch * 0.05 + cl);
    noStroke();
  }

  // ── Beat B: portrait builds outside-in ───────────────────────────────────
  _beatB(card, progress, lx, ty, cw, ch, config, portImg, sc, oval) {
    const ctx   = drawingContext;
    const portH = portImg.height * sc;

    // Cream background
    ctx.fillStyle = '#eae5dc';
    ctx.fillRect(lx, ty, cw, ch);

    // User face inside oval — greyscale, full opacity
    ctx.save();
    ctx.beginPath(); _ovalPath(ctx, oval); ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.05)';
    this._drawFace(portImg, sc, lx, ty, config.faceAnchors);
    ctx.filter = 'none';
    ctx.restore();

    // Portrait hair / clothing outside oval — fades in
    if (progress > 0.02) {
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.beginPath();
      ctx.rect(lx, ty, cw, portH);
      _ovalPath(ctx, oval);
      ctx.clip('evenodd');
      ctx.filter = 'grayscale(1) contrast(1.05)';
      tint(255, 255); image(portImg, lx, ty, cw, portH); noTint();
      ctx.filter = 'none';
      ctx.restore();
    }

    // Portrait face ghost inside oval — morph effect (25% max)
    if (progress > 0.04) {
      ctx.save();
      ctx.globalAlpha = progress * 0.25;
      ctx.beginPath(); _ovalPath(ctx, oval); ctx.clip();
      ctx.filter = 'grayscale(1)';
      tint(255, 255); image(portImg, lx, ty, cw, portH); noTint();
      ctx.filter = 'none';
      ctx.restore();
    }

    // Scan box pinned over face oval
    const anchors = config.faceAnchors;
    const ox1 = lx + Math.min(...anchors.faceOval.map(p => p.x)) * sc;
    const ox2 = lx + Math.max(...anchors.faceOval.map(p => p.x)) * sc;
    const oy1 = ty + Math.min(...anchors.faceOval.map(p => p.y)) * sc;
    const oy2 = ty + Math.max(...anchors.faceOval.map(p => p.y)) * sc;
    noFill();
    stroke(M_RED[0], M_RED[1], M_RED[2], 75 * progress);
    strokeWeight(1);
    rect(ox1, oy1, ox2 - ox1, oy2 - oy1);
    noStroke();

    // Card border
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(lx, ty, cw, ch);
  }

  // ── Beat C: report assembles ──────────────────────────────────────────────
  _beatC(card, progress, lx, ty, cw, ch, config, portImg, sc, oval) {
    const ctx   = drawingContext;
    const portH = portImg.height * sc;

    // Cream background
    ctx.fillStyle = '#eae5dc';
    ctx.fillRect(lx, ty, cw, ch);

    // Portrait outside oval (hair / clothing)
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx, ty, cw, portH);
    _ovalPath(ctx, oval);
    ctx.clip('evenodd');
    ctx.filter = 'grayscale(1) contrast(1.05)';
    tint(255, 255); image(portImg, lx, ty, cw, portH); noTint();
    ctx.filter = 'none';
    ctx.restore();

    // Face in oval (captured)
    ctx.save();
    ctx.beginPath(); _ovalPath(ctx, oval); ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.05)';
    this._drawFace(portImg, sc, lx, ty, config.faceAnchors);
    ctx.filter = 'none';
    ctx.restore();

    // Portrait ghost inside oval (25% morph)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); _ovalPath(ctx, oval); ctx.clip();
    ctx.filter = 'grayscale(1)';
    tint(255, 255); image(portImg, lx, ty, cw, portH); noTint();
    ctx.filter = 'none';
    ctx.restore();

    // ── Report panel ────────────────────────────────────────────────────────
    const anchors  = config.faceAnchors;
    const ovalBot  = ty + Math.max(...anchors.faceOval.map(pt => pt.y)) * sc;
    const panelTop = ovalBot + cw * 0.04;
    const panelBot = ty + ch - cw * 0.02;
    const panelH   = panelBot - panelTop;

    // Semi-transparent dark panel
    const panelA = constrain(progress * 3.5, 0, 1);
    ctx.fillStyle = `rgba(8,8,8,${0.75 * panelA})`;
    ctx.fillRect(lx, panelTop - cw * 0.01, cw, panelH + cw * 0.03);

    // Clip text to panel area
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx, panelTop, cw, panelH);
    ctx.clip();

    const chars    = card.determination?.characteristics || [];
    const N_LINES  = 4 + chars.length + 2;   // header + name + fileId + conf + chars + rule + classif
    const lineReveal = constrain(map(progress, 0, 1, 0, N_LINES + 1), 0, N_LINES + 1);

    let curY = panelTop + cw * 0.03;
    const lh = panelH / (N_LINES + 2);

    const panelLine = (txt, idx, sizeFrac, col, alpha255, bold) => {
      if (lineReveal < idx) return;
      const a = constrain(map(lineReveal, idx, idx + 0.7, 0, 1), 0, 1) * alpha255;
      noStroke();
      if (bold) textStyle(BOLD);
      fill(col[0], col[1], col[2], a);
      textFont('monospace');
      textSize(max(6, cw * sizeFrac));
      textAlign(LEFT, TOP);
      text(txt, lx + cw * 0.05, curY);
      if (bold) textStyle(NORMAL);
      curY += lh;
    };

    const panelRule = idx => {
      if (lineReveal < idx) return;
      const a = constrain(map(lineReveal, idx, idx + 0.4, 0, 1), 0, 1);
      stroke(255, 255, 255, 32 * a);
      strokeWeight(1);
      line(lx + cw * 0.04, curY, lx + cw * 0.96, curY);
      noStroke();
      curY += lh * 0.4;
    };

    panelLine('SUBJECT ANALYSIS REPORT', 0,   0.040, [255, 255, 255], 110,  false);
    panelLine(config.name,               1,   0.065, [255, 255, 255], 240,  true);
    panelLine(config.fileId,             2,   0.039, [M_RED[0], M_RED[1], M_RED[2]], 155, false);
    panelRule(2.5);
    panelLine('CONFIDENCE: ' + (card.determination?.confidence ?? 97) + '%',
                                         3,   0.042, [255, 255, 255], 200,  false);
    panelRule(3.5);
    chars.forEach((ch, i) => {
      panelLine('✓  ' + ch,            4 + i, 0.037, [255, 255, 255], 170, false);
    });
    panelRule(4 + chars.length + 0.2);
    panelLine('CULTURAL ICON',  4 + chars.length + 1, 0.056, [255, 255, 255], 230, true);

    ctx.restore();

    // Card border
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(lx, ty, cw, ch);
  }

  // ── Beat D: stamp ──────────────────────────────────────────────────────────
  _beatD(card, stampAge, lx, ty, cw, ch, config) {
    const ANIM_DUR = 650;
    const p = min(stampAge / ANIM_DUR, 1);

    let sc;
    if      (p < 0.28) sc = map(p, 0,    0.28, 4.2,  0.84);
    else if (p < 0.52) sc = map(p, 0.28, 0.52, 0.84, 1.07);
    else if (p < 0.72) sc = map(p, 0.52, 0.72, 1.07, 1.00);
    else               sc = 1.00;

    const alpha = min(p / 0.12, 1) * 255;
    if (alpha < 2) return;

    const treatment  = config.stamp.treatment;
    const fontSize   = cw * 0.95 * sc;
    const stampAngle = treatment === 'warhol_pop' ? -0.07 : 0.065;

    push();
    rotate(stampAngle);    // already in card-local space centered at (0,0)
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
      const nLines = 18;
      for (let i = 0; i < nLines; i++) {
        const a = (i / nLines) * TWO_PI;
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

  // ── Draw captured face aligned to subject portrait ────────────────────────
  // Must be called inside an active ctx clip region.
  _drawFace(portImg, sc, lx, ty, anchors) {
    if (!this.capturedSnap || !this.faceInfo) {
      // Fallback: show portrait face if no captured snap
      const portH = portImg.height * sc;
      tint(255, 255); image(portImg, lx, ty, portImg.width * sc, portH); noTint();
      return;
    }

    const portEyeMidX = (anchors.leftEye.x + anchors.rightEye.x) / 2;
    const portEyeMidY = (anchors.leftEye.y + anchors.rightEye.y) / 2;
    const portEyeDist = Math.hypot(
      anchors.rightEye.x - anchors.leftEye.x,
      anchors.rightEye.y - anchors.leftEye.y,
    );

    // Target: eye-mid in card-local space
    const cardEyeX = lx + portEyeMidX * sc;
    const cardEyeY = ty + portEyeMidY * sc;

    // Source: approximate eye-mid in captured snap (face centre ≈ eye-mid x)
    const fi          = this.faceInfo;
    const captEyeX    = fi.x;
    const captEyeY    = fi.y - fi.h * 0.18;
    const faceEyeDist = fi.w * 0.46;

    const faceScale = (portEyeDist * sc) / faceEyeDist;
    const dx = cardEyeX - captEyeX * faceScale;
    const dy = cardEyeY - captEyeY * faceScale;

    drawingContext.drawImage(
      this.capturedSnap.elt,
      dx, dy,
      width  * faceScale,
      height * faceScale,
    );
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const galleryReveal = new GalleryReveal();
