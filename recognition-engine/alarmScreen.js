'use strict';

// ── Per-subject poster overlays (one iframe per ALARM subject) ─────────────────
const _subjectOverlays = new Map();  // subjectId → { iframe, subject }
let _alarmContainer    = null;
let alarmOverlayActive = false;

// ── Webcam frame broadcaster (~12 fps to all active iframes) ──────────────────
let _senderRaf  = null;
let _lastSendMs = 0;
const _SEND_INTERVAL = 80;

function _startSender() {
  if (_senderRaf) return;
  function _tick(now) {
    if (_subjectOverlays.size === 0) { _senderRaf = null; return; }
    _senderRaf = requestAnimationFrame(_tick);
    if (now - _lastSendMs < _SEND_INTERVAL) return;
    _lastSendMs = now;

    const vid = (typeof cam !== 'undefined') ? cam.elt : null;
    if (!vid || vid.readyState < 2 || !vid.videoWidth) return;

    const fc = document.createElement('canvas');
    fc.width  = vid.videoWidth;
    fc.height = vid.videoHeight;
    fc.getContext('2d').drawImage(vid, 0, 0);
    const dataUrl = fc.toDataURL('image/jpeg', 0.75);

    const cw = window.innerWidth  || 1;
    const ch = window.innerHeight || 1;

    for (const state of _subjectOverlays.values()) {
      const s = state.subject;
      // Convert mirrored canvas coords → raw webcam pixel coords for face matching
      const faceHint = {
        x: (1 - s.x / cw) * vid.videoWidth,
        y: (s.y / ch)     * vid.videoHeight,
      };
      state.iframe.contentWindow?.postMessage(
        { type: 'WEBCAM_FRAME', dataUrl, faceHint }, '*'
      );
    }
  }
  _senderRaf = requestAnimationFrame(_tick);
}

function _stopSender() {
  if (_senderRaf) { cancelAnimationFrame(_senderRaf); _senderRaf = null; }
}

// ── Overlay container — tiles iframes side-by-side ───────────────────────────
function _ensureContainer() {
  if (_alarmContainer) return _alarmContainer;
  _alarmContainer = document.createElement('div');
  _alarmContainer.className    = 'alarm-overlay';
  _alarmContainer.style.alignItems = 'stretch';  // override class default (center)
  document.body.appendChild(_alarmContainer);
  return _alarmContainer;
}

// ── Per-subject iframe lifecycle ─────────────────────────────────────────────
function _addSubjectOverlay(subject) {
  const container = _ensureContainer();
  const iframe    = document.createElement('iframe');
  iframe.src      = 'poster/index.html?kiosk=1';
  iframe.style.cssText = 'flex:1;border:none;display:block;height:100%;min-width:0;';
  iframe.addEventListener('load', () => {
    iframe.contentWindow?.postMessage({ type: 'KIOSK_INIT', subjectKey: 'warhol' }, '*');
  });
  container.appendChild(iframe);
  _subjectOverlays.set(subject.id, { iframe, subject });
}

function _removeSubjectOverlay(id) {
  const state = _subjectOverlays.get(id);
  if (!state) return;
  state.iframe.remove();
  _subjectOverlays.delete(id);
}

// ── Public API — called every draw() frame from sketch.js ─────────────────────
function updateAlarmPosters(subjects) {
  const alarmed = subjects.filter(s => s.state === 'ALARM');

  // Remove overlays for subjects that left ALARM
  for (const [id] of _subjectOverlays) {
    if (!alarmed.some(s => s.id === id)) _removeSubjectOverlay(id);
  }

  // Add overlays for newly ALARM subjects; keep position reference fresh
  for (const s of alarmed) {
    if (_subjectOverlays.has(s.id)) _subjectOverlays.get(s.id).subject = s;
    else _addSubjectOverlay(s);
  }

  const container = _ensureContainer();
  if (alarmed.length > 0) {
    if (!container.classList.contains('visible')) {
      container.getBoundingClientRect();  // force reflow so CSS transition fires
      requestAnimationFrame(() => container.classList.add('visible'));
    }
    alarmOverlayActive = true;
    _startSender();
  } else {
    container.classList.remove('visible');
    alarmOverlayActive = false;
    _stopSender();
  }
}
