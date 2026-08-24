import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Activity, User, Stethoscope } from 'lucide-react';
import DoctorDashboard from './pages/DoctorDashboard';
import ExerciseBuilder from './pages/ExerciseBuilder';
import DoctorDebugTrial from './pages/DoctorDebugTrial';
import PatientDashboard from './pages/PatientDashboard';
import PatientExercise from './pages/PatientExercise';
import PatientProgress from './pages/PatientProgress';

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Activity className="w-12 h-12 text-indigo-600" />
          <h1 className="text-4xl font-bold text-gray-900">PhysioTrack</h1>
        </div>
        <p className="text-lg text-gray-600 mb-12">
          Visual joint-tracking for physiotherapy — pick the points that matter, track the movement
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/doctor"
            className="group p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100"
          >
            <Stethoscope className="w-10 h-10 text-indigo-600 mb-4 mx-auto group-hover:scale-110 transition-transform" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Doctor Portal</h2>
            <p className="text-gray-500">Record a movement, pause at the correct pose, and save — the system tracks the rest</p>
          </Link>
          <Link
            to="/patient"
            className="group p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100"
          >
            <User className="w-10 h-10 text-emerald-600 mb-4 mx-auto group-hover:scale-110 transition-transform" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Portal</h2>
            <p className="text-gray-500">Perform exercises with real-time guidance, track your progress</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/doctor/exercise/new" element={<ExerciseBuilder />} />
        <Route path="/doctor/exercise/:id/edit" element={<ExerciseBuilder />} />
        <Route path="/doctor/exercise/:id/trial" element={<DoctorDebugTrial />} />
        <Route path="/patient" element={<PatientDashboard />} />
        <Route path="/patient/exercise/:id" element={<PatientExercise />} />
        <Route path="/patient/progress" element={<PatientProgress />} />
      </Routes>
    </BrowserRouter>
  );
}
