from pathlib import Path
import os
import shutil

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# backend/physio.db ships with the deploy (current exercises + sessions)
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_BUNDLED_SQLITE = _BACKEND_DIR / "physio.db"

# Vercel’s function filesystem is read-only except /tmp
if os.getenv("VERCEL"):
    _DEFAULT_SQLITE = Path("/tmp/physio.db")
    if not _DEFAULT_SQLITE.exists() and _BUNDLED_SQLITE.exists():
        shutil.copy(_BUNDLED_SQLITE, _DEFAULT_SQLITE)
else:
    _DEFAULT_SQLITE = _BUNDLED_SQLITE

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_SQLITE}")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
