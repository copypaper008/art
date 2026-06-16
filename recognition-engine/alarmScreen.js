// Alarm overlay — full-screen poster with animated effects

const ENGINE_SLUGS = [
  "warhol", "haring", "disco", "leather", "drag",
  "camp",   "faerie", "ballroom", "archive", "gene"
];

let _alarmOverlay  = null;
let _animFrame     = null;
let alarmOverlayActive = false;

function _ensureOverlay() {
  if (_alarmOverlay) return _alarmOverlay;
  _alarmOverlay = document.createElement('div');
  _alarmOverlay.className = 'alarm-overlay';
  _alarmOverlay.innerHTML = `
    <img class="poster-img" src="" alt="" />
    <div class="scanline"></div>
    <div class="color-flash"></div>
  `;
  document.body.appendChild(_alarmOverlay);
  return _alarmOverlay;
}

function showAlarmScreen() {
  const el  = _ensureOverlay();
  const slug = ENGINE_SLUGS[Math.floor(Math.random() * ENGINE_SLUGS.length)];
  const img  = el.querySelector('.poster-img');
  img.src = `posters/${slug}.png`;

  el.getBoundingClientRect(); // force reflow
  el.classList.add('visible');
  alarmOverlayActive = true;

  _startAnimation(img, el.querySelector('.color-flash'));
}

function hideAlarmScreen() {
  if (!_alarmOverlay) return;
  _alarmOverlay.classList.remove('visible');
  alarmOverlayActive = false;
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
}

// ── Animation loop ────────────────────────────────────────────────────────────
function _startAnimation(img, flash) {
  if (_animFrame) cancelAnimationFrame(_animFrame);

  let startTime  = null;
  let glitchEnd  = 0;
  let nextGlitch = 1200 + Math.random() * 1800; // first glitch after 1.2-3s

  function tick(now) {
    if (!alarmOverlayActive) return;
    _animFrame = requestAnimationFrame(tick);

    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const t = elapsed / 1000; // seconds

    // Schedule next glitch
    if (elapsed > nextGlitch && now > glitchEnd) {
      glitchEnd  = now + 80 + Math.random() * 140;
      nextGlitch = elapsed + 900 + Math.random() * 1800;
    }

    const glitching = now < glitchEnd;

    // Gentle scale breathe (1.0 → 1.02 → 1.0)
    const breathe = 1 + Math.sin(t * 1.05) * 0.012;

    // Slow rainbow hue cycle (~30s per full rotation) — pride aesthetic on pop art
    const hue = (t * 11) % 360;

    // Glitch: horizontal snap + colour spike
    const dx  = glitching ? (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 16) : 0;
    const sat = glitching ? 260 : 120 + Math.sin(t * 1.05) * 18;
    const bri = glitching ? 1.35 : 1.0 + Math.sin(t * 1.05) * 0.06;
    const con = glitching ? 1.2 : 1.0;

    img.style.transform = `translateX(${dx.toFixed(1)}px) scale(${breathe.toFixed(4)})`;
    img.style.filter    = `hue-rotate(${hue.toFixed(1)}deg) saturate(${sat.toFixed(0)}%) brightness(${bri.toFixed(3)}) contrast(${con})`;

    // Colour flash overlay pulses on glitch (screen blend, low opacity)
    const flashAlpha = glitching ? 0.18 + Math.random() * 0.12 : 0;
    const flashHue   = (hue + 180) % 360;
    flash.style.opacity    = flashAlpha;
    flash.style.background = `hsl(${flashHue}, 100%, 60%)`;
  }

  _animFrame = requestAnimationFrame(tick);
}
