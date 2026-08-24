export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface JointAngles {
  [jointName: string]: number;
}

/** A doctor-added point that is not part of the MediaPipe skeleton. */
export interface CustomJoint {
  id: string;
  name: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  /** Optional: follow this landmark during playback until the doctor drags the point. */
  linkedTo?: string;
}

/** Doctor-defined angle from any three points (B = vertex). Refs are landmark names or custom ids. */
export interface CustomAngle {
  id: string;
  name: string;
  pointA: string;
  pointB: string;
  pointC: string;
}

/** Doctor override for a built-in joint position (normalized). */
export interface JointPosition {
  x: number;
  y: number;
}

/**
 * Doctor-defined angle thresholds that drive rep counting for one angle.
 * Direction (flexion vs extension) is inferred from the values:
 * acceptable always sits between resting and optimal.
 */
export interface RepThresholds {
  angleId: string;
  resting: number;
  acceptable: number;
  optimal: number;
}

/** Editor draft for one counting joint (values may be unset while defining). */
export interface RepThresholdsDraft {
  angleId: string;
  resting: number | null;
  acceptable: number | null;
  optimal: number | null;
}

export type RepZone = 'rest' | 'below' | 'acceptable' | 'optimal';

export interface Exercise {
  id: number;
  name: string;
  description: string;
  body_part: string;
  selected_joints: string[];
  custom_joints: CustomJoint[];
  joint_positions: Record<string, JointPosition>;
  custom_angles: CustomAngle[];
  primary_angle: string;
  reference_angles: Record<string, number>;
  /** One or more joints whose ranges drive rep counting (a rep needs all of them). */
  rep_targets: RepThresholds[];
  target_reps: number;
  target_sets: number;
  created_at: string;
}

/** Payload shape sent to the backend when saving (no id/created_at). */
export type ExerciseInput = Omit<Exercise, 'id' | 'created_at'>;

export interface SessionResult {
  id: number;
  exercise_id: number;
  patient_name: string;
  reps_completed: number;
  score: number;
  started_at: string;
  completed_at: string | null;
}

export interface FeedbackEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning';
}

/** Live state produced by the SimpleTracker each frame. */
export interface TrackerState {
  reps: number;
  sets: number;
  trackedAngles: JointAngles;
  feedback: FeedbackEntry[];
  /** Per counting-joint live state (value + zone) for gauges. */
  targets: { angleId: string; value: number | null; zone: RepZone | null }[];
  /** Reps that reached the optimal target on every joint. */
  optimalReps: number;
  rangeReady: boolean;
  fps: number;
}

export interface CameraSetupStatus {
  faceDetected: boolean;
  shouldersAligned: boolean;
  fullBodyVisible: boolean;
  distanceOk: boolean;
  allChecksPassed: boolean;
  passedDuration: number;
}
