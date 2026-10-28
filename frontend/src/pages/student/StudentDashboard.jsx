import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { hasInternet } from '../../lib/connectivity'
import { examStore } from '../../lib/examStore'

const STATUS = {
  not_started: { label: 'Not started', cls: '' },
  started: { label: 'In progress', cls: 'amber' },
  submitted: { label: 'Submitted', cls: 'green' },
}

export default function StudentDashboard() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(examStore.pending().length)

  useEffect(() => {
    const load = async () => {
      // Upload any answers that were saved offline but never reached the server
      if (examStore.pending().length && (await hasInternet())) {
        await examStore.syncAll()
        setPending(examStore.pending().length)
      }
      try {
        setExams(await api.myExams())
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My exams</h2>
          <p className="muted">You'll need to switch off your internet while taking an exam.</p>
        </div>
      </div>
      {pending > 0 && (
        <div className="alert warn">
          {pending} submitted exam(s) are saved on this device but not uploaded yet. Connect to the internet and reload this page.
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      {loading ? <p className="muted">Loading…</p> : exams.length === 0 ? (
        <div className="empty card">No exams assigned to you yet.</div>
      ) : (
        <div className="grid">
          {exams.map((e) => {
            const st = STATUS[e.status]
            const savedLocally = examStore.getSession(e.id)
            return (
              <div className="card" key={e.id}>
                <div className="row between">
                  <h3>{e.title}</h3>
                  <span className={`tag ${st.cls}`}>{st.label}</span>
                </div>
                <p className="muted small">By {e.teacher} · {e.duration_minutes} min · {e.total_marks} marks</p>
                {e.status === 'submitted' ? (
                  e.published
                    ? <Link className="btn primary sm" to={`/student/results/${e.attempt_id}`}>View result</Link>
                    : <span className="muted small">Waiting for your teacher to publish the score</span>
                ) : (
                  <Link className="btn primary sm" to={`/student/exam/${e.id}`}>
                    {e.status === 'started' || savedLocally ? 'Continue exam' : 'Start exam'}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
