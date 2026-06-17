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
      <img class="wc-face" src="posters/warhol.png" />
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

