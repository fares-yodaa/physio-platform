import type {
  Landmark,
  JointAngles,
  FeedbackEntry,
  TrackerState,
  CustomAngle,
  RepThresholds,
} from '../types';
import { computeEditorAngles, computeTargetAngles } from '../lib/editorAngles';
import { JOINT_ANGLE_DEFINITIONS, friendlyAngle, landmarksForRepTargets } from '../lib/constants';
import { thresholdsValid, progress, classifyZone } from '../lib/repThresholds';

const MIN_RANGE = 25;
const MARGIN_RATIO = 0.18;

interface TrackerConfig {
  selectedJoints: string[];
  targetReps: number;
  targetSets: number;
  primaryAngle?: string;
  customAngles?: CustomAngle[];
  referenceAngles?: Record<string, number>;
  /** One or more counting joints. A rep requires all of them to complete the cycle. */
  repTargets?: RepThresholds[];
  /** Legacy single-joint range (used if repTargets is empty). */
  repThresholds?: RepThresholds | null;
}

interface TargetRuntime {
  t: RepThresholds;
}

/**
 * Movement tracker.
 *
 * If the doctor defined counting joints (each with resting/acceptable/optimal),
 * a rep is counted when EVERY counting joint goes rest → past acceptable → back
 * to rest. It's graded "perfect" when every joint also reached its optimal.
 *
 * With no counting joints it falls back to auto-calibrating a single angle.
 */
export class SimpleTracker {
  private selectedJoints: string[];
  private targetReps: number;
  private targetSets: number;
  private customAngles: CustomAngle[];

  private targets: TargetRuntime[];
  private inPose = false;
  private poseOptimal = false;

  // Auto fallback (single angle, no thresholds).
  private autoJoint: string | null = null;
  private minAngle = Infinity;
  private maxAngle = -Infinity;
  private phase: 'high' | 'low' = 'high';
  private wentLow = false;

  private reps = 0;
  private completedSets = 0;
  private optimalReps = 0;
  private feedback: FeedbackEntry[] = [];
  private started = false;

  private frameTimes: number[] = [];

  constructor(config: TrackerConfig) {
    this.selectedJoints = config.selectedJoints;
    this.targetReps = Math.max(1, config.targetReps);
    this.targetSets = Math.max(1, config.targetSets);
    this.customAngles = config.customAngles ?? [];

    let defs: RepThresholds[] = [];
    if (config.repTargets && config.repTargets.length > 0) {
      defs = config.repTargets.filter((t) => thresholdsValid(t));
    } else if (thresholdsValid(config.repThresholds)) {
      defs = [config.repThresholds as RepThresholds];
    }

    this.targets = defs.map((t) => ({ t }));

    // Make sure every counting angle is always measurable, even if the doctor
    // turned the joint's dot off for display.
    if (this.targets.length > 0) {
      this.selectedJoints = landmarksForRepTargets(
        this.targets.map((rt) => rt.t),
        config.selectedJoints
      );
    }

    if (this.targets.length === 0) {
      const builtin = config.selectedJoints.filter((j) => j in JOINT_ANGLE_DEFINITIONS);
      const customIds = this.customAngles.map((c) => c.id);
      const all = [...builtin, ...customIds];
      this.autoJoint =
        config.primaryAngle && all.includes(config.primaryAngle)
          ? config.primaryAngle
          : builtin[0] ?? customIds[0] ?? null;
    }

    this.pushFeedback('Get into position and start moving', 'info');
  }

  private pushFeedback(message: string, type: FeedbackEntry['type']) {
    const last = this.feedback[this.feedback.length - 1];
    if (last && last.message === message) return;
    this.feedback.push({ timestamp: Date.now(), message, type });
    if (this.feedback.length > 6) this.feedback.shift();
  }

  private trackFps(now: number) {
    this.frameTimes.push(now);
    const cutoff = now - 1000;
    while (this.frameTimes.length && this.frameTimes[0] < cutoff) this.frameTimes.shift();
  }

  private computeAngles(landmarks: Landmark[]): JointAngles {
    if (this.targets.length > 0) {
      const ids = this.targets.map((rt) => rt.t.angleId);
      return computeTargetAngles(landmarks, ids, {}, [], this.customAngles);
    }
    return computeEditorAngles(landmarks, {}, [], this.selectedJoints, this.customAngles);
  }

  private targetLabel(t: RepThresholds): string {
    const ca = this.customAngles.find((c) => c.id === t.angleId);
    return friendlyAngle(t.angleId, ca?.name);
  }

  // --- Pose-based rep counting ----------------------------------------------
  // A rep = every counting joint is simultaneously in its target range
  // (the "pose"), then the body leaves it. e.g. elbow ~0° AND shoulder ~90°.

  private updateRepsPose(angles: JointAngles) {
    const values = this.targets.map((rt) => angles[rt.t.angleId]);

    const missing = values
      .map((v, i) => (v === undefined ? this.targetLabel(this.targets[i].t) : null))
      .filter(Boolean) as string[];
    if (missing.length > 0) {
      this.pushFeedback(`Keep ${missing.join(' and ')} in camera view`, 'warning');
      return;
    }

    const satisfied = this.targets.map((rt, i) => {
      const p = progress(values[i]!, rt.t);
      return p >= progress(rt.t.acceptable, rt.t);
    });
    const allSatisfied = satisfied.every(Boolean);
    const allOptimalNow = this.targets.every((rt, i) => {
      const p = progress(values[i]!, rt.t);
      return p >= progress(rt.t.optimal, rt.t);
    });

    if (!this.inPose) {
      if (allSatisfied) {
        this.inPose = true;
        this.started = true;
        this.poseOptimal = allOptimalNow;
        this.pushFeedback(allOptimalNow ? 'Perfect — hold it' : 'Hold it', 'success');
      } else {
        const weak = satisfied
          .map((s, i) => (!s ? this.targetLabel(this.targets[i].t) : null))
          .filter(Boolean) as string[];
        if (weak.length > 0) {
          this.pushFeedback(`Move your ${weak.join(' and ')}`, 'info');
        }
      }
      return;
    }

    // Currently holding the pose.
    if (allOptimalNow) this.poseOptimal = true;

    const stillHolding = this.targets.every((rt, i) => {
      const p = progress(values[i]!, rt.t);
      return p >= progress(rt.t.acceptable, rt.t) * 0.85;
    });

    if (!stillHolding) {
      this.inPose = false;
      this.reps += 1;
      if (this.poseOptimal) this.optimalReps += 1;
      this.onRep(this.poseOptimal);
      this.poseOptimal = false;
    }
  }

  // --- Auto fallback ---------------------------------------------------------

  private updateRepsAuto(angle: number) {
    if (angle < this.minAngle) this.minAngle = angle;
    if (angle > this.maxAngle) this.maxAngle = angle;

    const range = this.maxAngle - this.minAngle;
    if (range < MIN_RANGE) {
      this.pushFeedback('Move through your full range to start counting', 'info');
      return;
    }
    if (!this.started) {
      this.started = true;
      this.pushFeedback('Good, keep going', 'success');
    }

    const mid = (this.minAngle + this.maxAngle) / 2;
    const margin = range * MARGIN_RATIO;
    if (angle < mid - margin) {
      this.phase = 'low';
      this.wentLow = true;
    } else if (angle > mid + margin && this.phase === 'low' && this.wentLow) {
      this.phase = 'high';
      this.wentLow = false;
      this.reps += 1;
      this.onRep(false);
    }
  }

  private onRep(optimal: boolean) {
    if (this.reps >= this.targetReps) {
      this.completedSets += 1;
      if (this.completedSets >= this.targetSets) {
        this.pushFeedback('All sets complete! Great work', 'success');
      } else {
        this.pushFeedback(`Set ${this.completedSets} done — take a short rest`, 'success');
        this.reps = 0;
      }
    } else if (optimal) {
      this.pushFeedback(`Perfect rep! ${this.reps} of ${this.targetReps}`, 'success');
    } else {
      this.pushFeedback(`Rep ${this.reps} of ${this.targetReps} — go deeper for full credit`, 'info');
    }
  }

  processFrame(landmarks: Landmark[] | null): TrackerState {
    const now = performance.now();
    this.trackFps(now);

    let angles: JointAngles = {};
    if (landmarks) {
      angles = this.computeAngles(landmarks);
      if (this.targets.length > 0) {
        this.updateRepsPose(angles);
      } else if (this.autoJoint && angles[this.autoJoint] !== undefined) {
        this.updateRepsAuto(angles[this.autoJoint]);
      }
    } else {
      this.pushFeedback('Step into the camera view', 'warning');
    }

    const targetStates =
      this.targets.length > 0
        ? this.targets.map((rt) => {
            const value = angles[rt.t.angleId];
            return {
              angleId: rt.t.angleId,
              value: value ?? null,
              zone: value !== undefined ? classifyZone(value, rt.t) : null,
            };
          })
        : this.autoJoint
        ? [{ angleId: this.autoJoint, value: angles[this.autoJoint] ?? null, zone: null }]
        : [];

    return {
      reps: this.reps,
      sets: this.completedSets,
      trackedAngles: angles,
      feedback: [...this.feedback],
      targets: targetStates,
      optimalReps: this.optimalReps,
      rangeReady: this.targets.length > 0 ? true : this.maxAngle - this.minAngle >= MIN_RANGE,
      fps: this.frameTimes.length,
    };
  }

  isComplete(): boolean {
    return this.completedSets >= this.targetSets;
  }

  getScore(): number {
    const totalTarget = this.targetReps * this.targetSets;
    const totalDone = this.getTotalReps();
    const completion = Math.min(1, totalDone / totalTarget);
    if (this.targets.length === 0) return Math.round(completion * 100);
    const quality = totalDone > 0 ? this.optimalReps / totalDone : 0;
    return Math.round(100 * completion * (0.7 + 0.3 * quality));
  }

  getTotalReps(): number {
    return this.completedSets * this.targetReps + (this.isComplete() ? 0 : this.reps);
  }

  getOptimalReps(): number {
    return this.optimalReps;
  }
}
