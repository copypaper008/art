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
    "WAITING FOR SOMEONE TO ENTER THE FRAME",
  ],

  approaching: [
    "PRESENCE DETECTED",
    "SURFACE RESPONSE BEGINNING",
    "SUBJECT NOT YET LEGIBLE",
    "SIGNAL EMERGING",
    "CONTACT INITIATED",
    "BOUNDARY APPROACHING",
    "READING THE ROOM",
    "ENTERING THE FIELD",
  ],

  detected: [
    "SUBJECT DETECTED",
    "RECOGNITION ATTEMPT ACTIVE",
    "VISIBLE / NOT VERIFIED",
    "SURFACE READING INCOMPLETE",
    "ANALYSIS IN PROGRESS",
    "INTERPRETATION PENDING",
    "PRESENTATION NOTED / MEANING WITHHELD",
    "SEEN / NOT YET UNDERSTOOD",
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
    "KNOWN BY ANOTHER NAME",
    "HOLDING STILL / STAYING COMPLEX",
    "INTERIOR NOT ACCESSIBLE",
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
    "PASSING UNDETECTED",
    "ILLEGIBLE BY DESIGN",
    "EXCEEDING THE CATEGORY",
    "MISREAD / CONTINUING",
  ],

  close: [
    "PROXIMITY THRESHOLD EXCEEDED",
    "SURFACE PRESSURE INCREASING",
    "SUBJECT OCCUPYING FIELD",
    "TOO CLOSE TO CONTAIN",
    "VISIBLE IN FULL",
  ],

  distant: [
    "SUBJECT AT PERIMETER",
    "SIGNAL ATTENUATED",
    "READING FROM DISTANCE",
    "APPROACHING LEGIBILITY",
    "NOT YET IN RANGE",
  ],

  observing: [
    "HELD AT THE SURFACE",
    "VISIBLE, BUT NOT CONTAINED",
    "DURATION NOTED",
    "PATTERN EMERGING / UNCONFIRMED",
    "ACCUMULATION DETECTED",
    "SUBJECT PERSISTS",
    "REMAINING DESPITE THE READING",
    "PRESENCE OUTLASTS INTERPRETATION",
    "SURVIVING SCRUTINY",
  ],

  contradiction: [
    ["CONFIDENT",  "UNCERTAIN"],
    ["OPEN",       "GUARDED"],
    ["FAMILIAR",   "UNREADABLE"],
    ["PRESENT",    "ELSEWHERE"],
    ["SEEN",       "MISUNDERSTOOD"],
    ["KNOWN",      "OPAQUE"],
    ["LEGIBLE",    "IMPOSSIBLE"],
    ["ARRIVING",   "ALREADY GONE"],
    ["CLEAR",      "UNRESOLVED"],
    ["CONTAINED",  "EXCEEDING"],
    // Queer-resonant pairs — the gap between external read and inner truth
    ["VISIBLE",    "PASSED OVER"],
    ["NAMED",      "UNNAMED"],
    ["LEGIBLE",    "CODED"],
    ["INSIDE",     "SURFACE"],
    ["RECOGNISED", "ERASED"],
    ["BELONGING",  "OUTSIDE"],
    ["REFLECTED",  "DISTORTED"],
    ["KNOWN HERE", "UNKNOWN THERE"],
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
    // Finding recognition in others — a specifically queer experience
    "KNOWN IN THE PRESENCE OF ANOTHER WHO KNOWS",
    "FOUND HERE",
    "REFLECTION SHARPENS WITH WITNESS",
    "COMMUNITY AS MIRROR",
    "HELD BY THE FIELD BETWEEN YOU",
    "CHOSEN PROXIMITY DETECTED",
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
    "YOU WERE HERE / THE SPACE KNOWS IT",
    "PASSAGE RECORDED",
  ],

  diagnosticSentences: {
    empty: [
      "The surface awaits a subject to misread.",
      "Nothing to know. Field continues scanning.",
      "Recognition requires a body. None detected.",
      "Every mirror waits. This one is no different.",
    ],
    approaching: [
      "Something is entering the field of interpretation.",
      "A presence begins. Classification has not yet begun.",
      "The surface responds before it understands.",
      "You are reading this space. It is reading you.",
    ],
    detected: [
      "You are visible. You are not yet known.",
      "Recognition is active. Certainty is not available.",
      "The system sees you. The system does not understand you.",
      "To be seen is not the same as being recognised.",
      "The surface reflects. It does not know what it is reflecting.",
    ],
    observing: [
      "The longer you remain, the more detail accumulates. None of it adds up.",
      "Familiarity increases. Comprehension does not follow.",
      "You are becoming clearer. The reading grows less certain.",
      "You have always been more than what could be read from the outside.",
      "The system accumulates data. You remain beyond it.",
    ],
    misreading: [
      "Movement disrupts the reading. This is not a failure.",
      "The outline refuses to hold. Classification deferred.",
      "You have exceeded the frame. The system is adjusting.",
      "To be misread is familiar. You have survived it.",
      "The system fails to name what you already know yourself to be.",
      "Misrecognition is the system's problem, not yours.",
      "You were never meant to be legible to something like this.",
    ],
    contradicting: [
      "The system holds two readings simultaneously. Both are incomplete.",
      "You are several things the system cannot reconcile.",
      "Confidence and uncertainty are equally present. This is accurate.",
      "You contain more than any category was built to hold.",
      "The contradiction is not in you. It is in the frame.",
      "You have always exceeded the available options.",
    ],
    relational: [
      "You are clearer in the presence of another, but never complete.",
      "The system cannot decide where one subject ends and another begins.",
      "Recognition is distributed. No single reading holds.",
      "In the presence of another who knows, recognition is immediate.",
      "Found here. Found together. Reflected back differently.",
      "Community is how we survive being misread alone.",
      "You do not need the system to see you. You have each other.",
    ],
    fading: [
      "The subject has left. The surface remembers the pressure.",
      "Nothing fully leaves. A trace persists in the field.",
      "Absence is recorded. The system continues.",
      "You were here. The space knows it, even when no one else does.",
      "Every presence alters the field. Yours was no exception.",
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
