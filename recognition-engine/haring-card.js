// Haring Recognition Engine — fully coded HTML/CSS/SVG card

function renderHaringCard() {
  return `
  <article class="hc-card">
    <div class="hc-scanline"></div>

    <header class="hc-topbar">
      <span class="hc-id">02</span>
      <span>RECOGNITION ENGINE</span>
      <span>SUBJECTS: 01</span>
    </header>

    <div class="hc-hero">
      <h1>HARING</h1>
      <h2>RECOGNITION ENGINE™</h2>
    </div>

    <div class="hc-classification">
      <span class="hc-label">CLASSIFICATION:</span>
      <span class="hc-class">DANCING FIGURE HOMOSEXUAL</span>
    </div>

    <div class="hc-figure-stage">
      <div class="hc-reticle-tl"></div>
      <div class="hc-reticle-tr"></div>
      <div class="hc-reticle-bl"></div>
      <div class="hc-reticle-br"></div>

      <!-- Corner decorative Haring figures -->
      <svg class="hc-deco hc-deco-tl" width="44" height="44" viewBox="0 0 44 44">
        ${_haringSmallDancer(22, 22, '#ff2b00')}
      </svg>
      <svg class="hc-deco hc-deco-tr" width="44" height="44" viewBox="0 0 44 44">
        ${_haringSmallDancer(22, 22, '#ff2b00')}
      </svg>
      <svg class="hc-deco hc-deco-bl" width="44" height="44" viewBox="0 0 44 44">
        ${_haringDog(22, 22, '#ff2b00')}
      </svg>
      <svg class="hc-deco hc-deco-br" width="44" height="44" viewBox="0 0 44 44">
        ${_haringDog(22, 22, '#ff2b00')}
      </svg>

      ${_haringMainFigureSVG()}
    </div>

    <div class="hc-indicators">
      <span class="hc-label">INDICATORS DETECTED:</span>
      <ul>
        <li>MOVEMENT EXCEEDS HETERONORMATIVE LIMITS</li>
        <li>RADIANT ENERGY SIGNATURES DETECTED</li>
        <li>UNAUTHORISED JOY EVENT IN PROGRESS</li>
        <li>BARKING DOG PROXIMITY ELEVATED</li>
      </ul>
    </div>

    <div class="hc-result">
      <span class="hc-label">RESULT:</span>
      <strong>SUBJECT CURRENTLY<br>WERKING</strong>
    </div>

    <footer class="hc-footer">
      ★ PRIDE RESPONSE PROTOCOL INITIATED — ALL UNITS RESPOND ★
    </footer>
  </article>`;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function _haringMainFigureSVG() {
  return `<svg class="hc-face" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
    <rect width="160" height="200" fill="#0a0000"/>

    <!-- Background radiant lines (energy field) -->
    <g stroke="#ff2b00" stroke-width="1.2" opacity="0.22">
      ${Array.from({length: 16}, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r1 = 30, r2 = 95;
        const x1 = 80 + Math.cos(a) * r1, y1 = 95 + Math.sin(a) * r1;
        const x2 = 80 + Math.cos(a) * r2, y2 = 95 + Math.sin(a) * r2;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      }).join('')}
    </g>

    <!-- Background small dancing figures -->
    <g opacity="0.18" fill="#ff2b00">
      ${_haringSmallDancer(20, 30, '#ff2b00', 0.45)}
      ${_haringSmallDancer(140, 30, '#ff2b00', 0.45)}
      ${_haringSmallDancer(14, 160, '#ff2b00', 0.45)}
      ${_haringSmallDancer(146, 160, '#ff2b00', 0.45)}
    </g>

    <!-- Main dancing figure — white, bold Haring style -->
    <g fill="#ffffff" stroke="#000000" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Head -->
      <circle cx="80" cy="38" r="22"/>
      <!-- Body -->
      <rect x="57" y="58" width="46" height="50" rx="11"/>
      <!-- Left arm — raised high -->
      <path d="M 57 70 C 42 60 28 46 16 32" stroke="#fff" stroke-width="13" fill="none"/>
      <!-- Right arm — out and up -->
      <path d="M 103 70 C 118 58 132 44 144 28" stroke="#fff" stroke-width="13" fill="none"/>
      <!-- Left leg — kicked out left -->
      <path d="M 66 108 C 54 130 42 152 30 170" stroke="#fff" stroke-width="13" fill="none"/>
      <!-- Right leg — bent/dancing -->
      <path d="M 94 108 C 110 132 122 150 132 168" stroke="#fff" stroke-width="13" fill="none"/>
    </g>

    <!-- Radiant lines from figure — energy -->
    <g stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.65">
      <line x1="80" y1="6"   x2="80" y2="-2"/>
      <line x1="100" y1="12" x2="108" y2="5"/>
      <line x1="60"  y1="12" x2="52"  y2="5"/>
      <line x1="110" y1="32" x2="120" y2="26"/>
      <line x1="50"  y1="32" x2="40"  y2="26"/>
      <line x1="118" y1="58" x2="128" y2="54"/>
      <line x1="42"  y1="58" x2="32"  y2="54"/>
    </g>

    <!-- Dot halftone texture -->
    <pattern id="hdots" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="3.5" cy="3.5" r="0.7" fill="#000" opacity="0.18"/>
    </pattern>
    <rect width="160" height="200" fill="url(#hdots)"/>
  </svg>`;
}

// Small Haring-style dancer (used in corners and background)
function _haringSmallDancer(cx, cy, color, scale = 1.0) {
  const s = scale;
  const r = 8 * s, bw = 14 * s, bh = 16 * s, lw = 5 * s;
  const sw = Math.max(1, 2.5 * s);
  return `<g transform="translate(${cx},${cy})" fill="${color}" stroke="#000" stroke-width="${sw}" stroke-linecap="round">
    <circle cx="0" cy="${-bh - r}" r="${r}"/>
    <rect x="${-bw/2}" y="${-bh}" width="${bw}" height="${bh}" rx="${4*s}"/>
    <line x1="${-bw/2}" y1="${-bh*0.7}" x2="${-bw/2 - 12*s}" y2="${-bh - 8*s}" stroke="${color}" stroke-width="${lw}"/>
    <line x1="${bw/2}"  y1="${-bh*0.7}" x2="${bw/2  + 12*s}" y2="${-bh - 8*s}" stroke="${color}" stroke-width="${lw}"/>
    <line x1="${-bw/4}" y1="0"          x2="${-bw/2 - 6*s}"  y2="${14*s}"      stroke="${color}" stroke-width="${lw}"/>
    <line x1="${bw/4}"  y1="0"          x2="${bw/2  + 6*s}"   y2="${14*s}"      stroke="${color}" stroke-width="${lw}"/>
  </g>`;
}

// Small Haring-style barking dog
function _haringDog(cx, cy, color, scale = 1.0) {
  const s = scale;
  const sw = Math.max(1, 2.5 * s);
  return `<g transform="translate(${cx - 18*s}, ${cy - 10*s})" fill="${color}" stroke="#000" stroke-width="${sw}" stroke-linecap="round">
    <!-- Body -->
    <ellipse cx="${16*s}" cy="${10*s}" rx="${16*s}" ry="${9*s}"/>
    <!-- Head -->
    <ellipse cx="${32*s}" cy="${4*s}" rx="${9*s}" ry="${8*s}"/>
    <!-- Ear -->
    <path d="M ${26*s} ${-2*s} Q ${24*s} ${-10*s} ${32*s} ${-4*s} Z"/>
    <!-- Tail (curled up) -->
    <path d="M ${0*s} ${6*s} Q ${-10*s} ${0} ${-6*s} ${-8*s}" fill="none" stroke="${color}" stroke-width="${4*s}"/>
    <!-- Legs -->
    <line x1="${8*s}"  y1="${18*s}" x2="${6*s}"  y2="${28*s}" stroke="${color}" stroke-width="${4*s}"/>
    <line x1="${15*s}" y1="${18*s}" x2="${14*s}" y2="${28*s}" stroke="${color}" stroke-width="${4*s}"/>
    <line x1="${22*s}" y1="${18*s}" x2="${22*s}" y2="${28*s}" stroke="${color}" stroke-width="${4*s}"/>
    <line x1="${28*s}" y1="${16*s}" x2="${30*s}" y2="${26*s}" stroke="${color}" stroke-width="${4*s}"/>
    <!-- Bark lines -->
    <line x1="${40*s}" y1="${0}"     x2="${46*s}" y2="${-5*s}" stroke="${color}" stroke-width="${3*s}"/>
    <line x1="${40*s}" y1="${4*s}"  x2="${47*s}" y2="${4*s}"  stroke="${color}" stroke-width="${3*s}"/>
    <line x1="${40*s}" y1="${8*s}"  x2="${46*s}" y2="${13*s}" stroke="${color}" stroke-width="${3*s}"/>
  </g>`;
}
