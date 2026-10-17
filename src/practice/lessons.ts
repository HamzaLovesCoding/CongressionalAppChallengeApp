// Which feed lessons teach each practice concept, for the results screen's "Lessons to revisit".
// Only lessons that teach the same rule are listed; a concept with no matching lesson is left out
// and still shows under its topic in "Areas to improve".
export const CONCEPT_LESSONS: Record<string, string[]> = {
  'following-distance': ['three-second-check', 'following-distance'],
  scanning: ['lane-end-scan'],
  visibility: ['high-beams'],
  'collision-reporting': ['after-collision'],
  'emergency-vehicles': ['emergency-pull-right', 'emergency-right-edge'],
  roundabouts: ['roundabout'],
  'school-bus': ['school-bus'],
  'bicycle-clearance': ['passing-bicyclist'],
};
