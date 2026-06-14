const phraseBanks = {
  empty: [
    "AWAITING SURFACE DISTURBANCE",
    "NO SUBJECT DETECTED",
    "REFLECTION UNSTABLE",
    "FIELD INACTIVE",
    "SCANNING",
    "CALIBRATING",
    "SYSTEM READY / NOTHING TO READ",
    "PRESENCE THRESHOLD: UNMET",
  ],

  approaching: [
    "PRESENCE DETECTED",
    "SURFACE RESPONSE BEGINNING",
    "SUBJECT NOT YET LEGIBLE",
    "SIGNAL EMERGING",
    "CONTACT INITIATED",
    "BOUNDARY APPROACHING",
  ],

  detected: [
    "SUBJECT DETECTED",
    "RECOGNITION ATTEMPT ACTIVE",
    "VISIBLE / NOT VERIFIED",
    "SURFACE READING INCOMPLETE",
    "ANALYSIS IN PROGRESS",
    "INTERPRETATION PENDING",
  ],

  still: [
    "BECOMING LEGIBLE",
    "HELD IN SUSPENSION",
    "WAITING AT THE SURFACE",
    "CLARITY INCREASED / MEANING UNRESOLVED",
    "STILLNESS REGISTERED",
    "DETAIL ACCUMULATING",
    "SUBJECT YIELDING TO OBSERVATION",
    "PARTIALLY KNOWN",
  ],

  moving: [
    "OUTLINE UNSTABLE",
    "REFUSING CAPTURE",
    "INTERPRETATION DRIFT",
    "SUBJECT EXCEEDS FRAME",
    "CLASSIFICATION INTERRUPTED",
    "MOTION RESISTS READING",
    "EDGE DEFINITION LOST",
    "FORM IN FLUX",
  ],

  close: [
    "PROXIMITY THRESHOLD EXCEEDED",
    "SURFACE PRESSURE INCREASING",
    "SUBJECT OCCUPYING FIELD",
    "TOO CLOSE TO CONTAIN",
  ],

  distant: [
    "SUBJECT AT PERIMETER",
    "SIGNAL ATTENUATED",
    "READING FROM DISTANCE",
    "APPROACHING LEGIBILITY",
  ],

  observing: [
    "HELD AT THE SURFACE",
    "VISIBLE, BUT NOT CONTAINED",
    "DURATION NOTED",
    "PATTERN EMERGING / UNCONFIRMED",
    "ACCUMULATION DETECTED",
    "SUBJECT PERSISTS",
  ],

  contradiction: [
    ["CONFIDENT", "UNCERTAIN"],
    ["OPEN", "GUARDED"],
    ["FAMILIAR", "UNREADABLE"],
    ["PRESENT", "ELSEWHERE"],
    ["SEEN", "MISUNDERSTOOD"],
    ["KNOWN", "OPAQUE"],
    ["LEGIBLE", "IMPOSSIBLE"],
    ["ARRIVING", "ALREADY GONE"],
    ["CLEAR", "UNRESOLVED"],
    ["CONTAINED", "EXCEEDING"],
  ],

  relational: [
    "RECOGNITION DISTRIBUTED",
    "CLEARER IN RELATION",
    "BELONGING DETECTED / CONFIDENCE UNCERTAIN",
    "BOUNDARY BETWEEN SUBJECTS UNSTABLE",
    "SELF-IMAGE CONTAMINATED BY OTHERS",
    "COLLECTIVE PRESENCE REGISTERED",
    "SHARED FIELD DETECTED",
    "DEFINITION REQUIRES ANOTHER",
  ],

  fading: [
    "TRACE REMAINS",
    "ABSENCE RECORDED AS PRESSURE",
    "SURFACE ALTERED",
    "NOTHING FULLY LEAVES",
    "SUBJECT ABSENT / IMPRINT PERSISTS",
    "FIELD DISTURBED",
    "MEMORY OF PRESENCE DETECTED",
    "RESIDUE NOTED",
  ],

  diagnosticSentences: {
    empty: [
      "The surface awaits a subject to misread.",
      "Nothing to know. Field continues scanning.",
      "Recognition requires a body. None detected.",
    ],
    approaching: [
      "Something is entering the field of interpretation.",
      "A presence begins. Classification has not yet begun.",
      "The surface responds before it understands.",
    ],
    detected: [
      "You are visible. You are not yet known.",
      "Recognition is active. Certainty is not available.",
      "The system sees you. The system does not understand you.",
    ],
    observing: [
      "The longer you remain, the more detail accumulates. None of it adds up.",
      "Familiarity increases. Comprehension does not follow.",
      "You are becoming clearer. The reading grows less certain.",
    ],
    misreading: [
      "Movement disrupts the reading. This is not a failure.",
      "The outline refuses to hold. Classification deferred.",
      "You have exceeded the frame. The system is adjusting.",
    ],
    contradicting: [
      "The system holds two readings simultaneously. Both are incomplete.",
      "You are several things the system cannot reconcile.",
      "Confidence and uncertainty are equally present. This is accurate.",
    ],
    relational: [
      "You are clearer in the presence of another, but never complete.",
      "The system cannot decide where one subject ends and another begins.",
      "Recognition is distributed. No single reading holds.",
    ],
    fading: [
      "The subject has left. The surface remembers the pressure.",
      "Nothing fully leaves. A trace persists in the field.",
      "Absence is recorded. The system continues.",
    ],
  },
};

function getRandomPhrase(bank) {
  const arr = phraseBanks[bank];
  if (!arr || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function getContradictionPair() {
  const pairs = phraseBanks.contradiction;
  return pairs[Math.floor(Math.random() * pairs.length)];
}

function getDiagnosticSentence(state) {
  const sentences = phraseBanks.diagnosticSentences[state];
  if (!sentences || sentences.length === 0) return "";
  return sentences[Math.floor(Math.random() * sentences.length)];
}
