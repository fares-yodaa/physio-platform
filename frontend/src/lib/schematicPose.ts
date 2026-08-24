import { calculateAngle } from './angles';
import { JOINT_ANGLE_DEFINITIONS } from './constants';
import { SCHEMATIC_POSITIONS } from './schematicSkeleton';

export type SchematicPoint = { x: number; y: number };

/** Joints to rotate with the distal point when bending at vertex B. */
const DISTAL_CHAIN: Record<string, string[]> = {
  left_shoulder: ['left_elbow', 'left_wrist'],
  right_shoulder: ['right_elbow', 'right_wrist'],
  left_elbow: ['left_wrist'],
  right_elbow: ['right_wrist'],
  left_hip: ['left_knee', 'left_ankle'],
  right_hip: ['right_knee', 'right_ankle'],
  left_knee: ['left_ankle'],
  right_knee: ['right_ankle'],
};

/** Proximal → distal so downstream angles stay correct. */
const APPLY_ORDER = [
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_elbow',
  'right_elbow',
  'left_knee',
  'right_knee',
];

function clonePositions(): Record<string, SchematicPoint> {
  const out: Record<string, SchematicPoint> = {};
  for (const [name, p] of Object.entries(SCHEMATIC_POSITIONS)) {
    out[name] = { x: p.x, y: p.y };
  }
  return out;
}

function rotateAround(pivot: SchematicPoint, point: SchematicPoint, deltaRad: number): SchematicPoint {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const cos = Math.cos(deltaRad);
  const sin = Math.sin(deltaRad);
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

function to3(p: SchematicPoint) {
  return { x: p.x, y: p.y, z: 0 };
}

function applyOneAngle(pos: Record<string, SchematicPoint>, angleId: string, targetDeg: number) {
  const def = JOINT_ANGLE_DEFINITIONS[angleId];
  if (!def) return;
  const [aRef, bRef, cRef] = def;
  const a = pos[aRef];
  const b = pos[bRef];
  const c = pos[cRef];
  if (!a || !b || !c) return;

  const current = calculateAngle(to3(a), to3(b), to3(c));
  const delta = ((targetDeg - current) * Math.PI) / 180;
  if (Math.abs(delta) < 0.001) return;

  const rotateSet = new Set([cRef, ...(DISTAL_CHAIN[bRef] ?? [])]);
  for (const name of rotateSet) {
    const p = pos[name];
    if (p) pos[name] = rotateAround(b, p, delta);
  }
}

/** Pose stick figure with the given angle values (degrees) applied on the neutral schematic. */
export function schematicPositionsForAngles(angleValues: Record<string, number>): Record<string, SchematicPoint> {
  const pos = clonePositions();
  for (const id of APPLY_ORDER) {
    const target = angleValues[id];
    if (target != null) applyOneAngle(pos, id, target);
  }
  return pos;
}

export function baseSchematicAngles(): Record<string, number> {
  const pos = clonePositions();
  const angles: Record<string, number> = {};
  for (const [id, [aRef, bRef, cRef]] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
    const a = pos[aRef];
    const b = pos[bRef];
    const c = pos[cRef];
    if (a && b && c) angles[id] = calculateAngle(to3(a), to3(b), to3(c));
  }
  return angles;
}

export type PreviewPhase = 'live' | 'rest' | 'acceptable' | 'optimal';
