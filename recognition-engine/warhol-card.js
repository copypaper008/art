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
    </div>

    <div class="wc-cans-frame"></div>

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
