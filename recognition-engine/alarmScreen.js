// Alarm overlay — full-screen engine card shown when ALARM fires

const ENGINES = [
  {
    id: "01", slug: "warhol", title: "WARHOL",
    subtitle: "DETECTION ENGINE™",
    classification: "POP ART HOMOSEXUAL",
    palette: "warhol",
    result: "SUBJECT HAS BEEN\nSCREEN PRINTED 16 TIMES",
    indicators: [
      "Excessive use of fluorescent colours",
      "Suspicious interest in celebrity culture",
      "Soup can familiarity above baseline",
      "Factory attendance anomaly",
    ],
    icons: ["SOUP", "STAR", "CAMERA"],
  },
  {
    id: "02", slug: "haring", title: "HARING",
    subtitle: "RECOGNITION ENGINE™",
    classification: "DANCING FIGURE HOMOSEXUAL",
    palette: "haring",
    result: "SUBJECT CURRENTLY WERKING",
    indicators: [
      "Movement exceeds heteronormative limits",
      "Radiant energy signatures detected",
      "Unauthorised joy event in progress",
      "Barking dog proximity elevated",
    ],
    icons: ["DOG", "DANCE", "RAYS"],
  },
  {
    id: "03", slug: "disco", title: "DISCO",
    subtitle: "DETECTION ENGINE™",
    classification: "STUDIO 54 HOMOSEXUAL",
    palette: "disco",
    result: "SUBJECT CANNOT STOP DANCING",
    indicators: [
      "Mirror ball resonance",
      "Glitter contamination critical",
      "Bee Gees frequency detected",
      "Rhythm levels unsafe",
    ],
    icons: ["MIRRORBALL", "SPARKLE", "LASER"],
  },
  {
    id: "04", slug: "leather", title: "LEATHER",
    subtitle: "DETECTION ENGINE™",
    classification: "TOM OF FINLAND HOMOSEXUAL",
    palette: "leather",
    result: "SUBJECT TOO POWERFUL\nFOR THIS SYSTEM",
    indicators: [
      "Moustache confidence elevated",
      "Denim density above average",
      "Motorcycle ownership probability 87%",
      "Jawline structurally impossible",
    ],
    icons: ["CHROME", "CHAIN", "LIGHTNING"],
  },
  {
    id: "05", slug: "drag", title: "DRAG",
    subtitle: "DETECTION ENGINE™",
    classification: "GLAMOUR HOMOSEXUAL",
    palette: "drag",
    result: "SHANTAY, YOU STAY",
    indicators: [
      "Eyelash velocity exceeding regulations",
      "Sequins present in atmosphere",
      "Shade deployment systems active",
      "Wig energy critical",
    ],
    icons: ["LIPS", "SPOTLIGHT", "RHINESTONE"],
  },
  {
    id: "06", slug: "camp", title: "CAMP",
    subtitle: "DETECTION ENGINE™",
    classification: "EXTRA HOMOSEXUAL",
    palette: "camp",
    result: "SUBJECT IS BEING A LOT\n(COMPLIMENTARY)",
    indicators: [
      "Dramatic pause frequency elevated",
      "Hand gestures beyond legal limits",
      "Flamingo affinity confirmed",
      "Irony levels immeasurable",
    ],
    icons: ["FLAMINGO", "TEACUP", "CHERUB"],
  },
  {
    id: "07", slug: "faerie", title: "RADICAL FAERIE",
    subtitle: "DETECTION ENGINE™",
    classification: "FOREST HOMOSEXUAL",
    palette: "faerie",
    result: "SUBJECT HAS LEFT SOCIETY",
    indicators: [
      "Crystal accumulation detected",
      "Spiritual vibration instability",
      "Barefoot probability elevated",
      "Moon cycle awareness confirmed",
    ],
    icons: ["MOON", "CRYSTAL", "MUSHROOM"],
  },
  {
    id: "08", slug: "ballroom", title: "BALLROOM",
    subtitle: "DETECTION ENGINE™",
    classification: "VOGUE HOMOSEXUAL",
    palette: "ballroom",
    result: "10s 10s 10s ACROSS THE BOARD",
    indicators: [
      "Pose generation exceeding hardware limits",
      "Category currently being served",
      "House affiliation probable",
      "Face card never declines",
    ],
    icons: ["CROWN", "TROPHY", "SPARKLE"],
  },
  {
    id: "09", slug: "archive", title: "QUEER ARCHIVE",
    subtitle: "DETECTION ENGINE™",
    classification: "HISTORIC HOMOSEXUAL",
    palette: "archive",
    result: "SUBJECT CONTAINS MULTITUDES",
    indicators: [
      "Possession of obscure zines",
      "Knowledge of forgotten activists",
      "Archival dust contamination",
      "Citation count excessive",
    ],
    icons: ["ZINE", "STAMP", "PAPER"],
  },
  {
    id: "10", slug: "gene", title: "GAY GENE",
    subtitle: "SUPERCOMPUTER™",
    classification: "ULTIMATE HOMOSEXUAL",
    palette: "gene",
    result: "YAAAS QUEEN",
    indicators: [
      "Judy Garland exposure confirmed",
      "Cher event detected",
      "Madonna index elevated",
      "Lady Gaga levels catastrophic",
      "Kylie Minogue threshold surpassed",
      "Dolly Parton constant stable",
    ],
    icons: ["DNA", "CONFETTI", "WARNING"],
  },
];

let _alarmOverlay = null;
let alarmOverlayActive = false;

function _ensureOverlay() {
  if (_alarmOverlay) return _alarmOverlay;
  _alarmOverlay = document.createElement('div');
  _alarmOverlay.className = 'alarm-overlay';
  document.body.appendChild(_alarmOverlay);
  return _alarmOverlay;
}

function showAlarmScreen() {
  const el = _ensureOverlay();
  const engine = ENGINES[Math.floor(Math.random() * ENGINES.length)];
  el.innerHTML = _renderCard(engine);
  // Force reflow so transition fires
  el.getBoundingClientRect();
  el.classList.add('visible');
  alarmOverlayActive = true;
}

function hideAlarmScreen() {
  if (!_alarmOverlay) return;
  _alarmOverlay.classList.remove('visible');
  alarmOverlayActive = false;
}

function _renderCard(e) {
  const indicators = e.indicators
    .map(t => `<li>${t}</li>`)
    .join('');
  const resultHtml = e.result.replace(/\n/g, '<br>');
  return `
    <article class="engine-card theme-${e.palette}">
      <div class="scanline"></div>
      <header class="topbar">
        <span class="engine-id">${e.id}</span>
        <span>RECOGNITION ENGINE</span>
        <span>SUBJECTS: 01</span>
      </header>
      <section class="title-block">
        <h1>${e.title}</h1>
        <h2>${e.subtitle}</h2>
      </section>
      <section class="diagnostic">
        <p class="label">CLASSIFICATION:</p>
        <p class="classification">${e.classification}</p>
      </section>
      <section class="figure-stage">
        <div class="burst"></div>
        <div class="figure"><span>${e.icons[0]}</span></div>
        <div class="reticle"></div>
      </section>
      <section class="indicators">
        <p class="label">INDICATORS DETECTED:</p>
        <ul>${indicators}</ul>
      </section>
      <section class="result-box">
        <p class="label">RESULT:</p>
        <strong>${resultHtml}</strong>
      </section>
      <footer>PRIDE RESPONSE PROTOCOL INITIATED — ALL UNITS RESPOND</footer>
    </article>
  `;
}
