// Alarm overlay — shows a randomly chosen poster image full-screen

const ENGINE_SLUGS = [
  "warhol", "haring", "disco", "leather", "drag",
  "camp",   "faerie", "ballroom", "archive", "gene"
];

let _alarmOverlay = null;
let alarmOverlayActive = false;

function _ensureOverlay() {
  if (_alarmOverlay) return _alarmOverlay;
  _alarmOverlay = document.createElement('div');
  _alarmOverlay.className = 'alarm-overlay';
  _alarmOverlay.innerHTML = `
    <img class="poster-img" src="" alt="" />
    <div class="scanline"></div>
  `;
  document.body.appendChild(_alarmOverlay);
  return _alarmOverlay;
}

function showAlarmScreen() {
  const el = _ensureOverlay();
  const slug = ENGINE_SLUGS[Math.floor(Math.random() * ENGINE_SLUGS.length)];
  el.querySelector('.poster-img').src = `posters/${slug}.png`;
  el.getBoundingClientRect(); // force reflow so transition fires
  el.classList.add('visible');
  alarmOverlayActive = true;
}

function hideAlarmScreen() {
  if (!_alarmOverlay) return;
  _alarmOverlay.classList.remove('visible');
  alarmOverlayActive = false;
}
