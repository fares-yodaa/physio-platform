from pydantic import BaseModel
from typing import Any
from datetime import datetime


# --- Exercise Schemas ---

class ExerciseCreate(BaseModel):
    name: str
    description: str = ""
    body_part: str = "full_body"
    selected_joints: list[str] = []
    custom_joints: list[dict[str, Any]] = []
    joint_positions: dict[str, Any] = {}
    custom_angles: list[dict[str, Any]] = []
    primary_angle: str = ""
    reference_angles: dict[str, Any] = {}
    rep_thresholds: dict[str, Any] | None = None
    rep_targets: list[dict[str, Any]] = []
    target_reps: int = 10
    target_sets: int = 1


class ExerciseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    body_part: str | None = None
    selected_joints: list[str] | None = None
    custom_joints: list[dict[str, Any]] | None = None
    joint_positions: dict[str, Any] | None = None
    custom_angles: list[dict[str, Any]] | None = None
    primary_angle: str | None = None
    reference_angles: dict[str, Any] | None = None
    rep_thresholds: dict[str, Any] | None = None
    rep_targets: list[dict[str, Any]] | None = None
    target_reps: int | None = None
    target_sets: int | None = None


class ExerciseResponse(BaseModel):
    id: int
    name: str
    description: str
    body_part: str
    selected_joints: list[str]
    custom_joints: list[dict[str, Any]]
    joint_positions: dict[str, Any]
    custom_angles: list[dict[str, Any]]
    primary_angle: str
    reference_angles: dict[str, Any]
    rep_thresholds: dict[str, Any] | None = None
    rep_targets: list[dict[str, Any]] = []
    target_reps: int
    target_sets: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Session Schemas ---

class SessionCreate(BaseModel):
    exercise_id: int
    patient_name: str
    reps_completed: int = 0
    score: float = 0.0
    started_at: datetime | None = None
    completed_at: datetime | None = None


class SessionResponse(BaseModel):
    id: int
    exercise_id: int
    patient_name: str
    reps_completed: int
    score: float
    started_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# --- Progress Schema ---

class ProgressResponse(BaseModel):
    patient_name: str
    total_sessions: int
    exercises_practiced: int
    avg_score: float
    total_reps: int
    score_trend: list[dict[str, Any]]
