import { BODY_CONNECTIONS, BODY_LANDMARKS, JOINT_ANGLE_DEFINITIONS } from './constants';

/** Fixed front-facing stick figure (normalized 0–1). */
export const SCHEMATIC_POSITIONS: Record<string, { x: number; y: number }> = {
  nose: { x: 0.5, y: 0.1 },
  left_ear: { x: 0.42, y: 0.11 },
  right_ear: { x: 0.58, y: 0.11 },
  left_shoulder: { x: 0.38, y: 0.24 },
  right_shoulder: { x: 0.62, y: 0.24 },
  left_elbow: { x: 0.28, y: 0.42 },
  right_elbow: { x: 0.72, y: 0.42 },
  left_wrist: { x: 0.22, y: 0.58 },
  right_wrist: { x: 0.78, y: 0.58 },
  left_hip: { x: 0.42, y: 0.52 },
  right_hip: { x: 0.58, y: 0.52 },
  left_knee: { x: 0.4, y: 0.72 },
  right_knee: { x: 0.6, y: 0.72 },
  left_ankle: { x: 0.38, y: 0.92 },
  right_ankle: { x: 0.62, y: 0.92 },
};

export function angleAtLandmark(landmark: string): string | undefined {
  for (const [angleId, [, vertex]] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
    if (vertex === landmark) return angleId;
  }
  return undefined;
}

export function measurableAnglesForActive(activeJoints: string[]): string[] {
  const active = new Set(activeJoints);
  return Object.entries(JOINT_ANGLE_DEFINITIONS)
    .filter(([, [, vertex]]) => active.has(vertex))
    .map(([id]) => id);
}

export { BODY_LANDMARKS, BODY_CONNECTIONS };
