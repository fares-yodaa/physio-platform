export const MEDIAPIPE_LANDMARK_NAMES = [
  'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
  'right_eye_inner', 'right_eye', 'right_eye_outer',
  'left_ear', 'right_ear',
  'mouth_left', 'mouth_right',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_pinky', 'right_pinky',
  'left_index', 'right_index',
  'left_thumb', 'right_thumb',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
  'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index',
] as const;

export type LandmarkName = (typeof MEDIAPIPE_LANDMARK_NAMES)[number];

export const LANDMARK_INDEX: Record<LandmarkName, number> = Object.fromEntries(
  MEDIAPIPE_LANDMARK_NAMES.map((name, i) => [name, i])
) as any;

/**
 * Clean set of body joints shown in the editor as circular points.
 * (Face mesh points are excluded to keep the skeleton uncluttered.)
 */
export const BODY_LANDMARKS: LandmarkName[] = [
  'nose',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
];

/** Connections drawn between body joints (by landmark name). */
export const BODY_CONNECTIONS: [LandmarkName, LandmarkName][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['nose', 'left_shoulder'],
  ['nose', 'right_shoulder'],
];

/** Index-based connections (used by the simple skeleton overlay). */
export const SKELETON_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28],
];

/**
 * Joints that have a meaningful bend angle (vertex + two neighbors).
 * Used for the simple angle readout and rep counting.
 */
export const JOINT_ANGLE_DEFINITIONS: Record<string, [LandmarkName, LandmarkName, LandmarkName]> = {
  left_elbow: ['left_shoulder', 'left_elbow', 'left_wrist'],
  right_elbow: ['right_shoulder', 'right_elbow', 'right_wrist'],
  left_shoulder: ['left_elbow', 'left_shoulder', 'left_hip'],
  right_shoulder: ['right_elbow', 'right_shoulder', 'right_hip'],
  left_hip: ['left_shoulder', 'left_hip', 'left_knee'],
  right_hip: ['right_shoulder', 'right_hip', 'right_knee'],
  left_knee: ['left_hip', 'left_knee', 'left_ankle'],
  right_knee: ['right_hip', 'right_knee', 'right_ankle'],
};

/**
 * When the primary third point (usually hip) is off-screen, try these instead.
 * Shoulder raise: opposite shoulder gives a stable torso reference without needing hips in frame.
 */
export const ANGLE_TRIPLE_FALLBACKS: Partial<
  Record<string, [LandmarkName, LandmarkName, LandmarkName][]>
> = {
  left_shoulder: [
    ['left_elbow', 'left_shoulder', 'right_shoulder'],
    ['left_elbow', 'left_shoulder', 'right_hip'],
    ['left_elbow', 'left_shoulder', 'nose'],
  ],
  right_shoulder: [
    ['right_elbow', 'right_shoulder', 'left_shoulder'],
    ['right_elbow', 'right_shoulder', 'left_hip'],
    ['right_elbow', 'right_shoulder', 'nose'],
  ],
  left_hip: [['left_shoulder', 'left_hip', 'right_hip']],
  right_hip: [['right_shoulder', 'right_hip', 'left_hip']],
};

/** Primary + fallback triples to try when measuring an angle. */
export function angleMeasurementTriples(angleId: string): [LandmarkName, LandmarkName, LandmarkName][] {
  const primary = JOINT_ANGLE_DEFINITIONS[angleId];
  if (!primary) return [];
  return [primary, ...(ANGLE_TRIPLE_FALLBACKS[angleId] ?? [])];
}

export const JOINT_NAMES = Object.keys(JOINT_ANGLE_DEFINITIONS);

/** Body part options for the doctor, with the joints they typically pre-select. */
export const BODY_PARTS: { id: string; label: string; joints: LandmarkName[] }[] = [
  { id: 'full_body', label: 'Full Body', joints: BODY_LANDMARKS },
  { id: 'shoulder', label: 'Shoulder', joints: ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow'] },
  { id: 'arm', label: 'Arm / Elbow', joints: ['left_shoulder', 'left_elbow', 'left_wrist'] },
  { id: 'knee', label: 'Knee', joints: ['left_hip', 'left_knee', 'left_ankle'] },
  { id: 'hip', label: 'Hip', joints: ['left_hip', 'right_hip', 'left_knee', 'right_knee'] },
  { id: 'leg', label: 'Leg', joints: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'] },
];

/** Default angle used for rep counting per body part (auto-selected for doctors). */
export const BODY_PART_PRIMARY_ANGLE: Record<string, string> = {
  full_body: 'left_elbow',
  shoulder: 'left_shoulder',
  arm: 'left_elbow',
  knee: 'left_knee',
  hip: 'left_hip',
  leg: 'left_knee',
};

/** Plain-language labels doctors see instead of landmark ids. */
export const FRIENDLY_JOINT_LABELS: Record<string, string> = {
  nose: 'Head',
  left_shoulder: 'Left shoulder',
  right_shoulder: 'Right shoulder',
  left_elbow: 'Left elbow',
  right_elbow: 'Right elbow',
  left_wrist: 'Left wrist',
  right_wrist: 'Right wrist',
  left_hip: 'Left hip',
  right_hip: 'Right hip',
  left_knee: 'Left knee',
  right_knee: 'Right knee',
  left_ankle: 'Left ankle',
  right_ankle: 'Right ankle',
};

export const FRIENDLY_ANGLE_LABELS: Record<string, string> = {
  left_elbow: 'Elbow bend',
  right_elbow: 'Elbow bend (R)',
  left_shoulder: 'Shoulder raise',
  right_shoulder: 'Shoulder raise (R)',
  left_hip: 'Hip angle',
  right_hip: 'Hip angle (R)',
  left_knee: 'Knee bend',
  right_knee: 'Knee bend (R)',
};

export function friendlyJoint(name: string): string {
  return FRIENDLY_JOINT_LABELS[name] ?? prettyJoint(name);
}

export function friendlyAngle(angleId: string, customName?: string): string {
  if (customName) return customName;
  return FRIENDLY_ANGLE_LABELS[angleId] ?? prettyJoint(angleId);
}

/** All landmark refs needed to measure the given rep-counting angles. */
export function landmarksForRepTargets(
  targets: { angleId: string }[],
  selectedJoints: string[] = []
): string[] {
  const refs = new Set(selectedJoints);
  for (const t of targets) {
    for (const triple of angleMeasurementTriples(t.angleId)) {
      triple.forEach((r) => refs.add(r));
    }
  }
  return Array.from(refs);
}

/** Pick the best primary angle id for a body part given what's measurable right now. */
export function resolvePrimaryAngle(bodyPart: string, measurableIds: string[]): string {
  const preferred = BODY_PART_PRIMARY_ANGLE[bodyPart] ?? 'left_elbow';
  if (measurableIds.includes(preferred)) return preferred;
  const fallbackOrder = [
    preferred,
    preferred.replace('left_', 'right_'),
    ...measurableIds,
  ];
  for (const id of fallbackOrder) {
    if (measurableIds.includes(id)) return id;
  }
  return measurableIds[0] ?? '';
}

export function prettyJoint(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
