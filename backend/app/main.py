from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import engine, Base
from app.db.migrate import migrate_sqlite
from app.api import exercises, sessions, progress

Base.metadata.create_all(bind=engine)
migrate_sqlite(engine)

app = FastAPI(title="Physio Platform API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exercises.router)
app.include_router(sessions.router)
app.include_router(progress.router)


@app.get("/")
def root():
    return {"message": "Physio Platform API is running"}
