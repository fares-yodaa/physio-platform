import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../lib/api';

interface ProgressData {
  patient_name: string;
  total_sessions: number;
  exercises_practiced: number;
  avg_score: number;
  total_reps: number;
  score_trend: { session_id: number; date: string; score: number; reps: number }[];
}

export default function PatientProgress() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.progress
      .get('Patient')
      .then(setProgress)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const chartData = progress?.score_trend.map((s, i) => ({
    session: i + 1,
    score: Math.round(s.score),
    reps: s.reps,
  })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/patient" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">My Progress</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading progress...</div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No sessions recorded yet.</p>
            <p className="text-sm text-gray-400 mt-1">Complete an exercise to see your progress here.</p>
            <Link to="/patient" className="mt-4 inline-block text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              Go to exercises
            </Link>
          </div>
        ) : progress ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Sessions" value={progress.total_sessions} />
              <StatCard label="Exercises" value={progress.exercises_practiced} />
              <StatCard label="Total Reps" value={progress.total_reps} />
              <StatCard label="Average Score" value={`${Math.round(progress.avg_score)}%`} />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Score Over Time</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="session" label={{ value: 'Session', position: 'bottom' }} />
                    <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} name="Score %" />
                    <Line type="monotone" dataKey="reps" stroke="#22c55e" strokeWidth={1.5} name="Reps" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Not enough data to show chart</p>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
