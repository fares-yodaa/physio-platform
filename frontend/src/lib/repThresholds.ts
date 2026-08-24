import type { RepThresholds, RepThresholdsDraft, RepZone } from '../types';

/**
 * Doctor-defined rep counting works off three angles on a single axis:
 *   resting → acceptable → optimal
 * The movement direction (flexion lowers the angle, extension raises it) is
 * inferred from the ordering, so the same logic works for any joint.
 */

/** A draft is complete + sensible: resting/optimal differ and acceptable sits between them. */
export function thresholdsValid(
  t: RepThresholdsDraft | RepThresholds | null | undefined
): t is RepThresholds | (RepThresholdsDraft & { resting: number; acceptable: number; optimal: number }) {
  if (!t) return false;
  const { resting, acceptable, optimal } = t;
  if (resting == null || acceptable == null || optimal == null) return false;
  if (resting === optimal) return false;
  const lo = Math.min(resting, optimal);
  const hi = Math.max(resting, optimal);
  return acceptable > lo && acceptable < hi;
}

/** Default acceptable threshold: 60% of the way from resting toward optimal. */
export function suggestAcceptable(resting: number, optimal: number): number {
  return Math.round(resting + 0.6 * (optimal - resting));
}

/** Keep an acceptable value strictly inside the (resting, optimal) range. */
export function clampAcceptable(acceptable: number, resting: number, optimal: number): number {
  const lo = Math.min(resting, optimal);
  const hi = Math.max(resting, optimal);
  const pad = Math.max(1, Math.round(Math.abs(hi - lo) * 0.05));
  return Math.min(hi - pad, Math.max(lo + pad, acceptable));
}

/** +1 when effort increases the angle (extension), -1 when it lowers it (flexion). */
export function direction(t: { resting: number; optimal: number }): number {
  return Math.sign(t.optimal - t.resting) || 1;
}

/** "Progress" of an angle along the resting→optimal axis (0 at rest, larger = more effort). */
export function progress(angle: number, t: { resting: number; optimal: number }): number {
  return direction(t) * (angle - t.resting);
}

export function classifyZone(angle: number, t: RepThresholds): RepZone {
  const p = progress(angle, t);
  const acc = progress(t.acceptable, t);
  const opt = progress(t.optimal, t);
  if (p <= acc * 0.25) return 'rest';
  if (p < acc) return 'below';
  if (p < opt) return 'acceptable';
  return 'optimal';
}

/** 0..1 position of an angle along the resting→optimal track (clamped). */
export function gaugePosition(angle: number, t: { resting: number; optimal: number }): number {
  const span = t.optimal - t.resting;
  if (span === 0) return 0;
  return Math.max(0, Math.min(1, (angle - t.resting) / span));
}
