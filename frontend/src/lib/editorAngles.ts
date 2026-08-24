import { calculateAngle } from './angles';
import { JOINT_ANGLE_DEFINITIONS, LANDMARK_INDEX, angleMeasurementTriples } from './constants';
import { neckRotationDegrees, refineNose } from './neck';
import type { Landmark, JointPosition, CustomJoint, CustomAngle, JointAngles } from '../types';

export interface ResolvedPoint {
  x: number;
  y: number;
  z: number;
}

/** Resolve a landmark name or custom-joint id to a 3D point (normalized coords). */
export function resolvePoint(
  ref: string,
  landmarks: Landmark[] | null,
  jointPositions: Record<string, JointPosition>,
  customJoints: CustomJoint[],
  minVisibility = 0.3
): ResolvedPoint | null {
  const custom = customJoints.find((c) => c.id === ref);
  if (custom) {
    return { x: custom.x, y: custom.y, z: 0 };
  }

  const override = jointPositions[ref];
  if (override) {
    return { x: override.x, y: override.y, z: 0 };
  }

  if (!landmarks) return null;

  if (ref === 'neck_base') {
    const ls = resolvePoint('left_shoulder', landmarks, jointPositions, customJoints, minVisibility);
    const rs = resolvePoint('right_shoulder', landmarks, jointPositions, customJoints, minVisibility);
    if (!ls || !rs) return null;
    return {
      x: (ls.x + rs.x) / 2,
      y: (ls.y + rs.y) / 2,
      z: (ls.z + rs.z) / 2,
    };
  }

  if (ref === 'nose' && !jointPositions.nose) {
    const tip = refineNose(landmarks);
    if (tip && tip.visibility >= minVisibility) {
      return { x: tip.x, y: tip.y, z: tip.z };
    }
  }
  const idx = LANDMARK_INDEX[ref as keyof typeof LANDMARK_INDEX];
  if (idx === undefined) return null;
  const lm = landmarks[idx];
  if (!lm || lm.visibility < minVisibility) return null;
  return { x: lm.x, y: lm.y, z: lm.z };
}

function angleFromTriple(
  aRef: string,
  bRef: string,
  cRef: string,
  landmarks: Landmark[] | null,
  jointPositions: Record<string, JointPosition>,
  customJoints: CustomJoint[],
  minVisibility = 0.3
): number | null {
  const a = resolvePoint(aRef, landmarks, jointPositions, customJoints, minVisibility);
  const b = resolvePoint(bRef, landmarks, jointPositions, customJoints, minVisibility);
  const c = resolvePoint(cRef, landmarks, jointPositions, customJoints, minVisibility);
  if (!a || !b || !c) return null;
  return calculateAngle(a, b, c);
}

/** Try primary + fallback landmark triples until one is visible enough to measure. */
function measureBuiltinAngle(
  angleId: string,
  landmarks: Landmark[] | null,
  jointPositions: Record<string, JointPosition>,
  customJoints: CustomJoint[],
  minVisibility = 0.3
): number | null {
  if (angleId === 'neck') {
    const ls = resolvePoint('left_shoulder', landmarks, jointPositions, customJoints, minVisibility);
    const rs = resolvePoint('right_shoulder', landmarks, jointPositions, customJoints, minVisibility);
    const nose = resolvePoint('nose', landmarks, jointPositions, customJoints, Math.min(minVisibility, 0.12));
    if (!ls || !rs || !nose) return null;
    return neckRotationDegrees(nose, ls, rs);
  }

  for (const [aRef, bRef, cRef] of angleMeasurementTriples(angleId)) {
    const val = angleFromTriple(aRef, bRef, cRef, landmarks, jointPositions, customJoints, minVisibility);
    if (val !== null) return val;
  }
  return null;
}

/** All measurable angles for the current editor frame. */
export function computeEditorAngles(
  landmarks: Landmark[] | null,
  jointPositions: Record<string, JointPosition>,
  customJoints: CustomJoint[],
  selectedJoints: string[],
  customAngles: CustomAngle[] = []
): JointAngles {
  const angles: JointAngles = {};

  for (const [name, [aRef, bRef, cRef]] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
    // Only show angles the doctor cares about (vertex selected or whole chain selected)
    const relevant =
      selectedJoints.includes(bRef) ||
      selectedJoints.includes(aRef) ||
      selectedJoints.includes(cRef);
    if (!relevant) continue;

    const val = measureBuiltinAngle(name, landmarks, jointPositions, customJoints);
    if (val !== null) angles[name] = val;
  }

  for (const ca of customAngles) {
    const val = angleFromTriple(ca.pointA, ca.pointB, ca.pointC, landmarks, jointPositions, customJoints);
    if (val !== null) angles[ca.id] = val;
  }

  return angles;
}

/** Compute specific rep-counting angles — always tries each target, with relaxed visibility. */
export function computeTargetAngles(
  landmarks: Landmark[] | null,
  targetAngleIds: string[],
  jointPositions: Record<string, JointPosition> = {},
  customJoints: CustomJoint[] = [],
  customAngles: CustomAngle[] = []
): JointAngles {
  const angles: JointAngles = {};
  const minVis = 0.15;

  for (const id of targetAngleIds) {
    if (!(id in JOINT_ANGLE_DEFINITIONS)) continue;
    const val = measureBuiltinAngle(id, landmarks, jointPositions, customJoints, minVis);
    if (val !== null) angles[id] = val;
  }

  for (const ca of customAngles) {
    if (!targetAngleIds.includes(ca.id)) continue;
    const val = angleFromTriple(ca.pointA, ca.pointB, ca.pointC, landmarks, jointPositions, customJoints, minVis);
    if (val !== null) angles[ca.id] = val;
  }

  return angles;
}

export interface AngleArc {
  id: string;
  label: string;
  /** Vertex in pixel coords */
  bx: number;
  by: number;
  startAngle: number;
  endAngle: number;
  value: number;
}

/** Build arc metadata for canvas drawing. */
export function computeAngleArcs(
  landmarks: Landmark[] | null,
  jointPositions: Record<string, JointPosition>,
  customJoints: CustomJoint[],
  selectedJoints: string[],
  customAngles: CustomAngle[],
  width: number,
  height: number,
  angles: JointAngles
): AngleArc[] {
  const arcs: AngleArc[] = [];
  const addArc = (id: string, label: string, triples: [string, string, string][]) => {
    const value = angles[id];
    if (value === undefined) return;

    if (id === 'neck') {
      const base = resolvePoint('neck_base', landmarks, jointPositions, customJoints);
      const nose = resolvePoint('nose', landmarks, jointPositions, customJoints, 0.12);
      if (!base || !nose) return;
      const bx = base.x * width;
      const by = base.y * height;
      const endAngle = Math.atan2(nose.y * height - by, nose.x * width - bx);
      arcs.push({
        id,
        label,
        bx,
        by,
        startAngle: -Math.PI / 2,
        endAngle,
        value,
      });
      return;
    }

    for (const [aRef, bRef, cRef] of triples) {
      const a = resolvePoint(aRef, landmarks, jointPositions, customJoints);
      const b = resolvePoint(bRef, landmarks, jointPositions, customJoints);
      const c = resolvePoint(cRef, landmarks, jointPositions, customJoints);
      if (!a || !b || !c) continue;

      const ax = a.x * width;
      const ay = a.y * height;
      const bx = b.x * width;
      const by = b.y * height;
      const cx = c.x * width;
      const cy = c.y * height;

      const startAngle = Math.atan2(ay - by, ax - bx);
      const endAngle = Math.atan2(cy - by, cx - bx);

      arcs.push({ id, label, bx, by, startAngle, endAngle, value });
      return;
    }
  };

  for (const name of Object.keys(JOINT_ANGLE_DEFINITIONS)) {
    const [aRef, bRef, cRef] = JOINT_ANGLE_DEFINITIONS[name];
    if (!selectedJoints.includes(bRef) && !selectedJoints.includes(aRef) && !selectedJoints.includes(cRef)) {
      continue;
    }
    addArc(name, name.replace(/_/g, ' '), angleMeasurementTriples(name));
  }

  for (const ca of customAngles) {
    addArc(ca.id, ca.name, [[ca.pointA, ca.pointB, ca.pointC]]);
  }

  return arcs;
}
