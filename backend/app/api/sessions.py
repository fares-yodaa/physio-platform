from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Session as SessionModel, Exercise
from app.schemas.schemas import SessionCreate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    exercise = db.query(Exercise).filter(Exercise.id == data.exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    session = SessionModel(**data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionResponse])
def list_sessions(patient: str | None = None, exercise_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(SessionModel)
    if patient:
        query = query.filter(SessionModel.patient_name == patient)
    if exercise_id:
        query = query.filter(SessionModel.exercise_id == exercise_id)
    return query.order_by(SessionModel.started_at.desc()).all()


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
