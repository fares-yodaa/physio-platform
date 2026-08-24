import { useRef, useEffect, useCallback, useState } from 'react';
import type { Landmark, CustomJoint, JointPosition, JointAngles, RepThresholds } from '../../types';
import type { AngleArc } from '../../lib/editorAngles';
import { drawSkeletonOverlay } from '../../lib/skeletonDraw';
import { BODY_LANDMARKS, LANDMARK_INDEX } from '../../lib/constants';

interface JointEditorProps {
  landmarks: Landmark[] | null;
  width: number;
  height: number;
  selectedJoints: string[];
  customJoints: CustomJoint[];
  jointPositions: Record<string, JointPosition>;
  angles?: JointAngles;
  angleArcs?: AngleArc[];
  countingAngleIds?: string[];
  repTargets?: RepThresholds[];
  selectedJoint?: string | null;
  onJointTap: (name: string) => void;
  onMoveJoint: (name: string, x: number, y: number) => void;
  onMoveCustom: (id: string, x: number, y: number) => void;
}

const HIT_RADIUS = 24;
const DRAG_THRESHOLD = 4;

export default function JointEditor({
  landmarks,
  width,
  height,
  selectedJoints,
  customJoints,
  jointPositions,
  angles = {},
  angleArcs = [],
  countingAngleIds = [],
  repTargets = [],
  selectedJoint = null,
  onJointTap,
  onMoveJoint,
  onMoveCustom,
}: JointEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverJoint, setHoverJoint] = useState<string | null>(null);
  const dragRef = useRef<{
    kind: 'builtin' | 'custom';
    name: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSkeletonOverlay(ctx, {
      landmarks,
      width,
      height,
      activeJoints: selectedJoints,
      countingAngleIds,
      angles,
      angleArcs,
      repTargets: repTargets.filter((t) => t.resting != null && t.optimal != null && t.acceptable != null),
      jointPositions,
      customJoints,
      hoverJoint,
      selectedJoint,
    });
  }, [
    landmarks,
    width,
    height,
    selectedJoints,
    countingAngleIds,
    angles,
    angleArcs,
    repTargets,
    jointPositions,
    customJoints,
    hoverJoint,
    selectedJoint,
  ]);

  const toCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height]
  );

  const hitTestBuiltin = useCallback(
    (mx: number, my: number): string | null => {
      if (!landmarks) return null;
      let best: string | null = null;
      let bestDist = HIT_RADIUS;
      for (const name of BODY_LANDMARKS) {
        const override = jointPositions[name];
        let px: number | undefined;
        let py: number | undefined;
        if (override) {
          px = override.x * width;
          py = override.y * height;
        } else {
          const idx = LANDMARK_INDEX[name as keyof typeof LANDMARK_INDEX];
          if (idx === undefined) continue;
          const lm = landmarks[idx];
          if (!lm || lm.visibility < 0.2) continue;
          px = lm.x * width;
          py = lm.y * height;
        }
        const d = Math.hypot(mx - px, my - py);
        if (d < bestDist) {
          bestDist = d;
          best = name;
        }
      }
      return best;
    },
    [landmarks, jointPositions, width, height]
  );

  const hitTestCustom = useCallback(
    (mx: number, my: number): string | null => {
      for (const cj of customJoints) {
        const px = cj.x * width;
        const py = cj.y * height;
        if (Math.hypot(mx - px, my - py) < HIT_RADIUS) return cj.id;
      }
      return null;
    },
    [customJoints, width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = toCanvasCoords(e);
      const customHit = hitTestCustom(x, y);
      const builtinHit = hitTestBuiltin(x, y);

      if (customHit) {
        canvasRef.current?.setPointerCapture(e.pointerId);
        dragRef.current = { kind: 'custom', name: customHit, startX: x, startY: y, moved: false };
        return;
      }

      if (builtinHit) {
        canvasRef.current?.setPointerCapture(e.pointerId);
        dragRef.current = { kind: 'builtin', name: builtinHit, startX: x, startY: y, moved: false };
        return;
      }
    },
    [toCanvasCoords, hitTestCustom, hitTestBuiltin]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = toCanvasCoords(e);
      const drag = dragRef.current;

      if (!drag) {
        setHoverJoint(hitTestBuiltin(x, y));
        return;
      }

      if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD) {
        drag.moved = true;
      }
      if (drag.moved) {
        if (drag.kind === 'builtin') onMoveJoint(drag.name, x / width, y / height);
        else onMoveCustom(drag.name, x / width, y / height);
      }
    },
    [toCanvasCoords, hitTestBuiltin, onMoveJoint, onMoveCustom, width, height]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      canvasRef.current?.releasePointerCapture(e.pointerId);
      if (drag && !drag.moved && drag.kind === 'builtin') {
        onJointTap(drag.name);
      }
    },
    [onJointTap]
  );

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full cursor-pointer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoverJoint(null)}
    />
  );
}
