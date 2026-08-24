from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Session as SessionModel
from app.schemas.schemas import ProgressResponse

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/{patient_name}", response_model=ProgressResponse)
def get_progress(patient_name: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.patient_name == patient_name)
        .order_by(SessionModel.started_at.asc())
        .all()
    )

    if not sessions:
        raise HTTPException(status_code=404, detail="No sessions found for this patient")

    exercise_ids = set(s.exercise_id for s in sessions)
    scores = [s.score for s in sessions]
    total_reps = sum(s.reps_completed for s in sessions)

    score_trend = [
        {
            "session_id": s.id,
            "date": s.started_at.isoformat() if s.started_at else None,
            "score": s.score,
            "reps": s.reps_completed,
            "exercise_id": s.exercise_id,
        }
        for s in sessions
    ]

    return ProgressResponse(
        patient_name=patient_name,
        total_sessions=len(sessions),
        exercises_practiced=len(exercise_ids),
        avg_score=sum(scores) / len(scores) if scores else 0.0,
        total_reps=total_reps,
        score_trend=score_trend,
    )
