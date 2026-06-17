'use strict';

// Portrait: substitute a proper B&W portrait of Haring.
// haring.png in /posters/ is the pop-art card asset; replace with a
// frontal headshot and re-calibrate the faceAnchors below.
// Placeholder anchors assume a similar 684 × 816 crop.

/** @type {SubjectConfig} */
const HARING_CONFIG = {
  fileId: 'KH-1958-0504',
  name:   'HARING, KEITH',
  date:   '05.06.2024',

  portrait:        '../posters/haring.png',
  imageResolution: '8192 × 10240',
  mode:            'B&W',
  source:          'ARCHIVAL PHOTOGRAPH c. 1985',
  scanDepth:       '96.8%',

  faceAnchors: {
    // Placeholder — run anchor-overlay.js to calibrate against your portrait.
    leftEye:  { x: 268, y: 296 },
    rightEye: { x: 418, y: 292 },
    faceOval: [
      { x: 342, y: 162 },
      { x: 430, y: 192 },
      { x: 466, y: 290 },
      { x: 454, y: 400 },
      { x: 422, y: 482 },
      { x: 342, y: 514 },
      { x: 262, y: 482 },
      { x: 228, y: 400 },
      { x: 218, y: 290 },
      { x: 255, y: 192 },
    ],
  },

  exhibitionTitle: 'KEITH HARING\nLINES OF RECOGNITION\nA SOLO EXHIBITION',
  dateRange:       '10.01 — 01.15.2025',
  venue:           'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
  address:         '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',
};
