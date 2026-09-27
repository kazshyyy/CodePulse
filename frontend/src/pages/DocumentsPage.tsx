import { useEffect, useState } from 'react'
import api, { type Project, type Document } from '../api'

const DOC_TYPES: Record<string, { label: string; color: string }> = {
  readme:        { label: 'README',          color: '#58a6ff' },
  architecture:  { label: 'Architecture',    color: '#d29922' },
  security:      { label: 'Security',        color: '#ff7b72' },
  requirements:  { label: 'Requirements',    color: '#3fb950' },
  coding_standards: { label: 'Standards',   color: '#f0883e' },
  general:       { label: 'General',         color: '#8b949e' },
}

function extractRequirements(content: string): string[] {
  const reqs: string[] = []
  const lines = content.split('\n')
  for (const line of lines) {
    const stripped = line.replace(/^[-*•]\s*/, '').trim()
    if (stripped.match(/\bMUST\b|\bSHOULD\b|\brequired\b|\bprohibited\b/i) && stripped.length > 20) {
      reqs.push(stripped)
    }
  }
  return reqs
}

export default function DocumentsPage({ activeProject }: { activeProject: Project | null }) {
  const [docs, setDocs] = useState<Document[]>([])
  const [selected, setSelected] = useState<Document | null>(null)
  const [tab, setTab] = useState<'content' | 'requirements'>('content')
  const [showAdd, setShowAdd] = useState(false)
  const [newDoc, setNewDoc] = useState({ name: '', doc_type: 'general', content: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeProject) {
      api.get<Document[]>(`/projects/${activeProject.id}/documents`).then(r => {
        setDocs(r.data)
        if (r.data.length > 0) setSelected(r.data[0])
      })
    }
  }, [activeProject])

  async function addDoc() {
    if (!activeProject) return
    setSaving(true)
    try {
      const r = await api.post<Document>(`/projects/${activeProject.id}/documents`, newDoc)
      setDocs(d => [...d, r.data])
      setSelected(r.data)
      setShowAdd(false)
      setNewDoc({ name: '', doc_type: 'general', content: '' })
    } finally {
      setSaving(false)
    }
  }

  if (!activeProject) return <div className="loading-center">No project selected.</div>

  const selectedReqs = selected ? extractRequirements(selected.content) : []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Document Understanding</div>
          <div className="page-subtitle">Project context documents — requirements extracted and used during analysis</div>
        </div>
        <button className="btn-secondary" onClick={() => setShowAdd(!showAdd)}>+ Add Document</button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Add Document</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={newDoc.name} onChange={e => setNewDoc(d => ({ ...d, name: e.target.value }))} placeholder="e.g. API Requirements" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={newDoc.doc_type} onChange={e => setNewDoc(d => ({ ...d, doc_type: e.target.value }))}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea className="form-input" rows={6} value={newDoc.content} onChange={e => setNewDoc(d => ({ ...d, content: e.target.value }))} placeholder="Paste document content..." />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" disabled={saving || !newDoc.name} onClick={addDoc}>{saving ? 'Saving…' : 'Save Document'}</button>
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Doc list */}
        <div className="card" style={{ padding: 10 }}>
          <div className="section-title" style={{ padding: '0 6px', marginBottom: 8 }}>Documents</div>
          {docs.map(d => {
            const meta = DOC_TYPES[d.doc_type] ?? DOC_TYPES.general
            return (
              <div
                key={d.id}
                className={`tree-item ${selected?.id === d.id ? 'selected' : ''}`}
                onClick={() => setSelected(d)}
                style={{ marginBottom: 3 }}
              >
                <span style={{ fontSize: 12 }}>📄</span>
                <span style={{ flex: 1, fontSize: 12 }}>{d.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: meta.color,
                  border: `1px solid ${meta.color}44`, borderRadius: 3,
                  padding: '1px 5px', background: `${meta.color}11`
                }}>{meta.label}</span>
              </div>
            )
          })}
          {docs.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 6px' }}>No documents yet</div>}
        </div>

        {/* Doc content */}
        {selected && (
          <div>
            <div className="doc-card">
              <div className="doc-header">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {selected.content.split('\n').length} lines · {selected.content.length} chars
                  </div>
                </div>
                <span className="doc-type-tag">{DOC_TYPES[selected.doc_type]?.label ?? selected.doc_type}</span>
              </div>

              <div className="tabs" style={{ margin: '0 14px', borderBottom: '1px solid var(--border)' }}>
                <button className={`tab ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>Content</button>
                <button className={`tab ${tab === 'requirements' ? 'active' : ''}`} onClick={() => setTab('requirements')}>
                  Extracted Requirements ({selectedReqs.length})
                </button>
              </div>

              {tab === 'content' && (
                <div className="doc-body">{selected.content}</div>
              )}

              {tab === 'requirements' && (
                <div style={{ padding: 14 }}>
                  {selectedReqs.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                      No explicit MUST/SHOULD requirements found in this document.
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                        {selectedReqs.length} requirement(s) extracted using MUST/SHOULD/required keywords — these are cross-referenced with findings during analysis.
                      </div>
                      {selectedReqs.map((r, i) => (
                        <div key={i} className="req-item">
                          <span className="req-bullet">REQ-{String(i + 1).padStart(3, '0')}</span>
                          <span style={{ color: 'var(--text)' }}>{r}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* How it's used */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>How This Document is Used</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>
                <p>When a review is started, CodePulse extracts requirements from all project documents. The <strong style={{ color: 'var(--text)' }}>Requirements Agent</strong> cross-references each requirement against the proposed code change.</p>
                <p style={{ marginTop: 8 }}>Any finding that traces back to a documented requirement will include a <span className="req-tag" style={{ display: 'inline' }}>Related Requirement</span> reference in its detail view — enabling traceability from code change to documented requirement.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
