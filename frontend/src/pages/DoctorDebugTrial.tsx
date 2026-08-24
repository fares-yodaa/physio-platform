import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square } from 'lucide-react';
import { api } from '../lib/api';
import { initMediaPipe, detectPose, destroyMediaPipe } from '../lib/mediapipe';
import { SimpleTracker } from '../engine/SimpleTracker';
import { computeTargetAngles, computeAngleArcs } from '../lib/editorAngles';
import { drawSkeletonOverlay } from '../lib/skeletonDraw';
import { landmarksForRepTargets } from '../lib/constants';
import type { Landmark, Exercise, TrackerState } from '../types';

const W = 640;
const H = 480;

function drawExerciseOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  exercise: Exercise
) {
  const repTargets = exercise.rep_targets || [];
  const countingIds = repTargets.map((t) => t.angleId);
  const active = landmarksForRepTargets(repTargets, exercise.selected_joints);
  const angles = computeTargetAngles(
    landmarks,
    countingIds,
    exercise.joint_positions || {},
    exercise.custom_joints || [],
    exercise.custom_angles || []
  );
  const angleArcs = computeAngleArcs(
    landmarks,
    exercise.joint_positions || {},
    exercise.custom_joints || [],
    active,
    exercise.custom_angles || [],
    W,
    H,
    angles
  );
  drawSkeletonOverlay(ctx, {
    landmarks,
    width: W,
    height: H,
    activeJoints: active,
    countingAngleIds: countingIds,
    angles,
    angleArcs,
    repTargets,
    jointPositions: exercise.joint_positions || {},
    customJoints: exercise.custom_joints || [],
  });
}

export default function DoctorDebugTrial() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<TrackerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<SimpleTracker | null>(null);
  const rafRef = useRef<number>(0);
  const detectingRef = useRef(false);

  useEffect(() => {
    api.exercises.get(Number(id)).then(setExercise);
  }, [id]);

  const stop = useCallback(() => {
    detectingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => () => {
    stop();
    destroyMediaPipe();
  }, [stop]);

  const start = useCallback(async () => {
    if (!exercise) return;
    setError(null);
    trackerRef.current = new SimpleTracker({
      selectedJoints: exercise.selected_joints,
      targetReps: exercise.target_reps,
      targetSets: exercise.target_sets,
      primaryAngle: exercise.primary_angle || undefined,
      customAngles: exercise.custom_angles || [],
      referenceAngles: exercise.reference_angles || {},
      repTargets: exercise.rep_targets || [],
    });
    try {
      await initMediaPipe();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: W, height: H, facingMode: 'user' },
      });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      detectingRef.current = true;
      setRunning(true);

      const loop = () => {
        if (!detectingRef.current) return;
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2) {
          const lm = detectPose(vid, performance.now());
          const s = trackerRef.current!.processFrame(lm);
          setState(s);
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            if (lm) drawExerciseOverlay(ctx, lm, exercise);
            else ctx.clearRect(0, 0, W, H);
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      setError(e.message || 'Could not access camera');
    }
  }, [exercise]);

  if (!exercise) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/doctor')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Trial · {exercise.name}</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div
            className="relative bg-gray-900 rounded-xl overflow-hidden mx-auto"
            style={{ width: W, height: H, maxWidth: '100%' }}
          >
            <video ref={videoRef} width={W} height={H} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          <div className="mt-3">
            {running ? (
              <button onClick={stop} className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 font-medium">
                <Square className="w-4 h-4" /> Stop
              </button>
            ) : (
              <button onClick={start} className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-medium">
                <Play className="w-4 h-4" /> Start Trial
              </button>
            )}
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Reps</div>
            <div className="text-3xl font-bold text-gray-900">
              {state?.reps ?? 0}<span className="text-base text-gray-400"> / {exercise.target_reps}</span>
            </div>
            {state && state.optimalReps > 0 && (
              <div className="text-xs text-emerald-600 mt-1">{state.optimalReps} perfect</div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">FPS</div>
            <div className="text-lg font-semibold text-gray-900">{state?.fps ?? 0}</div>
          </div>
          <p className="text-xs text-gray-400 px-1">
            Angles and arcs are shown on the skeleton overlay — gold joints show live degrees.
          </p>
        </div>
      </main>
    </div>
  );
}
