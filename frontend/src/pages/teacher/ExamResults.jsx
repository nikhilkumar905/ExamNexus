import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'

const FLAG_LABELS = {
  late_upload: 'Uploaded late',
  over_time: 'Exceeded time',
  never_offline: 'Never went offline',
  paper_redownloaded: 'Paper re-downloaded',
}
const VIOLATION_LABELS = { went_online: 'came back online', tab_hidden: 'left the exam tab' }

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—')

function GradeRow({ a, total, onSaved }) {
  const [score, setScore] = useState(a.final_score ?? a.auto_score ?? 0)
  const [remarks, setRemarks] = useState(a.remarks || '')
  const [published, setPublished] = useState(!!a.published)
  const [state, setState] = useState('')
  const [open, setOpen] = useState(false)

  if (a.status !== 'submitted') {
    return (
      <tr>
        <td>{a.student_name}<div className="muted small">{a.student_email}</div></td>
        <td colSpan={5}><span className="tag amber">In progress</span> <span className="muted small">downloaded {fmt(a.downloaded_at)}</span></td>
      </tr>
    )
  }

  const save = async () => {
    setState('saving')
    try {
      await api.gradeAttempt(a.id, { final_score: Number(score), remarks, published })
      setState('saved')
      onSaved()
    } catch (e) {
      setState(e.message)
    }
  }

  const issues = (a.flags?.length || 0) + (a.violations?.length || 0)
  return (
    <>
      <tr>
        <td>{a.student_name}<div className="muted small">{a.student_email}</div></td>
        <td>
          <b>{a.auto_score}</b> / {total}
          <div className="muted small">{a.correct_count}/{a.total_questions} correct</div>
        </td>
        <td>
          {issues ? (
            <button className="btn ghost sm warn" onClick={() => setOpen(!open)}>⚠ {issues} issue{issues > 1 ? 's' : ''}</button>
          ) : <span className="tag green">Clean</span>}
        </td>
        <td><input type="number" className="score-input" min={0} max={total} step={0.25} value={score} onChange={(e) => setScore(e.target.value)} /></td>
        <td><input placeholder="Remarks for the student" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></td>
        <td className="nowrap">
          <label className="check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publish</label>
          <button className="btn primary sm" onClick={save} disabled={state === 'saving'}>Save</button>
          {state && state !== 'saving' && <div className={`small ${state === 'saved' ? 'green-text' : 'red-text'}`}>{state}</div>}
        </td>
      </tr>
      {open && (
        <tr className="detail-row">
          <td colSpan={6}>
            <div className="small">
              <div>Offline from {fmt(a.offline_started_at)} · submitted {fmt(a.submitted_at)} · uploaded {fmt(a.synced_at)}</div>
              {a.flags?.map((f) => <span key={f} className="tag amber">{FLAG_LABELS[f] || f}</span>)}
              {a.violations?.length > 0 && (
                <ul>
                  {a.violations.map((v, i) => <li key={i}>{fmt(v.at)}: {VIOLATION_LABELS[v.type] || v.type}</li>)}
                </ul>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function ExamResults() {
  const { examId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.examResults(examId).then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [examId])

  if (error) return <div className="alert error">{error}</div>
  if (!data) return <p className="muted">Loading…</p>

  const { exam, stats, attempts, per_question, not_started } = data
  const total = exam.total_marks
  const maxBucket = Math.max(1, ...stats.distribution)

  const publishAll = async () => {
    if (!confirm('Publish all submitted results? Ungraded attempts will use their auto-calculated score.')) return
    await api.publishAll(examId)
    load()
  }

  return (
    <>
      <Link to="/teacher/exams" className="muted small">← All exams</Link>
      <div className="page-head">
        <div>
          <h2>{exam.title}</h2>
          <p className="muted">{exam.duration_minutes} min · {total} marks</p>
        </div>
        <button className="btn primary" onClick={publishAll} disabled={!stats.submitted}>Publish all results</button>
      </div>

      <div className="stats">
        <div className="card stat"><span>Submitted</span><b>{stats.submitted}/{stats.assigned}</b></div>
        <div className="card stat"><span>Average</span><b>{stats.average}</b><small>/ {total}</small></div>
        <div className="card stat"><span>Highest</span><b>{stats.highest}</b></div>
        <div className="card stat"><span>Lowest</span><b>{stats.lowest}</b></div>
        <div className="card stat"><span>Pass rate (≥40%)</span><b>{stats.pass_rate}%</b></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Score distribution</h3>
          <div className="histogram">
            {stats.distribution.map((n, i) => (
              <div key={i} className="bar-col" title={`${n} student(s)`}>
                <span className="bar-n">{n || ''}</span>
                <div className="bar" style={{ height: `${(n / maxBucket) * 100}%` }} />
                <span className="bar-label">{i * 10}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Question accuracy</h3>
          <div className="accuracy-list">
            {per_question.map((q, i) => (
              <div key={q.id} className="acc-row" title={q.question}>
                <span className="acc-label">Q{i + 1}</span>
                <div className="acc-track"><div className={`acc-fill ${q.accuracy < 40 ? 'low' : ''}`} style={{ width: `${q.accuracy}%` }} /></div>
                <span className="acc-val">{q.accuracy}%</span>
              </div>
            ))}
          </div>
          <p className="muted small">Questions below 40% are highlighted. Hover to see the question.</p>
        </div>
      </div>

      <div className="card">
        <h3>Students — review & assign scores</h3>
        {attempts.length === 0 ? <p className="muted">No attempts yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Auto score</th><th>Integrity</th><th>Final score</th><th>Remarks</th><th></th></tr>
              </thead>
              <tbody>
                {attempts.map((a) => <GradeRow key={a.id} a={a} total={total} onSaved={load} />)}
              </tbody>
            </table>
          </div>
        )}
        {not_started.length > 0 && (
          <p className="muted small">Not started: {not_started.map((s) => s.name).join(', ')}</p>
        )}
      </div>

      <div className="card">
        <h3>Question breakdown</h3>
        {per_question.map((q, i) => (
          <div key={q.id} className="breakdown">
            <strong>Q{i + 1}. {q.question}</strong>
            <ul className="options">
              {q.options.map((o) => (
                <li key={o.id} className={o.id === q.correct_option_id ? 'correct' : ''}>
                  <b>{o.id.toUpperCase()}.</b> {o.text} <span className="muted small">— {q.picks[o.id] || 0} picked</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
