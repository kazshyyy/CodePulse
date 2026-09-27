import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { type Review } from '../api'

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)

  useEffect(() => {
    if (id) api.get<Review>(`/reviews/${id}`).then(r => setReview(r.data))
  }, [id])

  if (!review) return <div className="loading-center"><div className="spinner" /> Loading review…</div>

  return (
    <div>
      <div className="review-strip">
        <div>
          <div className="review-strip-title">{review.title}</div>
          <div className="review-strip-meta">
            <span>{review.author}</span>
            <span>·</span>
            <code style={{ fontSize: 11 }}>{review.branch}</code>
            <span>·</span>
            <span className={`badge ${review.status}`}>{review.status}</span>
          </div>
        </div>
        <div className="review-actions">
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/orchestrator`)}>Orchestrator</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/findings`)}>Findings</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/diff`)}>Diff View</button>
        </div>
      </div>

      <div className="page">
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {Object.entries(review.severity_counts || {}).map(([sev, count]) => (
            <div key={sev} className="stat-card">
              <div className="stat-value" style={{ color: sevColor(sev) }}>{count}</div>
              <div className="stat-label">{sev}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-title">Review Details</div>
            <table style={{ width: '100%' }}>
              <tbody>
                {[
                  ['Status', <span className={`badge ${review.status}`}>{review.status}</span>],
                  ['Branch', <code style={{ fontSize: 11 }}>{review.branch}</code>],
                  ['Author', review.author],
                  ['Duration', `${review.duration_seconds.toFixed(1)}s`],
                  ['Tests Generated', review.tests_generated],
                  ['Tests Passed', review.tests_passed],
                  ['Tests Failed', review.tests_failed],
                  ['Changed Files', (review.changed_files || []).join(', ')],
                ].map(([k, v]) => (
                  <tr key={String(k)}>
                    <td style={{ color: 'var(--muted)', width: 140, fontSize: 12 }}>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="section-title">Description</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{review.description}</p>
            {review.requirements_text && (
              <>
                <div className="section-title" style={{ marginTop: 16 }}>Requirements</div>
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{review.requirements_text}</div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" onClick={() => navigate(`/review/${id}/orchestrator`)}>View Orchestrator Log →</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/findings`)}>View Findings ({Object.values(review.severity_counts || {}).reduce((a, b) => a + b, 0)}) →</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/diff`)}>View Code Diff →</button>
        </div>
      </div>
    </div>
  )
}

function sevColor(s: string) {
  return { CRITICAL: '#ff7b72', HIGH: '#f0883e', MEDIUM: '#d29922', LOW: '#3fb950', INFO: '#58a6ff' }[s] ?? '#8b949e'
}
