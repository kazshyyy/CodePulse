import { useEffect, useState } from 'react'
import api, { type Project, type RepoFile } from '../api'

const FILE_ICONS: Record<string, string> = {
  source: '📄',
  test: '🧪',
  config: '⚙️',
  doc: '📖',
}
const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Markdown: '#083fa1',
  TOML: '#9c4121',
  Text: '#8b949e',
}

function buildTree(files: RepoFile[]): Record<string, RepoFile[]> {
  const dirs: Record<string, RepoFile[]> = { '': [] }
  for (const f of files) {
    const parts = f.path.split('/')
    if (parts.length === 1) {
      dirs[''].push(f)
    } else {
      const dir = parts.slice(0, -1).join('/')
      if (!dirs[dir]) dirs[dir] = []
      dirs[dir].push(f)
    }
  }
  return dirs
}

export default function Explorer({ activeProject }: { activeProject: Project | null }) {
  const [files, setFiles] = useState<RepoFile[]>([])
  const [selected, setSelected] = useState<RepoFile | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['', 'tests', 'docs', 'models', 'config']))

  useEffect(() => {
    if (activeProject) {
      api.get<RepoFile[]>(`/projects/${activeProject.id}/files`).then(r => {
        setFiles(r.data)
        if (r.data.length > 0) setSelected(r.data[0])
      })
    }
  }, [activeProject])

  if (!activeProject) return <div className="loading-center">No project selected.</div>

  const tree = buildTree(files)
  const dirs = Object.keys(tree).sort()

  function toggleDir(d: string) {
    setExpandedDirs(s => {
      const ns = new Set(s)
      if (ns.has(d)) ns.delete(d)
      else ns.add(d)
      return ns
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Repository Explorer</div>
          <div className="page-subtitle">{activeProject.name} · {files.length} files</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        {/* File tree */}
        <div className="card" style={{ padding: 10 }}>
          <div className="section-title" style={{ padding: '0 6px', marginBottom: 8 }}>Files</div>
          <div className="file-tree">
            {dirs.map(dir => (
              <div key={dir}>
                {dir && (
                  <div className="tree-item dir" onClick={() => toggleDir(dir)}>
                    {expandedDirs.has(dir) ? '▾' : '▸'} 📁 {dir}/
                  </div>
                )}
                {(!dir || expandedDirs.has(dir)) && tree[dir].map(f => (
                  <div
                    key={f.id}
                    className={`tree-item ${selected?.id === f.id ? 'selected' : ''}`}
                    style={{ paddingLeft: dir ? 20 : 8 }}
                    onClick={() => setSelected(f)}
                  >
                    <span className="file-icon">{FILE_ICONS[f.file_type] ?? '📄'}</span>
                    <span style={{ flex: 1 }}>{f.path.split('/').pop()}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: LANG_COLORS[f.language] ?? 'var(--muted)',
                      border: `1px solid ${LANG_COLORS[f.language] ?? 'var(--border)'}44`,
                      borderRadius: 3, padding: '1px 5px', background: `${LANG_COLORS[f.language] ?? 'var(--border)'}11`
                    }}>{f.language}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* File content */}
        {selected && (
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{FILE_ICONS[selected.file_type]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.path}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {selected.language} · {selected.file_type} · {selected.content.split('\n').length} lines
                  </div>
                </div>
                <span style={{
                  marginLeft: 'auto', fontWeight: 600, fontSize: 11,
                  color: LANG_COLORS[selected.language] ?? 'var(--muted)',
                  border: `1px solid ${LANG_COLORS[selected.language] ?? 'var(--border)'}55`,
                  borderRadius: 4, padding: '2px 10px',
                  background: `${LANG_COLORS[selected.language] ?? 'var(--border)'}15`
                }}>{selected.language}</span>
              </div>
            </div>

            <div className="code-preview" style={{ maxHeight: 600 }}>
              <pre>
                {selected.content.split('\n').map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: 0 }}>
                    <span style={{ color: 'var(--border)', userSelect: 'none', minWidth: 36, textAlign: 'right', paddingRight: 10, fontSize: 11, flexShrink: 0 }}>{i + 1}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
