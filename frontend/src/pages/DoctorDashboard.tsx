import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Play, Edit, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import type { Exercise } from '../types';

export default function DoctorDashboard() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.exercises.list().then(setExercises).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this exercise?')) return;
    await api.exercises.delete(id);
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Doctor Dashboard</h1>
          </div>
          <Link
            to="/doctor/exercise/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Exercise
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading exercises...</div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No exercises created yet.</p>
            <Link
              to="/doctor/exercise/new"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Create your first exercise
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 capitalize">
                    {exercise.body_part?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{exercise.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                  <span>{exercise.selected_joints?.length ?? 0} joints</span>
                  <span>·</span>
                  <span>{exercise.custom_joints?.length ?? 0} custom</span>
                  <span>·</span>
                  <span>{exercise.target_reps} reps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/doctor/exercise/${exercise.id}/edit`}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-50"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </Link>
                  <Link
                    to={`/doctor/exercise/${exercise.id}/trial`}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-emerald-600 px-3 py-1.5 rounded-md hover:bg-emerald-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Trial
                  </Link>
                  <button
                    onClick={() => handleDelete(exercise.id)}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
