import { gaugePosition } from '../lib/repThresholds';
import type { RepThresholds } from '../types';

interface RepGaugeProps {
  thresholds: Pick<RepThresholds, 'resting' | 'acceptable' | 'optimal'>;
  /** Live angle to show as a moving needle. */
  current?: number | null;
  variant?: 'light' | 'dark';
}

/**
 * Horizontal gauge of the rep-counting axis: resting → acceptable → optimal.
 * The grey band doesn't count, the green band is the target. A needle shows
 * the live angle so doctors and patients can "push into the green".
 */
export default function RepGauge({ thresholds, current, variant = 'light' }: RepGaugeProps) {
  const { resting, acceptable, optimal } = thresholds;
  const accPos = Math.max(0, Math.min(1, gaugePosition(acceptable, thresholds))) * 100;
  const curPos = current != null ? gaugePosition(current, thresholds) * 100 : null;

  const dark = variant === 'dark';
  const trackBase = dark ? 'bg-gray-700' : 'bg-gray-200';
  const labelColor = dark ? 'text-gray-300' : 'text-gray-600';
  const needleColor = dark ? 'bg-white' : 'bg-gray-900';

  return (
    <div className="w-full">
      <div className={`relative h-4 rounded-full overflow-hidden ${trackBase}`}>
        {/* below-acceptable band (doesn't count) */}
        <div
          className={dark ? 'absolute inset-y-0 left-0 bg-gray-600' : 'absolute inset-y-0 left-0 bg-gray-300'}
          style={{ width: `${accPos}%` }}
        />
        {/* acceptable → optimal band (counts) */}
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-amber-400 to-emerald-500"
          style={{ left: `${accPos}%`, right: 0 }}
        />
        {/* acceptable divider */}
        <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${accPos}%` }} />
        {/* live needle */}
        {curPos != null && (
          <div
            className={`absolute -inset-y-1 w-1 rounded-full ${needleColor} shadow`}
            style={{ left: `calc(${curPos}% - 2px)` }}
          />
        )}
      </div>

      <div className={`flex justify-between text-[10px] mt-1 ${labelColor}`}>
        <span>Rest {Math.round(resting)}°</span>
        <span>OK {Math.round(acceptable)}°</span>
        <span>Best {Math.round(optimal)}°</span>
      </div>
    </div>
  );
}
