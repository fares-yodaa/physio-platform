import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, BarChart3, Activity } from 'lucide-react';
import { api } from '../lib/api';
import type { Exercise } from '../types';

export default function PatientDashboard() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.exercises.list().then(setExercises).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <h1 className="text-xl font-bold text-gray-900">My Exercises</h1>
            </div>
          </div>
          <Link
            to="/patient/progress"
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            <BarChart3 className="w-4 h-4" />
            View Progress
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading exercises...</div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No exercises available yet.</p>
            <p className="text-sm text-gray-400 mt-1">Ask your doctor to create exercises for you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-indigo-50 text-indigo-700">
                    {exercise.body_part?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{exercise.description}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    {exercise.target_reps} reps × {exercise.target_sets} {exercise.target_sets > 1 ? 'sets' : 'set'}
                  </div>
                  <Link
                    to={`/patient/exercise/${exercise.id}`}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
