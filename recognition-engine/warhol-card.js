// Warhol Detection Engine — fully coded HTML/CSS/SVG card

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
      ${[0, 200, 300, 330].map((hue, i) => `
        <div class="wc-can" style="filter:hue-rotate(${hue}deg)">
          <div class="wc-can-top"></div>
          <div class="wc-can-body">
            <div class="wc-can-red-top"></div>
            <div class="wc-can-gold-band"></div>
            <div class="wc-can-label">
              <div class="wc-can-campbells">Campbell's</div>
              <div class="wc-can-condensed">CONDENSED</div>
              <div class="wc-can-soup">Tomato<br>SOUP</div>
            </div>
            <div class="wc-can-gold-band"></div>
            <div class="wc-can-red-bot"></div>
          </div>
          <div class="wc-can-bottom"></div>
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
    <!-- Teal background matching poster -->
    <rect width="160" height="200" fill="#0e3540"/>

    <!-- Subtle dot texture on bg -->
    <pattern id="wbgdots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="5" r="0.7" fill="#00e5ff" opacity="0.18"/>
    </pattern>
    <rect width="160" height="200" fill="url(#wbgdots)"/>

    <!-- Platinum/silver wig — voluminous Warhol bouffant -->
    <!-- Main wig mass -->
    <ellipse cx="80" cy="46" rx="65" ry="56" fill="#d8d8d8"/>
    <!-- Wig highlight — lighter center -->
    <ellipse cx="80" cy="34" rx="50" ry="38" fill="#e8e8e8"/>
    <ellipse cx="72" cy="28" rx="28" ry="18" fill="#f0f0f0" opacity="0.7"/>
    <!-- Wig sides hanging down -->
    <path d="M 14 50 Q 10 72 16 100 Q 22 80 28 60 Z" fill="#c8c8c8"/>
    <path d="M 146 50 Q 150 72 144 100 Q 138 80 132 60 Z" fill="#c8c8c8"/>
    <!-- Wig shadow/depth at base -->
    <path d="M 22 88 Q 22 100 36 104 Q 80 112 124 104 Q 138 100 138 88 Q 110 96 80 96 Q 50 96 22 88 Z"
          fill="#aaa" opacity="0.5"/>

    <!-- Face — flat orange/amber Warhol silkscreen style -->
    <!-- Main face oval -->
    <ellipse cx="80" cy="118" rx="54" ry="60" fill="#e86b10"/>
    <!-- Forehead blending into wig -->
    <ellipse cx="80" cy="78" rx="52" ry="30" fill="#e86b10"/>

    <!-- Subtle cheek shadow -->
    <ellipse cx="40" cy="122" rx="15" ry="11" fill="#c04800" opacity="0.35"/>
    <ellipse cx="120" cy="122" rx="15" ry="11" fill="#c04800" opacity="0.35"/>

    <!-- Eyebrows — thin dark arches -->
    <path d="M 38 88 Q 54 82 66 86" stroke="#4a1400" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 94 86 Q 106 82 122 88" stroke="#4a1400" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- Large oval dark sunglasses — Warhol signature -->
    <!-- Frames -->
    <ellipse cx="58" cy="102" rx="25" ry="19" fill="#0a0a0a"/>
    <ellipse cx="102" cy="102" rx="25" ry="19" fill="#0a0a0a"/>
    <!-- Lens tint — very dark -->
    <ellipse cx="58" cy="102" rx="21" ry="15" fill="#0d0d0d"/>
    <ellipse cx="102" cy="102" rx="21" ry="15" fill="#0d0d0d"/>
    <!-- Very subtle lens sheen -->
    <ellipse cx="51" cy="97" rx="6" ry="4" fill="#222" opacity="0.7"/>
    <ellipse cx="95" cy="97" rx="6" ry="4" fill="#222" opacity="0.7"/>
    <!-- Bridge connecting lenses -->
    <path d="M 79 100 Q 80 98 81 100 Q 80 104 79 100 Z" fill="#0a0a0a"/>
    <rect x="76" y="99" width="8" height="6" fill="#0a0a0a" rx="2"/>
    <!-- Temple arms -->
    <line x1="33" y1="101" x2="16" y2="98" stroke="#0a0a0a" stroke-width="5" stroke-linecap="round"/>
    <line x1="127" y1="101" x2="144" y2="98" stroke="#0a0a0a" stroke-width="5" stroke-linecap="round"/>

    <!-- Nose — minimal shadow suggestion -->
    <path d="M 76 118 L 73 132 Q 80 137 87 132 L 84 118" fill="#c04800" opacity="0.35"/>
    <ellipse cx="72" cy="132" rx="5" ry="3.5" fill="#9a3000" opacity="0.4"/>
    <ellipse cx="88" cy="132" rx="5" ry="3.5" fill="#9a3000" opacity="0.4"/>

    <!-- Lips — bold hot pink Warhol flat -->
    <path d="M 54 148 Q 67 140 80 143 Q 93 140 106 148 Q 93 162 80 159 Q 67 162 54 148 Z"
          fill="#e0105a"/>
    <!-- Upper lip line -->
    <path d="M 54 148 Q 67 140 80 143 Q 93 140 106 148" fill="none" stroke="#b00040" stroke-width="1.5"/>

    <!-- Jaw / chin area -->
    <ellipse cx="80" cy="162" rx="44" ry="22" fill="#d45a08"/>

    <!-- Neck -->
    <rect x="64" y="170" width="32" height="26" fill="#cc5208" rx="3"/>

    <!-- Dark turtleneck — signature Warhol -->
    <path d="M 0 200 L 34 172 L 60 182 L 64 174 L 80 168 L 96 174 L 100 182 L 126 172 L 160 200 Z"
          fill="#111"/>
    <!-- Turtleneck roll -->
    <ellipse cx="80" cy="179" rx="22" ry="7" fill="#1a1a1a"/>
    <path d="M 60 180 Q 80 172 100 180" fill="none" stroke="#333" stroke-width="2"/>

    <!-- Halftone dot overlay — Warhol screen-print feel -->
    <pattern id="wdots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="0.7" fill="#000" opacity="0.1"/>
    </pattern>
    <rect width="160" height="200" fill="url(#wdots)"/>
  </svg>`;
}
