# Physio Platform

A visual, joint-tracking tool for physiotherapy — think **"Figma for human body joints."**
A doctor captures a video, then directly clicks, drags, adds, and removes circular joint points
to define which body points matter for an exercise. Patients then perform the exercise while the
system tracks only those joints and counts reps with simple feedback.

The focus is **visual-first, not rule-first**: direct manipulation over configuration.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS. Canvas-based **Joint Editor** for direct
  manipulation, MediaPipe (`@mediapipe/tasks-vision`) for client-side pose detection.
- **Backend**: Python + FastAPI + SQLite — basic storage of exercises and sessions only.

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to the backend at `localhost:8000`.

## Deploy (free)

- **Frontend**: Vercel (`frontend/`, set `VITE_API_URL` to the backend URL)
- **Backend**: Render free web service (`backend/`)

Existing exercises and sessions live in `backend/physio.db` and are included in the backend deploy. On Render’s free plan the disk resets when the service sleeps, so that original data comes back; new rows added after deploy may not last.

## How it works

### Doctor — define an exercise visually
1. Enter a name, pick a body area, set target reps.
2. Record or upload a video of the **correct** movement.
3. **Pause** at the right moment — the app automatically saves that pose and the main angle.
4. Tap any tracking dot to turn it off, or drag if automatic tracking looks wrong.
5. Save. Advanced options (extra markers, custom measurements) live under **Adjust tracking**.

### Patient — perform the exercise
- Tracks only the doctor's selected points.
- Simple feedback like “Raise a bit higher” compared to the doctor's paused pose.
- Automatic rep counting.

## What this demo intentionally keeps simple

Removed in favor of a clean, visual experience: complex movement phases, direction logic, fatigue
tracking, compensation detection, and advanced scoring. Kept: joint selection, a simple angle
readout, basic rep counting, and simple feedback.
