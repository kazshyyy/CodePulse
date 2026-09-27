import { useState } from 'react'
import api, { type Project } from '../api'

const DEMO_REQUIREMENTS = `All user-controlled database input MUST use parameterized queries.
Shell commands MUST NOT be constructed from user input.
File access MUST be restricted to the designated uploads/ directory.
Credentials MUST NOT be hard-coded; use environment variables or a secrets manager.
Deserialization of untrusted data MUST use safe formats (JSON, not pickle).
All destructive operations MUST verify authorization before execution.
All mutations MUST be logged to the audit trail.`

const DEMO_GUIDELINES = `Functions must have docstrings.
No bare except clauses.
All external calls must be wrapped in try/except with specific exception types.
Test coverage must be >= 85%.
No print() statements in production code; use the logging module.
No secrets in code.`

const DEMO_BEFORE = `import sqlite3
import subprocess
import os


def get_user(username):
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    row = cursor.fetchone()
    conn.close()
    return row


def run_report(report_name):
    os.system(f"python reports/{report_name}.py")


def read_file(filename):
    path = f"uploads/{filename}"
    with open(path, "r") as f:
        return f.read()


DB_PASSWORD = "SuperSecret123!"


def deserialize_payload(data):
    import pickle
    return pickle.loads(data)


def delete_user(user_id):
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM users WHERE id = {user_id}")
    conn.commit()
    conn.close()`

const DEMO_AFTER = `import sqlite3
import subprocess
import os


def get_user(username):
    """Fetch user record from the database."""
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE username = ?"
    cursor.execute(query, (username,))
    row = cursor.fetchone()
    conn.close()
    return row


def run_report(report_name):
    """Run a named report script."""
    allowed = ["summary", "monthly", "weekly"]
    if report_name not in allowed:
        raise ValueError(f"Unknown report: {report_name}")
    subprocess.run(["python", f"reports/{report_name}.py"], check=True)


def read_file(filename):
    """Read a file from the uploads directory."""
    safe_name = os.path.basename(filename)
    path = os.path.realpath(os.path.join("uploads", safe_name))
    if not path.startswith(os.path.realpath("uploads")):
        raise ValueError("Path traversal detected")
    with open(path, "r") as f:
        return f.read()


DB_PASSWORD = "SuperSecret123!"   # TODO: move to env var


def deserialize_payload(data):
    import json
    return json.loads(data)


def delete_user(user_id, requesting_user_id):
    """Delete a user with authorization check."""
    if not is_admin(requesting_user_id):
        raise PermissionError("Admin access required")
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()


def is_admin(user_id):
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row and row[0]`

interface Props {
  projects: Project[]
  onCreated: (id: number) => void
}

export default function NewReview({ projects, onCreated }: Props) {
  const [form, setForm] = useState({
    project_id: projects[0]?.id ?? 1,
    title: '',
    description: '',
    branch: 'feature/',
    author: 'developer',
    requirements_text: '',
    coding_guidelines: '',
  })
  const [beforeCode, setBeforeCode] = useState('')
  const [afterCode, setAfterCode] = useState('')
  const [fileName, setFileName] = useState('app.py')
  const [loading, setLoading] = useState(false)

  function loadDemo() {
    setForm({
      project_id: projects[0]?.id ?? 1,
      title: 'Fix security vulnerabilities in core API layer',
      description: 'This PR addresses multiple critical security issues: SQL injection, OS command injection, path traversal, hard-coded credentials, unsafe deserialization, and missing authorization checks.',
      branch: 'feature/security-fixes',
      author: 'alice@acme.com',
      requirements_text: DEMO_REQUIREMENTS,
      coding_guidelines: DEMO_GUIDELINES,
    })
    setBeforeCode(DEMO_BEFORE)
    setAfterCode(DEMO_AFTER)
    setFileName('app.py')
  }

  async function submit() {
    setLoading(true)
    try {
      const r = await api.post('/reviews', { ...form, changed_files: [fileName] })
      const reviewId = r.data.id
      if (beforeCode || afterCode) {
        await api.post(`/reviews/${reviewId}/diffs`, {
          file_path: fileName,
          before_content: beforeCode,
          after_content: afterCode,
        })
      }
      await api.post(`/reviews/${reviewId}/start`)
      onCreated(reviewId)
    } finally {
      setLoading(false)
    }
  }

  function set(k: string, v: string | number) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">New Review</div>
          <div className="page-subtitle">Configure and launch an AI-powered code review</div>
        </div>
        <button className="btn-secondary" onClick={loadDemo}>⚡ Load Demo Data</button>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Review Context</div>

            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-input" value={form.project_id} onChange={e => set('project_id', parseInt(e.target.value))}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Pull Request Title</label>
              <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Fix SQL injection in user lookup" />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does this change do?" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Branch</label>
                <input className="form-input" value={form.branch} onChange={e => set('branch', e.target.value)} placeholder="feature/..." />
              </div>
              <div className="form-group">
                <label className="form-label">Author</label>
                <input className="form-input" value={form.author} onChange={e => set('author', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Requirements & Guidelines</div>
            <div className="form-group">
              <label className="form-label">Project Requirements</label>
              <textarea className="form-input" rows={5} value={form.requirements_text} onChange={e => set('requirements_text', e.target.value)} placeholder="One requirement per line..." />
            </div>
            <div className="form-group">
              <label className="form-label">Coding Guidelines</label>
              <textarea className="form-input" rows={4} value={form.coding_guidelines} onChange={e => set('coding_guidelines', e.target.value)} placeholder="One guideline per line..." />
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Code Change</div>
            <div className="form-group">
              <label className="form-label">Changed File</label>
              <input className="form-input" value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. src/app.py" />
            </div>
            <div className="form-group">
              <label className="form-label">Before (original code)</label>
              <textarea className="form-input" rows={10} value={beforeCode} onChange={e => setBeforeCode(e.target.value)} placeholder="Paste the original file content..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>
            <div className="form-group">
              <label className="form-label">After (proposed change)</label>
              <textarea className="form-input" rows={10} value={afterCode} onChange={e => setAfterCode(e.target.value)} placeholder="Paste the modified file content..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15 }}
            disabled={loading || !form.title}
            onClick={submit}
          >
            {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Starting Review…</> : '🚀 Start Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
