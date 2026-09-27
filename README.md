# ⚡ CodePulse — IBM Bob 2.0 Hackathon

> **"From code change to validated review."**

CodePulse is an intelligent developer workflow platform that turns manual code review into a fully automated, multi-agent analysis pipeline.

---

## 🚀 Quick Start (Demo)

```bash
# 1. Install backend dependencies (one time)
cd backend
pip install fastapi uvicorn sqlalchemy pydantic python-multipart aiofiles

# 2. Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Open in browser
#    http://localhost:8000
```

Or double-click **`start.bat`** on Windows.

---

## 🎯 Demo Flow

1. **Open** `http://localhost:8000`
2. **Dashboard** loads with the pre-seeded PaymentService API review
3. Click **"⚡ Run Demo Review"** to launch a fresh live analysis
4. Watch the **Orchestrator** tab — 4 agents run in parallel
5. Browse **Findings** — 12 structured security/quality findings with evidence
6. View the **Code Diff** — annotated with inline finding markers
7. See **Generated Tests** — 6 regression tests with pass/fail output

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│  Dashboard · Orchestrator · Findings · Diff · Tests     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────┐
│               FastAPI Backend (Python)                   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Review Orchestrator                    │   │
│  │  Context Load → Parallel Agents → Aggregate      │   │
│  │                                                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────┐  │   │
│  │  │Security │ │Code Qual.│ │Testing │ │Reqmts │  │   │
│  │  │ Agent   │ │  Agent   │ │ Agent  │ │ Agent │  │   │
│  │  └─────────┘ └──────────┘ └────────┘ └───────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  SQLite Database · Static File Serving                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 IBM Bob 2.0 Features Demonstrated

| Feature | How Used |
|---------|----------|
| **Agent Mode** | Each analysis engine (Security, Code, Testing, Requirements) is an independent agent |
| **Parallel Tasks** | All 4 agents run concurrently via `ThreadPoolExecutor` |
| **Subagents** | Security Agent, Code Quality Agent, Testing Agent, Requirements Agent |
| **Document Understanding** | Requirements extracted from README, architecture docs, security guidelines |
| **Iterative Implementation** | Orchestrator deduplicates, correlates, and normalizes findings across agents |
| **Test Generation** | Testing Agent generates executable regression tests for high-severity findings |
| **Validation** | Generated tests are run and results reported |
| **Workflow Orchestration** | Central orchestrator coordinates all steps with real-time status logging |

---

## 📁 Project Structure

```
CodePulse/
├── backend/
│   ├── main.py              # FastAPI app + static file serving
│   ├── models.py            # SQLAlchemy ORM models
│   ├── database.py          # SQLite setup
│   ├── orchestrator.py      # Multi-agent review orchestrator
│   ├── analysis_engines.py  # Security/Code/Testing/Requirements agents
│   ├── seed_data.py         # Demo dataset (12 findings, 6 tests, diffs)
│   └── static/              # Built React frontend
├── frontend/
│   └── src/App.tsx          # Complete React SPA (single file)
├── start.bat                # Windows quick-start
└── README.md
```

---

## 🔍 Sample Findings (from demo)

| ID | Severity | Title |
|----|----------|-------|
| SEC-001 | 🔴 CRITICAL | Hard-coded credential in source file |
| SEC-005 | 🔴 CRITICAL | Unsafe deserialization using Python pickle |
| SEC-002 | 🟠 HIGH | SQL injection via f-string query construction |
| SEC-003 | 🟠 HIGH | Unsafe OS command execution |
| SEC-004 | 🟠 HIGH | Path traversal in file read operation |
| SEC-006 | 🟠 HIGH | Missing authorization on destructive operation |
| CODE-001 | 🟡 MEDIUM | Missing audit logging on user deletion |
| TEST-001 | 🟠 HIGH | Insufficient test coverage for security-critical functions |
| REQ-001 | 🟡 MEDIUM | No logging module usage detected |

Each finding includes: evidence, related requirement, potential impact, suggested fix, and test recommendation.
