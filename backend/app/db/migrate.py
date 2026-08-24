"""Lightweight SQLite migrations — adds missing columns without wiping data."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def migrate_sqlite(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "exercises" not in inspector.get_table_names():
        return

    existing = {col["name"] for col in inspector.get_columns("exercises")}
    additions: list[tuple[str, str]] = [
        ("custom_angles", "TEXT DEFAULT '[]'"),
        ("primary_angle", "TEXT DEFAULT ''"),
        ("reference_angles", "TEXT DEFAULT '{}'"),
        ("rep_thresholds", "TEXT DEFAULT NULL"),
        ("rep_targets", "TEXT DEFAULT '[]'"),
    ]

    with engine.begin() as conn:
        for name, ddl in additions:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE exercises ADD COLUMN {name} {ddl}"))
