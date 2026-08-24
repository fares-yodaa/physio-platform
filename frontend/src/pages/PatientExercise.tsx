import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { initMediaPipe, detectPose, destroyMediaPipe } from '../lib/mediapipe';
import { SimpleTracker } from '../engine/SimpleTracker';
import { computeTargetAngles, computeAngleArcs } from '../lib/editorAngles';
import { drawSkeletonOverlay } from '../lib/skeletonDraw';
import { landmarksForRepTargets } from '../lib/constants';
import type { Landmark, Exercise, TrackerState } from '../types';

const W = 640;
const H = 480;

type Phase = 'intro' | 'active' | 'done';

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

export default function PatientExercise() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [state, setState] = useState<TrackerState | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<SimpleTracker | null>(null);
  const rafRef = useRef<number>(0);
  const detectingRef = useRef(false);
  const startedAtRef = useRef<string>('');
  const savedRef = useRef(false);

  useEffect(() => {
    api.exercises.get(Number(id)).then(setExercise);
  }, [id]);

  const stopCamera = useCallback(() => {
    detectingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }, []);

  useEffect(() => () => {
    stopCamera();
    destroyMediaPipe();
  }, [stopCamera]);

  const finish = useCallback(async () => {
    stopCamera();
    setPhase('done');
    const tracker = trackerRef.current;
    if (tracker && !savedRef.current && exercise) {
      savedRef.current = true;
      try {
        await api.sessions.create({
          exercise_id: exercise.id,
          patient_name: 'Patient',
          reps_completed: tracker.getTotalReps(),
          score: tracker.getScore(),
          started_at: startedAtRef.current || new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
      } catch {
        /* non-blocking for the demo */
      }
    }
  }, [exercise, stopCamera]);

  const start = useCallback(async () => {
    if (!exercise) return;
    setCameraError(null);
    setPhase('active');
    savedRef.current = false;
    startedAtRef.current = new Date().toISOString();
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

      const loop = () => {
        if (!detectingRef.current) return;
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2) {
          const lm = detectPose(vid, performance.now());
          const tracker = trackerRef.current!;
          const s = tracker.processFrame(lm);
          setState(s);

          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            if (lm) drawExerciseOverlay(ctx, lm, exercise);
            else ctx.clearRect(0, 0, W, H);
          }

          if (tracker.isComplete()) {
            finish();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      setCameraError(e.message || 'Could not access camera');
      setPhase('intro');
    }
  }, [exercise, finish]);

  if (!exercise) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  const lastFeedback = state?.feedback[state.feedback.length - 1];
  const repsTarget = exercise.target_reps;
  const countingCount = exercise.rep_targets?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="px-6 py-4 flex items-center gap-4 border-b border-gray-800">
        <button onClick={() => navigate('/patient')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">{exercise.name}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {phase === 'intro' && (
          <div className="text-center py-8">
            <p className="text-gray-300 mb-2">{exercise.description || 'Follow the movement on screen.'}</p>
            <p className="text-sm text-gray-500 mb-6">
              {repsTarget} reps × {exercise.target_sets} {exercise.target_sets > 1 ? 'sets' : 'set'}
              {countingCount > 0 && ` · ${countingCount} angle${countingCount > 1 ? 's' : ''} on skeleton`}
            </p>
            {cameraError && (
              <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-sm mb-4 max-w-md mx-auto">
                {cameraError}
              </div>
            )}
            <button
              onClick={start}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl font-medium text-lg"
            >
              <Play className="w-5 h-5" /> Start Exercise
            </button>
          </div>
        )}

        {phase === 'active' && (
          <div className="space-y-4">
            <div
              className="relative bg-black rounded-2xl overflow-hidden mx-auto"
              style={{ width: W, height: H, maxWidth: '100%' }}
            >
              <video
                ref={videoRef}
                width={W}
                height={H}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              <div className="absolute top-4 left-4 bg-black/60 rounded-xl px-4 py-2 backdrop-blur">
                <div className="text-3xl font-bold leading-none">
                  {state?.reps ?? 0}
                  <span className="text-base text-gray-400"> / {repsTarget}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">reps</div>
              </div>

              {exercise.target_sets > 1 && (
                <div className="absolute top-4 right-4 bg-black/60 rounded-xl px-4 py-2 backdrop-blur text-right">
                  <div className="text-xl font-bold leading-none">
                    {(state?.sets ?? 0) + 1}
                    <span className="text-sm text-gray-400"> / {exercise.target_sets}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">set</div>
                </div>
              )}

              {lastFeedback && (
                <div
                  className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur ${
                    lastFeedback.type === 'success'
                      ? 'bg-emerald-600/80'
                      : lastFeedback.type === 'warning'
                      ? 'bg-amber-600/80'
                      : 'bg-gray-700/80'
                  }`}
                >
                  {lastFeedback.message}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={finish}
                className="px-6 py-2.5 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 font-medium"
              >
                Finish
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
            <div className="flex items-center justify-center gap-8 my-6">
              <div>
                <div className="text-4xl font-bold">{trackerRef.current?.getTotalReps() ?? 0}</div>
                <div className="text-sm text-gray-400">reps done</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-emerald-400">
                  {trackerRef.current?.getScore() ?? 0}%
                </div>
                <div className="text-sm text-gray-400">of target</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setState(null);
                  setPhase('intro');
                }}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-lg font-medium"
              >
                <RefreshCw className="w-4 h-4" /> Do Again
              </button>
              <button
                onClick={() => navigate('/patient')}
                className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 font-medium"
              >
                Back to Exercises
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
