// Warhol Detection Engine — fully coded HTML/CSS/SVG card
// Renders in place of the warhol.png poster image

function renderWarholCard() {
  return `
  <article class="wc-card">
    <div class="wc-scanline"></div>

    <header class="wc-topbar">
      <span class="wc-id">01</span>
      <span>RECOGNITION ENGINE</span>
      <span>SUBJECTS: 01</span>
    </header>

    <div class="wc-hero">
      <h1>WARHOL</h1>
      <h2>DETECTION ENGINE™</h2>
    </div>

    <div class="wc-classification">
      <span class="wc-label">CLASSIFICATION:</span>
      <span class="wc-class">POP ART HOMOSEXUAL</span>
    </div>

    <div class="wc-figure-stage">
      <div class="wc-reticle-tl"></div>
      <div class="wc-reticle-tr"></div>
      <div class="wc-reticle-bl"></div>
      <div class="wc-reticle-br"></div>
      ${_warholPortraitSVG()}
    </div>

    <div class="wc-cans">
      ${[0, 150, 210, 295].map(hue => `
        <div class="wc-can" style="filter:hue-rotate(${hue}deg)">
          <div class="wc-can-rim top"></div>
          <div class="wc-can-body">
            <div class="wc-band"></div>
            <div class="wc-label-area">
              <span class="wc-campbells">Campbell's</span>
              <span class="wc-condensed">CONDENSED</span>
              <span class="wc-soup">Tomato<br>SOUP</span>
            </div>
            <div class="wc-band"></div>
          </div>
          <div class="wc-can-rim bot"></div>
        </div>
      `).join('')}
    </div>

    <div class="wc-indicators">
      <span class="wc-label">INDICATORS DETECTED:</span>
      <ul>
        <li>EXCESSIVE USE OF FLUORESCENT COLOURS</li>
        <li>SUSPICIOUS INTEREST IN CELEBRITY CULTURE</li>
        <li>SOUP CAN FAMILIARITY ABOVE BASELINE</li>
        <li>FACTORY ATTENDANCE ANOMALY</li>
      </ul>
    </div>

    <div class="wc-result">
      <span class="wc-label">RESULT:</span>
      <strong>SUBJECT HAS BEEN<br>SCREEN PRINTED 16 TIMES</strong>
    </div>

    <footer class="wc-footer">
      ★ PRIDE RESPONSE PROTOCOL INITIATED — ALL UNITS RESPOND ★
    </footer>
  </article>`;
}

function _warholPortraitSVG() {
  return `<svg class="wc-face" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
    <!-- Vivid yellow background — classic Warhol silkscreen ground -->
    <rect width="160" height="200" fill="#ffe000"/>

    <!-- Hair — dark, voluminous, slightly silver-grey bouffant -->
    <ellipse cx="80" cy="38" rx="64" ry="52" fill="#1a1a1a"/>
    <ellipse cx="80" cy="44" rx="58" ry="46" fill="#2a2a2a"/>
    <!-- Silver highlight on hair -->
    <ellipse cx="72" cy="26" rx="28" ry="16" fill="#888" opacity="0.35"/>

    <!-- Side hair coming down to temples -->
    <path d="M 18 90 Q 14 60 20 34 Q 26 62 28 90 Z" fill="#1a1a1a"/>
    <path d="M 142 90 Q 146 60 140 34 Q 134 62 132 90 Z" fill="#1a1a1a"/>

    <!-- Face/skin — warm yellow, flat Warhol style -->
    <ellipse cx="80" cy="114" rx="52" ry="64" fill="#f5c518"/>
    <!-- Forehead -->
    <ellipse cx="80" cy="72" rx="50" ry="26" fill="#f5c518"/>

    <!-- Cheek blush / shadow — subtle orange wash -->
    <ellipse cx="42" cy="116" rx="16" ry="12" fill="#e8a000" opacity="0.4"/>
    <ellipse cx="118" cy="116" rx="16" ry="12" fill="#e8a000" opacity="0.4"/>

    <!-- Eyebrows — thin, dark -->
    <path d="M 38 82 Q 58 76 66 80" stroke="#2a1800" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 94 80 Q 102 76 122 82" stroke="#2a1800" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- Glasses — large dark oval frames, Warhol's signature -->
    <ellipse cx="58" cy="100" rx="23" ry="17" fill="#111"/>
    <ellipse cx="102" cy="100" rx="23" ry="17" fill="#111"/>
    <!-- Lens tint — very dark, barely see-through -->
    <ellipse cx="58" cy="100" rx="19" ry="13" fill="#1a1000" opacity="0.9"/>
    <ellipse cx="102" cy="100" rx="19" ry="13" fill="#1a1000" opacity="0.9"/>
    <!-- Lens glint -->
    <ellipse cx="50" cy="95" rx="5" ry="3" fill="#333" opacity="0.6"/>
    <ellipse cx="94" cy="95" rx="5" ry="3" fill="#333" opacity="0.6"/>
    <!-- Bridge -->
    <rect x="77" y="97" width="6" height="5" fill="#111" rx="2"/>
    <!-- Temple arms -->
    <line x1="35" y1="99" x2="22" y2="96" stroke="#111" stroke-width="4.5" stroke-linecap="round"/>
    <line x1="125" y1="99" x2="138" y2="96" stroke="#111" stroke-width="4.5" stroke-linecap="round"/>

    <!-- Nose — minimal suggestion -->
    <path d="M 76 118 L 72 133 Q 80 138 88 133 L 84 118 Z" fill="#e0a800" opacity="0.45"/>
    <!-- Nostrils -->
    <ellipse cx="72" cy="133" rx="5" ry="3" fill="#cc8800" opacity="0.5"/>
    <ellipse cx="88" cy="133" rx="5" ry="3" fill="#cc8800" opacity="0.5"/>

    <!-- Lips — flat hot pink, Warhol-bold -->
    <path d="M 56 147 Q 80 138 104 147 Q 80 160 56 147 Z" fill="#cc2244"/>
    <!-- Upper lip cupid's bow -->
    <path d="M 56 147 Q 68 141 80 144 Q 92 141 104 147" fill="none" stroke="#aa1133" stroke-width="1.5"/>
    <!-- Lip line -->
    <line x1="56" y1="147" x2="104" y2="147" stroke="#990022" stroke-width="1"/>

    <!-- Jaw / chin -->
    <ellipse cx="80" cy="162" rx="42" ry="22" fill="#f0b810"/>

    <!-- Neck -->
    <rect x="64" y="170" width="32" height="24" fill="#e8a800" rx="4"/>

    <!-- Black turtleneck — Warhol's signature look -->
    <path d="M 0 200 L 38 172 L 60 182 L 64 174 L 80 168 L 96 174 L 100 182 L 122 172 L 160 200 Z"
          fill="#111"/>
    <!-- Turtleneck roll -->
    <path d="M 58 180 Q 80 170 102 180 Q 80 188 58 180 Z" fill="#1a1a1a"/>

    <!-- Subtle dot/screen-print texture overlay -->
    <pattern id="wdots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="0.8" fill="#000" opacity="0.12"/>
    </pattern>
    <rect width="160" height="200" fill="url(#wdots)"/>
  </svg>`;
}
