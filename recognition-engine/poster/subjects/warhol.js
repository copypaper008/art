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
    leftEye:  { x: 175, y: 298 },   // image-left eye (portrait 495×690)
    rightEye: { x: 300, y: 293 },   // image-right eye
    faceOval: [
      { x: 248, y: 165 },   // forehead top
      { x: 325, y: 190 },   // right forehead
      { x: 360, y: 295 },   // right temple
      { x: 350, y: 390 },   // right cheek
      { x: 315, y: 480 },   // right jaw
      { x: 248, y: 525 },   // chin
      { x: 180, y: 480 },   // left jaw
      { x: 140, y: 390 },   // left cheek
      { x: 133, y: 295 },   // left temple
      { x: 168, y: 190 },   // left forehead
    ],
  },

  exhibitionTitle: 'ANDY WARHOL\nRECOGNITION & SIMULATION\nA SOLO EXHIBITION',
  dateRange:       '06.01 — 09.22.2024',
  venue:           'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
  address:         '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',

  stamp: {
    text:      'HOMOSEXUAL',
    treatment: 'warhol_pop',
    palette:   ['rgba(185,8,8,1)', 'rgba(255,0,180,1)', 'rgba(0,200,220,1)'],
  },
};
