import { useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import {
  SCHEMATIC_POSITIONS,
  BODY_CONNECTIONS,
  BODY_LANDMARKS,
  angleAtLandmark,
} from '../../lib/schematicSkeleton';
import { schematicPositionsForAngles, type PreviewPhase } from '../../lib/schematicPose';
import { friendlyAngle, JOINT_ANGLE_DEFINITIONS } from '../../lib/constants';
import { classifyZone, thresholdsValid } from '../../lib/repThresholds';
import type { JointAngles, RepThresholdsDraft } from '../../types';

interface SkeletonPreviewProps {
  activeJoints: string[];
  countingAngleIds: string[];
  selectedJoint: string | null;
  liveAngles?: JointAngles;
  repTargets: RepThresholdsDraft[];
  onJointTap: (name: string) => void;
}

const W = 240;
const H = 336;
const HIT_R = 18;

const PHASES: PreviewPhase[] = ['live', 'rest', 'acceptable', 'optimal'];
const PLAY_PHASES: PreviewPhase[] = ['rest', 'acceptable', 'optimal'];

const PHASE_LABEL: Record<PreviewPhase, string> = {
  live: 'Live',
  rest: 'Rest',
  acceptable: 'Acceptable',
  optimal: 'Optimal',
};

const PHASE_COLOR: Record<PreviewPhase, string> = {
  live: '#6366f1',
  rest: '#94a3b8',
  acceptable: '#fbbf24',
  optimal: '#22c55e',
};

function zoneFill(zone: string | null): string {
  if (zone === 'optimal') return '#22c55e';
  if (zone === 'acceptable') return '#fbbf24';
  if (zone === 'below') return '#fb923c';
  if (zone === 'rest') return '#94a3b8';
  return '#f59e0b';
}

function displayAnglesForPhase(
  phase: PreviewPhase,
  liveAngles: JointAngles,
  repTargets: RepThresholdsDraft[]
): JointAngles {
  if (phase === 'live') return liveAngles;
  const out: JointAngles = {};
  for (const t of repTargets) {
    if (!thresholdsValid(t)) continue;
    if (phase === 'rest') out[t.angleId] = t.resting;
    else if (phase === 'acceptable') out[t.angleId] = t.acceptable;
    else out[t.angleId] = t.optimal;
  }
  return out;
}

export default function SkeletonPreview({
  activeJoints,
  countingAngleIds,
  selectedJoint,
  liveAngles = {},
  repTargets,
  onJointTap,
}: SkeletonPreviewProps) {
  const [phase, setPhase] = useState<PreviewPhase>('live');
  const [playing, setPlaying] = useState(false);

  const hasThresholds = repTargets.some((t) => thresholdsValid(t));

  useEffect(() => {
    if (!playing || !hasThresholds) return;
    let idx = 0;
    setPhase(PLAY_PHASES[0]);
    const id = window.setInterval(() => {
      idx = (idx + 1) % PLAY_PHASES.length;
      setPhase(PLAY_PHASES[idx]);
    }, 1400);
    return () => window.clearInterval(id);
  }, [playing, hasThresholds]);

  const activeSet = useMemo(() => new Set(activeJoints), [activeJoints]);
  const countingSet = useMemo(() => new Set(countingAngleIds), [countingAngleIds]);
  const targetByAngle = useMemo(
    () => new Map(repTargets.filter((t) => thresholdsValid(t)).map((t) => [t.angleId, t])),
    [repTargets]
  );

  const displayAngles = useMemo(
    () => displayAnglesForPhase(phase, liveAngles, repTargets),
    [phase, liveAngles, repTargets]
  );

  const jointPositions = useMemo(() => {
    if (phase === 'live') {
      const angleValues: Record<string, number> = {};
      for (const id of countingAngleIds) {
        if (liveAngles[id] != null) angleValues[id] = liveAngles[id];
      }
      if (Object.keys(angleValues).length === 0) return SCHEMATIC_POSITIONS;
      return schematicPositionsForAngles(angleValues);
    }
    if (Object.keys(displayAngles).length === 0) return SCHEMATIC_POSITIONS;
    return schematicPositionsForAngles(displayAngles);
  }, [phase, liveAngles, countingAngleIds, displayAngles]);

  const px = (name: string) => (jointPositions[name]?.x ?? SCHEMATIC_POSITIONS[name]?.x ?? 0.5) * W;
  const py = (name: string) => (jointPositions[name]?.y ?? SCHEMATIC_POSITIONS[name]?.y ?? 0.5) * H;

  const togglePlay = () => {
    if (!hasThresholds) return;
    setPlaying((p) => {
      if (p) setPhase('live');
      return !p;
    });
  };

  const pickPhase = (p: PreviewPhase) => {
    setPlaying(false);
    setPhase(p);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Skeleton</p>
          <p className="text-xs text-gray-400">Tap joints · preview your rep ranges</p>
        </div>
        {hasThresholds && (
          <button
            type="button"
            onClick={togglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              playing
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-indigo-200'
            }`}
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pause' : 'Play ranges'}
          </button>
        )}
      </div>

      {hasThresholds && (
        <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-xl">
          {PHASES.map((p) => {
            const active = phase === p;
            const needsThresholds = p !== 'live';
            const disabled = needsThresholds && !hasThresholds;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => pickPhase(p)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                } ${disabled ? 'opacity-40' : ''}`}
                style={active ? { color: PHASE_COLOR[p] } : undefined}
              >
                {PHASE_LABEL[p]}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-center relative">
        {phase !== 'live' && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow"
            style={{ backgroundColor: PHASE_COLOR[phase] }}
          >
            {PHASE_LABEL[phase]}
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-44 h-auto select-none mt-4"
          role="img"
          aria-label="Skeleton preview"
        >
          {BODY_CONNECTIONS.map(([a, b]) => {
            const both = activeSet.has(a) && activeSet.has(b);
            const countingLine = countingAngleIds.some((id) => {
              const def = JOINT_ANGLE_DEFINITIONS[id];
              return def && (def.includes(a) || def.includes(b));
            });
            return (
              <line
                key={`${a}-${b}`}
                x1={px(a)}
                y1={py(a)}
                x2={px(b)}
                y2={py(b)}
                stroke={countingLine ? '#fbbf24' : both ? '#22c55e' : '#e2e8f0'}
                strokeWidth={countingLine ? 3 : both ? 2.5 : 1.5}
                strokeLinecap="round"
                pointerEvents="none"
              />
            );
          })}

          {BODY_LANDMARKS.map((name) => {
            const angleId = angleAtLandmark(name);
            const isActive = activeSet.has(name);
            const isCounting = angleId != null && countingSet.has(angleId);
            const isSelected = selectedJoint === name;
            const x = px(name);
            const y = py(name);
            const shown = angleId != null ? displayAngles[angleId] : undefined;
            const target = angleId != null ? targetByAngle.get(angleId) : undefined;
            const zone =
              phase === 'live' && shown !== undefined && target
                ? classifyZone(shown, target)
                : phase === 'rest'
                ? 'rest'
                : phase === 'acceptable'
                ? 'acceptable'
                : phase === 'optimal'
                ? 'optimal'
                : null;

            let fill = '#cbd5e1';
            if (isCounting && shown !== undefined && phase !== 'live') fill = PHASE_COLOR[phase];
            else if (isCounting && shown !== undefined && target) fill = zoneFill(zone);
            else if (isCounting) fill = '#f59e0b';
            else if (isActive) fill = '#22c55e';

            const r = isSelected ? 10 : isCounting ? 9 : isActive ? 8 : 6;

            return (
              <g key={name}>
                {isSelected && (
                  <circle cx={x} cy={y} r={16} fill="none" stroke="#6366f1" strokeWidth={2.5} pointerEvents="none" />
                )}
                {isCounting && !isSelected && (
                  <circle cx={x} cy={y} r={14} fill="rgba(251,191,36,0.15)" pointerEvents="none" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={HIT_R}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onJointTap(name)}
                />
                <circle cx={x} cy={y} r={r} fill={fill} stroke="white" strokeWidth={2} pointerEvents="none" />
                {isCounting && shown !== undefined && (
                  <text
                    x={x}
                    y={y + r + 14}
                    textAnchor="middle"
                    className="fill-slate-800 pointer-events-none"
                    style={{ fontSize: 11, fontWeight: 700 }}
                  >
                    {shown.toFixed(0)}°
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {countingAngleIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {countingAngleIds.map((id) => {
            const shown = displayAngles[id];
            const draft = repTargets.find((t) => t.angleId === id);
            const target = thresholdsValid(draft) ? draft : null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-gray-50"
              >
                {friendlyAngle(id)}
                {shown !== undefined ? (
                  <span className="tabular-nums font-bold">{shown.toFixed(0)}°</span>
                ) : target ? (
                  <span className="text-gray-400 tabular-nums">
                    {Math.round(target.resting)}→{Math.round(target.optimal)}°
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      )}

      {!hasThresholds && countingAngleIds.length > 0 && (
        <p className="text-xs text-center text-amber-600 mt-2">
          Set rest, acceptable, and optimal to preview the movement here.
        </p>
      )}
    </div>
  );
}
