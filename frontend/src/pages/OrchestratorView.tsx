import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { type Review, type OrchestratorStep } from '../api'

const STEP_ICONS: Record<string, string> = {
  init: '🔧',
  context_repo: '📂',
  context_change: '🔍',
  context_docs: '📄',
  parallel_start: '🔀',
  agent_security: '🛡️',
  agent_code: '🧹',
  agent_testing: '🧪',
  agent_requirements: '📋',
  aggregation: '🔗',
  dedup: '🧹',
  correlation: '🔗',
  severity: '⚖️',
  tests: '🧪',
  validation: '✅',
  report: '📊',
  error: '❌',
}

const PARALLEL_STEPS = new Set(['agent_security', 'agent_code', 'agent_testing', 'agent_requirements'])

function AgentCard({ step }: { step: string; msg?: string }) {
  const names: Record<string, string> = {
    agent_security: 'Security Agent',
    agent_code: 'Code Quality Agent',
    agent_testing: 'Testing Agent',
    agent_requirements: 'Requirements Agent',
  }
  return (
    <div className="agent-badge">
      <span>✓</span> {names[step] || step}
    </div>
  )
}

export default function OrchestratorView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)
  useEffect(() => {
    const load = () => {
      if (!id) return
      api.get<Review>(`/reviews/${id}`).then(r => {
        setReview(r.data)
      })
    }
    load()
    const t = setInterval(load, 1500)
    return () => clearInterval(t)
  }, [id])

  if (!review) return <div className="loading-center"><div className="spinner" /> Loading…</div>

  const log = review.orchestrator_log || []
  // Group parallel agent steps together for display
  const parallelAgents = log.filter(s => PARALLEL_STEPS.has(s.step))
  // Build display list
  type DisplayStep = { type: 'step'; step: OrchestratorStep } | { type: 'parallel'; agents: OrchestratorStep[] }
  const display: DisplayStep[] = []
  let parallelInserted = false
  for (const s of log) {
    if (PARALLEL_STEPS.has(s.step)) continue
    if (s.step === 'parallel_start') {
      display.push({ type: 'step', step: s })
      if (!parallelInserted && parallelAgents.length > 0) {
        display.push({ type: 'parallel', agents: parallelAgents })
        parallelInserted = true
      }
    } else {
      display.push({ type: 'step', step: s })
    }
  }
  if (!parallelInserted && parallelAgents.length > 0) {
    display.push({ type: 'parallel', agents: parallelAgents })
  }

  const workflowSteps = ['Context', 'Analysis', 'Findings', 'Fixes', 'Tests', 'Validation', 'Report']
  const doneMap: Record<string, number> = { completed: 7, running: log.length > 8 ? 5 : 3, pending: 0, failed: 2 }
  const doneCnt = doneMap[review.status] ?? 0

  return (
    <div>
      <div className="review-strip">
        <div>
          <div className="review-strip-title">Review Orchestrator</div>
          <div className="review-strip-meta">
            <span>{review.title}</span>
            <span className={`badge ${review.status}`}>{review.status}</span>
          </div>
        </div>
        <div className="review-actions">
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/findings`)}>View Findings →</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}`)}>Review Details</button>
        </div>
      </div>

      <div className="page">
        {/* Workflow pipeline */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Pipeline Status</div>
          <div className="workflow-bar">
            {workflowSteps.map((s, i) => (
              <div key={s} className={`workflow-step ${i < doneCnt ? 'done' : i === doneCnt && review.status === 'running' ? 'active' : i < doneCnt ? 'done' : 'pending'}`}>
                {i < doneCnt ? '✓' : i === doneCnt && review.status === 'running'
                  ? <span className="pulse" style={{ marginRight: 4 }} />
                  : '○'} {s}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {review.status === 'completed' && (
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-value">{Object.values(review.severity_counts || {}).reduce((a, b) => a + b, 0)}</div>
              <div className="stat-label">Total Findings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--critical)' }}>{review.severity_counts['CRITICAL'] ?? 0}</div>
              <div className="stat-label">Critical</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--low)' }}>{review.tests_passed}</div>
              <div className="stat-label">Tests Passed</div>
              <div className="stat-sub">of {review.tests_generated} generated</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{review.duration_seconds.toFixed(1)}s</div>
              <div className="stat-label">Duration</div>
            </div>
          </div>
        )}

        {/* Agent log */}
        <div className="section-title">Orchestrator Log</div>
        <div className="orch-log">
          {display.map((item, idx) => {
            if (item.type === 'parallel') {
              return (
                <div key="parallel-agents" className="orch-step parallel">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="orch-icon">🔀</span>
                    <span className="orch-msg" style={{ fontWeight: 600 }}>Parallel Analysis — 4 agents running concurrently</span>
                  </div>
                  <div className="orch-agents">
                    {item.agents.map(a => <AgentCard key={a.step} step={a.step} msg={a.message} />)}
                    {review.status === 'running' && item.agents.length < 4 && (
                      <div className="agent-badge" style={{ opacity: .5 }}>
                        <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Analyzing…
                      </div>
                    )}
                  </div>
                  {item.agents.map(a => (
                    <div key={a.step} style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 28 }}>
                      ✓ {a.message} <span style={{ color: 'var(--border)' }}>({a.timestamp})</span>
                    </div>
                  ))}
                </div>
              )
            }
            const s = item.step
            const isLast = idx === display.length - 1 && review.status === 'running'
            return (
              <div key={s.step + idx} className="orch-step">
                <span className="orch-icon">{STEP_ICONS[s.step] ?? '●'}</span>
                <div style={{ flex: 1 }}>
                  <div className="orch-msg">{s.message}</div>
                  <div className="orch-time">{s.timestamp}</div>
                </div>
                {isLast && <span className="spinner" />}
              </div>
            )
          })}

          {review.status === 'running' && (
            <div className="orch-step" style={{ opacity: .5 }}>
              <span className="spinner" />
              <div className="orch-msg" style={{ color: 'var(--muted)' }}>Analysis in progress…</div>
            </div>
          )}
        </div>

        {review.status === 'completed' && (
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={() => navigate(`/review/${id}/findings`)}>
              View {Object.values(review.severity_counts || {}).reduce((a, b) => a + b, 0)} Findings →
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/review/${id}/diff`)}>View Code Diff →</button>
          </div>
        )}
      </div>
    </div>
  )
}
