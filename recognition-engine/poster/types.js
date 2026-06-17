/**
 * @typedef {{ x: number, y: number }} Anchor
 *
 * @typedef {{
 *   fileId:          string,
 *   name:            string,
 *   date:            string,
 *   portrait:        string,
 *   imageResolution: string,
 *   mode:            string,
 *   source:          string,
 *   scanDepth:       string,
 *   faceAnchors: {
 *     leftEye:  Anchor,
 *     rightEye: Anchor,
 *     faceOval: Anchor[],
 *   },
 *   exhibitionTitle: string,
 *   dateRange:       string,
 *   venue:           string,
 *   address:         string,
 * }} SubjectConfig
 *
 * @typedef {{
 *   scanStatus:        string,
 *   confidence:        string,
 *   reflectionScore:   string,
 *   characteristics:   string[],
 *   interpretation:    string[],
 *   classification:    string,
 *   explanation:       string,
 *   referenceMatrices: Array<{ code: string, value: string }>,
 * }} Determination
 */
