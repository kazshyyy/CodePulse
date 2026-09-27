import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ─── Types ────────────────────────────────────────────────────────────────────
interface Finding {
  id: number; finding_id: string; severity: string; category: string
  title: string; description: string; evidence: string; file_path: string
  line_start: number | null; affected_component: string
  related_requirement: string; potential_impact: string
  suggested_fix: string; test_recommendation: string
  validation_status: string; agent_source: string
}
interface OrcStep { step: string; message: string; status: string; timestamp: string }
interface Review {
  id: number; title: string; description: string; branch: string; author: string
  status: string; orchestrator_log: OrcStep[]; severity_counts: Record<string,number>
  tests_generated: number; tests_passed: number; tests_failed: number
  duration_seconds: number; changed_files: string[]
}
interface GenTest { id: number; test_name: string; test_code: string; finding_id: string; status: string; output: string }
interface DiffHunkLine { type: string; content: string }
interface DiffHunk { hunk_header: string; lines: DiffHunkLine[] }
interface FileDiff { file_path: string; before_content: string; after_content: string; diff_hunks: DiffHunk[] }

// ─── Constants ────────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string,string> = { CRITICAL:'#ff7b72', HIGH:'#f0883e', MEDIUM:'#e3b341', LOW:'#3fb950', INFO:'#58a6ff' }
const SEV_BG: Record<string,string>    = { CRITICAL:'#ff7b7218', HIGH:'#f0883e18', MEDIUM:'#e3b34118', LOW:'#3fb95018', INFO:'#58a6ff18' }
const SEV_ORDER = ['CRITICAL','HIGH','MEDIUM','LOW','INFO']
const CAT_ICON: Record<string,string>  = { Security:'🛡️', Correctness:'🔧', Reliability:'⚡', Maintainability:'🧹', Testing:'🧪', Requirements:'📋', Performance:'⚡', Configuration:'⚙️' }

// ─── Utility ──────────────────────────────────────────────────────────────────
function Badge({ sev }: { sev: string }) {
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, letterSpacing:.5, background: SEV_BG[sev]||'#8b949e18', color: SEV_COLOR[sev]||'#8b949e', border:`1px solid ${SEV_COLOR[sev]||'#8b949e'}33` }}>{sev}</span>
}
function StatusBadge({ status }: { status: string }) {
  const c: Record<string,string> = { completed:'#3fb950', running:'#58a6ff', pending:'#8b949e', failed:'#ff7b72' }
  const bg: Record<string,string> = { completed:'#3fb95018', running:'#58a6ff18', pending:'#8b949e18', failed:'#ff7b7218' }
  return <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:700, background: bg[status]||'#8b949e18', color: c[status]||'#8b949e', border:`1px solid ${c[status]||'#8b949e'}44` }}>{status.toUpperCase()}</span>
}
function Spinner() { return <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #30363d', borderTopColor:'#58a6ff', borderRadius:'50%', animation:'spin .6s linear infinite', verticalAlign:'middle' }} /> }

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<'dashboard'|'orchestrator'|'findings'|'diff'|'tests'|'new'>('dashboard')
  const [review, setReview] = useState<Review | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [tests, setTests] = useState<GenTest[]>([])
  const [diffs, setDiffs] = useState<FileDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [expandedFinding, setExpandedFinding] = useState<number|null>(null)
  const [expandedTest, setExpandedTest] = useState<number|null>(null)
  const [sevFilter, setSevFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState('ALL')
  const [diffFile, setDiffFile] = useState<string|null>(null)
  const [newForm, setNewForm] = useState({ title:'', branch:'feature/my-fix', author:'developer', description:'' })
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const loadReview = useCallback(async (id: number) => {
    const [rv, fi, te, di] = await Promise.all([
      api.get<Review>(`/reviews/${id}`),
      api.get<Finding[]>(`/reviews/${id}/findings`),
      api.get<GenTest[]>(`/reviews/${id}/tests`),
      api.get<FileDiff[]>(`/reviews/${id}/diffs`),
    ])
    setReview(rv.data)
    setFindings(fi.data)
    setTests(te.data)
    setDiffs(di.data)
    if (di.data.length) setDiffFile(di.data[0].file_path)
    return rv.data.status
  }, [])

  // Initial load
  useEffect(() => {
    api.get('/reviews?').then(r => {
      const reviews = r.data as Review[]
      if (reviews.length) {
        loadReview(reviews[0].id).finally(() => setLoading(false))
      } else setLoading(false)
    }).catch(() => setLoading(false))
  }, [loadReview])

  // Poll while pending or running — catches both states
  useEffect(() => {
    if (review?.status === 'running' || review?.status === 'pending') {
      pollRef.current = setInterval(() => {
        loadReview(review.id).then(status => {
          if (status !== 'running' && status !== 'pending' && pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        })
      }, 800)
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [review?.status, review?.id, loadReview])

  async function startDemoReview() {
    setStarting(true)
    try {
      const proj = await api.get('/projects')
      const projId = (proj.data as {id:number}[])[0]?.id || 1
      const rv = await api.post('/reviews', {
        project_id: projId,
        title: 'Fix security vulnerabilities in core API layer',
        description: 'Security audit PR: SQL injection, path traversal, unsafe deserialization, hard-coded credentials, OS command injection, missing authorization.',
        branch: 'feature/security-fixes',
        author: 'demo@codepulse.io',
        requirements_text: 'All user-controlled database input MUST use parameterized queries.\nShell commands MUST NOT be constructed from user input.\nFile access MUST be restricted to uploads/ directory.\nCredentials MUST NOT be hard-coded.\nDeserialization of untrusted data MUST use JSON, not pickle.\nAll destructive operations MUST verify authorization.',
        coding_guidelines: 'Functions must have docstrings.\nNo bare except clauses.\nTest coverage >= 85%.\nUse logging module, not print().',
        changed_files: ['app.py']
      })
      const rid = rv.data.id
      // Set the review as pending immediately so the poll loop fires
      setReview({ ...rv.data, status: 'pending' })
      setFindings([]); setTests([]); setDiffs([])
      setTab('orchestrator')
      // Fire start — background task begins; poll loop will catch transitions
      await api.post(`/reviews/${rid}/start`)
    } finally { setStarting(false) }
  }

  async function startCustomReview() {
    if (!newForm.title) return
    setStarting(true)
    try {
      const proj = await api.get('/projects')
      const projId = (proj.data as {id:number}[])[0]?.id || 1
      const rv = await api.post('/reviews', { project_id: projId, ...newForm, changed_files: ['app.py'] })
      const rid = rv.data.id
      setReview({ ...rv.data, status: 'pending' })
      setFindings([]); setTests([]); setDiffs([])
      setTab('orchestrator')
      await api.post(`/reviews/${rid}/start`)
    } finally { setStarting(false) }
  }

  const filteredFindings = findings.filter(f =>
    (sevFilter === 'ALL' || f.severity === sevFilter) &&
    (catFilter === 'ALL' || f.category === catFilter)
  )
  const sevCounts = SEV_ORDER.reduce((a,s) => ({...a,[s]:findings.filter(f=>f.severity===s).length}), {} as Record<string,number>)
  const categories = [...new Set(findings.map(f=>f.category))]
  const selectedDiff = diffs.find(d=>d.file_path===diffFile)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16, background:'#0d1117', color:'#8b949e' }}>
      <Spinner />
      <span style={{ fontSize:14 }}>Loading CodePulse…</span>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0d1117', fontFamily:"-apple-system,'Segoe UI',system-ui,sans-serif", fontSize:13, color:'#e6edf3' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        * { box-sizing:border-box; margin:0; padding:0 }
        ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
        a{color:#58a6ff;text-decoration:none}
        button{cursor:pointer;font-family:inherit}
      `}</style>

      {/* ── Sidebar ── */}
      <Sidebar tab={tab} setTab={setTab} review={review} />

      {/* ── Main ── */}
      <main style={{ flex:1, marginLeft:220, overflow:'auto', minHeight:'100vh' }}>
        {tab === 'dashboard'    && <DashboardTab review={review} findings={findings} tests={tests} sevCounts={sevCounts} onStartDemo={startDemoReview} starting={starting} setTab={setTab} />}
        {tab === 'orchestrator' && <OrchestratorTab review={review} setTab={setTab} />}
        {tab === 'findings'     && <FindingsTab findings={filteredFindings} allFindings={findings} sevCounts={sevCounts} sevFilter={sevFilter} setSevFilter={setSevFilter} catFilter={catFilter} setCatFilter={setCatFilter} categories={categories} expanded={expandedFinding} setExpanded={setExpandedFinding} />}
        {tab === 'diff'         && <DiffTab diffs={diffs} diffFile={diffFile} setDiffFile={setDiffFile} selectedDiff={selectedDiff} findings={findings} />}
        {tab === 'tests'        && <TestsTab tests={tests} findings={findings} expanded={expandedTest} setExpanded={setExpandedTest} />}
        {tab === 'new'          && <NewReviewTab form={newForm} setForm={setNewForm} onSubmit={startCustomReview} onDemo={startDemoReview} starting={starting} />}
      </main>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, review }: { tab:string, setTab:(t:any)=>void, review:Review|null }) {
  const navItems = [
    { id:'dashboard',    icon:'◉', label:'Dashboard' },
    { id:'orchestrator', icon:'🔀', label:'Orchestrator' },
    { id:'findings',     icon:'🛡️', label:'Findings' },
    { id:'diff',         icon:'±',  label:'Code Diff' },
    { id:'tests',        icon:'🧪', label:'Tests' },
    { id:'new',          icon:'＋', label:'New Review' },
  ]
  return (
    <aside style={{ width:220, background:'#161b22', borderRight:'1px solid #21262d', position:'fixed', top:0, left:0, bottom:0, display:'flex', flexDirection:'column', padding:'16px 0', zIndex:100 }}>
      {/* Logo */}
      <div style={{ padding:'0 20px 20px', borderBottom:'1px solid #21262d', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>⚡</span>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#e6edf3', letterSpacing:'-.4px' }}>CodePulse</div>
            <div style={{ fontSize:10, color:'#58a6ff', fontWeight:600, letterSpacing:.5 }}>IBM BOB 2.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding:'0 8px', flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'#484f58', padding:'4px 10px 8px' }}>Workflow</div>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 10px', borderRadius:6,
            border:'none', background: tab===item.id ? '#1f6feb22':'transparent',
            color: tab===item.id ? '#58a6ff':'#8b949e', fontWeight: tab===item.id ? 600:400,
            fontSize:13, marginBottom:2, textAlign:'left', transition:'all .12s'
          }}>
            <span style={{ width:18, textAlign:'center', fontSize:13 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Active review chip */}
      {review && (
        <div style={{ margin:'12px 10px 0', padding:'10px 12px', background:'#21262d', borderRadius:8, border:'1px solid #30363d' }}>
          <div style={{ fontSize:10, color:'#484f58', fontWeight:700, textTransform:'uppercase', letterSpacing:.6, marginBottom:5 }}>Active Review</div>
          <div style={{ fontSize:12, fontWeight:600, color:'#e6edf3', marginBottom:5, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{review.title}</div>
          <StatusBadge status={review.status} />
        </div>
      )}

      <div style={{ padding:'12px 16px 0', borderTop:'1px solid #21262d', marginTop:12 }}>
        <div style={{ fontSize:10, color:'#484f58', textAlign:'center' }}>IBM Bob 2.0 Hackathon</div>
      </div>
    </aside>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ review, findings, tests, sevCounts, onStartDemo, starting, setTab }: any) {
  const wfSteps = ['Context','Analysis','Findings','Fixes','Tests','Validation','Report']
  const doneMap: Record<string,number> = { completed:7, running:4, pending:0, failed:2 }
  const done = doneMap[review?.status||'pending']||0
  const totalFindings = Object.values(sevCounts as Record<string,number>).reduce((a:number,b)=>a+(b as number),0)

  return (
    <div style={{ padding:'28px 32px', maxWidth:1200, animation:'fadeIn .3s' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#e6edf3', letterSpacing:'-.4px' }}>Dashboard</h1>
          <p style={{ color:'#8b949e', fontSize:13, marginTop:3 }}>AI-powered code review &amp; validation platform · PaymentService API</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setTab('new')} style={{ padding:'8px 16px', borderRadius:6, border:'1px solid #30363d', background:'#21262d', color:'#e6edf3', fontSize:13, fontWeight:500 }}>
            + New Review
          </button>
          <button onClick={onStartDemo} disabled={starting} style={{ padding:'8px 18px', borderRadius:6, border:'none', background:'#238636', color:'#fff', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:7, opacity:starting?0.6:1 }}>
            {starting ? <><Spinner /> Starting…</> : '⚡ Run Demo Review'}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
        {[
          { label:'Total Findings', value: totalFindings, color:'#e6edf3', sub:`${review?.tests_generated||0} tests generated` },
          { label:'Critical', value: sevCounts['CRITICAL']||0, color:'#ff7b72', sub:`${sevCounts['HIGH']||0} high severity` },
          { label:'Tests Passed', value: review?.tests_passed||0, color:'#3fb950', sub:`of ${review?.tests_generated||0} generated` },
          { label:'Duration', value: review ? `${review.duration_seconds.toFixed(1)}s` : '—', color:'#58a6ff', sub:'end-to-end analysis' },
        ].map(c => (
          <div key={c.label} style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:10, padding:'18px 20px' }}>
            <div style={{ fontSize:28, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
            <div style={{ fontSize:12, color:'#8b949e', marginTop:5 }}>{c.label}</div>
            <div style={{ fontSize:11, color:'#484f58', marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Severity breakdown */}
      <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:10, padding:'18px 20px', marginBottom:18 }}>
        <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:'#8b949e', marginBottom:14 }}>Severity Breakdown</div>
        <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
          {SEV_ORDER.map(s => (
            <div key={s} style={{ textAlign:'center' }}>
              <div style={{ fontSize:26, fontWeight:800, color:SEV_COLOR[s] }}>{sevCounts[s]||0}</div>
              <Badge sev={s} />
            </div>
          ))}
          <div style={{ flex:1, display:'flex', alignItems:'center' }}>
            <div style={{ width:'100%', height:8, background:'#21262d', borderRadius:4, overflow:'hidden', display:'flex' }}>
              {SEV_ORDER.filter(s=>(sevCounts[s]||0)>0).map(s=>(
                <div key={s} style={{ background:SEV_COLOR[s], flex:sevCounts[s]||0, transition:'flex .5s', borderRadius:2 }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow pipeline */}
      {review && (
        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:10, padding:'18px 20px', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:'#8b949e' }}>Review Pipeline</div>
            <StatusBadge status={review.status} />
          </div>
          <div style={{ display:'flex', gap:0, marginBottom:16 }}>
            {wfSteps.map((s,i) => {
              const state = i<done?'done':i===done&&review.status==='running'?'active':'pending'
              return (
                <div key={s} style={{
                  flex:1, textAlign:'center', padding:'7px 4px', fontSize:11, fontWeight:600,
                  background: state==='done'?'#3fb95015':state==='active'?'#1f6feb22':'transparent',
                  color: state==='done'?'#3fb950':state==='active'?'#58a6ff':'#484f58',
                  border:`1px solid ${state==='done'?'#3fb95033':state==='active'?'#58a6ff33':'#21262d'}`,
                  borderLeft: i>0?'none':undefined, borderRadius: i===0?'6px 0 0 6px':i===wfSteps.length-1?'0 6px 6px 0':'0'
                }}>
                  {state==='done'?'✓ ':state==='active'?<span style={{ marginRight:4, display:'inline-block', width:6, height:6, background:'#58a6ff', borderRadius:'50%', animation:'pulse 1.4s infinite' }} />:'○ '}{s}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize:13, color:'#e6edf3', fontWeight:600 }}>{review.title}</div>
          <div style={{ fontSize:12, color:'#8b949e', marginTop:4 }}>
            {review.author} · <code style={{ fontSize:11, background:'#21262d', padding:'1px 6px', borderRadius:3 }}>{review.branch}</code> · {review.duration_seconds.toFixed(1)}s
          </div>
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <button onClick={()=>setTab('orchestrator')} style={{ padding:'6px 14px', borderRadius:5, border:'1px solid #30363d', background:'#21262d', color:'#58a6ff', fontSize:12, fontWeight:600 }}>View Orchestrator Log</button>
            <button onClick={()=>setTab('findings')} style={{ padding:'6px 14px', borderRadius:5, border:'1px solid #30363d', background:'#21262d', color:'#e6edf3', fontSize:12 }}>View {totalFindings} Findings</button>
            <button onClick={()=>setTab('diff')} style={{ padding:'6px 14px', borderRadius:5, border:'1px solid #30363d', background:'#21262d', color:'#e6edf3', fontSize:12 }}>View Code Diff</button>
            <button onClick={()=>setTab('tests')} style={{ padding:'6px 14px', borderRadius:5, border:'1px solid #30363d', background:'#21262d', color:'#e6edf3', fontSize:12 }}>View Tests ({review.tests_passed}/{review.tests_generated} ✓)</button>
          </div>
        </div>
      )}

      {/* No review yet */}
      {!review && (
        <div style={{ background:'#161b22', border:'2px dashed #30363d', borderRadius:12, padding:48, textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚡</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#e6edf3', marginBottom:8 }}>No reviews yet</div>
          <div style={{ color:'#8b949e', marginBottom:20 }}>Start the demo to see CodePulse in action — security analysis, code review, test generation and validation in seconds.</div>
          <button onClick={onStartDemo} disabled={starting} style={{ padding:'10px 24px', borderRadius:7, border:'none', background:'#238636', color:'#fff', fontSize:14, fontWeight:700 }}>
            {starting ? 'Starting…' : '⚡ Run Demo Review'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────
function OrchestratorTab({ review, setTab }: { review: Review|null, setTab:(t:any)=>void }) {
  if (!review) return <EmptyState icon="🔀" title="No review running" sub="Start a review from the Dashboard." />
  const log = review.orchestrator_log || []
  const parallelSteps = new Set(['agent_security','agent_code','agent_testing','agent_requirements'])
  const agentSteps = log.filter(s=>parallelSteps.has(s.step))
  const mainSteps = log.filter(s=>!parallelSteps.has(s.step))
  const ICONS: Record<string,string> = { init:'🔧', context_repo:'📂', context_change:'🔍', context_docs:'📄', parallel_start:'🔀', aggregation:'🔗', dedup:'🧹', correlation:'🔗', severity:'⚖️', tests:'🧪', validation:'✅', report:'📊', error:'❌' }

  return (
    <div style={{ padding:'28px 32px', maxWidth:900, animation:'fadeIn .3s' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#e6edf3', letterSpacing:'-.4px' }}>Review Orchestrator</h1>
          <p style={{ color:'#8b949e', fontSize:13, marginTop:3 }}>Multi-agent coordination log — mirrors IBM Bob 2.0 parallel subagent workflow</p>
        </div>
        <StatusBadge status={review.status} />
      </div>

      {/* Agent cards */}
      {agentSteps.length > 0 && (
        <div style={{ background:'#1f6feb11', border:'1px solid #1f6feb33', borderRadius:10, padding:'14px 18px', marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#58a6ff', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            🔀 Parallel Analysis — 4 agents running concurrently
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {(['agent_security','agent_code','agent_testing','agent_requirements'] as const).map(key => {
              const step = agentSteps.find(s=>s.step===key)
              const names: Record<string,string> = { agent_security:'Security Agent', agent_code:'Code Quality Agent', agent_testing:'Testing Agent', agent_requirements:'Requirements Agent' }
              const icons: Record<string,string> = { agent_security:'🛡️', agent_code:'🧹', agent_testing:'🧪', agent_requirements:'📋' }
              return (
                <div key={key} style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:8, padding:'12px 14px' }}>
                  <div style={{ fontSize:18, marginBottom:6 }}>{icons[key]}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#e6edf3', marginBottom:4 }}>{names[key]}</div>
                  {step ? (
                    <div style={{ fontSize:11, color:'#3fb950' }}>✓ {step.timestamp}</div>
                  ) : (
                    <div style={{ fontSize:11, color:'#58a6ff', display:'flex', alignItems:'center', gap:5 }}><Spinner /> Running…</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main log steps */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {mainSteps.map((step, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 16px', background:'#161b22', border:'1px solid #21262d', borderRadius:8, animation:'slideIn .2s' }}>
            <span style={{ fontSize:16, flexShrink:0, lineHeight:1.5 }}>{ICONS[step.step]||'●'}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:'#e6edf3' }}>{step.message}</div>
              <div style={{ fontSize:11, color:'#484f58', marginTop:2 }}>{step.timestamp}</div>
            </div>
            <span style={{ fontSize:12, color:'#3fb950' }}>✓</span>
          </div>
        ))}
        {review.status === 'running' && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', background:'#161b22', border:'1px solid #1f6feb33', borderRadius:8, opacity:.7 }}>
            <Spinner />
            <span style={{ fontSize:13, color:'#8b949e' }}>Analysis in progress…</span>
          </div>
        )}
      </div>

      {review.status === 'completed' && (
        <div style={{ marginTop:22, padding:'16px 20px', background:'#3fb95011', border:'1px solid #3fb95033', borderRadius:10 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#3fb950', marginBottom:4 }}>✅ Review Complete</div>
          <div style={{ fontSize:13, color:'#8b949e', marginBottom:14 }}>
            {Object.values(review.severity_counts).reduce((a,b)=>a+b,0)} findings · {review.tests_passed}/{review.tests_generated} tests passed · {review.duration_seconds.toFixed(1)}s
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>setTab('findings')} style={{ padding:'7px 16px', borderRadius:6, border:'none', background:'#238636', color:'#fff', fontSize:13, fontWeight:600 }}>View Findings →</button>
            <button onClick={()=>setTab('diff')} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid #30363d', background:'#21262d', color:'#e6edf3', fontSize:13 }}>View Code Diff →</button>
            <button onClick={()=>setTab('tests')} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid #30363d', background:'#21262d', color:'#e6edf3', fontSize:13 }}>View Tests →</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Findings ─────────────────────────────────────────────────────────────────
function FindingsTab({ findings, allFindings, sevCounts, sevFilter, setSevFilter, catFilter, setCatFilter, categories, expanded, setExpanded }: any) {
  if (!allFindings.length) return <EmptyState icon="🛡️" title="No findings yet" sub="Start a review to generate findings." />
  return (
    <div style={{ padding:'28px 32px', animation:'fadeIn .3s' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#e6edf3', letterSpacing:'-.4px' }}>Findings</h1>
        <p style={{ color:'#8b949e', fontSize:13, marginTop:3 }}>Click any row to expand full evidence, impact analysis, and fix recommendations</p>
      </div>

      {/* Sev filter pills */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={()=>setSevFilter('ALL')} style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${sevFilter==='ALL'?'#58a6ff':'#30363d'}`, background: sevFilter==='ALL'?'#1f6feb22':'transparent', color: sevFilter==='ALL'?'#58a6ff':'#8b949e', fontSize:12, fontWeight:600 }}>
          All ({allFindings.length})
        </button>
        {SEV_ORDER.filter(s=>(sevCounts[s]||0)>0).map(s=>(
          <button key={s} onClick={()=>setSevFilter(sevFilter===s?'ALL':s)} style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${sevFilter===s?SEV_COLOR[s]:'#30363d'}`, background: sevFilter===s?SEV_BG[s]:'transparent', color: sevFilter===s?SEV_COLOR[s]:'#8b949e', fontSize:12, fontWeight:600 }}>
            {s} ({sevCounts[s]})
          </button>
        ))}
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #30363d', background:'#21262d', color:'#8b949e', fontSize:12 }}>
          <option value="ALL">All Categories</option>
          {categories.map((c:string)=><option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#484f58', alignSelf:'center', marginLeft:'auto' }}>{findings.length} of {allFindings.length} findings</span>
      </div>

      {/* Findings list */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {findings.map((f: Finding) => (
          <div key={f.id}>
            <div onClick={()=>setExpanded(expanded===f.id?null:f.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', background:'#161b22', border:`1px solid ${expanded===f.id?'#30363d':'#21262d'}`, borderRadius: expanded===f.id?'8px 8px 0 0':'8px', cursor:'pointer', transition:'border .15s' }}>
              <Badge sev={f.severity} />
              <code style={{ fontSize:10, color:'#484f58', minWidth:70 }}>{f.finding_id}</code>
              <span style={{ fontSize:12, color:'#8b949e', minWidth:90 }}>{CAT_ICON[f.category]||'●'} {f.category}</span>
              <span style={{ flex:1, fontSize:13, fontWeight:500, color:'#e6edf3' }}>{f.title}</span>
              {f.file_path && <code style={{ fontSize:11, color:'#8b949e', background:'#21262d', padding:'2px 7px', borderRadius:4 }}>{f.file_path}{f.line_start?`:${f.line_start}`:''}</code>}
              <span style={{ fontSize:11, color:f.validation_status==='fixed'?'#3fb950':'#8b949e' }}>{f.validation_status==='fixed'?'✓ Fixed':'● Open'}</span>
              <span style={{ color:'#484f58', fontSize:12 }}>{expanded===f.id?'▲':'▼'}</span>
            </div>
            {expanded===f.id && <FindingDetail f={f} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function FindingDetail({ f }: { f: Finding }) {
  return (
    <div style={{ background:'#161b22', border:'1px solid #30363d', borderTop:'none', borderRadius:'0 0 8px 8px', padding:'16px 20px', animation:'fadeIn .2s' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div>
          <Label>Description</Label>
          <p style={{ fontSize:13, color:'#8b949e', lineHeight:1.7 }}>{f.description}</p>
        </div>
        <div>
          {f.related_requirement && <>
            <Label>Related Requirement</Label>
            <div style={{ background:'#1f6feb11', border:'1px solid #1f6feb33', borderRadius:5, padding:'7px 12px', fontSize:12, color:'#58a6ff', fontStyle:'italic', marginBottom:12 }}>"{f.related_requirement}"</div>
          </>}
          {f.potential_impact && <>
            <Label>Potential Impact</Label>
            <p style={{ fontSize:12, color:'#f0883e', lineHeight:1.6 }}>{f.potential_impact}</p>
          </>}
        </div>
      </div>
      {f.evidence && (
        <div style={{ marginBottom:14 }}>
          <Label>Evidence</Label>
          <pre style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#e6edf3', overflowX:'auto', whiteSpace:'pre-wrap' }}>{f.evidence}</pre>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {f.suggested_fix && <div>
          <Label>Suggested Fix</Label>
          <p style={{ fontSize:12, color:'#3fb950', lineHeight:1.7 }}>{f.suggested_fix}</p>
        </div>}
        {f.test_recommendation && <div>
          <Label>Test Recommendation</Label>
          <p style={{ fontSize:12, color:'#8b949e', lineHeight:1.7 }}>{f.test_recommendation}</p>
        </div>}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
        <Chip>{f.agent_source}</Chip>
        {f.affected_component && <Chip>⚙ {f.affected_component}</Chip>}
        <Chip style={{ color:f.validation_status==='fixed'?'#3fb950':undefined }}>{f.validation_status}</Chip>
      </div>
    </div>
  )
}

// ─── Diff View ────────────────────────────────────────────────────────────────
function DiffTab({ diffs, diffFile, setDiffFile, selectedDiff, findings }: any) {
  if (!diffs.length) return <EmptyState icon="±" title="No diff available" sub="Start a review to see code changes." />
  const fileFindigns: Finding[] = findings.filter((f:Finding)=>f.file_path===diffFile)
  const lineMap: Record<number,Finding[]> = {}
  fileFindigns.forEach((f:Finding) => { if(f.line_start) for(let l=f.line_start;l<=(f.line_end||f.line_start);l++) lineMap[l]=[...(lineMap[l]||[]),f] })

  return (
    <div style={{ padding:'28px 32px', animation:'fadeIn .3s' }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#e6edf3', letterSpacing:'-.4px' }}>Code Diff</h1>
        <p style={{ color:'#8b949e', fontSize:13, marginTop:3 }}>Changed files with inline finding annotations</p>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {diffs.map((d:FileDiff)=>(
          <button key={d.file_path} onClick={()=>setDiffFile(d.file_path)} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${diffFile===d.file_path?'#58a6ff':'#30363d'}`, background: diffFile===d.file_path?'#1f6feb22':'#21262d', color: diffFile===d.file_path?'#58a6ff':'#8b949e', fontSize:12, fontWeight:600 }}>
            📄 {d.file_path} <span style={{ color:'#484f58', marginLeft:4 }}>({findings.filter((f:Finding)=>f.file_path===d.file_path).length} findings)</span>
          </button>
        ))}
      </div>

      {/* Findings sidebar for this file */}
      {fileFindigns.length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {fileFindigns.map((f:Finding)=>(
            <div key={f.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 12px', background:SEV_BG[f.severity], border:`1px solid ${SEV_COLOR[f.severity]}33`, borderRadius:6, fontSize:12 }}>
              <Badge sev={f.severity} />
              <span style={{ color:'#e6edf3', fontWeight:500 }}>L{f.line_start}</span>
              <span style={{ color:'#8b949e' }}>{f.title}</span>
            </div>
          ))}
        </div>
      )}

      {selectedDiff && (
        <>
          {selectedDiff.diff_hunks?.length > 0 ? (
            selectedDiff.diff_hunks.map((hunk:DiffHunk, hi:number) => (
              <div key={hi} style={{ marginBottom:16, borderRadius:8, overflow:'hidden', border:'1px solid #21262d' }}>
                <div style={{ background:'#161b22', padding:'7px 14px', fontSize:12, color:'#8b949e', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between' }}>
                  <span>📄 {selectedDiff.file_path}</span>
                  <span style={{ fontFamily:'monospace', color:'#58a6ff88' }}>{hunk.hunk_header}</span>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'Cascadia Code','Fira Code',Consolas,monospace" }}>
                  <tbody>
                    {hunk.lines.map((line:DiffHunkLine, li:number)=>{
                      const lno = li+1
                      const lf = lineMap[lno]
                      const bg = line.type==='added'?'#2ea04318':line.type==='removed'?'#f8514918':'transparent'
                      const col = line.type==='added'?'#3fb950':line.type==='removed'?'#ff7b72':'#6e7681'
                      const prefix = line.type==='added'?'+':line.type==='removed'?'-':' '
                      return (
                        <tr key={li} style={{ background:bg }}>
                          <td style={{ width:36, textAlign:'right', padding:'1px 8px', fontSize:11, color:'#484f58', userSelect:'none', background:'#161b22', borderRight:'1px solid #21262d' }}>{lno}</td>
                          <td style={{ padding:'1px 14px', fontSize:12, color:col, whiteSpace:'pre' }}>{prefix} {line.content}</td>
                          <td style={{ width:28, padding:'1px 6px', textAlign:'center' }}>
                            {lf && <span title={lf.map(f=>f.title).join('; ')} style={{ color:SEV_COLOR[lf[0].severity], fontSize:13 }}>⚠</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <SimpleDiff before={selectedDiff.before_content} after={selectedDiff.after_content} filePath={selectedDiff.file_path} />
          )}
        </>
      )}
    </div>
  )
}

function SimpleDiff({ before, after, filePath }: { before:string; after:string; filePath:string }) {
  const bLines = before.split('\n'); const aLines = after.split('\n')
  const max = Math.max(bLines.length, aLines.length)
  const rows = []
  for (let i=0;i<max;i++) {
    const b=bLines[i],a=aLines[i]
    if (b===a) rows.push({ type:'context', content:b||'', ln:i+1 })
    else { if(b!==undefined) rows.push({ type:'removed', content:b, ln:i+1 }); if(a!==undefined) rows.push({ type:'added', content:a, ln:i+1 }) }
  }
  return (
    <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #21262d' }}>
      <div style={{ background:'#161b22', padding:'7px 14px', fontSize:12, color:'#8b949e', borderBottom:'1px solid #21262d' }}>📄 {filePath}</div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'Cascadia Code','Fira Code',Consolas,monospace" }}>
        <tbody>
          {rows.map((r,i)=>{
            const bg=r.type==='added'?'#2ea04318':r.type==='removed'?'#f8514918':'transparent'
            const col=r.type==='added'?'#3fb950':r.type==='removed'?'#ff7b72':'#6e7681'
            const p=r.type==='added'?'+':r.type==='removed'?'-':' '
            return <tr key={i} style={{background:bg}}><td style={{width:36,textAlign:'right',padding:'1px 8px',fontSize:11,color:'#484f58',userSelect:'none',background:'#161b22',borderRight:'1px solid #21262d'}}>{r.ln}</td><td style={{padding:'1px 14px',fontSize:12,color:col,whiteSpace:'pre'}}>{p} {r.content}</td></tr>
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tests Tab ────────────────────────────────────────────────────────────────
function TestsTab({ tests, findings, expanded, setExpanded }: any) {
  if (!tests.length) return <EmptyState icon="🧪" title="No tests generated yet" sub="Tests are generated when a review completes." />
  const passed = tests.filter((t:GenTest)=>t.status==='passed').length
  const failed = tests.filter((t:GenTest)=>t.status==='failed').length
  return (
    <div style={{ padding:'28px 32px', animation:'fadeIn .3s' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#e6edf3', letterSpacing:'-.4px' }}>Generated Tests</h1>
        <p style={{ color:'#8b949e', fontSize:13, marginTop:3 }}>Regression tests auto-generated for high-severity findings</p>
      </div>

      {/* Summary bar */}
      <div style={{ display:'flex', gap:14, marginBottom:22 }}>
        {[
          { label:'Generated', value:tests.length, color:'#58a6ff' },
          { label:'Passed', value:passed, color:'#3fb950' },
          { label:'Failed', value:failed, color:'#ff7b72' },
        ].map(c=>(
          <div key={c.label} style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'14px 20px', minWidth:120 }}>
            <div style={{ fontSize:24, fontWeight:700, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:12, color:'#8b949e', marginTop:4 }}>{c.label}</div>
          </div>
        ))}
        <div style={{ flex:1, background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'14px 20px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1, height:8, background:'#21262d', borderRadius:4, overflow:'hidden', display:'flex' }}>
            <div style={{ background:'#3fb950', width:`${(passed/tests.length)*100}%`, borderRadius:4 }} />
          </div>
          <span style={{ fontSize:12, fontWeight:700, color:'#3fb950' }}>{Math.round((passed/tests.length)*100)}% pass rate</span>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {tests.map((t:GenTest)=>{
          const relFinding = findings.find((f:Finding)=>f.finding_id===t.finding_id)
          const statusColor = t.status==='passed'?'#3fb950':t.status==='failed'?'#ff7b72':'#8b949e'
          const statusIcon  = t.status==='passed'?'✅':t.status==='failed'?'❌':'📝'
          return (
            <div key={t.id} style={{ border:'1px solid #21262d', borderRadius:8, overflow:'hidden' }}>
              <div onClick={()=>setExpanded(expanded===t.id?null:t.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', background:'#161b22', cursor:'pointer' }}>
                <span style={{ fontSize:16 }}>{statusIcon}</span>
                <code style={{ fontSize:12, fontWeight:600, color:'#e6edf3', flex:1 }}>{t.test_name}</code>
                {relFinding && <Badge sev={relFinding.severity} />}
                <code style={{ fontSize:10, color:'#484f58' }}>{t.finding_id}</code>
                <span style={{ fontSize:12, fontWeight:700, color:statusColor }}>{t.status}</span>
                <span style={{ color:'#484f58', fontSize:11 }}>{expanded===t.id?'▲':'▼'}</span>
              </div>
              {expanded===t.id && (
                <div style={{ padding:'12px 16px', background:'#0d1117', borderTop:'1px solid #21262d', animation:'fadeIn .2s' }}>
                  {t.output && (
                    <div style={{ marginBottom:12 }}>
                      <Label>Test Output</Label>
                      <pre style={{ fontSize:12, color:'#3fb950', background:'#161b22', border:'1px solid #21262d', borderRadius:5, padding:'10px 14px', overflow:'auto' }}>{t.output}</pre>
                    </div>
                  )}
                  <Label>Test Code</Label>
                  <pre style={{ fontSize:12, color:'#e6edf3', background:'#161b22', border:'1px solid #21262d', borderRadius:5, padding:'12px 16px', overflow:'auto', maxHeight:360 }}>{t.test_code}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── New Review ───────────────────────────────────────────────────────────────
function NewReviewTab({ form, setForm, onSubmit, onDemo, starting }: any) {
  return (
    <div style={{ padding:'28px 32px', maxWidth:860, animation:'fadeIn .3s' }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#e6edf3', letterSpacing:'-.4px' }}>New Review</h1>
        <p style={{ color:'#8b949e', fontSize:13, marginTop:3 }}>Configure and launch an AI-powered code review</p>
      </div>

      {/* Demo CTA */}
      <div style={{ background:'linear-gradient(135deg,#1f6feb22,#238636 22)', border:'1px solid #238636aa', borderRadius:12, padding:'20px 24px', marginBottom:24, display:'flex', alignItems:'center', gap:20 }}>
        <div style={{ fontSize:36 }}>⚡</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#e6edf3', marginBottom:4 }}>Demo Review — PaymentService API Security Fixes</div>
          <div style={{ fontSize:13, color:'#8b949e' }}>Instantly run a complete security review on the sample PR — SQL injection, path traversal, unsafe deserialization, hard-coded credentials, and more.</div>
        </div>
        <button onClick={onDemo} disabled={starting} style={{ padding:'10px 22px', borderRadius:7, border:'none', background:'#238636', color:'#fff', fontSize:14, fontWeight:700, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}>
          {starting ? <><Spinner /> Starting…</> : '⚡ Start Demo'}
        </button>
      </div>

      {/* Custom form */}
      <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:10, padding:'20px 24px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#8b949e', marginBottom:16, textTransform:'uppercase', letterSpacing:.6 }}>Custom Review</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div>
            <Label>PR Title *</Label>
            <input value={form.title} onChange={(e:any)=>setForm((f:any)=>({...f,title:e.target.value}))} placeholder="e.g. Fix SQL injection in user lookup" style={inputStyle} />
          </div>
          <div>
            <Label>Branch</Label>
            <input value={form.branch} onChange={(e:any)=>setForm((f:any)=>({...f,branch:e.target.value}))} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <Label>Description</Label>
          <textarea value={form.description} onChange={(e:any)=>setForm((f:any)=>({...f,description:e.target.value}))} rows={3} placeholder="What does this change do?" style={{...inputStyle, resize:'vertical'}} />
        </div>
        <button onClick={onSubmit} disabled={starting||!form.title} style={{ padding:'9px 20px', borderRadius:6, border:'none', background: form.title?'#1f6feb':'#21262d', color: form.title?'#fff':'#484f58', fontSize:13, fontWeight:600, cursor:form.title?'pointer':'default' }}>
          {starting ? 'Starting…' : '🚀 Start Review'}
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon:string; title:string; sub:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12, color:'#8b949e' }}>
      <span style={{ fontSize:48 }}>{icon}</span>
      <div style={{ fontSize:16, fontWeight:600, color:'#e6edf3' }}>{title}</div>
      <div style={{ fontSize:13 }}>{sub}</div>
    </div>
  )
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:'#8b949e', marginBottom:5 }}>{children}</div>
}
function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ fontSize:11, color:'#8b949e', background:'#21262d', border:'1px solid #30363d', borderRadius:4, padding:'2px 8px', ...style }}>{children}</span>
}
const inputStyle: React.CSSProperties = {
  width:'100%', background:'#0d1117', border:'1px solid #30363d', borderRadius:6,
  color:'#e6edf3', fontFamily:'inherit', fontSize:13, padding:'7px 10px', outline:'none'
}
