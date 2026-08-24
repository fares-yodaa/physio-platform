import { Check } from 'lucide-react';
import { friendlyAngle } from '../../lib/constants';
import { thresholdsValid } from '../../lib/repThresholds';
import type { CustomAngle, JointAngles, RepThresholdsDraft } from '../../types';

interface DoctorEditorPanelProps {
  liveAngles: JointAngles;
  repTargets: RepThresholdsDraft[];
  thresholdsReady: boolean;
  onCaptureResting: () => void;
  onCaptureOptimal: () => void;
  onRemoveTarget: (angleId: string) => void;
  isPaused: boolean;
  hasVideo: boolean;
  saving: boolean;
  customAngles: CustomAngle[];
  onSave: () => void;
}

export default function DoctorEditorPanel({
  liveAngles,
  repTargets,
  thresholdsReady,
  onCaptureResting,
  onCaptureOptimal,
  onRemoveTarget,
  isPaused,
  hasVideo,
  saving,
  customAngles,
  onSave,
}: DoctorEditorPanelProps) {
  const canCapture = hasVideo && isPaused && repTargets.length > 0;
  const step = !hasVideo ? 1 : repTargets.length === 0 ? 2 : !thresholdsReady ? 3 : 4;

  return (
    <div className="w-full lg:w-72 shrink-0 space-y-4">
      {/* Steps */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Setup</h3>
        <ol className="space-y-2 text-xs">
          <Step n={1} done={hasVideo} active={step === 1} label="Add your video" />
          <Step n={2} done={repTargets.length > 0} active={step === 2} label="Tap joints on the body (gold = counting)" />
          <Step n={3} done={thresholdsReady} active={step === 3} label="Pause → capture rest, then target" />
          <Step n={4} done={false} active={step === 4} label="Save exercise" />
        </ol>
      </div>

      {/* Capture — the only controls doctors need day-to-day */}
      {repTargets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs text-gray-500">
            {isPaused
              ? 'Paused — capture this frame as rest or target.'
              : 'Pause the video at each pose, then capture.'}
          </p>
          <button
            type="button"
            onClick={onCaptureResting}
            disabled={!canCapture}
            className="w-full py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
          >
            ← This is REST
          </button>
          <button
            type="button"
            onClick={onCaptureOptimal}
            disabled={!canCapture}
            className="w-full py-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            This is TARGET →
          </button>
        </div>
      )}

      {/* Live angles — compact list, details are on the skeleton */}
      {repTargets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Counting</div>
          <ul className="space-y-2">
            {repTargets.map((t) => {
              const live = liveAngles[t.angleId];
              const ca = customAngles.find((c) => c.id === t.angleId);
              const ready = thresholdsValid(t);
              return (
                <li
                  key={t.angleId}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-800 truncate">
                    {friendlyAngle(t.angleId, ca?.name)}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-bold tabular-nums text-amber-600">
                      {live !== undefined ? `${live.toFixed(0)}°` : '—'}
                    </span>
                    {ready && (
                      <span className="text-[10px] text-gray-400 tabular-nums">
                        {Math.round(t.resting!)}→{Math.round(t.optimal!)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveTarget(t.angleId)}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving || !thresholdsReady}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3.5 rounded-2xl hover:bg-indigo-700 font-semibold disabled:opacity-40 shadow-sm"
      >
        <Check className="w-5 h-5" />
        {saving ? 'Saving…' : 'Save exercise'}
      </button>
    </div>
  );
}

function Step({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <li className={`flex items-start gap-2 ${active ? 'text-indigo-700 font-medium' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
          done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'
        }`}
      >
        {done ? '✓' : n}
      </span>
      {label}
    </li>
  );
}
