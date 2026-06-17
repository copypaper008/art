'use strict';

// ── Animation constants ─────────────────────────────────────────────────────
const MORPH_AMOUNT    = 0.25;   // 0 = pure user face, 1 = full subject — never exceed 0.4
const REVEAL_TOTAL_MS = 4500;   // p: 0 → 1

// Phase gates (normalised 0–1)
const PH = {
  ANCHOR: 0.10,   // face freezes; scan overlays snap on
  FRAME:  0.20,   // portrait grows around face; morph begins; desaturation begins
  POSTER: 0.55,   // poster sections assemble
  STAMP:  0.90,   // stamp lands — sole colour
};

// ── Easing ──────────────────────────────────────────────────────────────────
function _eOut(t)   { return 1 - (1 - t) * (1 - t); }
function _eIO(t)    { return t < 0.5 ? 2*t*t : 1 - (-2*t+2)**2/2; }
function _ph(p,a,b) { return Math.max(0, Math.min(1, (p-a)/(b-a))); }

// ── Stamp thwack scale ──────────────────────────────────────────────────────
function _thwack(p4) {
  if (p4 < 0.28) return 4.2 - (4.2 - 0.84) * (p4 / 0.28);
  if (p4 < 0.52) return 0.84 + (1.07 - 0.84) * ((p4 - 0.28) / 0.24);
  if (p4 < 0.72) return 1.07 - (1.07 - 1.00) * ((p4 - 0.52) / 0.20);
  return 1.00;
}

// ── Stamp renderers (per treatment, sole colour in the poster) ──────────────

function _stampWarholPop(ctx, stamp, p4, W, H) {
  // Silkscreen registration misalignment: cyan + hot-pink offset + red primary
  const sc    = _thwack(p4);
  const shake = p4 < 0.3 ? (Math.random() - 0.5) * 8 * (1 - p4 / 0.3) : 0;
  const alpha = Math.min(p4 / 0.12, 1);
  const fs    = Math.round(W * 0.215 * sc);

  ctx.save();
  ctx.translate(W * 0.5 + shake, H * 0.495 + shake * 0.5);
  ctx.rotate(-0.07);
  ctx.font = `900 ${fs}px "Barlow Condensed", Arial, sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = `rgba(0,200,220,${alpha * 0.70})`;   ctx.fillText(stamp.text, -11,  11);
  ctx.fillStyle = `rgba(255,0,180,${alpha * 0.62})`;   ctx.fillText(stamp.text,   9,  -8);
  ctx.fillStyle = `rgba(185,8,8,${alpha * 0.88})`;     ctx.fillText(stamp.text,   0,   0);
  ctx.restore();
}

function _stampHaringBold(ctx, stamp, p4, W, H) {
  // Yellow fill + thick black outline + radiant Haring lines
  const sc    = _thwack(p4);
  const shake = p4 < 0.3 ? (Math.random() - 0.5) * 8 * (1 - p4 / 0.3) : 0;
  const alpha = Math.min(p4 / 0.12, 1);
  const fs    = Math.round(W * 0.19 * sc);

  ctx.save();
  ctx.translate(W * 0.5 + shake, H * 0.495 + shake * 0.5);
  ctx.rotate(0.065);

  // Radiant lines
  ctx.strokeStyle = `rgba(220,40,40,${alpha * 0.32})`;
  ctx.lineWidth   = 7;
  ctx.lineCap     = 'round';
  const numL = 18;
  for (let i = 0; i < numL; i++) {
    const a = (i / numL) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * fs * 0.55, Math.sin(a) * fs * 0.30);
    ctx.lineTo(Math.cos(a) * W * 0.38,  Math.sin(a) * W * 0.25);
    ctx.stroke();
  }

  ctx.font = `900 ${fs}px "Barlow Condensed", Arial, sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin     = 'round';
  ctx.lineWidth    = fs * 0.09;
  ctx.strokeStyle  = `rgba(0,0,0,${alpha})`;
  ctx.strokeText(stamp.text, 0, 0);
  ctx.fillStyle = `rgba(255,210,0,${alpha})`;
  ctx.fillText(stamp.text, 0, 0);
  ctx.restore();
}

const _STAMPS = {
  warhol_pop:  _stampWarholPop,
  haring_bold: _stampHaringBold,
};

// ── Phase 1 scan overlays ───────────────────────────────────────────────────
function _drawScanOverlays(ctx, p1, dx, dy, dw, dh) {
  const a = _eOut(p1);
  ctx.save();

  // Dashed crosshairs
  const ccx = dx + dw / 2, ccy = dy + dh * 0.44;
  ctx.globalAlpha = a * 0.7;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 0.9;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(dx, ccy); ctx.lineTo(dx + dw, ccy);
  ctx.moveTo(ccx, dy); ctx.lineTo(ccx, dy + dh);
  ctx.stroke();
  ctx.setLineDash([]);

  // Corner brackets (white, snapping in)
  const bm = 14, bl = 22;
  ctx.globalAlpha = a * 0.9;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 2.5;
  [
    [dx + bm,      dy + bm,      1,  1],
    [dx + dw - bm, dy + bm,     -1,  1],
    [dx + bm,      dy + dh - bm, 1, -1],
    [dx + dw - bm, dy + dh - bm,-1, -1],
  ].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * bl, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * bl);
    ctx.stroke();
  });

  // Sweeping scan line
  const sweepY = dy + ((p1 * 3) % 1) * dh;
  ctx.globalAlpha = a * 0.55;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(dx, sweepY); ctx.lineTo(dx + dw, sweepY);
  ctx.stroke();

  ctx.restore();
}

// ── Portrait decorations (no image — called separately to control alpha) ────
function _drawPortraitDecor(ctx, dx, dy, dw, dh) {
  ctx.save();
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
  ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);

  function bracket(x, y, sX, sY) {
    const l = 18;
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x + sX * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sY * l);
    ctx.stroke();
  }
  const m = 8;
  bracket(dx + m,      dy + m,        1,  1);
  bracket(dx + dw - m, dy + m,       -1,  1);
  bracket(dx + m,      dy + dh - m,   1, -1);
  bracket(dx + dw - m, dy + dh - m,  -1, -1);

  ctx.restore();
}

// ── Phase 3 — Poster assembly ───────────────────────────────────────────────
function _drawPosterAssembly(ctx, config, det, p3) {
  // Sub-phase timings within p3 (0→1)
  const hdrP   = _ph(p3, 0.00, 0.18);  // header
  const metP   = _ph(p3, 0.05, 0.42);  // metrics count up
  const charP  = _ph(p3, 0.22, 0.76);  // characteristics, one by one
  const intP   = _ph(p3, 0.62, 0.86);  // machine interpretation
  const clsP   = _ph(p3, 0.80, 0.94);  // classification (hard-cut slam)
  const ftrP   = _ph(p3, 0.85, 1.00);  // system note + footer

  const bg = '#eae5dc';

  if (hdrP > 0) {
    ctx.save(); ctx.globalAlpha = _eOut(hdrP);
    drawHeader(ctx, config);
    ctx.globalAlpha = 1; ctx.restore();
  }

  if (metP > 0) {
    ctx.fillStyle = bg;
    ctx.fillRect(RIGHT_X - 2, S3_Y, RIGHT_W + MARGIN + 4, S3_H);
    const conf = (parseFloat(det.confidence)     * _eOut(metP)).toFixed(2);
    const refl = (parseFloat(det.reflectionScore) * _eOut(metP)).toFixed(1);
    ctx.save(); ctx.globalAlpha = _eOut(metP);
    drawMetrics(ctx, { ...det, confidence: conf, reflectionScore: refl });
    ctx.globalAlpha = 1; ctx.restore();
  }

  if (charP > 0) {
    const n = Math.ceil(charP * det.characteristics.length);
    ctx.fillStyle = bg;
    ctx.fillRect(RIGHT_X - 2, S4_Y, RIGHT_W + MARGIN + 4, S4_H);
    drawCharacteristics(ctx, { ...det, characteristics: det.characteristics.slice(0, n) });
  }

  if (intP > 0) {
    ctx.save(); ctx.globalAlpha = _eOut(intP);
    drawInterpretation(ctx, det);
    ctx.globalAlpha = 1; ctx.restore();
  }

  if (clsP > 0) {
    // Slam: cuts in hard at threshold then eases
    const slamAlpha = clsP < 0.08 ? 1.0 : _eOut(clsP);
    ctx.save(); ctx.globalAlpha = slamAlpha;
    drawClassification(ctx, det);
    ctx.globalAlpha = 1; ctx.restore();
  }

  if (ftrP > 0) {
    ctx.save(); ctx.globalAlpha = _eOut(ftrP);
    drawSystemNote(ctx);
    drawFooter(ctx, config);
    ctx.globalAlpha = 1; ctx.restore();
  }
}

// ── Main frame render ───────────────────────────────────────────────────────
function _frame(ctx, p, state) {
  const { W, H, config, det, img, maskedUser, maskedPortrait,
          dx, dy, dw, dh, iw, ih } = state;

  const p1 = _ph(p, PH.ANCHOR, PH.FRAME);
  const p2 = _ph(p, PH.FRAME,  PH.POSTER);
  const p3 = _ph(p, PH.POSTER, PH.STAMP);
  const p4 = _ph(p, PH.STAMP,  1.0);

  // Background
  ctx.fillStyle = '#eae5dc';
  ctx.fillRect(0, 0, W, H);

  // ── Layer A: Portrait OUTSIDE face oval (hair, turtleneck, shoulders) ────
  // Fades in during Phase 2 from the edges, framing the face
  const layerA = _eOut(p2);
  if (layerA > 0.005 && img) {
    const oval = config.faceAnchors.faceOval;
    const sx = dw / iw, sy = dh / ih;
    ctx.save();
    ctx.globalAlpha = layerA;
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    // Oval path (even-odd clips this out, leaving only the outside)
    ctx.moveTo(dx + oval[0].x * sx, dy + oval[0].y * sy);
    for (let i = 1; i < oval.length; i++) {
      const a = oval[i], b = oval[(i + 1) % oval.length];
      ctx.quadraticCurveTo(
        dx + a.x * sx, dy + a.y * sy,
        dx + (a.x + b.x) * 0.5 * sx, dy + (a.y + b.y) * 0.5 * sy
      );
    }
    ctx.closePath();
    ctx.clip('evenodd');
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Layer B: User face inside oval ───────────────────────────────────────
  // morph animates 0 → MORPH_AMOUNT during Phase 2
  const morphP       = _eIO(p2);
  const currentMorph = MORPH_AMOUNT * morphP;

  // Portrait face at morph fraction (slightly bleeds through)
  if (maskedPortrait && currentMorph > 0.005) {
    ctx.save();
    ctx.globalAlpha = currentMorph;
    ctx.drawImage(maskedPortrait, 0, 0, iw, ih, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // User face (dominant, desaturating from colour to B&W across Phases 1–2)
  const faceAppear = _eOut(_ph(p, 0, PH.ANCHOR + 0.05));
  const desat      = _eOut(_ph(p, PH.ANCHOR, PH.POSTER));  // 0=colour, 1=greyscale
  const saturate   = Math.round((1 - desat) * 100);

  if (maskedUser && faceAppear > 0.005) {
    ctx.save();
    ctx.filter      = `saturate(${saturate}%)`;
    ctx.globalAlpha = (1 - currentMorph) * faceAppear;
    ctx.drawImage(maskedUser, 0, 0, iw, ih, dx, dy, dw, dh);
    ctx.filter      = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (!maskedUser && maskedPortrait && faceAppear > 0.005) {
    // Fallback — no captured face: show portrait face at full opacity
    ctx.save();
    ctx.globalAlpha = faceAppear;
    ctx.drawImage(maskedPortrait, 0, 0, iw, ih, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Portrait decorations (frame, brackets) ────────────────────────────────
  if (layerA > 0.005) {
    ctx.save(); ctx.globalAlpha = layerA;
    _drawPortraitDecor(ctx, dx, dy, dw, dh);
    ctx.globalAlpha = 1; ctx.restore();
  }

  // ── Phase 1 scan overlays ─────────────────────────────────────────────────
  if (p1 > 0 && p1 < 1) _drawScanOverlays(ctx, p1, dx, dy, dw, dh);

  // ── Early header (appears at start of Phase 2) ────────────────────────────
  if (p3 === 0 && p2 > 0) {
    const earlyHdr = _ph(p, PH.FRAME, PH.FRAME + 0.08);
    if (earlyHdr > 0) {
      ctx.save(); ctx.globalAlpha = _eOut(earlyHdr);
      drawHeader(ctx, config);
      ctx.globalAlpha = 1; ctx.restore();
    }
  }

  // ── Phase 3: Poster assembly ──────────────────────────────────────────────
  if (p3 > 0) _drawPosterAssembly(ctx, config, det, p3);

  // ── Layer C: STAMP (sole colour on screen) ────────────────────────────────
  if (p4 > 0 && config.stamp) {
    const renderer = _STAMPS[config.stamp.treatment];
    if (renderer) renderer(ctx, config.stamp, p4, W, H);
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Run the poster reveal animation on `posterCanvas`.
 * Resolves when the animation + hold are complete.
 */
async function runReveal(posterCanvas, config, determination, capturedFaceDataUrl) {
  await document.fonts.ready;

  const W = POSTER_W, H = POSTER_H;
  posterCanvas.width  = W;
  posterCanvas.height = H;
  const ctx = posterCanvas.getContext('2d');

  // 1. Load portrait image
  const img = await loadImage(config.portrait);
  const iw  = img.naturalWidth  || img.width  || 684;
  const ih  = img.naturalHeight || img.height || 816;

  // 2. Portrait layout (mirrors renderer.js drawPortrait)
  const PAD_L = 46, PAD_T = 14, PAD_B = 88;
  const bw = LEFT_W - PAD_L - 4, bh = BODY_H - PAD_T - PAD_B;
  const fitSc = Math.min(bw / iw, bh / ih);
  const dw = iw * fitSc, dh = ih * fitSc;
  const dx = PAD_L + (bw - dw) / 2, dy = BODY_Y + PAD_T;

  // 3. Face oval mask at portrait native resolution
  const ovalMask = createFaceMask(iw, ih, config.faceAnchors.faceOval);

  // 4. Masked portrait face (morph target) — B&W portrait clipped to oval
  const maskedPortrait = document.createElement('canvas');
  maskedPortrait.width = iw; maskedPortrait.height = ih;
  { const c = maskedPortrait.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(ovalMask, 0, 0); }

  // 5. Eye-align captured face → portrait space; add grain; mask to oval
  let maskedUser = null;
  if (capturedFaceDataUrl) {
    try {
      const srcImg = new Image();
      await new Promise((res, rej) => { srcImg.onload = res; srcImg.onerror = rej; srcImg.src = capturedFaceDataUrl; });
      const srcC = document.createElement('canvas');
      srcC.width = srcImg.width; srcC.height = srcImg.height;
      srcC.getContext('2d').drawImage(srcImg, 0, 0);

      const eyes = await detectEyes(srcC);
      if (eyes) {
        const T = computeSimilarityTransform(
          eyes.leftEye, eyes.rightEye,
          config.faceAnchors.leftEye, config.faceAnchors.rightEye
        );
        const warpC = document.createElement('canvas');
        warpC.width = iw; warpC.height = ih;
        const wCtx = warpC.getContext('2d');
        wCtx.save();
        wCtx.translate(T.tx, T.ty);
        wCtx.rotate(T.rotation);
        wCtx.scale(T.scale, T.scale);
        wCtx.drawImage(srcC, -T.srcMidX, -T.srcMidY);
        wCtx.restore();
        addGrain(warpC, 12);  // grain — greyscale applied per-frame via ctx.filter

        maskedUser = document.createElement('canvas');
        maskedUser.width = iw; maskedUser.height = ih;
        { const c = maskedUser.getContext('2d');
          c.drawImage(warpC, 0, 0);
          c.globalCompositeOperation = 'destination-in';
          c.drawImage(ovalMask, 0, 0); }
      }
    } catch (e) { console.warn('[reveal] face align failed:', e); }
  }

  // 6. Animate
  const state = {
    W, H, config, det: determination, img,
    maskedUser, maskedPortrait,
    dx, dy, dw, dh, iw, ih,
  };

  const startMs = performance.now();
  const holdMs  = 3000;  // hold after stamp before resolving

  return new Promise(resolve => {
    let active = true;
    function tick(now) {
      if (!active) return;
      const elapsed = now - startMs;
      const p = Math.min(elapsed / REVEAL_TOTAL_MS, 1);
      _frame(ctx, p, state);
      if (elapsed < REVEAL_TOTAL_MS + holdMs) requestAnimationFrame(tick);
      else { active = false; resolve(); }
    }
    requestAnimationFrame(tick);
    // expose cancel
    posterCanvas._cancelReveal = () => { active = false; resolve(); };
  });
}
