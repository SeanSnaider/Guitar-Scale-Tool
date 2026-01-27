from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db, engine, Base
from models import ScaleProgress
from sqlalchemy.orm import Session

app = FastAPI(
    title="Guitar Scale Progress API",
    description="API for tracking guitar scale learning progress",
    version="1.0.0"
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProgressCreate(BaseModel):
    user_id: str
    root_note: str
    scale_type: str
    position: Optional[int] = 0
    learned: bool = True
    notes: Optional[str] = None

class ProgressResponse(BaseModel):
    id: int
    user_id: str
    root_note: str
    scale_type: str
    position: int
    learned: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProgressSummary(BaseModel):
    total_learned: int
    scales_by_root: dict
    scales_by_type: dict
    recent_activity: list

Base.metadata.create_all(bind=engine)

@app.get("/")
def read_root():
    return {
        "message": "Guitar Scale Progress API",
        "docs": "Visit /docs for interactive API documentation"
    }

@app.get("/progress/{user_id}", response_model=list[ProgressResponse])
def get_user_progress(user_id: str, db: Session = Depends(get_db)):
    progress = db.query(ScaleProgress).filter(
        ScaleProgress.user_id == user_id
    ).all()
    return progress

@app.post("/progress", response_model=ProgressResponse)
def create_or_update_progress(progress: ProgressCreate, db: Session = Depends(get_db)):
    existing = db.query(ScaleProgress).filter(
        ScaleProgress.user_id == progress.user_id,
        ScaleProgress.root_note == progress.root_note,
        ScaleProgress.scale_type == progress.scale_type,
        ScaleProgress.position == progress.position
    ).first()

    if existing:
        existing.learned = progress.learned
        existing.notes = progress.notes
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_progress = ScaleProgress(
            user_id=progress.user_id,
            root_note=progress.root_note,
            scale_type=progress.scale_type,
            position=progress.position,
            learned=progress.learned,
            notes=progress.notes
        )
        db.add(db_progress)
        db.commit()
        db.refresh(db_progress)
        return db_progress

@app.delete("/progress/{progress_id}")
def delete_progress(progress_id: int, db: Session = Depends(get_db)):
    progress = db.query(ScaleProgress).filter(
        ScaleProgress.id == progress_id
    ).first()

    if not progress:
        raise HTTPException(status_code=404, detail="Progress record not found")

    db.delete(progress)
    db.commit()
    return {"message": "Progress record deleted", "id": progress_id}

@app.get("/progress/{user_id}/summary", response_model=ProgressSummary)
def get_progress_summary(user_id: str, db: Session = Depends(get_db)):
    all_progress = db.query(ScaleProgress).filter(
        ScaleProgress.user_id == user_id,
        ScaleProgress.learned == True
    ).all()

    scales_by_root = {}
    for p in all_progress:
        scales_by_root[p.root_note] = scales_by_root.get(p.root_note, 0) + 1

    scales_by_type = {}
    for p in all_progress:
        scales_by_type[p.scale_type] = scales_by_type.get(p.scale_type, 0) + 1

    recent = db.query(ScaleProgress).filter(
        ScaleProgress.user_id == user_id
    ).order_by(ScaleProgress.updated_at.desc()).limit(10).all()

    recent_activity = [
        {
            "root_note": p.root_note,
            "scale_type": p.scale_type,
            "position": p.position,
            "learned": p.learned,
            "updated_at": p.updated_at.isoformat()
        }
        for p in recent
    ]

    return ProgressSummary(
        total_learned=len(all_progress),
        scales_by_root=scales_by_root,
        scales_by_type=scales_by_type,
        recent_activity=recent_activity
    )

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
