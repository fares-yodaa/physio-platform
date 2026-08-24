from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, default="")
    body_part = Column(String, default="full_body")

    # Visual-first model: the doctor simply chooses which joints matter.
    selected_joints = Column(JSON, default=list)          # ["left_shoulder", "left_elbow", ...]
    custom_joints = Column(JSON, default=list)             # [{ "id": "c1", "name": "Custom 1", "x": 0.5, "y": 0.4 }]
    joint_positions = Column(JSON, default=dict)           # { "left_elbow": { "x": 0.52, "y": 0.41 } } doctor corrections
    custom_angles = Column(JSON, default=list)             # [{ "id", "name", "pointA", "pointB", "pointC" }]
    primary_angle = Column(String, default="")             # which angle drives rep counting
    reference_angles = Column(JSON, default=dict)          # snapshot at "correct" pose: { "left_elbow": 90 }
    rep_thresholds = Column(JSON, nullable=True)            # legacy single-joint range
    rep_targets = Column(JSON, default=list)                # [{ "angleId", "resting", "acceptable", "optimal" }]

    target_reps = Column(Integer, default=10)
    target_sets = Column(Integer, default=1)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sessions = relationship("Session", back_populates="exercise", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    patient_name = Column(String, nullable=False)
    reps_completed = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    exercise = relationship("Exercise", back_populates="sessions")
