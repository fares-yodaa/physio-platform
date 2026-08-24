import { friendlyAngle, friendlyJoint } from '../../lib/constants';
import { suggestAcceptable, thresholdsValid } from '../../lib/repThresholds';
import type { RepThresholdsDraft } from '../../types';

interface JointAnglePanelProps {
  jointName: string;
  angleId: string | null;
  liveAngle: number | undefined;
  draft: RepThresholdsDraft | null;
  isCounting: boolean;
  onClose: () => void;
  onSetField: (field: 'resting' | 'acceptable' | 'optimal', value: number | null) => void;
  onUseCurrent: (field: 'resting' | 'acceptable' | 'optimal') => void;
  onToggleCounting: (on: boolean) => void;
  onDeactivateJoint: () => void;
}

export default function JointAnglePanel({
  jointName,
  angleId,
  liveAngle,
  draft,
  isCounting,
  onClose,
  onSetField,
  onUseCurrent,
  onToggleCounting,
  onDeactivateJoint,
}: JointAnglePanelProps) {
  const title = angleId ? friendlyAngle(angleId) : friendlyJoint(jointName);
  const ready = draft != null && thresholdsValid(draft);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {angleId ? 'Set angle thresholds for rep counting' : 'Tracking only — no angle at this joint'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {angleId && (
        <>
          <div className="flex items-baseline justify-between mb-4 px-3 py-2.5 rounded-xl bg-slate-900 text-white">
            <span className="text-xs text-slate-400">Live now</span>
            <span className="text-2xl font-bold tabular-nums">
              {liveAngle !== undefined ? `${liveAngle.toFixed(0)}°` : '—'}
            </span>
          </div>

          <div className="space-y-3">
            <ThresholdRow
              label="Rest"
              hint="Starting position"
              value={draft?.resting ?? null}
              live={liveAngle}
              onChange={(v) => onSetField('resting', v)}
              onUseCurrent={() => onUseCurrent('resting')}
              accent="gray"
            />
            <ThresholdRow
              label="Acceptable"
              hint="Good enough"
              value={draft?.acceptable ?? null}
              live={liveAngle}
              onChange={(v) => onSetField('acceptable', v)}
              onUseCurrent={() => onUseCurrent('acceptable')}
              accent="amber"
            />
            <ThresholdRow
              label="Optimal"
              hint="Target pose"
              value={draft?.optimal ?? null}
              live={liveAngle}
              onChange={(v) => onSetField('optimal', v)}
              onUseCurrent={() => onUseCurrent('optimal')}
              accent="emerald"
            />
          </div>

          <label className="mt-4 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isCounting}
              onChange={(e) => onToggleCounting(e.target.checked)}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm text-gray-800">Count reps on this angle</span>
          </label>

          {isCounting && ready && draft && (
            <p className="mt-2 text-xs text-emerald-600">
              Range: {Math.round(draft.resting!)}° → {Math.round(draft.optimal!)}° (acceptable{' '}
              {Math.round(draft.acceptable!)}°)
            </p>
          )}
          {isCounting && !ready && (
            <p className="mt-2 text-xs text-amber-600">Set rest, acceptable, and optimal to count reps.</p>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onDeactivateJoint}
        className="mt-4 w-full py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
      >
        Turn off {friendlyJoint(jointName)}
      </button>
    </div>
  );
}

function ThresholdRow({
  label,
  hint,
  value,
  live,
  onChange,
  onUseCurrent,
  accent,
}: {
  label: string;
  hint: string;
  value: number | null;
  live: number | undefined;
  onChange: (v: number | null) => void;
  onUseCurrent: () => void;
  accent: 'gray' | 'amber' | 'emerald';
}) {
  const border =
    accent === 'emerald'
      ? 'border-emerald-200 focus-within:ring-emerald-200'
      : accent === 'amber'
      ? 'border-amber-200 focus-within:ring-amber-200'
      : 'border-gray-200 focus-within:ring-gray-200';

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:ring-2 ${border}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-800">{label}</div>
        <div className="text-[10px] text-gray-400">{hint}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min={0}
          max={180}
          value={value ?? ''}
          placeholder="—"
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? null : Number(raw));
          }}
          className="w-14 text-center text-sm font-semibold tabular-nums border border-gray-200 rounded-lg py-1"
        />
        <span className="text-xs text-gray-400">°</span>
        <button
          type="button"
          onClick={onUseCurrent}
          disabled={live === undefined}
          className="text-[10px] font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 whitespace-nowrap"
        >
          Use current
        </button>
      </div>
    </div>
  );
}

/** Helper used by parent when applying "use current" with auto-acceptable. */
export function applyUseCurrent(
  draft: RepThresholdsDraft,
  field: 'resting' | 'acceptable' | 'optimal',
  live: number
): RepThresholdsDraft {
  const next = { ...draft, [field]: Math.round(live) };
  if (field !== 'acceptable' && next.resting != null && next.optimal != null) {
    next.acceptable =
      next.acceptable == null
        ? suggestAcceptable(next.resting, next.optimal)
        : next.acceptable;
  }
  return next;
}
