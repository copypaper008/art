(function () {
'use strict';

// ── Canvas dimensions ───────────────────────────────────────────────────
const POSTER_W = 1024;
const POSTER_H = 1536;

// ── Layout ──────────────────────────────────────────────────────────────
const MARGIN    = 22;
const HEADER_H  = 80;
const FOOT_H    = 218;
const SYS_H     = 148;
const SYS_Y     = POSTER_H - FOOT_H - SYS_H;   // 1170
const FOOT_Y    = SYS_Y + SYS_H;               // 1318
const BODY_Y    = HEADER_H;                    // 80
const BODY_H    = SYS_Y - BODY_Y;             // 1090

const LEFT_W    = 570;
const GAP       = 18;
const RIGHT_X   = LEFT_W + GAP;               // 588
const RIGHT_W   = POSTER_W - RIGHT_X - MARGIN; // 414

// Right column section heights (must sum to BODY_H = 1090)
const S3_H = 252;
const S4_H = 282;
const S5_H = 196;
const S6_H = BODY_H - S3_H - S4_H - S5_H;    // 360

const S3_Y = BODY_Y;
const S4_Y = S3_Y + S3_H;
const S5_Y = S4_Y + S4_H;
const S6_Y = S5_Y + S5_H;

// ── Palette ─────────────────────────────────────────────────────────────
const C = {
  BG:    '#eae5dc',
  BLACK: '#000000',
  WHITE: '#ffffff',
  GRAY:  '#777777',
  LGRAY: '#bbbbbb',
  RULE:  '#000000',
};

// ── Font helpers ─────────────────────────────────────────────────────────
const FD  = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const FM  = "'IBM Plex Mono', 'Courier New', monospace";

function fnt(size, weight = 400, family = FD) {
  return `${weight} ${size}px ${family}`;
}

// ── Primitive helpers ────────────────────────────────────────────────────

function fill(ctx, x, y, w, h, col = C.BLACK) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

function hline(ctx, x1, y, x2, lw = 1, col = C.BLACK) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y + 0.5);
  ctx.lineTo(x2, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

function vline(ctx, x, y1, y2, lw = 1, col = C.BLACK) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y1);
  ctx.lineTo(x + 0.5, y2);
  ctx.stroke();
  ctx.restore();
}

function orect(ctx, x, y, w, h, lw = 1, col = C.BLACK) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// text(ctx, str, x, y, options)
function txt(ctx, str, x, y, opts = {}) {
  const {
    size = 10, weight = 400, family = FD,
    col = C.BLACK, align = 'left', base = 'alphabetic',
    ls = 0,   // letter-spacing in px
  } = opts;
  ctx.save();
  ctx.font = fnt(size, weight, family);
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (ls) {
    let cx = align === 'center'
      ? x - (measureStr(ctx, str, ls)) / 2
      : align === 'right'
        ? x - measureStr(ctx, str, ls)
        : x;
    for (const ch of str) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + ls;
    }
  } else {
    ctx.fillText(str, x, y);
  }
  ctx.restore();
}

function measureStr(ctx, str, ls) {
  let w = 0;
  for (const ch of str) w += ctx.measureText(ch).width + ls;
  return w - ls;
}

// ── Decorative elements ──────────────────────────────────────────────────

function drawBarcode(ctx, x, y, w, h) {
  let seed = 0x9e3779b9;
  function next() {
    seed = (Math.imul(seed, 0x6b43a9b5) + 0x1) >>> 0;
    return seed / 0xffffffff;
  }
  let cx = x;
  let dark = true;
  while (cx < x + w - 1) {
    const bw = Math.max(1, Math.floor(next() * 3));
    if (dark) fill(ctx, cx, y, bw, h - 10);
    cx += bw;
    dark = !dark;
  }
  txt(ctx, '9 780000 000000', x, y + h, { size: 6, family: FM });
}

function drawBracket(ctx, x, y, dir, len = 18, lw = 1.5) {
  const dx = dir.includes('r') ? 1 : -1;
  const dy = dir.includes('b') ? 1 : -1;
  ctx.save();
  ctx.strokeStyle = C.BLACK;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x + dx * len, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * len);
  ctx.stroke();
  ctx.restore();
}

function drawProgressBar(ctx, x, y, w, h, frac) {
  orect(ctx, x, y, w, h, 0.8);
  fill(ctx, x + 1, y + 1, Math.max(0, Math.floor((w - 2) * Math.min(1, frac))), h - 2);
}

function drawStepWedge(ctx, x, y, w, h, steps = 8) {
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const v = Math.round((i / (steps - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x + i * sw, y, sw + 0.5, h);
  }
  orect(ctx, x, y, w, h, 0.5, C.GRAY);
}

function drawSphere(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = C.BLACK;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  // Latitude lines
  for (const t of [-0.65, -0.3, 0, 0.3, 0.65]) {
    const ry = r * Math.sqrt(Math.max(0, 1 - t * t));
    ctx.beginPath();
    ctx.ellipse(cx, cy + t * r, ry * 0.98, ry * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Longitude lines
  for (const t of [-0.55, 0, 0.55]) {
    const rx = r * Math.sqrt(Math.max(0, 1 - t * t));
    ctx.beginPath();
    ctx.ellipse(cx + t * r, cy, rx * 0.13, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = C.BLACK;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.91, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // Circular text
  const arcText = 'RECOGNITION ENGINE · CULTURAL PATTERN SYSTEM ·';
  const arcR = r * 0.875;
  const step = (Math.PI * 2) / arcText.length;
  ctx.font = fnt(6.5, 600, FD);
  ctx.fillStyle = C.BLACK;
  arcText.split('').forEach((ch, i) => {
    const a = -Math.PI / 2 + i * step;
    ctx.save();
    ctx.translate(cx + arcR * Math.cos(a), cy + arcR * Math.sin(a));
    ctx.rotate(a + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  // Inner crosshair
  const ir = r * 0.32;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - ir, cy); ctx.lineTo(cx + ir, cy);
  ctx.moveTo(cx, cy - ir); ctx.lineTo(cx, cy + ir);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2); ctx.stroke();

  txt(ctx, 'v.7.3.1', cx, cy + r * 0.54, { size: 7, family: FM, align: 'center', base: 'middle' });
  ctx.restore();
}

function drawMCCS(ctx, x, y, s) {
  const h = s;
  orect(ctx, x, y, s, h);
  hline(ctx, x, y + h / 2, x + s, 0.5);
  vline(ctx, x + s / 2, y, y + h, 0.5);
  ctx.font = fnt(s * 0.28, 700, FD);
  ctx.fillStyle = C.BLACK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [i, ch] of ['M', 'C', 'C', 'S'].entries()) {
    ctx.fillText(ch, x + (i % 2) * (s / 2) + s / 4, y + Math.floor(i / 2) * (h / 2) + h / 4);
  }
}

// ── Text wrap ────────────────────────────────────────────────────────────

function wrapLines(ctx, str, maxW) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ═══════════════════════════════════════════════════════════════════════
// S1  HEADER
// ═══════════════════════════════════════════════════════════════════════

function drawHeader(ctx, config) {
  fill(ctx, 0, 0, POSTER_W, 2);

  txt(ctx, 'SUBJECT ANALYSIS REPORT', MARGIN, 38, { size: 31, weight: 800, ls: 0.5 });

  const meta = `FILE ID: ${config.fileId}   SUBJECT: ${config.name}   DATE: ${config.date}`;
  txt(ctx, meta, MARGIN, 57, { size: 8, family: FM });

  // Right cluster
  const rcx = 588;
  txt(ctx, 'RECOGNITION ENGINE v.7.3.1', rcx, 22, { size: 7.5, family: FM });
  txt(ctx, 'CULTURAL PATTERN RECOGNITION SYSTEM', rcx, 34, { size: 7.5, family: FM });

  drawBarcode(ctx, POSTER_W - 118, 4, 96, 48);
  hline(ctx, 0, HEADER_H, POSTER_W);
}

// ═══════════════════════════════════════════════════════════════════════
// S2  PORTRAIT + SCAN METADATA
// ═══════════════════════════════════════════════════════════════════════

function drawPortrait(ctx, img, config) {
  const PAD_L  = 46;
  const PAD_T  = 14;
  const PAD_B  = 88;  // space below image for metadata

  const px = PAD_L;
  const py = BODY_Y + PAD_T;
  const pw = LEFT_W - PAD_L - 4;
  const ph = BODY_H - PAD_T - PAD_B;

  // Fit image
  const scale = Math.min(pw / img.width, ph / img.height);
  const dw = img.width  * scale;
  const dh = img.height * scale;
  const dx = px + (pw - dw) / 2;
  const dy = py;

  ctx.drawImage(img, dx, dy, dw, dh);

  // Outer frame
  orect(ctx, dx, dy, dw, dh, 1);

  // Corner brackets (inside the frame)
  const bm = 8;
  drawBracket(ctx, dx + bm,      dy + bm,      'tl');
  drawBracket(ctx, dx + dw - bm, dy + bm,      'tr');
  drawBracket(ctx, dx + bm,      dy + dh - bm, 'bl');
  drawBracket(ctx, dx + dw - bm, dy + dh - bm, 'br');

  // Centre crosshairs (dashed, white, semi-transparent)
  const ccx = dx + dw / 2;
  const ccy = dy + dh * 0.44;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = C.WHITE;
  ctx.lineWidth = 0.7;
  ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.moveTo(dx, ccy); ctx.lineTo(dx + dw, ccy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ccx, dy); ctx.lineTo(ccx, dy + dh); ctx.stroke();
  ctx.setLineDash([]);

  // Mini crosshair marks
  function miniX(x, y, s = 6) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = C.WHITE;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    ctx.stroke();
    ctx.restore();
  }
  miniX(ccx, ccy);
  miniX(dx + dw * 0.25, dy + dh * 0.31);
  miniX(dx + dw * 0.75, dy + dh * 0.31);
  ctx.restore();

  // Measurement tick marks on left edge of portrait column
  const tickBase = px - 6;
  for (let i = 0; i <= 20; i++) {
    const ty = py + (ph / 20) * i;
    const tw = i % 5 === 0 ? 10 : 5;
    hline(ctx, tickBase - tw, ty, tickBase, 0.8);
    if (i % 5 === 0 && i > 0) {
      txt(ctx, `${i * 5}`, tickBase - tw - 2, ty, { size: 5.5, family: FM, align: 'right', base: 'middle' });
    }
  }

  // Scan depth label (rotated, left margin)
  ctx.save();
  ctx.translate(14, py + ph / 2);
  ctx.rotate(-Math.PI / 2);
  txt(ctx, `SCAN DEPTH  ${config.scanDepth}`, 0, 0, { size: 7, weight: 500, family: FM, align: 'center', base: 'middle' });
  ctx.restore();

  // Step wedge
  const wedgeY = py + ph + 6;
  drawStepWedge(ctx, dx, wedgeY, dw, 10);
  txt(ctx, '▸ DENSITY REFERENCE', dx, wedgeY + 20, { size: 6, family: FM });

  // Metadata row
  const my = BODY_Y + BODY_H - 36;
  const cols3 = [
    ['IMAGE RESOLUTION', config.imageResolution],
    ['MODE', config.mode],
    ['SOURCE', config.source],
  ];
  const colW = LEFT_W / 3;
  cols3.forEach(([label, value], i) => {
    const mx = MARGIN + i * colW;
    txt(ctx, label, mx, my,      { size: 6.5, family: FM, col: C.GRAY });
    txt(ctx, value, mx, my + 14, { size: 8,   weight: 600, family: FM });
  });

  // Column divider
  vline(ctx, LEFT_W, BODY_Y, SYS_Y);
}

// ═══════════════════════════════════════════════════════════════════════
// S3  ANALYSIS METRICS
// ═══════════════════════════════════════════════════════════════════════

function drawMetrics(ctx, det) {
  const x = RIGHT_X, y = S3_Y, w = RIGHT_W;

  txt(ctx, 'ANALYSIS METRICS', x + w, y + 14, { size: 7, weight: 600, family: FM, align: 'right' });

  // SCAN STATUS
  let cy = y + 28;
  txt(ctx, 'SCAN STATUS:', x, cy, { size: 7.5, family: FM });
  txt(ctx, det.scanStatus, x, cy + 26, { size: 24, weight: 800, ls: 1 });

  // Status icon (filled square)
  const sq = 14;
  orect(ctx, x + w - sq - 2, cy + 8, sq, sq, 1);
  fill(ctx, x + w - sq, cy + 10, sq - 4, sq - 4);

  cy += 60;
  hline(ctx, x, cy, x + w, 0.5, C.LGRAY);
  cy += 12;

  // CONFIDENCE
  txt(ctx, 'CONFIDENCE:', x, cy, { size: 7.5, family: FM });
  cy += 6;
  txt(ctx, `${det.confidence}%`, x, cy + 40, { size: 40, weight: 800 });
  const bar1y = cy + 54;
  drawProgressBar(ctx, x, bar1y, w, 7, parseFloat(det.confidence) / 100);
  txt(ctx, `${det.confidence}%`, x + w, bar1y + 14, { size: 7, family: FM, align: 'right' });

  cy = bar1y + 26;
  hline(ctx, x, cy, x + w, 0.5, C.LGRAY);
  cy += 12;

  // REFLECTION SCORE
  txt(ctx, 'REFLECTION SCORE:', x, cy, { size: 7.5, family: FM });
  txt(ctx, `${det.reflectionScore}%`, x, cy + 22, { size: 20, weight: 700 });
  drawProgressBar(ctx, x, cy + 32, w, 5, parseFloat(det.reflectionScore) / 100);
  txt(ctx, `${det.reflectionScore}%`, x + w, cy + 46, { size: 7, family: FM, align: 'right' });
}

// ═══════════════════════════════════════════════════════════════════════
// S4  OBSERVED CHARACTERISTICS
// ═══════════════════════════════════════════════════════════════════════

function drawCharacteristics(ctx, det) {
  const x = RIGHT_X, y = S4_Y, w = RIGHT_W;

  // Header bar
  fill(ctx, x, y, w, 24);
  txt(ctx, 'OBSERVED CHARACTERISTICS', x + 8, y + 15, { size: 8.5, weight: 700, col: C.WHITE, ls: 0.3 });

  const rows = det.characteristics;
  const rowH = (S4_H - 24) / (rows.length + 0.5);

  rows.forEach((char, i) => {
    const ry = y + 24 + i * rowH;
    const midY = ry + rowH / 2;

    if (i > 0) hline(ctx, x, ry, x + w, 0.4, C.LGRAY);

    // Checkmark
    ctx.save();
    ctx.strokeStyle = C.BLACK;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 7,  midY + 1);
    ctx.lineTo(x + 11, midY + 5);
    ctx.lineTo(x + 17, midY - 5);
    ctx.stroke();
    ctx.restore();

    txt(ctx, char, x + 26, midY, { size: 8.5, base: 'middle' });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// S5  MACHINE INTERPRETATION
// ═══════════════════════════════════════════════════════════════════════

function drawInterpretation(ctx, det) {
  const x = RIGHT_X, y = S5_Y, w = RIGHT_W;

  hline(ctx, x, y, x + w);
  txt(ctx, 'MACHINE INTERPRETATION', x, y + 16, { size: 7.5, weight: 600, family: FM });

  ctx.save();
  ctx.font = fnt(9, 400, FD);
  ctx.fillStyle = C.BLACK;
  ctx.textBaseline = 'alphabetic';
  const lineH = 13.5;
  let ty = y + 34;
  for (const sentence of det.interpretation) {
    for (const line of wrapLines(ctx, sentence, w)) {
      ctx.fillText(line, x, ty);
      ty += lineH;
    }
    ty += 2;
  }
  ty += 4;
  ctx.font = `italic ${fnt(8.5, 400, FD)}`;
  const disclaimer = 'Alternative explanations have not been considered.';
  for (const line of wrapLines(ctx, disclaimer, w)) {
    ctx.fillText(line, x, ty);
    ty += lineH;
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════
// S6  CLASSIFICATION PANEL
// ═══════════════════════════════════════════════════════════════════════

function drawClassification(ctx, det) {
  const x = RIGHT_X, y = S6_Y, w = RIGHT_W;

  hline(ctx, x, y, x + w);

  // Wireframe sphere (left)
  const sphereR = 48;
  const sphereCX = x + sphereR + 4;
  const sphereCY = y + 80;
  drawSphere(ctx, sphereCX, sphereCY, sphereR);

  // Text block (right of sphere)
  const tx = sphereCX + sphereR + 18;
  txt(ctx, 'CLASSIFICATION:', tx, y + 20, { size: 7.5, family: FM });
  const titleSize = det.classification.length > 14 ? 20 : 26;
  txt(ctx, det.classification, tx, y + 54, { size: titleSize, weight: 800, ls: 0.5 });
  txt(ctx, 'EXPLANATION:', tx, y + 76, { size: 7.5, family: FM });
  txt(ctx, det.explanation, tx, y + 96, { size: 15, weight: 700 });

  // Reference matrices table
  const tableX = x;
  const tableY = y + 144;
  txt(ctx, 'REFERENCE MATRICES', tableX, tableY - 10, { size: 6.5, family: FM, col: C.GRAY });
  hline(ctx, tableX, tableY - 4, tableX + w, 0.5);

  const barChartX = tableX + 68;
  const bcW = w - 70;
  det.referenceMatrices.forEach((row, i) => {
    const ry = tableY + i * 16;
    txt(ctx, row.code,  tableX,    ry + 10, { size: 7.5, family: FM });
    txt(ctx, row.value, tableX + 60, ry + 10, { size: 7.5, family: FM, align: 'right' });
    hline(ctx, tableX, ry + 13, tableX + w, 0.3, C.LGRAY);

    // Bar
    const bw = Math.max(1, bcW * parseFloat(row.value));
    fill(ctx, barChartX + 4, ry + 4, Math.round(bw), 7);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// S7  SYSTEM NOTE
// ═══════════════════════════════════════════════════════════════════════

function drawSystemNote(ctx) {
  const y = SYS_Y;
  hline(ctx, 0, y, POSTER_W, 1.5);

  txt(ctx, 'SYSTEM NOTE:', MARGIN, y + 22, { size: 7.5, weight: 600, family: FM });
  txt(ctx, 'The Recognition Engine has determined a result.', MARGIN, y + 44, { size: 12, weight: 400 });
  txt(ctx, 'The Recognition Engine is unable to explain how this conclusion was reached.', MARGIN, y + 62, { size: 12 });

  // Seal
  drawSeal(ctx, POSTER_W - MARGIN - 52, y + SYS_H / 2, 52);

  hline(ctx, 0, y + SYS_H, POSTER_W);
}

// ═══════════════════════════════════════════════════════════════════════
// S8  EXHIBITION FOOTER
// ═══════════════════════════════════════════════════════════════════════

function drawFooter(ctx, config) {
  const y = FOOT_Y;

  // Exhibition title (left)
  const lines = config.exhibitionTitle.split('\n');
  txt(ctx, lines[0], MARGIN, y + 32, { size: 15, weight: 800, ls: 0.4 });
  lines.slice(1).forEach((line, i) => {
    txt(ctx, line, MARGIN, y + 54 + i * 18, { size: 10, weight: 500, ls: 0.2 });
  });

  // Date / venue / address (centre)
  const col2 = MARGIN + (POSTER_W - 2 * MARGIN) / 3;
  txt(ctx, config.dateRange, col2, y + 32, { size: 9, family: FM });
  txt(ctx, config.venue,     col2, y + 52, { size: 8, family: FM });
  config.address.split('\n').forEach((line, i) => {
    txt(ctx, line, col2, y + 70 + i * 13, { size: 8, family: FM });
  });

  // MCCS monogram (right)
  const ms = 66;
  drawMCCS(ctx, POSTER_W - MARGIN - ms, y + 20, ms);

  // Bottom rules
  hline(ctx, 0, POSTER_H - 3, POSTER_W, 2);
  hline(ctx, 0, POSTER_H - 1, POSTER_W, 0.5);
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/** Load an image from src; returns a placeholder canvas if the file is missing. */
function loadImage(src) {
  if (src instanceof HTMLCanvasElement || src instanceof ImageBitmap) {
    return Promise.resolve(src);
  }
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => res(img);
    img.onerror = () => res(_placeholderPortrait());
    img.src = src;
  });
}

function _placeholderPortrait(w = 684, h = 816) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#aaa';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#555';
  ctx.font = fnt(18, 500, FM);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD PORTRAIT', w / 2, h / 2 - 14);
  ctx.fillText('poster/portraits/', w / 2, h / 2 + 14);
  return c;
}

/**
 * Render the full 1024×1536 poster onto `canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {SubjectConfig} config
 * @param {Determination} determination
 * @param {HTMLCanvasElement|string|null} compositedPortrait
 */
async function renderPoster(canvas, config, determination, compositedPortrait = null) {
  await document.fonts.ready;

  canvas.width  = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext('2d');

  // Background
  fill(ctx, 0, 0, POSTER_W, POSTER_H, C.BG);

  const portraitSrc = compositedPortrait ?? config.portrait;
  const img = await loadImage(portraitSrc);

  drawHeader(ctx, config);
  drawPortrait(ctx, img, config);
  drawMetrics(ctx, determination);
  drawCharacteristics(ctx, determination);
  drawInterpretation(ctx, determination);
  drawClassification(ctx, determination);
  drawSystemNote(ctx);
  drawFooter(ctx, config);

  return canvas;
}

window.renderPoster = renderPoster;
})();
