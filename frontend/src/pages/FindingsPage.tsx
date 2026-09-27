import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { type Finding, type Review, type GeneratedTest } from '../api'

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
const CATEGORIES = ['Security', 'Correctness', 'Reliability', 'Performance', 'Maintainability', 'Testing', 'Requirements', 'Configuration']
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ff7b72', HIGH: '#f0883e', MEDIUM: '#d29922', LOW: '#3fb950', INFO: '#58a6ff'
}

function FindingDetail({ f, onClose }: { f: Finding; onClose: () => void }) {
  return (
    <div className="finding-expanded">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span className={`badge ${f.severity}`} style={{ marginRight: 8 }}>{f.severity}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.finding_id} · {f.agent_source}</span>
        </div>
        <button className="btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={onClose}>✕</button>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{f.title}</div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.7 }}>{f.description}</p>

      {f.evidence && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)', marginBottom: 5 }}>Evidence</div>
          <pre>{f.evidence}</pre>
        </div>
      )}

      <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
        {f.related_requirement && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)', marginBottom: 4 }}>Related Requirement</div>
            <div className="req-tag">{f.related_requirement}</div>
          </div>
        )}
        {f.potential_impact && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)', marginBottom: 4 }}>Potential Impact</div>
            <p style={{ fontSize: 12, color: 'var(--text)' }}>{f.potential_impact}</p>
          </div>
        )}
      </div>

      {f.suggested_fix && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)', marginBottom: 4 }}>Suggested Fix</div>
          <p style={{ fontSize: 13, color: 'var(--low)', lineHeight: 1.7 }}>{f.suggested_fix}</p>
        </div>
      )}

      {f.test_recommendation && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)', marginBottom: 4 }}>Test Recommendation</div>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>{f.test_recommendation}</p>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {f.file_path && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>
          📄 {f.file_path}{f.line_start ? `:${f.line_start}` : ''}
        </span>}
        {f.affected_component && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>
          ⚙ {f.affected_component}
        </span>}
        <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>
          Status: {f.validation_status}
        </span>
      </div>
    </div>
  )
}

export default function FindingsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [tests, setTests] = useState<GeneratedTest[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [sevFilter, setSevFilter] = useState<string>('ALL')
  const [catFilter, setCatFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [tab, setTab] = useState<'findings' | 'tests'>('findings')
  const [expandedTest, setExpandedTest] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<Review>(`/reviews/${id}`).then(r => setReview(r.data))
    api.get<Finding[]>(`/reviews/${id}/findings`).then(r => setFindings(r.data))
    api.get<GeneratedTest[]>(`/reviews/${id}/tests`).then(r => setTests(r.data))
  }, [id])

  const filtered = findings.filter(f =>
    (sevFilter === 'ALL' || f.severity === sevFilter) &&
    (catFilter === 'ALL' || f.category === catFilter) &&
    (statusFilter === 'ALL' || f.validation_status === statusFilter)
  )

  const counts = SEV_ORDER.reduce((acc, s) => ({ ...acc, [s]: findings.filter(f => f.severity === s).length }), {} as Record<string, number>)

  return (
    <div>
      <div className="review-strip">
        <div>
          <div className="review-strip-title">Findings & Tests</div>
          <div className="review-strip-meta">
            <span>{review?.title}</span>
            <span className={`badge ${review?.status}`}>{review?.status}</span>
          </div>
        </div>
        <div className="review-actions">
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/diff`)}>Code Diff →</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}`)}>Review Details</button>
        </div>
      </div>

      <div className="page">
        {/* Severity counts */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {SEV_ORDER.map(s => (
            <div
              key={s}
              className={`stat-card ${sevFilter === s ? 'active' : ''}`}
              style={{ cursor: 'pointer', padding: '10px 16px', minWidth: 90,
                border: sevFilter === s ? `1px solid ${SEV_COLOR[s]}55` : undefined,
                background: sevFilter === s ? `${SEV_COLOR[s]}11` : undefined }}
              onClick={() => setSevFilter(sevFilter === s ? 'ALL' : s)}
            >
              <div className="stat-value" style={{ fontSize: 22, color: SEV_COLOR[s] }}>{counts[s] ?? 0}</div>
              <div className="stat-label">{s}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${tab === 'findings' ? 'active' : ''}`} onClick={() => setTab('findings')}>
            Findings ({findings.length})
          </button>
          <button className={`tab ${tab === 'tests' ? 'active' : ''}`} onClick={() => setTab('tests')}>
            Generated Tests ({tests.length})
          </button>
        </div>

        {tab === 'findings' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="ALL">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="open">Open</option>
                <option value="fixed">Fixed</option>
              </select>
              <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
                {filtered.length} of {findings.length} findings
              </span>
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>ID</th>
                      <th>Category</th>
                      <th>Title</th>
                      <th>File</th>
                      <th>Agent</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(f => (
                      <>
                        <tr key={f.id} className="finding-row" onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                          <td><span className={`badge ${f.severity}`}>{f.severity}</span></td>
                          <td><code style={{ fontSize: 11 }}>{f.finding_id}</code></td>
                          <td style={{ color: 'var(--muted)' }}>{f.category}</td>
                          <td style={{ fontWeight: 500, maxWidth: 360 }}>{f.title}</td>
                          <td style={{ color: 'var(--muted)' }}>
                            {f.file_path && <code style={{ fontSize: 11 }}>{f.file_path}{f.line_start ? `:${f.line_start}` : ''}</code>}
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: 11 }}>{f.agent_source}</td>
                          <td>
                            <span style={{ fontSize: 11, color: f.validation_status === 'fixed' ? 'var(--low)' : 'var(--muted)' }}>
                              {f.validation_status === 'fixed' ? '✓ Fixed' : '● Open'}
                            </span>
                          </td>
                        </tr>
                        {expanded === f.id && (
                          <tr key={`exp-${f.id}`}>
                            <td colSpan={7} style={{ padding: '4px 8px', background: 'transparent' }}>
                              <FindingDetail f={f} onClose={() => setExpanded(null)} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'tests' && (
          <div>
            {tests.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🧪</div>
                <div className="empty-title">No tests generated yet</div>
                <div>Tests are generated after the review completes.</div>
              </div>
            )}
            {tests.map(t => (
              <div key={t.id} className="test-item">
                <div className="test-header" onClick={() => setExpandedTest(expandedTest === t.id ? null : t.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15 }}>{t.status === 'passed' ? '✅' : t.status === 'failed' ? '❌' : '📝'}</span>
                    <span className="test-name">{t.test_name}</span>
                    <code style={{ fontSize: 10, color: 'var(--muted)' }}>{t.finding_id}</code>
                  </div>
                  <span className={`badge ${t.status === 'passed' ? 'completed' : t.status === 'failed' ? 'failed' : 'pending'}`}>
                    {t.status}
                  </span>
                </div>
                {expandedTest === t.id && (
                  <div className="test-body">
                    {t.output && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Output</div>
                        <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, padding: '8px 12px', fontSize: 11, color: 'var(--low)' }}>{t.output}</pre>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>Test Code</div>
                    <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, padding: '10px 14px', fontSize: 12, overflowX: 'auto' }}>{t.test_code}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
