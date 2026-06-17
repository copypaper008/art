'use strict';

const CHARACTERISTIC_POOL = [
  'Displays advanced understanding of image production',
  'Demonstrates sustained interest in celebrity ecosystems',
  'Maintains controlled emotional presentation',
  'Repeatedly converts personal experience into cultural artefact',
  'Identity appears partially self-constructed',
  'Exhibits fascination with visibility',
  'Human authenticity cannot be independently verified',
  'Demonstrates systematic cultural legibility',
  'Presents recognisable persona across media contexts',
  'Output suggests preoccupation with surface and depth simultaneously',
  'Transforms biographical material into aesthetic framework',
  'Sustains public identity through repetition and variation',
  'Engages with commodity structures reflexively',
  'Occupies multiple cultural registers simultaneously',
  'Demonstrates consistent self-referential aesthetic strategy',
];

const CLASSIFICATION_POOL = [
  'CULTURAL ICON',
  'CULTURAL ARTEFACT',
  'SOCIAL ARCHETYPE',
  'PATTERN ENTITY',
  'SYMBOLIC FIGURE',
  'COLLECTIVE PROJECTION',
];

const INTERPRETATION_SENTENCES = [
  'Subject exhibits multiple indicators associated with a recognised cultural archetype.',
  'Pattern analysis suggests elevated symbolic function within documented social frameworks.',
  'Observed characteristics are consistent with historical classification precedents.',
  'Subject demonstrates sustained production of legible cultural output.',
  'Behavioural signatures indicate long-term engagement with public identity construction.',
  'Cross-referencing against known matrices yields high-confidence category assignment.',
  'Structural analysis of subject output reveals repeating self-referential motifs.',
  'Subject occupies a stable position within the dominant symbolic order.',
];

const REF_PREFIXES = ['CM', 'CV', 'CA', 'CB', 'CX'];
const REF_NUMS     = ['11', '13', '22', '33', '34', '41', '44'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** @returns {Determination} */
function generateDetermination() {
  const confidence     = (99 + Math.random() * 0.99).toFixed(2);
  const reflectionScore = (95 + Math.random() * 4).toFixed(1);
  const characteristics = shuffle(CHARACTERISTIC_POOL).slice(0, randInt(6, 7));
  const interpretation  = shuffle(INTERPRETATION_SENTENCES).slice(0, 2);
  const classification  = CLASSIFICATION_POOL[randInt(0, CLASSIFICATION_POOL.length - 1)];

  const referenceMatrices = Array.from({ length: 5 }, () => ({
    code:  `${REF_PREFIXES[randInt(0, REF_PREFIXES.length - 1)]}-${REF_NUMS[randInt(0, REF_NUMS.length - 1)]}`,
    value: Math.random().toFixed(2),
  }));

  return {
    scanStatus: 'COMPLETE',
    confidence,
    reflectionScore,
    characteristics,
    interpretation,
    classification,
    explanation: 'NOT AVAILABLE',
    referenceMatrices,
  };
}
