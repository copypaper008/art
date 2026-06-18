'use strict';

// ALARM display — the high-fidelity black-and-white "SUBJECT ANALYSIS REPORT"
// poster, rendered by the poster/ engine (renderer.js + reveal.js) inside an
// iframe running in kiosk mode. On ALARM we capture the subject's face, drop the
// iframe over the canvas growing out of the face position, and postMessage a
// KIOSK_INIT so the poster runs its reveal (scan → portrait frames the face →
// desaturate to B&W → report assembles → stamp lands as the sole colour).
//
// This replaces the earlier on-canvas gallery reveal entirely.

let _alarmIframe   = null;
let _alarmLoaded   = false;
let alarmOverlayActive = false;

function _ensureAlarmIframe() {
  if (_alarmIframe) return _alarmIframe;
  const f = document.createElement('iframe');
  f.className = 'alarm-overlay';
  f.src = 'poster/index.html?kiosk';
  f.setAttribute('scrolling', 'no');
  f.addEventListener('load', () => { _alarmLoaded = true; });
  document.body.appendChild(f);
  _alarmIframe = f;
  return f;
}

// Grab the current (mirrored) camera frame as a JPEG data URL so the poster
// engine can superimpose the visitor's face onto the icon. Returns null if the
// camera isn't ready — the reveal then falls back to the icon's own face.
function _captureFaceDataUrl() {
  try {
    if (!cam || !cam.elt || cam.elt.readyState < 2) return null;
    const vw = cam.elt.videoWidth  || 640;
    const vh = cam.elt.videoHeight || 480;
    const c  = document.createElement('canvas');
    c.width = vw; c.height = vh;
    const ctx = c.getContext('2d');
    ctx.translate(vw, 0); ctx.scale(-1, 1);   // mirror to match the displayed feed
    ctx.drawImage(cam.elt, 0, 0, vw, vh);
    return c.toDataURL('image/jpeg', 0.85);
  } catch (e) {
    return null;
  }
}

// subject: the Subject entering ALARM (gives subjectKey + face position).
function showAlarmScreen(subject) {
  const f          = _ensureAlarmIframe();
  const subjectKey = (subject && subject.subjectKey) || 'warhol';
  const faceUrl    = _captureFaceDataUrl();

  // Origin of the grow-from-face animation (percent of viewport).
  if (subject && typeof width === 'number' && typeof height === 'number') {
    f.style.setProperty('--grow-x', (subject.x / width  * 100).toFixed(1) + '%');
    f.style.setProperty('--grow-y', (subject.y / height * 100).toFixed(1) + '%');
  }

  alarmOverlayActive = true;
  f.classList.add('visible');
  // Re-trigger the clip-path grow each time the overlay appears.
  f.classList.remove('poster-iframe-growing');
  void f.offsetWidth;                          // force reflow so the animation restarts
  f.classList.add('poster-iframe-growing');

  const send = () => {
    if (f.contentWindow) {
      f.contentWindow.postMessage({
        type: 'KIOSK_INIT',
        subjectKey,
        capturedFaceDataUrl: faceUrl,
      }, '*');
    }
  };
  if (_alarmLoaded) send();
  else f.addEventListener('load', () => { _alarmLoaded = true; send(); }, { once: true });
}

function hideAlarmScreen() {
  if (!_alarmIframe) return;
  alarmOverlayActive = false;
  _alarmIframe.classList.remove('visible');
  _alarmIframe.classList.remove('poster-iframe-growing');
}

// ── Preview mode ──────────────────────────────────────────────────────────────
// Add ?preview=warhol (or =haring) to the URL to show the poster overlay
// immediately without scanning. Tap or press Escape to dismiss.
(function _initPreview() {
  const slug = new URLSearchParams(window.location.search).get('preview');
  if (!slug) return;
  setTimeout(() => {
    showAlarmScreen({ subjectKey: slug, x: window.innerWidth * 0.3, y: window.innerHeight * 0.2 });
    const dismiss = () => hideAlarmScreen();
    if (_alarmIframe) _alarmIframe.addEventListener('click', dismiss, { once: true });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(); }, { once: true });
  }, 600);
})();
