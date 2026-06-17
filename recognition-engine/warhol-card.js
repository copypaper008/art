// Warhol Detection Engine — coded card using the new clean pop-art design

function renderWarholCard() {
  return `
  <div class="wc-page-shell">
    <section class="wc-poster" aria-label="Warhol Detection Engine poster">

      <header class="wc-status-bar">
        <div class="wc-issue-number">01</div>
        <div class="wc-system-name">Recognition Engine</div>
        <div class="wc-subject-count">Subjects: <strong>01</strong><span aria-hidden="true"> ★★★</span></div>
      </header>

      <section class="wc-hero-grid">
        <div class="wc-copy-block">
          <p class="wc-kicker">Detection Engine™</p>
          <h1 class="wc-h1">Warhol</h1>

          <div class="wc-classification">
            <span>Classification:</span>
            <strong>Pop Art<br />Homosexual</strong>
          </div>

          <div class="wc-indicators">
            <h2>Indicators Detected:</h2>
            <ul>
              <li>Excessive use of fluorescent colours</li>
              <li>Suspicious interest in celebrity culture</li>
              <li>Soup can familiarity above baseline</li>
              <li>Factory attendance anomaly</li>
            </ul>
          </div>
        </div>

        <figure class="wc-portrait" aria-label="Andy Warhol portrait scan">
          <img src="posters/warhol-portrait-real.jpg" alt="Pop art portrait of Andy Warhol" />
          <figcaption>Screen print scan active</figcaption>
        </figure>
      </section>

      <section class="wc-soup-strip" aria-label="Andy Warhol soup can sequence">
        <div class="wc-strip-label" aria-hidden="true">Factory output // 06 variants detected</div>
        <div class="wc-film-track">
          <img src="posters/pop-can-1.png" alt="" />
          <img src="posters/pop-can-2.png" alt="" />
          <img src="posters/pop-can-3.png" alt="" />
          <img src="posters/pop-can-4.png" alt="" />
          <img src="posters/pop-can-5.png" alt="" />
          <img src="posters/pop-can-6.png" alt="" />
        </div>
      </section>

      <section class="wc-result-panel" aria-live="polite">
        <span>Result:</span>
        <p id="wcResultText">Subject has been screen printed 16 times</p>
      </section>

      <footer class="wc-ticker" aria-label="Protocol ticker">
        <span id="wcTickerText">Pride response protocol initiated — all units respond</span>
      </footer>

    </section>
  </div>`;
}

function initWarholCard(container) {
  const poster   = container.querySelector('.wc-poster');
  const resultEl = container.querySelector('#wcResultText');
  const tickerEl = container.querySelector('#wcTickerText');

  const resultStates = [
    'Subject has been screen printed 16 times',
    'Celebrity residue detected at critical density',
    'Factory signal confirmed',
    'Soup can familiarity exceeds baseline',
  ];

  let index = 0;

  function triggerGlitch() {
    poster.classList.add('is-glitch');
    setTimeout(() => poster.classList.remove('is-glitch'), 520);
  }

  function rotateResult() {
    index = (index + 1) % resultStates.length;
    resultEl.textContent = resultStates[index];
    tickerEl.textContent = `${resultStates[index]} — pride response protocol initiated — all units respond`;
    triggerGlitch();
  }

  poster.addEventListener('pointerenter', triggerGlitch);
  poster.addEventListener('click', rotateResult);
  container._cardInterval = setInterval(triggerGlitch, 6500);
}
