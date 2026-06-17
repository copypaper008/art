'use strict';

// Portrait: place a B&W headshot at poster/portraits/haring.jpg
// Calibrate faceAnchors with the anchor-overlay.js dev tool after adding the image.

/** @type {SubjectConfig} */
const HARING_CONFIG = {
  fileId: 'KH-1958-0504',
  name:   'HARING, KEITH',
  date:   '05.06.2024',

  portrait:        'portraits/haring.jpg',
  imageResolution: '8192 × 10240',
  mode:            'B&W',
  source:          'ARCHIVAL PHOTOGRAPH c. 1985',
  scanDepth:       '96.8%',

  faceAnchors: {
    leftEye:  { x: 175, y: 330 },   // image-left eye (portrait 493×764)
    rightEye: { x: 297, y: 326 },   // image-right eye
    faceOval: [
      { x: 246, y: 205 },   // forehead top
      { x: 325, y: 225 },   // right forehead
      { x: 355, y: 335 },   // right temple
      { x: 345, y: 435 },   // right cheek
      { x: 310, y: 530 },   // right jaw
      { x: 246, y: 575 },   // chin
      { x: 182, y: 530 },   // left jaw
      { x: 145, y: 435 },   // left cheek
      { x: 140, y: 335 },   // left temple
      { x: 168, y: 225 },   // left forehead
    ],
  },

  exhibitionTitle: 'KEITH HARING\nLINES OF RECOGNITION\nA SOLO EXHIBITION',
  dateRange:       '10.01 — 01.15.2025',
  venue:           'MUSEUM OF CONTEMPORARY CULTURAL STUDIES',
  address:         '301 OBSERVATION DRIVE\nMETROPOLIS, NY 10001',

  stamp: {
    text:      'HOMOSEXUAL',
    treatment: 'haring_bold',
    palette:   ['rgba(255,210,0,1)', 'rgba(0,0,0,1)', 'rgba(220,40,40,1)'],
  },
};
