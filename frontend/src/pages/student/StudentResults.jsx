import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

export default function StudentResults() {
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.myResults().then(setResults).catch((e) => setError(e.message)) }, [])

  if (error) return <div className="alert error">{error}</div>
  if (!results) return <p className="muted">Loading…</p>

  const published = results.filter((r) => r.published)
  const avg = published.length
    ? Math.round(published.reduce((s, r) => s + (r.score / r.total_marks) * 100, 0) / published.length)
    : null

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My results</h2>
          {avg !== null && <p className="muted">Average across {published.length} published exam(s): <b>{avg}%</b></p>}
        </div>
      </div>
      {results.length === 0 ? <div className="empty card">You haven't submitted any exams yet.</div> : (
        <div className="grid">
          {results.map((r) => {
            const pct = r.published ? Math.round((r.score / r.total_marks) * 100) : null
            return (
              <div className="card" key={r.attempt_id}>
                <h3>{r.title}</h3>
                <p className="muted small">Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''}</p>
                {r.published ? (
                  <>
                    <div className="score-big">{r.score}<small> / {r.total_marks}</small></div>
                    <div className="acc-track"><div className={`acc-fill ${pct < 40 ? 'low' : ''}`} style={{ width: `${pct}%` }} /></div>
                    {r.remarks && <p className="small">Teacher: “{r.remarks}”</p>}
                    <Link className="btn ghost sm" to={`/student/results/${r.attempt_id}`}>Review answers</Link>
                  </>
                ) : <span className="tag amber">Awaiting teacher</span>}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
