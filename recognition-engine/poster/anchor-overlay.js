'use strict';

/**
 * Dev tool: render a subject's faceAnchors overlaid on their portrait
 * so the anchor positions can be visually verified and fine-tuned.
 *
 * Usage (browser console or from index.html):
 *   showAnchorOverlay(WARHOL_CONFIG);   // opens an overlay dialog
 *
 * The dialog shows:
 *  • The portrait with coloured eye markers and oval points
 *  • A table of current coordinate values
 *  • Drag-to-reposition handles (click + drag any point)
 *  • A "Copy JSON" button that prints the updated faceAnchors to console
 */

let _overlayEl = null;

function showAnchorOverlay(config) {
  if (_overlayEl) _overlayEl.remove();

  const overlay = document.createElement('div');
  overlay.id = 'anchor-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: '9999', fontFamily: 'monospace', fontSize: '12px', color: '#fff',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    display: 'flex', gap: '20px', alignItems: 'flex-start',
    background: '#111', padding: '20px', borderRadius: '4px',
    maxHeight: '90vh', overflow: 'auto',
  });

  // ── Canvas panel ──────────────────────────────────────────────────────
  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;user-select:none;';

  const canvas = document.createElement('canvas');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width  = img.width;
    canvas.height = img.height;
    redraw();
  };
  img.src = config.portrait;

  // Working copy of anchors (mutable during this session)
  const anchors = JSON.parse(JSON.stringify(config.faceAnchors));

  function redraw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Darken portrait slightly for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Face oval
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const oval = anchors.faceOval;
    ctx.moveTo(oval[0].x, oval[0].y);
    for (let i = 1; i < oval.length; i++) {
      const a = oval[i];
      const b = oval[(i + 1) % oval.length];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Oval points
    oval.forEach((pt, i) => {
      ctx.save();
      ctx.fillStyle = '#00ff88';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i, pt.x, pt.y + 3);
      ctx.restore();
    });

    // Eye anchors
    for (const [key, col] of [['leftEye', '#ff4466'], ['rightEye', '#4488ff']]) {
      const pt = anchors[key];
      ctx.save();
      ctx.strokeStyle = col;
      ctx.fillStyle   = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill();
      // crosshair
      ctx.beginPath();
      ctx.moveTo(pt.x - 12, pt.y); ctx.lineTo(pt.x + 12, pt.y);
      ctx.moveTo(pt.x, pt.y - 12); ctx.lineTo(pt.x, pt.y + 12);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(key === 'leftEye' ? 'L' : 'R', pt.x, pt.y - 14);
      ctx.restore();
    }
  }

  // ── Drag logic ──────────────────────────────────────────────────────────
  let dragging = null; // { type: 'eye'|'oval', key, idx }

  const RADIUS = 10;

  function hitTest(mx, my) {
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    const cx = mx / scale;
    const cy = my / scale;

    for (const key of ['leftEye', 'rightEye']) {
      const pt = anchors[key];
      if (Math.hypot(pt.x - cx, pt.y - cy) < RADIUS) return { type: 'eye', key };
    }
    for (let i = 0; i < anchors.faceOval.length; i++) {
      const pt = anchors.faceOval[i];
      if (Math.hypot(pt.x - cx, pt.y - cy) < RADIUS) return { type: 'oval', idx: i };
    }
    return null;
  }

  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    dragging = hitTest(e.clientX - rect.left, e.clientY - rect.top);
  });
  canvas.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect  = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const cx = (e.clientX - rect.left) / scale;
    const cy = (e.clientY - rect.top)  / scale;
    if (dragging.type === 'eye') {
      anchors[dragging.key] = { x: Math.round(cx), y: Math.round(cy) };
    } else {
      anchors.faceOval[dragging.idx] = { x: Math.round(cx), y: Math.round(cy) };
    }
    redraw();
    updateTable();
  });
  canvas.addEventListener('mouseup', () => { dragging = null; });

  canvasWrap.appendChild(canvas);

  // ── Info panel ───────────────────────────────────────────────────────────
  const info = document.createElement('div');
  info.style.cssText = 'min-width:220px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:13px;font-weight:bold;margin-bottom:10px;color:#eee;';
  title.textContent = `ANCHOR EDITOR — ${config.name}`;
  info.appendChild(title);

  const hint = document.createElement('div');
  hint.style.cssText = 'color:#999;margin-bottom:12px;line-height:1.5;';
  hint.innerHTML = 'Drag • to reposition<br>Red = leftEye &nbsp; Blue = rightEye<br>Green = faceOval';
  info.appendChild(hint);

  const table = document.createElement('div');
  info.appendChild(table);

  function updateTable() {
    table.innerHTML = '';
    const rows = [
      ['leftEye',  `${anchors.leftEye.x}, ${anchors.leftEye.y}`],
      ['rightEye', `${anchors.rightEye.x}, ${anchors.rightEye.y}`],
      ...anchors.faceOval.map((pt, i) => [`oval[${i}]`, `${pt.x}, ${pt.y}`]),
    ];
    rows.forEach(([label, val]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;margin:3px 0;';
      row.innerHTML = `<span style="color:#aaa;min-width:70px;">${label}</span><span>${val}</span>`;
      table.appendChild(row);
    });
  }
  updateTable();

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy JSON';
  Object.assign(copyBtn.style, {
    marginTop: '14px', padding: '6px 14px', background: '#333',
    color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '3px',
  });
  copyBtn.addEventListener('click', () => {
    const json = JSON.stringify(anchors, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
    console.log('faceAnchors:', json);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 2000);
  });
  info.appendChild(copyBtn);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  Object.assign(closeBtn.style, {
    marginTop: '8px', marginLeft: '8px', padding: '6px 14px', background: 'transparent',
    color: '#aaa', border: '1px solid #444', cursor: 'pointer', borderRadius: '3px',
  });
  closeBtn.addEventListener('click', () => overlay.remove());
  info.appendChild(closeBtn);

  box.appendChild(canvasWrap);
  box.appendChild(info);
  overlay.appendChild(box);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  _overlayEl = overlay;
}
