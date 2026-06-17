'use strict';

// Maps subject.id → iframe element
const _alarmIframes = new Map();

let alarmOverlayActive = false;

function updateAlarmPosters(subjects) {
  const alarmSubjects = subjects.filter(s => s.state === 'ALARM');
  const alarmIds      = new Set(alarmSubjects.map(s => s.id));

  // Remove iframes for subjects that are no longer in ALARM
  for (const [id, iframe] of _alarmIframes) {
    if (!alarmIds.has(id)) {
      iframe.style.opacity = '0';
      setTimeout(() => iframe.remove(), 400);
      _alarmIframes.delete(id);
    }
  }

  alarmOverlayActive = alarmSubjects.length > 0;

  for (const s of alarmSubjects) {
    if (_alarmIframes.has(s.id)) continue;

    // Snapshot at creation time in case subject state changes before iframe loads
    const subjectKey          = s.subjectKey;
    const capturedFaceDataUrl = s.capturedFaceDataUrl;

    const iframe = document.createElement('iframe');
    iframe.src = './poster/index.html?kiosk';
    iframe.style.cssText = [
      'position:fixed', 'inset:0', 'width:100%', 'height:100%',
      'border:none', 'z-index:100',
      'opacity:0', 'transition:opacity 0.4s ease',
    ].join(';');
    document.body.appendChild(iframe);
    _alarmIframes.set(s.id, iframe);

    iframe.addEventListener('load', () => {
      iframe.contentWindow.postMessage({
        type: 'KIOSK_INIT',
        subjectKey,
        capturedFaceDataUrl,
      }, '*');
      requestAnimationFrame(() => { iframe.style.opacity = '1'; });
    });
  }
}
