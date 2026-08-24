import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Landmark } from '../types';
import { SKELETON_CONNECTIONS, LANDMARK_INDEX, JOINT_ANGLE_DEFINITIONS } from './constants';

let poseLandmarker: PoseLandmarker | null = null;
let lastVideoTime = -1;

export async function initMediaPipe(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  return poseLandmarker;
}

export function detectPose(
  video: HTMLVideoElement,
  timestamp: number
): Landmark[] | null {
  if (!poseLandmarker) return null;
  if (timestamp === lastVideoTime) return null;
  lastVideoTime = timestamp;

  const result = poseLandmarker.detectForVideo(video, timestamp);
  if (!result.landmarks || result.landmarks.length === 0) return null;

  return result.landmarks[0].map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility ?? 0,
  }));
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  options?: {
    activeJoints?: string[];
    stableJoints?: string[];
    highlightColor?: string;
  }
) {
  ctx.clearRect(0, 0, width, height);

  // Draw connections
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
  ctx.lineWidth = 2;
  for (const [i, j] of SKELETON_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a.visibility < 0.5 || b.visibility < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  // Draw landmarks
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (lm.visibility < 0.5) continue;

    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.fill();
  }

  // Highlight active/stable joints if provided
  if (options?.activeJoints || options?.stableJoints) {
    for (const [jointName, triple] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
      const vertex = triple[1];
      const idx = LANDMARK_INDEX[vertex];
      const lm = landmarks[idx];
      if (!lm || lm.visibility < 0.5) continue;

      let color: string | null = null;
      if (options.activeJoints?.includes(jointName)) {
        color = 'rgba(34, 197, 94, 0.9)';
      } else if (options.stableJoints?.includes(jointName)) {
        color = 'rgba(239, 68, 68, 0.9)';
      }
      if (color) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 7, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }
}

export function destroyMediaPipe() {
  if (poseLandmarker) {
    poseLandmarker.close();
    poseLandmarker = null;
  }
  lastVideoTime = -1;
}
