import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { type FileDiff, type Finding, type Review } from '../api'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ff7b72', HIGH: '#f0883e', MEDIUM: '#d29922', LOW: '#3fb950', INFO: '#58a6ff'
}

function buildUnifiedDiff(before: string, after: string): { type: 'added' | 'removed' | 'context', content: string, lineNo: number }[] {
  const bLines = before.split('\n')
  const aLines = after.split('\n')
  const result: { type: 'added' | 'removed' | 'context', content: string, lineNo: number }[] = []
  let ln = 1
  const maxLen = Math.max(bLines.length, aLines.length)
  for (let i = 0; i < maxLen; i++) {
    const bLine = bLines[i]
    const aLine = aLines[i]
    if (bLine === aLine) {
      result.push({ type: 'context', content: bLine ?? '', lineNo: ln++ })
    } else {
      if (bLine !== undefined) result.push({ type: 'removed', content: bLine, lineNo: ln })
      if (aLine !== undefined) { result.push({ type: 'added', content: aLine, lineNo: ln }); ln++ }
    }
  }
  return result
}

export default function DiffView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)
  const [diffs, setDiffs] = useState<FileDiff[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [highlightLine, setHighlightLine] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<Review>(`/reviews/${id}`).then(r => setReview(r.data))
    api.get<FileDiff[]>(`/reviews/${id}/diffs`).then(r => {
      setDiffs(r.data)
      if (r.data.length > 0) setSelectedFile(r.data[0].file_path)
    })
    api.get<Finding[]>(`/reviews/${id}/findings`).then(r => setFindings(r.data))
  }, [id])

  const diff = diffs.find(d => d.file_path === selectedFile)
  const fileFindigns = findings.filter(f => f.file_path === selectedFile)

  // Build line-to-findings map
  const lineFindings: Record<number, Finding[]> = {}
  for (const f of fileFindigns) {
    if (f.line_start) {
      for (let l = f.line_start; l <= (f.line_end ?? f.line_start); l++) {
        lineFindings[l] = [...(lineFindings[l] ?? []), f]
      }
    }
  }

  return (
    <div>
      <div className="review-strip">
        <div>
          <div className="review-strip-title">Code Diff</div>
          <div className="review-strip-meta">
            <span>{review?.title}</span>
            <span className={`badge ${review?.status}`}>{review?.status}</span>
          </div>
        </div>
        <div className="review-actions">
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}/findings`)}>Findings →</button>
          <button className="btn-secondary" onClick={() => navigate(`/review/${id}`)}>Review Details</button>
        </div>
      </div>

      <div className="page">
        <div className="grid-2" style={{ gap: 20 }}>
          {/* Left: file list + findings attached */}
          <div>
            <div className="section-title">Changed Files</div>
            {diffs.map(d => (
              <div
                key={d.file_path}
                className={`tree-item ${selectedFile === d.file_path ? 'selected' : ''}`}
                onClick={() => setSelectedFile(d.file_path)}
                style={{ marginBottom: 4, padding: '8px 12px' }}
              >
                <span>📄</span>
                <span style={{ flex: 1 }}>{d.file_path}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {findings.filter(f => f.file_path === d.file_path).length} findings
                </span>
              </div>
            ))}

            {fileFindigns.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="section-title">Findings in this file</div>
                {fileFindigns.map(f => (
                  <div
                    key={f.id}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
                      background: 'var(--surface)', marginBottom: 6, cursor: 'pointer' }}
                    onClick={() => setHighlightLine(f.line_start)}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span className={`badge ${f.severity}`}>{f.severity}</span>
                      <code style={{ fontSize: 10, color: 'var(--muted)' }}>L{f.line_start}</code>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{f.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: diff */}
          <div style={{ gridColumn: '1 / -1' }}>
            {diff ? (
              <>
                {/* If we have structured hunks, render them */}
                {diff.diff_hunks && diff.diff_hunks.length > 0 ? (
                  diff.diff_hunks.map((hunk, hi) => (
                    <div key={hi} style={{ marginBottom: 16 }}>
                      <div className="diff-file-header">
                        📄 {diff.file_path}
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{hunk.hunk_header}</span>
                      </div>
                      <table className="diff-table">
                        <tbody>
                          <tr className="hunk-header"><td colSpan={3}>{hunk.hunk_header}</td></tr>
                          {hunk.lines.map((line, li) => {
                            const findingsHere = lineFindings[li + 1]
                            return (
                              <>
                                <tr key={li} className={`diff-line-${line.type}`}
                                  style={highlightLine && li + 1 === highlightLine ? { outline: '2px solid var(--accent)' } : {}}>
                                  <td className="diff-ln">{li + 1}</td>
                                  <td className="diff-content">
                                    {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                                    {line.content}
                                  </td>
                                  <td style={{ width: 30 }}>
                                    {findingsHere && (
                                      <span title={findingsHere.map(f => f.title).join('; ')}
                                        style={{ color: SEV_COLOR[findingsHere[0].severity], fontSize: 14, cursor: 'pointer' }}>⚠</span>
                                    )}
                                  </td>
                                </tr>
                                {findingsHere && highlightLine === li + 1 && findingsHere.map(f => (
                                  <tr key={`finding-${f.id}`}>
                                    <td />
                                    <td colSpan={2} style={{ padding: '6px 14px', background: '#1f6feb11', borderLeft: `3px solid ${SEV_COLOR[f.severity]}` }}>
                                      <span className={`badge ${f.severity}`} style={{ marginRight: 6 }}>{f.severity}</span>
                                      <strong style={{ fontSize: 12 }}>{f.title}</strong>
                                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{f.agent_source}</span>
                                    </td>
                                  </tr>
                                ))}
                              </>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))
                ) : (
                  /* Fallback: compute diff from before/after */
                  <div>
                    <div className="diff-file-header">📄 {diff.file_path}</div>
                    <table className="diff-table">
                      <tbody>
                        {buildUnifiedDiff(diff.before_content, diff.after_content).map((line, li) => {
                          const findingsHere = lineFindings[line.lineNo]
                          return (
                            <tr key={li} className={`diff-line-${line.type}`}
                              style={highlightLine === line.lineNo ? { outline: '2px solid var(--accent)' } : {}}>
                              <td className="diff-ln">{line.lineNo}</td>
                              <td className="diff-content">
                                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                                {line.content}
                              </td>
                              <td style={{ width: 30 }}>
                                {findingsHere && (
                                  <span title={findingsHere.map(f => f.title).join('; ')}
                                    style={{ color: SEV_COLOR[findingsHere[0].severity], fontSize: 14, cursor: 'pointer' }}>⚠</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <div className="empty-title">No diff available</div>
                <div>Select a changed file to view the diff.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
