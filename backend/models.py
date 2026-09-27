from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    repository_url = Column(String, default="")
    language = Column(String, default="Python")
    created_at = Column(DateTime, default=datetime.utcnow)
    reviews = relationship("Review", back_populates="project")
    documents = relationship("Document", back_populates="project")
    repo_files = relationship("RepoFile", back_populates="project")


class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    branch = Column(String, default="main")
    author = Column(String, default="developer")
    status = Column(String, default="pending")  # pending, running, completed, failed
    orchestrator_log = Column(JSON, default=list)
    requirements_text = Column(Text, default="")
    coding_guidelines = Column(Text, default="")
    changed_files = Column(JSON, default=list)
    severity_counts = Column(JSON, default=dict)
    tests_generated = Column(Integer, default=0)
    tests_passed = Column(Integer, default=0)
    tests_failed = Column(Integer, default=0)
    duration_seconds = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    project = relationship("Project", back_populates="reviews")
    findings = relationship("Finding", back_populates="review")
    diffs = relationship("FileDiff", back_populates="review")


class Finding(Base):
    __tablename__ = "findings"
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"))
    finding_id = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # CRITICAL HIGH MEDIUM LOW INFO
    category = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    evidence = Column(Text, default="")
    file_path = Column(String, default="")
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)
    affected_component = Column(String, default="")
    related_requirement = Column(Text, default="")
    potential_impact = Column(Text, default="")
    suggested_fix = Column(Text, default="")
    test_recommendation = Column(Text, default="")
    validation_status = Column(String, default="open")
    agent_source = Column(String, default="")
    review = relationship("Review", back_populates="findings")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=False)
    doc_type = Column(String, default="general")  # readme, architecture, security, requirements, coding_standards
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship("Project", back_populates="documents")


class RepoFile(Base):
    __tablename__ = "repo_files"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    path = Column(String, nullable=False)
    file_type = Column(String, default="source")  # source, test, config, doc
    content = Column(Text, default="")
    language = Column(String, default="")
    project = relationship("Project", back_populates="repo_files")


class FileDiff(Base):
    __tablename__ = "file_diffs"
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"))
    file_path = Column(String, nullable=False)
    before_content = Column(Text, default="")
    after_content = Column(Text, default="")
    diff_hunks = Column(JSON, default=list)
    review = relationship("Review", back_populates="diffs")


class GeneratedTest(Base):
    __tablename__ = "generated_tests"
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"))
    test_name = Column(String, nullable=False)
    test_code = Column(Text, default="")
    finding_id = Column(String, default="")
    status = Column(String, default="generated")  # generated, passed, failed
    output = Column(Text, default="")
