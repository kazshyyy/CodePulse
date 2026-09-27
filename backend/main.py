"""
CodePulse Backend – FastAPI Application
"""
import os
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import engine, get_db, Base
from models import Project, Review, Finding, Document, RepoFile, FileDiff, GeneratedTest
from seed_data import seed_demo_data
from orchestrator import run_review_orchestrator

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="CodePulse API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.on_event("startup")
def startup():
    db = next(get_db())
    seed_demo_data(db)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    repository_url: str
    language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    repository_url: str = ""
    language: str = "Python"


class ReviewOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str
    branch: str
    author: str
    status: str
    orchestrator_log: list
    requirements_text: str
    coding_guidelines: str
    changed_files: list
    severity_counts: dict
    tests_generated: int
    tests_passed: int
    tests_failed: int
    duration_seconds: float
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ReviewCreate(BaseModel):
    project_id: int
    title: str
    description: str = ""
    branch: str = "main"
    author: str = "developer"
    requirements_text: str = ""
    coding_guidelines: str = ""
    changed_files: list = []


class FindingOut(BaseModel):
    id: int
    review_id: int
    finding_id: str
    severity: str
    category: str
    title: str
    description: str
    evidence: str
    file_path: str
    line_start: Optional[int]
    line_end: Optional[int]
    affected_component: str
    related_requirement: str
    potential_impact: str
    suggested_fix: str
    test_recommendation: str
    validation_status: str
    agent_source: str

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    project_id: int
    name: str
    doc_type: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentCreate(BaseModel):
    name: str
    doc_type: str = "general"
    content: str = ""


class RepoFileOut(BaseModel):
    id: int
    project_id: int
    path: str
    file_type: str
    language: str
    content: str

    model_config = {"from_attributes": True}


class FileDiffOut(BaseModel):
    id: int
    review_id: int
    file_path: str
    before_content: str
    after_content: str
    diff_hunks: list

    model_config = {"from_attributes": True}


class GeneratedTestOut(BaseModel):
    id: int
    review_id: int
    test_name: str
    test_code: str
    finding_id: str
    status: str
    output: str

    model_config = {"from_attributes": True}


class DiffCreate(BaseModel):
    file_path: str
    before_content: str = ""
    after_content: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Projects
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@app.post("/api/projects", response_model=ProjectOut)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    p = Project(**body.dict())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter_by(id=project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return p


# ─────────────────────────────────────────────────────────────────────────────
# Reviews
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/reviews", response_model=List[ReviewOut])
def list_reviews(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Review)
    if project_id:
        q = q.filter_by(project_id=project_id)
    return q.order_by(Review.created_at.desc()).all()


@app.get("/api/reviews/{review_id}", response_model=ReviewOut)
def get_review(review_id: int, db: Session = Depends(get_db)):
    r = db.query(Review).filter_by(id=review_id).first()
    if not r:
        raise HTTPException(404, "Review not found")
    return r


@app.post("/api/reviews", response_model=ReviewOut)
def create_review(body: ReviewCreate, db: Session = Depends(get_db)):
    p = db.query(Project).filter_by(id=body.project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    r = Review(**body.dict())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@app.post("/api/reviews/{review_id}/diffs")
def add_diff(review_id: int, body: DiffCreate, db: Session = Depends(get_db)):
    r = db.query(Review).filter_by(id=review_id).first()
    if not r:
        raise HTTPException(404, "Review not found")
    # Remove existing diff for same file
    db.query(FileDiff).filter_by(review_id=review_id, file_path=body.file_path).delete()
    diff = FileDiff(review_id=review_id, **body.dict())
    db.add(diff)
    # Update changed_files list
    files = list(r.changed_files or [])
    if body.file_path not in files:
        files.append(body.file_path)
    r.changed_files = files
    db.commit()
    return {"ok": True}


@app.post("/api/reviews/{review_id}/start")
def start_review(review_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    r = db.query(Review).filter_by(id=review_id).first()
    if not r:
        raise HTTPException(404, "Review not found")
    if r.status == "running":
        return {"ok": True, "message": "Already running"}
    r.status = "pending"
    db.commit()
    background_tasks.add_task(_run_review_bg, review_id)
    return {"ok": True, "message": "Review started"}


def _run_review_bg(review_id: int):
    db = next(get_db())
    try:
        run_review_orchestrator(review_id, db)
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Findings
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/reviews/{review_id}/findings", response_model=List[FindingOut])
def list_findings(
    review_id: int,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Finding).filter_by(review_id=review_id)
    if severity:
        q = q.filter_by(severity=severity.upper())
    if category:
        q = q.filter_by(category=category)
    return q.order_by(Finding.id).all()


@app.patch("/api/findings/{finding_id}")
def update_finding(finding_id: int, body: dict, db: Session = Depends(get_db)):
    f = db.query(Finding).filter_by(id=finding_id).first()
    if not f:
        raise HTTPException(404, "Finding not found")
    allowed = {"validation_status"}
    for k, v in body.items():
        if k in allowed:
            setattr(f, k, v)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Documents
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/documents", response_model=List[DocumentOut])
def list_documents(project_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter_by(project_id=project_id).all()


@app.post("/api/projects/{project_id}/documents", response_model=DocumentOut)
def create_document(project_id: int, body: DocumentCreate, db: Session = Depends(get_db)):
    p = db.query(Project).filter_by(id=project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    d = Document(project_id=project_id, **body.dict())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


# ─────────────────────────────────────────────────────────────────────────────
# Repository files
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/files", response_model=List[RepoFileOut])
def list_repo_files(project_id: int, db: Session = Depends(get_db)):
    return db.query(RepoFile).filter_by(project_id=project_id).order_by(RepoFile.path).all()


@app.get("/api/projects/{project_id}/files/{file_id}", response_model=RepoFileOut)
def get_repo_file(project_id: int, file_id: int, db: Session = Depends(get_db)):
    f = db.query(RepoFile).filter_by(id=file_id, project_id=project_id).first()
    if not f:
        raise HTTPException(404, "File not found")
    return f


# ─────────────────────────────────────────────────────────────────────────────
# Diffs
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/reviews/{review_id}/diffs", response_model=List[FileDiffOut])
def list_diffs(review_id: int, db: Session = Depends(get_db)):
    return db.query(FileDiff).filter_by(review_id=review_id).all()


@app.get("/api/reviews/{review_id}/diffs/{file_path:path}", response_model=FileDiffOut)
def get_diff(review_id: int, file_path: str, db: Session = Depends(get_db)):
    d = db.query(FileDiff).filter_by(review_id=review_id, file_path=file_path).first()
    if not d:
        raise HTTPException(404, "Diff not found")
    return d


# ─────────────────────────────────────────────────────────────────────────────
# Generated Tests
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/reviews/{review_id}/tests", response_model=List[GeneratedTestOut])
def list_tests(review_id: int, db: Session = Depends(get_db)):
    return db.query(GeneratedTest).filter_by(review_id=review_id).all()


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard stats
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total_reviews = db.query(Review).count()
    completed = db.query(Review).filter_by(status="completed").count()
    running = db.query(Review).filter_by(status="running").count()
    total_findings = db.query(Finding).count()
    critical = db.query(Finding).filter_by(severity="CRITICAL").count()
    high = db.query(Finding).filter_by(severity="HIGH").count()
    medium = db.query(Finding).filter_by(severity="MEDIUM").count()
    low = db.query(Finding).filter_by(severity="LOW").count()
    total_tests = db.query(GeneratedTest).count()
    passed_tests = db.query(GeneratedTest).filter_by(status="passed").count()
    failed_tests = db.query(GeneratedTest).filter_by(status="failed").count()
    recent_reviews = db.query(Review).order_by(Review.created_at.desc()).limit(5).all()
    projects = db.query(Project).count()

    return {
        "total_reviews": total_reviews,
        "completed_reviews": completed,
        "running_reviews": running,
        "total_findings": total_findings,
        "severity_breakdown": {
            "CRITICAL": critical,
            "HIGH": high,
            "MEDIUM": medium,
            "LOW": low,
        },
        "total_tests": total_tests,
        "tests_passed": passed_tests,
        "tests_failed": failed_tests,
        "total_projects": projects,
        "recent_reviews": [
            {
                "id": r.id,
                "title": r.title,
                "status": r.status,
                "author": r.author,
                "branch": r.branch,
                "severity_counts": r.severity_counts or {},
                "created_at": r.created_at.isoformat(),
                "duration_seconds": r.duration_seconds,
            }
            for r in recent_reviews
        ],
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "CodePulse API"}


# ─────────────────────────────────────────────────────────────────────────────
# Static frontend — serve React SPA (must be last)
# ─────────────────────────────────────────────────────────────────────────────

_assets_dir = os.path.join(STATIC_DIR, "assets")
if os.path.isdir(_assets_dir):
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")


@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str = ""):
    index = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    return {"detail": "Frontend not built. Run: cd frontend && npm run build"}
