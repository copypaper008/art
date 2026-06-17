// Alarm overlay — full-screen poster with animated effects

const ENGINE_SLUGS = [
  // "warhol", "haring", "disco", "leather", "drag",
  // "camp",   "faerie", "ballroom", "archive", "gene"
];

// Slugs that have fully coded HTML/CSS/SVG cards (no PNG needed)
const CODED_CARDS = {
  // warhol:  renderWarholCard,
  // haring:  renderHaringCard,
  // leather: renderLeatherCard,
};

// Optional JS init called after HTML is injected (for glitch loops, listeners)
const CARD_INITS = {
  // warhol: initWarholCard,
};

let _alarmOverlay  = null;
let _animFrame     = null;
let alarmOverlayActive = false;

function _ensureOverlay() {
  if (_alarmOverlay) return _alarmOverlay;
  _alarmOverlay = document.createElement('div');
  _alarmOverlay.className = 'alarm-overlay';
  document.body.appendChild(_alarmOverlay);
  return _alarmOverlay;
}

function _showSlug(slug) {
  const el = _ensureOverlay();
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  if (el._cardInterval) { clearInterval(el._cardInterval); el._cardInterval = null; }

  if (CODED_CARDS[slug]) {
    el.innerHTML = CODED_CARDS[slug]();
    if (CARD_INITS[slug]) CARD_INITS[slug](el);
  } else {
    el.innerHTML = `
      <img class="poster-img" src="posters/${slug}.png" />
      <div class="scanline"></div>
      <div class="color-flash"></div>
    `;
    el.getBoundingClientRect();
    _startAnimation(
      el.querySelector('.poster-img'),
      el.querySelector('.color-flash')
    );
  }

  // Two-step: reflow first, then add class so CSS transition actually fires
  el.getBoundingClientRect();
  requestAnimationFrame(() => el.classList.add('visible'));
  alarmOverlayActive = true;
}

function _captureFaceToSession() {
  // cam is the p5.js capture element defined in sketch.js
  const videoEl = (typeof cam !== 'undefined') ? cam.elt : null;
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return;

  const c = document.createElement('canvas');
  c.width  = videoEl.videoWidth;
  c.height = videoEl.videoHeight;
  c.getContext('2d').drawImage(videoEl, 0, 0);

  try {
    sessionStorage.setItem('reco-face', c.toDataURL('image/jpeg', 0.88));
  } catch (e) {
    console.warn('[alarm] Could not cache face frame:', e.message);
  }
}

function showAlarmScreen() {
  _captureFaceToSession();

  const el = _ensureOverlay();
  if (_animFrame)         { cancelAnimationFrame(_animFrame); _animFrame = null; }
  if (el._cardInterval)  { clearInterval(el._cardInterval); el._cardInterval = null; }

  el.innerHTML = '<iframe src="poster/index.html?kiosk=1" style="width:100%;height:100%;border:none;display:block;"></iframe>';

  el.getBoundingClientRect();
  requestAnimationFrame(() => el.classList.add('visible'));
  alarmOverlayActive = true;
}

function hideAlarmScreen() {
  if (!_alarmOverlay) return;
  _alarmOverlay.classList.remove('visible');
  alarmOverlayActive = false;
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  if (_alarmOverlay._cardInterval) { clearInterval(_alarmOverlay._cardInterval); _alarmOverlay._cardInterval = null; }
}

// ── Preview mode ──────────────────────────────────────────────────────────────
// Add ?preview=SLUG to URL to instantly show any card without scanning.
// e.g.  ?preview=warhol   ?preview=haring   ?preview=leather
// Tap the overlay or press Escape to dismiss.
(function _initPreview() {
  const slug = new URLSearchParams(window.location.search).get('preview');
  if (!slug) return;
  // Scripts are already loaded at this point (we're in the body, not async).
  // A short delay lets p5.js finish its setup() before we add the overlay.
  setTimeout(() => {
    _showSlug(slug);
    if (_alarmOverlay) {
      _alarmOverlay.addEventListener('click', hideAlarmScreen, { once: true });
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideAlarmScreen();
    }, { once: true });
  }, 600);
})();

// ── Animation loop (for PNG poster cards) ────────────────────────────────────
function _startAnimation(img, flash) {
  if (_animFrame) cancelAnimationFrame(_animFrame);

  let startTime  = null;
  let glitchEnd  = 0;
  let nextGlitch = 1200 + Math.random() * 1800;

  function tick(now) {
    if (!alarmOverlayActive) return;
    _animFrame = requestAnimationFrame(tick);

    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const t = elapsed / 1000;

    if (elapsed > nextGlitch && now > glitchEnd) {
      glitchEnd  = now + 80 + Math.random() * 140;
      nextGlitch = elapsed + 900 + Math.random() * 1800;
    }

    const glitching = now < glitchEnd;
    const breathe   = 1 + Math.sin(t * 1.05) * 0.012;
    const hue       = (t * 11) % 360;
    const dx        = glitching ? (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 16) : 0;
    const sat       = glitching ? 260 : 120 + Math.sin(t * 1.05) * 18;
    const bri       = glitching ? 1.35 : 1.0 + Math.sin(t * 1.05) * 0.06;

    img.style.transform = `translateX(${dx.toFixed(1)}px) scale(${breathe.toFixed(4)})`;
    img.style.filter    = `hue-rotate(${hue.toFixed(1)}deg) saturate(${sat.toFixed(0)}%) brightness(${bri.toFixed(3)}) contrast(${glitching ? 1.2 : 1})`;

    flash.style.opacity    = glitching ? 0.18 + Math.random() * 0.12 : 0;
    flash.style.background = `hsl(${(hue + 180) % 360}, 100%, 60%)`;
  }

  _animFrame = requestAnimationFrame(tick);
}
