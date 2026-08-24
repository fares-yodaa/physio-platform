import type { Landmark } from '../types';
import { LANDMARK_INDEX } from './constants';

function visible(lm: Landmark | undefined, min: number): Landmark | null {
  if (!lm || lm.visibility < min) return null;
  return lm;
}

/**
 * MediaPipe Pose often parks landmark 0 on the cheek/jaw once the head turns.
 * Rebuild a nose that stays on the face midline (eyes → mouth) so rotation
 * looks like the nose actually moving.
 */
export function refineNose(landmarks: Landmark[]): Landmark | null {
  const raw = visible(landmarks[LANDMARK_INDEX.nose], 0.12);
  const eyeL = visible(landmarks[LANDMARK_INDEX.left_eye], 0.35);
  const eyeR = visible(landmarks[LANDMARK_INDEX.right_eye], 0.35);
  const mouthL = visible(landmarks[LANDMARK_INDEX.mouth_left], 0.25);
  const mouthR = visible(landmarks[LANDMARK_INDEX.mouth_right], 0.25);
  const earL = visible(landmarks[LANDMARK_INDEX.left_ear], 0.25);
  const earR = visible(landmarks[LANDMARK_INDEX.right_ear], 0.25);

  if (eyeL && eyeR) {
    const midEye = {
      x: (eyeL.x + eyeR.x) / 2,
      y: (eyeL.y + eyeR.y) / 2,
      z: (eyeL.z + eyeR.z) / 2,
    };
    const mouths = [mouthL, mouthR].filter(Boolean) as Landmark[];
    const midMouth = mouths.length
      ? {
          x: mouths.reduce((s, p) => s + p.x, 0) / mouths.length,
          y: mouths.reduce((s, p) => s + p.y, 0) / mouths.length,
          z: mouths.reduce((s, p) => s + p.z, 0) / mouths.length,
        }
      : { x: midEye.x, y: midEye.y + 0.055, z: midEye.z };

    return {
      x: midEye.x * 0.62 + midMouth.x * 0.38,
      y: midEye.y * 0.62 + midMouth.y * 0.38,
      z: midEye.z * 0.62 + midMouth.z * 0.38,
      visibility: Math.min(eyeL.visibility, eyeR.visibility),
    };
  }

  const eye = eyeL ?? eyeR;
  const ear = (eyeL ? earL : earR) ?? earL ?? earR;
  if (eye && ear) {
    const dx = eye.x - ear.x;
    const dy = eye.y - ear.y;
    return {
      x: eye.x + dx * 0.9,
      y: eye.y + dy * 0.2 + 0.02,
      z: eye.z,
      visibility: eye.visibility,
    };
  }

  return raw;
}

/** 0° = looking at the camera; grows as the nose swings left or right. */
export function neckRotationDegrees(
  nose: { x: number; y: number },
  leftShoulder: { x: number; y: number },
  rightShoulder: { x: number; y: number }
): number {
  const midX = (leftShoulder.x + rightShoulder.x) / 2;
  const midY = (leftShoulder.y + rightShoulder.y) / 2;
  return Math.abs(Math.atan2(nose.x - midX, midY - nose.y) * (180 / Math.PI));
}
