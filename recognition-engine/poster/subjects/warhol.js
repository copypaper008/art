'use strict';

// Portrait: place a B&W headshot at poster/portraits/warhol.jpg
// Calibrate faceAnchors with the anchor-overlay.js dev tool after adding the image.

/** @type {SubjectConfig} */
const WARHOL_CONFIG = {
  fileId: 'AW-1928-0601',
  name:   'WARHOL, ANDY',
  date:   '05.06.2024',

  portrait:        'portraits/warhol.jpg',
  imageResolution: '8192 × 10240',
  mode:            'B&W',
  source:          'ARCHIVAL PHOTOGRAPH c. 1967',
  scanDepth:       '97.2%',

  faceAnchors: {
    leftEye:  { x: 268, y: 296 },   // subject's left eye (image-left side)
    rightEye: { x: 418, y: 292 },   // subject's right eye (image-right side)
    faceOval: [
      { x: 342, y: 162 },   // forehead top
      { x: 430, y: 192 },   // right forehead
      { x: 466, y: 290 },   // right temple
      { x: 454, y: 400 },   // right cheek
      { x: 422, y: 482 },   // right jaw
      { x: 342, y: 514 },   // chin
      { x: 262, y: 482 },   // left jaw
      { x: 228, y: 400 },   // left cheek
      { x: 218, y: 290 },   // left temple
      { x: 255, y: 192 },   // left forehead
    ],
  },

  exhibitionTitle: 'ANDY WARHOL\nRECOGNITION & SIMULATION\nA SOLO EXHIBITION',
  dateRange:       '06.01 — 09.22.2024',
  venue:           'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
  address:         '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',
};
