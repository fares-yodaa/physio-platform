import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Upload, Video, Play, Pause, Check } from 'lucide-react';
import { api } from '../lib/api';
import { initMediaPipe, detectPose, destroyMediaPipe } from '../lib/mediapipe';
import { computeEditorAngles, computeAngleArcs, computeTargetAngles } from '../lib/editorAngles';
import JointEditor from '../components/skeleton/JointEditor';
import JointAnglePanel, { applyUseCurrent } from '../components/skeleton/JointAnglePanel';
import SkeletonPreview from '../components/skeleton/SkeletonPreview';
import {
  BODY_PARTS,
  LANDMARK_INDEX,
  JOINT_ANGLE_DEFINITIONS,
  landmarksForRepTargets,
} from '../lib/constants';
import { thresholdsValid, clampAcceptable } from '../lib/repThresholds';
import type {
  Landmark,
  CustomJoint,
  CustomAngle,
  JointPosition,
  Exercise,
  RepThresholdsDraft,
} from '../types';

const W = 640;
const H = 480;

type Step = 'details' | 'edit';

export default function ExerciseBuilder() {
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  const editId =
    idParam && idParam !== 'new' && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const isEdit = editId !== null;

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bodyPart, setBodyPart] = useState('shoulder');
  const [targetReps, setTargetReps] = useState(10);

  const [selectedJoints, setSelectedJoints] = useState<string[]>([]);
  const [customJoints, setCustomJoints] = useState<CustomJoint[]>([]);
  const [customAngles, setCustomAngles] = useState<CustomAngle[]>([]);
  const [jointPositions, setJointPositions] = useState<Record<string, JointPosition>>({});
  const [repTargets, setRepTargets] = useState<RepThresholdsDraft[]>([]);
  const [editLandmarks, setEditLandmarks] = useState<Landmark[] | null>(null);
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);
  /** Draft thresholds for angles being edited but not yet counting reps. */
  const [angleDrafts, setAngleDrafts] = useState<Record<string, RepThresholdsDraft>>({});

  const [source, setSource] = useState<'camera' | 'upload' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const detectingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEdit || editId === null) return;
    api.exercises
      .get(editId)
      .then((ex: Exercise) => {
        setName(ex.name);
        setDescription(ex.description);
        setBodyPart(ex.body_part);
        setTargetReps(ex.target_reps);
        setSelectedJoints(ex.selected_joints || []);
        setCustomJoints(ex.custom_joints || []);
        setCustomAngles(ex.custom_angles || []);
        setJointPositions(ex.joint_positions || {});
        const targets = ex.rep_targets && ex.rep_targets.length > 0 ? ex.rep_targets : [];
        setRepTargets(
          targets.map((t) => ({
            angleId: t.angleId,
            resting: t.resting,
            acceptable: t.acceptable,
            optimal: t.optimal,
          }))
        );
      })
      .catch((e: Error & { status?: number }) => {
        if (e.status === 404) {
          setError('That exercise no longer exists. Save will create a new one.');
        }
      });
  }, [editId, isEdit]);

  const countingAngleIds = useMemo(() => repTargets.map((t) => t.angleId), [repTargets]);

  /** Landmarks needed to draw/count angles — not shown as user-activated joints. */
  const jointsForMeasurement = useMemo(
    () => landmarksForRepTargets(repTargets, selectedJoints),
    [selectedJoints, repTargets]
  );

  const angleAtLandmark = useCallback((landmarkName: string): string | null => {
    for (const [id, def] of Object.entries(JOINT_ANGLE_DEFINITIONS)) {
      if (def[1] === landmarkName) return id;
    }
    return null;
  }, []);

  const selectedAngleId = useMemo(() => {
    if (!selectedJoint) return null;
    return angleAtLandmark(selectedJoint);
  }, [selectedJoint, angleAtLandmark]);

  const liveAngles = useMemo(() => {
    const ids = new Set(repTargets.map((t) => t.angleId));
    if (selectedAngleId) ids.add(selectedAngleId);
    const countingIds = Array.from(ids);
    if (countingIds.length > 0) {
      return computeTargetAngles(editLandmarks, countingIds, jointPositions, customJoints, customAngles);
    }
    return computeEditorAngles(editLandmarks, jointPositions, customJoints, selectedJoints, customAngles);
  }, [editLandmarks, jointPositions, customJoints, selectedJoints, customAngles, repTargets, selectedAngleId]);

  const angleArcs = useMemo(
    () =>
      computeAngleArcs(
        editLandmarks,
        jointPositions,
        customJoints,
        jointsForMeasurement,
        customAngles,
        W,
        H,
        liveAngles
      ),
    [editLandmarks, jointPositions, customJoints, jointsForMeasurement, customAngles, liveAngles]
  );

  const thresholdsReady = repTargets.length > 0 && repTargets.every((t) => thresholdsValid(t));

  const panelDraft = useMemo((): RepThresholdsDraft | null => {
    if (!selectedAngleId) return null;
    const counting = repTargets.find((t) => t.angleId === selectedAngleId);
    if (counting) return counting;
    return (
      angleDrafts[selectedAngleId] ?? {
        angleId: selectedAngleId,
        resting: null,
        acceptable: null,
        optimal: null,
      }
    );
  }, [selectedAngleId, repTargets, angleDrafts]);

  const isSelectedCounting = selectedAngleId != null && repTargets.some((t) => t.angleId === selectedAngleId);

  const handleJointTap = useCallback((name: string) => {
    setSelectedJoint(name);
    setSelectedJoints((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const updateDraft = useCallback(
    (angleId: string, updater: (d: RepThresholdsDraft) => RepThresholdsDraft) => {
      const inCounting = repTargets.some((t) => t.angleId === angleId);
      if (inCounting) {
        setRepTargets((prev) => prev.map((t) => (t.angleId === angleId ? updater(t) : t)));
      } else {
        setAngleDrafts((prev) => {
          const base =
            prev[angleId] ??
            repTargets.find((t) => t.angleId === angleId) ?? {
              angleId,
              resting: null,
              acceptable: null,
              optimal: null,
            };
          return { ...prev, [angleId]: updater(base) };
        });
      }
    },
    [repTargets]
  );

  const setTargetField = useCallback(
    (field: 'resting' | 'acceptable' | 'optimal', value: number | null) => {
      if (!selectedAngleId) return;
      updateDraft(selectedAngleId, (t) => {
        const next = { ...t, [field]: value };
        if (
          field !== 'acceptable' &&
          next.resting != null &&
          next.optimal != null &&
          next.acceptable != null
        ) {
          next.acceptable = clampAcceptable(next.acceptable, next.resting, next.optimal);
        }
        return next;
      });
    },
    [selectedAngleId, updateDraft]
  );

  const useCurrentField = useCallback(
    (field: 'resting' | 'acceptable' | 'optimal') => {
      if (!selectedAngleId) return;
      const live = liveAngles[selectedAngleId];
      if (live === undefined) return;
      updateDraft(selectedAngleId, (t) => {
        const next = applyUseCurrent(t, field, live);
        if (next.resting != null && next.optimal != null && next.acceptable != null) {
          next.acceptable = clampAcceptable(next.acceptable, next.resting, next.optimal);
        }
        return next;
      });
    },
    [selectedAngleId, liveAngles, updateDraft]
  );

  const setCountingForAngle = useCallback(
    (angleId: string, on: boolean) => {
      if (on) {
        setRepTargets((prev) => {
          if (prev.some((t) => t.angleId === angleId)) return prev;
          const draft = angleDrafts[angleId] ?? {
            angleId,
            resting: null,
            acceptable: null,
            optimal: null,
          };
          return [...prev, draft];
        });
        setAngleDrafts((prev) => {
          const next = { ...prev };
          delete next[angleId];
          return next;
        });
      } else {
        const existing = repTargets.find((t) => t.angleId === angleId);
        setRepTargets((prev) => prev.filter((t) => t.angleId !== angleId));
        if (existing) {
          setAngleDrafts((d) => ({ ...d, [angleId]: existing }));
        }
      }
    },
    [angleDrafts, repTargets]
  );

  const deactivateJoint = useCallback(() => {
    if (!selectedJoint) return;
    const angleId = angleAtLandmark(selectedJoint);
    setSelectedJoints((prev) => prev.filter((j) => j !== selectedJoint));
    if (angleId) {
      setRepTargets((prev) => prev.filter((t) => t.angleId !== angleId));
      setAngleDrafts((prev) => {
        const next = { ...prev };
        delete next[angleId];
        return next;
      });
    }
    setSelectedJoint(null);
  }, [selectedJoint, angleAtLandmark]);

  const savedRepTargets = useMemo(
    () =>
      repTargets
        .filter((t) => thresholdsValid(t))
        .map((t) => ({
          angleId: t.angleId,
          resting: t.resting as number,
          acceptable: t.acceptable as number,
          optimal: t.optimal as number,
        })),
    [repTargets]
  );

  useEffect(() => {
    if (!editLandmarks) return;
    setCustomJoints((prev) => {
      let changed = false;
      const next = prev.map((cj) => {
        if (!cj.linkedTo) return cj;
        const idx = LANDMARK_INDEX[cj.linkedTo as keyof typeof LANDMARK_INDEX];
        if (idx === undefined) return cj;
        const lm = editLandmarks[idx];
        if (!lm || lm.visibility < 0.3) return cj;
        if (Math.abs(cj.x - lm.x) < 0.0001 && Math.abs(cj.y - lm.y) < 0.0001) return cj;
        changed = true;
        return { ...cj, x: lm.x, y: lm.y };
      });
      return changed ? next : prev;
    });
  }, [editLandmarks]);

  const releaseMedia = useCallback(() => {
    detectingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
      v.removeAttribute('src');
      v.load();
    }
  }, []);

  useEffect(() => () => {
    releaseMedia();
    destroyMediaPipe();
  }, [releaseMedia]);

  const runLoop = useCallback(() => {
    const loop = () => {
      if (!detectingRef.current) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        const lm = detectPose(v, performance.now());
        if (lm) setEditLandmarks(lm);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      await initMediaPipe();
      releaseMedia();
      setSource('camera');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: W, height: H, facingMode: 'user' },
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      v.loop = false;
      await v.play();
      setIsPlaying(true);
      detectingRef.current = true;
      runLoop();
    } catch (e: any) {
      setCameraError(e.message || 'Could not access camera');
    }
  }, [releaseMedia, runLoop]);

  const startUpload = useCallback(
    async (file: File) => {
      setCameraError(null);
      try {
        await initMediaPipe();
        releaseMedia();
        setSource('upload');
        const url = URL.createObjectURL(file);
        urlRef.current = url;
        const v = videoRef.current!;
        v.src = url;
        v.loop = true;
        v.muted = true;
        await v.play();
        setIsPlaying(true);
        detectingRef.current = true;
        runLoop();
      } catch (e: any) {
        setCameraError(e.message || 'Could not load video');
      }
    },
    [releaseMedia, runLoop]
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  const moveJoint = useCallback((joint: string, x: number, y: number) => {
    setJointPositions((prev) => ({ ...prev, [joint]: { x, y } }));
  }, []);

  const moveCustom = useCallback((cid: string, x: number, y: number) => {
    setCustomJoints((prev) =>
      prev.map((c) => (c.id === cid ? { ...c, x, y, linkedTo: undefined } : c))
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter an exercise name');
      setStep('details');
      return;
    }
    setSaving(true);
    setError(null);
    const targetsPayload = repTargets
      .filter((t) => thresholdsValid(t))
      .map((t) => ({
        angleId: t.angleId,
        resting: t.resting as number,
        acceptable: t.acceptable as number,
        optimal: t.optimal as number,
      }));
    const referenceAngles: Record<string, number> = {};
    for (const t of targetsPayload) referenceAngles[t.angleId] = t.optimal;
    const payload = {
      name: name.trim(),
      description: description.trim(),
      body_part: bodyPart,
      selected_joints: landmarksForRepTargets(targetsPayload, selectedJoints),
      custom_joints: customJoints,
      custom_angles: customAngles,
      joint_positions: jointPositions,
      primary_angle: targetsPayload[0]?.angleId ?? '',
      reference_angles: referenceAngles,
      rep_thresholds: targetsPayload[0] ?? null,
      rep_targets: targetsPayload,
      target_reps: targetReps,
      target_sets: 1,
    };
    try {
      if (isEdit && editId !== null) {
        try {
          await api.exercises.update(editId, payload);
        } catch (e: unknown) {
          const err = e as Error & { status?: number };
          // Stale edit link (e.g. after DB reset) — create instead of failing
          if (err.status === 404) {
            await api.exercises.create(payload);
          } else {
            throw err;
          }
        }
      } else {
        await api.exercises.create(payload);
      }
      releaseMedia();
      navigate('/doctor');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  };

  const goToEdit = () => {
    if (!name.trim()) {
      setError('Please enter an exercise name');
      return;
    }
    setError(null);
    setStep('edit');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button
            onClick={() => {
              releaseMedia();
              navigate('/doctor');
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit exercise' : 'New exercise'}
          </h1>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <StepDot active={step === 'details'} done={step !== 'details'} label="Setup" />
            <div className="w-6 h-px bg-gray-300" />
            <StepDot active={step === 'edit'} done={false} label="Record movement" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {step === 'details' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
            <p className="text-sm text-gray-500 mb-5">
              Name the exercise and pick the body area. You will record the correct movement next.
            </p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exercise name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shoulder raise"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions for patient <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  className="input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Raise your arm to the side and hold briefly"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body area</label>
                <div className="flex flex-wrap gap-2">
                  {BODY_PARTS.filter((b) => b.id !== 'full_body').map((bp) => (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => {
                        setBodyPart(bp.id);
                        setSelectedJoints([...bp.joints]);
                      }}
                      className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                        bodyPart === bp.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {bp.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reps per session</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="input w-32"
                  value={targetReps}
                  onChange={(e) => setTargetReps(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <button
                type="button"
                onClick={goToEdit}
                className="w-full bg-indigo-600 text-white px-5 py-3 rounded-xl hover:bg-indigo-700 font-semibold"
              >
                Next — record the movement
              </button>
            </div>
          </div>
        )}

        {step === 'edit' && (
          <div className="max-w-xl mx-auto space-y-4">
              {!source && (
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    <Camera className="w-5 h-5" /> Record with camera
                  </button>
                  <label className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:border-indigo-400 cursor-pointer">
                    <Upload className="w-5 h-5" /> Upload video
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && startUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              )}

              <div
                className="relative bg-gray-900 rounded-xl overflow-hidden mx-auto"
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
                <JointEditor
                  landmarks={editLandmarks}
                  width={W}
                  height={H}
                  selectedJoints={selectedJoints}
                  customJoints={customJoints}
                  jointPositions={jointPositions}
                  angles={liveAngles}
                  angleArcs={angleArcs}
                  countingAngleIds={countingAngleIds}
                  repTargets={savedRepTargets}
                  selectedJoint={selectedJoint}
                  onJointTap={handleJointTap}
                  onMoveJoint={moveJoint}
                  onMoveCustom={moveCustom}
                />
                {source && !selectedJoint && (
                  <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
                    <p className="text-center text-xs text-white/90 bg-black/50 rounded-lg px-3 py-2 backdrop-blur">
                      Tap a joint on the body to configure angles
                    </p>
                  </div>
                )}
                {source && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-sm font-medium backdrop-blur"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                )}
                {!source && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center px-6">
                      <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Show the correct movement using camera or upload</p>
                    </div>
                  </div>
                )}

              </div>

              {cameraError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {cameraError}
                </div>
              )}

            {selectedJoint && (
              <JointAnglePanel
                jointName={selectedJoint}
                angleId={selectedAngleId}
                liveAngle={selectedAngleId ? liveAngles[selectedAngleId] : undefined}
                draft={panelDraft}
                isCounting={isSelectedCounting}
                onClose={() => setSelectedJoint(null)}
                onSetField={setTargetField}
                onUseCurrent={useCurrentField}
                onToggleCounting={(on) => selectedAngleId && setCountingForAngle(selectedAngleId, on)}
                onDeactivateJoint={deactivateJoint}
              />
            )}

            <SkeletonPreview
              activeJoints={selectedJoints}
              countingAngleIds={countingAngleIds}
              selectedJoint={selectedJoint}
              liveAngles={liveAngles}
              repTargets={repTargets}
              onJointTap={handleJointTap}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !thresholdsReady || selectedJoints.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3.5 rounded-2xl hover:bg-indigo-700 font-semibold disabled:opacity-40 shadow-sm"
            >
              <Check className="w-5 h-5" />
              {saving ? 'Saving…' : 'Save exercise'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 ${
        active ? 'text-indigo-600 font-medium' : done ? 'text-emerald-600' : 'text-gray-400'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          active ? 'bg-indigo-600' : done ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      />
      {label}
    </span>
  );
}
