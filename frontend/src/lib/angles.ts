import type { Landmark, JointAngles } from '../types';
import { JOINT_ANGLE_DEFINITIONS, LANDMARK_INDEX } from './constants';

/**
 * Calculate the angle (in degrees) at vertex B formed by points A-B-C.
 * Uses the dot product formula: angle = acos((BA . BC) / (|BA| * |BC|))
 */
export function calculateAngle(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number }
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

  if (magBA === 0 || magBC === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Compute all defined joint angles from a set of landmarks.
 */
export function computeAllAngles(landmarks: Landmark[]): JointAngles {
  const angles: JointAngles = {};

  for (const [jointName, [aName, bName, cName]] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
    const aIdx = LANDMARK_INDEX[aName];
    const bIdx = LANDMARK_INDEX[bName];
    const cIdx = LANDMARK_INDEX[cName];

    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    const c = landmarks[cIdx];

    if (!a || !b || !c) continue;
    if (a.visibility < 0.5 || b.visibility < 0.5 || c.visibility < 0.5) continue;

    angles[jointName] = calculateAngle(a, b, c);
  }

  return angles;
}

/**
 * Calculate torso lean angle (deviation from vertical).
 */
export function computeTorsoLean(landmarks: Landmark[]): number {
  const ls = landmarks[LANDMARK_INDEX.left_shoulder];
  const rs = landmarks[LANDMARK_INDEX.right_shoulder];
  const lh = landmarks[LANDMARK_INDEX.left_hip];
  const rh = landmarks[LANDMARK_INDEX.right_hip];

  if (!ls || !rs || !lh || !rh) return 0;

  const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };

  const dx = shoulderMid.x - hipMid.x;
  const dy = shoulderMid.y - hipMid.y;

  return Math.abs(Math.atan2(dx, -dy) * (180 / Math.PI));
}

/**
 * Calculate hip shift (lateral displacement from neutral).
 */
export function computeHipShift(
  landmarks: Landmark[],
  baseline?: { x: number; y: number }
): number {
  const lh = landmarks[LANDMARK_INDEX.left_hip];
  const rh = landmarks[LANDMARK_INDEX.right_hip];

  if (!lh || !rh) return 0;

  const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };

  if (baseline) {
    return Math.abs(hipMid.x - baseline.x) * 100;
  }
  return 0;
}
