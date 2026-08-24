import type { Landmark, JointPosition, CustomJoint, JointAngles, RepThresholds } from '../types';
import type { AngleArc } from './editorAngles';
import { resolvePoint } from './editorAngles';
import {
  BODY_LANDMARKS,
  BODY_CONNECTIONS,
  JOINT_ANGLE_DEFINITIONS,
} from './constants';
import { classifyZone } from './repThresholds';

const ARC_RADIUS = 34;
const POINT_RADIUS = 10;

function angleAtLandmark(landmark: string): string | undefined {
  for (const [angleName, [, vertex]] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
    if (vertex === landmark) return angleName;
  }
  return undefined;
}

function arcColor(zone: string | null): string {
  if (zone === 'optimal') return 'rgba(34, 197, 94, 0.95)';
  if (zone === 'acceptable') return 'rgba(251, 191, 36, 0.95)';
  if (zone === 'below') return 'rgba(249, 115, 22, 0.9)';
  return 'rgba(251, 191, 36, 0.75)';
}

export interface SkeletonDrawOptions {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  /** Landmarks to highlight on the skeleton. */
  activeJoints: string[];
  /** Angles that drive rep counting — shown with arcs + degree badges. */
  countingAngleIds: string[];
  angles?: JointAngles;
  angleArcs?: AngleArc[];
  /** When set, arc color reflects how close the live angle is to target. */
  repTargets?: RepThresholds[];
  jointPositions?: Record<string, JointPosition>;
  customJoints?: CustomJoint[];
  /** Highlight one joint (hover). */
  hoverJoint?: string | null;
  /** Doctor-selected joint (blue ring). */
  selectedJoint?: string | null;
}

/** Draw skeleton, angle arcs, and live degree badges on a canvas. */
export function drawSkeletonOverlay(ctx: CanvasRenderingContext2D, opts: SkeletonDrawOptions) {
  const {
    landmarks,
    width,
    height,
    activeJoints,
    countingAngleIds,
    angles = {},
    angleArcs = [],
    repTargets = [],
    jointPositions = {},
    customJoints = [],
    hoverJoint,
    selectedJoint,
  } = opts;

  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const countingSet = new Set(countingAngleIds);
  const activeSet = new Set(activeJoints);
  const targetByAngle = new Map(repTargets.map((t) => [t.angleId, t]));

  const point = (name: string): { x: number; y: number } | null => {
    const p = resolvePoint(name, landmarks, jointPositions, customJoints, 0.12);
    if (!p) return null;
    return { x: p.x * width, y: p.y * height };
  };

  // Full body skeleton (subtle)
  for (const [a, b] of BODY_CONNECTIONS) {
    const pa = point(a);
    const pb = point(b);
    if (!pa || !pb) continue;
    const bothActive = activeSet.has(a) && activeSet.has(b);
    const eitherCounting =
      countingAngleIds.some((id) => {
        const def = JOINT_ANGLE_DEFINITIONS[id];
        return def && (def[0] === a || def[1] === a || def[2] === a || def[0] === b || def[1] === b || def[2] === b);
      });
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = eitherCounting
      ? 'rgba(251, 191, 36, 0.55)'
      : bothActive
      ? 'rgba(34, 197, 94, 0.65)'
      : 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = eitherCounting ? 3 : bothActive ? 2.5 : 1.5;
    ctx.stroke();
  }

  // Neck rotation stem: shoulder midpoint → nose
  if (activeSet.has('nose')) {
    const base = point('neck_base');
    const nose = point('nose');
    if (base && nose) {
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(nose.x, nose.y);
      ctx.strokeStyle = countingSet.has('neck')
        ? 'rgba(251, 191, 36, 0.85)'
        : 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(base.x, base.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.95)';
      ctx.fill();
    }
  }

  // Angle arcs at counting joints
  for (const arc of angleArcs) {
    if (!countingSet.has(arc.id)) continue;
    const live = angles[arc.id];
    const target = targetByAngle.get(arc.id);
    const zone = live !== undefined && target ? classifyZone(live, target) : null;
    ctx.beginPath();
    ctx.arc(arc.bx, arc.by, ARC_RADIUS, arc.startAngle, arc.endAngle, false);
    ctx.strokeStyle = arcColor(zone);
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // Joint dots
  for (const name of BODY_LANDMARKS) {
    if (
      (name === 'left_ear' || name === 'right_ear') &&
      !activeSet.has(name) &&
      !activeSet.has('nose')
    ) {
      continue;
    }
    const p = point(name);
    if (!p) continue;
    const angleKey = angleAtLandmark(name);
    const isCounting = angleKey != null && countingSet.has(angleKey);
    const isActive = activeSet.has(name);
    const isHover = hoverJoint === name;
    const isSelected = selectedJoint === name;
    const r = isHover ? POINT_RADIUS + 4 : POINT_RADIUS;

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.95)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (isCounting) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (isCounting) ctx.fillStyle = 'rgba(251, 191, 36, 0.98)';
    else if (isActive) ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
    else ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.stroke();

    // Live degree badge on counting joints
    if (isCounting && angleKey && angles[angleKey] !== undefined) {
      const live = angles[angleKey];
      const target = targetByAngle.get(angleKey);
      const text = `${live.toFixed(0)}°`;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(text).width;
      const bgY = p.y + r + 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      ctx.roundRect(p.x - tw / 2 - 6, bgY, tw + 12, 20, 5);
      ctx.fill();
      ctx.fillStyle =
        zoneColor(live, target) === 'green'
          ? '#4ade80'
          : zoneColor(live, target) === 'yellow'
          ? '#fbbf24'
          : '#f8fafc';
      ctx.fillText(text, p.x, bgY + 14);
    }
  }

  // Custom markers
  for (const cj of customJoints) {
    const x = cj.x * width;
    const y = cj.y * height;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function zoneColor(live: number, target?: RepThresholds): 'green' | 'yellow' | 'gray' {
  if (!target) return 'gray';
  const z = classifyZone(live, target);
  if (z === 'optimal') return 'green';
  if (z === 'acceptable') return 'yellow';
  return 'gray';
}

/** Resolve landmark refs needed to draw + measure for counting angles. */
export function jointsForOverlay(activeJoints: string[], countingAngleIds: string[]): string[] {
  const set = new Set(activeJoints);
  for (const id of countingAngleIds) {
    const def = JOINT_ANGLE_DEFINITIONS[id];
    if (def) def.forEach((r) => set.add(r));
  }
  return Array.from(set);
}
