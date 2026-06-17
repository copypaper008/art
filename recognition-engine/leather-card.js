// Leather Detection Engine — fully coded HTML/CSS/SVG card

function renderLeatherCard() {
  return `
  <article class="lc-card">
    <div class="lc-scanline"></div>

    <header class="lc-topbar">
      <span class="lc-id">04</span>
      <span>RECOGNITION ENGINE</span>
      <span>SUBJECTS: 01</span>
    </header>

    <div class="lc-hero">
      <h1>LEATHER</h1>
      <h2>DETECTION ENGINE™</h2>
    </div>

    <div class="lc-classification">
      <span class="lc-label">CLASSIFICATION:</span>
      <span class="lc-class">TOM OF FINLAND HOMOSEXUAL</span>
    </div>

    <div class="lc-figure-stage">
      <div class="lc-reticle-tl"></div>
      <div class="lc-reticle-tr"></div>
      <div class="lc-reticle-bl"></div>
      <div class="lc-reticle-br"></div>
      ${_leatherFigureSVG()}
    </div>

    <div class="lc-indicators">
      <span class="lc-label">INDICATORS DETECTED:</span>
      <ul>
        <li>MOUSTACHE CONFIDENCE ELEVATED</li>
        <li>DENIM DENSITY ABOVE AVERAGE</li>
        <li>MOTORCYCLE OWNERSHIP PROBABILITY 87%</li>
        <li>JAWLINE STRUCTURALLY IMPOSSIBLE</li>
      </ul>
    </div>

    <div class="lc-result">
      <span class="lc-label">RESULT:</span>
      <strong>SUBJECT TOO POWERFUL<br>FOR THIS SYSTEM</strong>
    </div>

    <footer class="lc-footer">
      ★ PRIDE RESPONSE PROTOCOL INITIATED — ALL UNITS RESPOND ★
    </footer>
  </article>`;
}

function _leatherFigureSVG() {
  return `<svg class="lc-face" viewBox="0 0 160 210" xmlns="http://www.w3.org/2000/svg">
    <!-- Dark red-black background -->
    <rect width="160" height="210" fill="#0a0000"/>

    <!-- Subtle vignette -->
    <radialGradient id="lvignette" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#1a0000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.7"/>
    </radialGradient>
    <rect width="160" height="210" fill="url(#lvignette)"/>

    <!-- The figure: Tom of Finland leather man, grey/silver monochrome -->
    <g fill="#b0b0b0" stroke="#000" stroke-linejoin="round" stroke-linecap="round">

      <!-- Peaked leather cap brim -->
      <ellipse cx="80" cy="32" rx="46" ry="7" fill="#555" stroke="#000" stroke-width="2"/>
      <!-- Cap body -->
      <path d="M 36 32 Q 36 8 80 6 Q 124 8 124 32 Z" fill="#444" stroke="#000" stroke-width="2"/>
      <!-- Cap crown indent -->
      <path d="M 50 24 Q 80 18 110 24" fill="none" stroke="#222" stroke-width="2"/>
      <!-- Cap badge (eagle/insignia placeholder) -->
      <polygon points="80,14 84,20 78,18 80,24 76,18 72,20" fill="#888" stroke="#000" stroke-width="1"/>

      <!-- Face -->
      <ellipse cx="80" cy="54" rx="34" ry="36" fill="#aaa" stroke="#000" stroke-width="2.5"/>

      <!-- Forehead shadow under cap -->
      <path d="M 46 38 Q 80 44 114 38 Q 108 50 80 48 Q 52 50 46 38 Z"
            fill="#888" opacity="0.5"/>

      <!-- Strong brow ridge -->
      <path d="M 50 44 Q 67 39 78 42" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M 82 42 Q 93 39 110 44" stroke="#333" stroke-width="3.5" fill="none" stroke-linecap="round"/>

      <!-- Deep-set eyes — intense gaze -->
      <ellipse cx="62" cy="52" rx="9" ry="6" fill="#222" stroke="#000" stroke-width="1.5"/>
      <ellipse cx="98" cy="52" rx="9" ry="6" fill="#222" stroke="#000" stroke-width="1.5"/>
      <!-- Eye highlights -->
      <circle cx="65" cy="50" r="2.5" fill="#fff" opacity="0.9"/>
      <circle cx="101" cy="50" r="2.5" fill="#fff" opacity="0.9"/>

      <!-- Nose — strong, square -->
      <path d="M 76 55 L 74 68 Q 80 72 86 68 L 84 55" fill="#999" stroke="#333" stroke-width="1.5"/>
      <!-- Nostrils -->
      <ellipse cx="72" cy="69" rx="5" ry="3.5" fill="#777"/>
      <ellipse cx="88" cy="69" rx="5" ry="3.5" fill="#777"/>

      <!-- Thick Tom of Finland moustache — signature element -->
      <path d="M 54 76 Q 65 70 80 73 Q 95 70 106 76 Q 95 84 80 81 Q 65 84 54 76 Z"
            fill="#555" stroke="#000" stroke-width="2"/>
      <!-- Moustache highlight -->
      <path d="M 62 74 Q 80 71 98 74" fill="none" stroke="#888" stroke-width="1.2" opacity="0.6"/>

      <!-- Strong jaw and chin -->
      <path d="M 46 72 Q 44 92 80 100 Q 116 92 114 72"
            fill="#aaa" stroke="#000" stroke-width="2.5"/>
      <!-- Chin cleft -->
      <path d="M 78 96 Q 80 100 82 96" fill="none" stroke="#666" stroke-width="2"/>

      <!-- Thick neck -->
      <rect x="62" y="96" width="36" height="28" fill="#aaa" stroke="#000" stroke-width="2.5" rx="4"/>
      <!-- Neck shadow -->
      <path d="M 62 100 Q 80 106 98 100" fill="#888" opacity="0.4"/>

      <!-- Shoulders — massively broad -->
      <path d="M 0 130 Q 20 108 50 112 L 62 120 L 62 124 L 50 120 Q 22 116 4 138 Z"
            fill="#888" stroke="#000" stroke-width="2"/>
      <path d="M 160 130 Q 140 108 110 112 L 98 120 L 98 124 L 110 120 Q 138 116 156 138 Z"
            fill="#888" stroke="#000" stroke-width="2"/>

      <!-- Chest / torso -->
      <path d="M 50 120 Q 50 210 80 210 Q 110 210 110 120 L 98 120 Q 98 130 80 132 Q 62 130 62 120 Z"
            fill="#999" stroke="#000" stroke-width="2.5"/>

      <!-- Leather harness straps -->
      <!-- Diagonal strap left shoulder to right hip -->
      <path d="M 50 118 L 62 126 L 90 180 L 82 182 L 54 128 Z"
            fill="#333" stroke="#000" stroke-width="1.5"/>
      <!-- Diagonal strap right shoulder to left hip -->
      <path d="M 110 118 L 98 126 L 70 180 L 78 182 L 106 128 Z"
            fill="#333" stroke="#000" stroke-width="1.5"/>
      <!-- Horizontal chest strap -->
      <path d="M 48 138 L 112 138 L 112 145 L 48 145 Z"
            fill="#333" stroke="#000" stroke-width="1.5"/>
      <!-- Strap buckle/ring at center -->
      <circle cx="80" cy="141" r="7" fill="none" stroke="#888" stroke-width="3"/>
      <circle cx="80" cy="141" r="3" fill="#666" stroke="#000" stroke-width="1"/>

      <!-- Pectoral muscles suggested by shadow -->
      <path d="M 64 126 Q 74 138 80 136 Q 86 138 96 126" fill="none" stroke="#777" stroke-width="2" opacity="0.6"/>

    </g>

    <!-- Halftone dot texture over figure -->
    <pattern id="ldots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="0.6" fill="#000" opacity="0.15"/>
    </pattern>
    <rect width="160" height="210" fill="url(#ldots)"/>
  </svg>`;
}
