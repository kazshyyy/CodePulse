import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { type DashboardData, type Project } from '../api'

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ff7b72', HIGH: '#f0883e', MEDIUM: '#d29922', LOW: '#3fb950', INFO: '#58a6ff'
}

function WorkflowBar({ status }: { status: string }) {
  const steps = ['Context', 'Analysis', 'Findings', 'Fixes', 'Tests', 'Validation', 'Report']
  const doneMap: Record<string, number> = { completed: 7, running: 4, pending: 0, failed: 2 }
  const done = doneMap[status] ?? 0
  return (
    <div className="workflow-bar">
      {steps.map((s, i) => (
        <div key={s} className={`workflow-step ${i < done ? 'done' : i === done ? 'active' : 'pending'}`}>
          {i < done ? '✓' : i === done ? <span className="pulse" style={{ marginRight: 4 }} /> : '○'} {s}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ activeProject }: { activeProject: Project | null }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = () => api.get<DashboardData>('/dashboard').then(r => setData(r.data))
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  if (!data) return <div className="loading-center"><div className="spinner" /> Loading dashboard…</div>

  const latest = data.recent_reviews[0]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {activeProject ? `${activeProject.name} · ${activeProject.language}` : 'CodePulse Platform'}
          </div>
        </div>
        <button className="btn-primary" onClick={() => navigate('/new-review')}>+ New Review</button>
      </div>

      {/* Metric cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{data.total_reviews}</div>
          <div className="stat-label">Total Reviews</div>
          <div className="stat-sub">{data.completed_reviews} completed · {data.running_reviews} running</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--critical)' }}>
            {data.severity_breakdown['CRITICAL'] ?? 0}
          </div>
          <div className="stat-label">Critical Findings</div>
          <div className="stat-sub">{data.total_findings} total findings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--low)' }}>{data.tests_passed}</div>
          <div className="stat-label">Tests Passed</div>
          <div className="stat-sub">{data.total_tests} generated · {data.tests_failed} failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.total_projects}</div>
          <div className="stat-label">Projects</div>
          <div className="stat-sub">Active workspace</div>
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Severity Breakdown</div>
        <div className="sev-bar" style={{ gap: 20 }}>
          {SEV_ORDER.map(s => (
            <div key={s} className="sev-pill" style={{ flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: SEV_COLOR[s] }}>
                {data.severity_breakdown[s] ?? 0}
              </div>
              <span className={`badge ${s}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest review + workflow */}
      {latest && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 4 }}>Latest Review</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{latest.title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                {latest.author} · {latest.branch} · {latest.duration_seconds.toFixed(1)}s
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${latest.status}`}>{latest.status}</span>
              <button className="btn-secondary" onClick={() => navigate(`/review/${latest.id}`)}>View →</button>
            </div>
          </div>
          <WorkflowBar status={latest.status} />
          <div className="sev-bar">
            {SEV_ORDER.map(s => (latest.severity_counts[s] ?? 0) > 0 && (
              <div key={s} className="sev-pill">
                <div className={`sev-dot ${s}`} />
                <span style={{ color: SEV_COLOR[s], fontWeight: 700 }}>{latest.severity_counts[s]}</span>
                <span style={{ color: 'var(--muted)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews table */}
      <div className="card">
        <div className="section-title">Recent Reviews</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Branch</th>
                <th>Author</th>
                <th>Status</th>
                <th>Findings</th>
                <th>Duration</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_reviews.map(r => (
                <tr key={r.id} className="clickable-row" onClick={() => navigate(`/review/${r.id}`)}>
                  <td style={{ color: 'var(--accent)', maxWidth: 260 }}>{r.title}</td>
                  <td><code style={{ fontSize: 11 }}>{r.branch}</code></td>
                  <td style={{ color: 'var(--muted)' }}>{r.author}</td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td>
                    <div className="sev-bar">
                      {SEV_ORDER.filter(s => (r.severity_counts[s] ?? 0) > 0).map(s => (
                        <span key={s} style={{ color: SEV_COLOR[s], fontWeight: 600, fontSize: 12 }}>
                          {r.severity_counts[s]}
                          <span style={{ color: 'var(--muted)', fontWeight: 400 }}> {s[0]}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{r.duration_seconds.toFixed(1)}s</td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
