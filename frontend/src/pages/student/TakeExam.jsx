// Offline exam flow:
//   download  -> (online) student downloads the paper
//   go_offline -> questions stay hidden until the internet is off; timer starts when it is
//   in_progress -> answering offline; reconnecting or leaving the tab is logged as a violation
//   submitted -> answers saved locally, waiting for the internet to come back to upload
//   done      -> uploaded and graded on the server
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useInternet } from '../../lib/connectivity'
import { examStore } from '../../lib/examStore'

const pad = (n) => String(n).padStart(2, '0')
const formatTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function NetBadge({ online }) {
  if (online === null) return <span className="net checking">Checking connection…</span>
  return online ? <span className="net on">● Internet ON</span> : <span className="net off">● Internet OFF</span>
}

export default function TakeExam() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const online = useInternet(2000)
  const [session, setSession] = useState(() => examStore.getSession(examId))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sync, setSync] = useState({ state: 'idle', result: null, error: '' })
  const [now, setNow] = useState(Date.now())
  const prevOnline = useRef(online)

  const phase = session?.phase ?? 'download'

  // Every change is persisted so a refresh never loses answers.
  const update = useCallback((fn) => {
    setSession((s) => {
      const next = { ...s, ...fn(s) }
      examStore.saveSession(examId, next)
      return next
    })
  }, [examId])

  const addViolation = useCallback((type) => {
    update((s) => ({ violations: [...s.violations, { type, at: new Date().toISOString() }] }))
  }, [update])

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const paper = await api.startExam(examId)
      const fresh = { phase: 'go_offline', paper, answers: {}, violations: [], offline_started_at: null, current: 0 }
      examStore.saveSession(examId, fresh)
      setSession(fresh)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const finish = useCallback(() => {
    update((s) => {
      if (s.phase !== 'in_progress') return {}
      const payload = {
        answers: s.answers,
        offline_started_at: s.offline_started_at,
        submitted_at: new Date().toISOString(),
        violations: s.violations,
      }
      examStore.addPending({ attempt_id: s.paper.attempt_id, exam_id: examId, payload })
      return { phase: 'submitted' }
    })
  }, [update, examId])

  // Start the exam as soon as the internet goes off.
  useEffect(() => {
    if (phase === 'go_offline' && online === false) {
      update(() => ({ phase: 'in_progress', offline_started_at: new Date().toISOString() }))
    }
  }, [phase, online, update])

  // Log reconnecting during the exam (once per transition to online, incl. after a reload).
  useEffect(() => {
    if (phase === 'in_progress' && online === true && prevOnline.current !== true) addViolation('went_online')
    prevOnline.current = online
  }, [online, phase, addViolation])

  // Log leaving the tab / minimising the app, and warn before closing.
  useEffect(() => {
    if (phase !== 'in_progress') return
    const onVis = () => document.hidden && addViolation('tab_hidden')
    const onUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [phase, addViolation])

  // Timer, counted from the moment the student went offline.
  const deadline = session?.offline_started_at
    ? new Date(session.offline_started_at).getTime() + session.paper.duration_minutes * 60000
    : null
  useEffect(() => {
    if (phase !== 'in_progress') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (phase === 'in_progress' && deadline && now >= deadline) finish()
  }, [phase, deadline, now, finish])

  // Upload as soon as the internet is back.
  const upload = useCallback(async () => {
    setSync({ state: 'syncing', result: null, error: '' })
    try {
      const result = await examStore.syncOne(session.paper.attempt_id)
      setSync({ state: 'done', result, error: '' })
      setSession((s) => ({ ...s, phase: 'done' })) // stored session was cleared by syncOne
    } catch (e) {
      setSync({ state: 'error', result: null, error: e.message })
    }
  }, [session?.paper?.attempt_id])

  useEffect(() => {
    if (phase === 'submitted' && online === true && sync.state === 'idle') upload()
  }, [phase, online, sync.state, upload])

  // ---------- screens ----------

  if (phase === 'download') {
    return (
      <div className="exam-shell center-screen">
        <div className="card narrow">
          <h2>Before you begin</h2>
          <ol className="rules">
            <li>Click <b>Download paper</b> while you are connected to the internet.</li>
            <li>Then <b>turn off Wi-Fi and mobile data</b>. The questions appear and the timer starts only once you are offline.</li>
            <li>Do not reconnect or leave this tab during the exam. Both are recorded and shown to your teacher.</li>
            <li>Do not refresh or close this page while offline.</li>
            <li>After you submit, <b>turn the internet back on</b> and your answers upload automatically.</li>
          </ol>
          {error && <div className="alert error">{error}</div>}
          <div className="row between">
            <NetBadge online={online} />
            <div className="row gap">
              <Link to="/student" className="btn ghost">Back</Link>
              <button className="btn primary" onClick={download} disabled={busy || online === false}>
                {busy ? 'Downloading…' : 'Download paper'}
              </button>
            </div>
          </div>
          {online === false && <p className="muted small">You're offline. Connect to download the paper.</p>}
        </div>
      </div>
    )
  }

  const { paper } = session

  if (phase === 'go_offline') {
    return (
      <div className="exam-shell center-screen">
        <div className="card narrow center">
          <div className="big-icon">📴</div>
          <h2>Paper downloaded. Now turn off your internet.</h2>
          <p className="muted">
            Turn off Wi-Fi (and mobile data / Ethernet). <b>{paper.title}</b> has {paper.questions.length} questions
            and {paper.duration_minutes} minutes. The timer starts the moment you go offline.
          </p>
          <NetBadge online={online} />
          <p className="muted small">Waiting for the connection to drop…</p>
        </div>
      </div>
    )
  }

  if (phase === 'submitted' || phase === 'done') {
    const done = phase === 'done'
    return (
      <div className="exam-shell center-screen">
        <div className="card narrow center">
          <div className="big-icon">{done ? '✅' : '📶'}</div>
          {done ? (
            <>
              <h2>Exam submitted</h2>
              <p className="muted">Your answers were uploaded and graded.</p>
              {sync.result?.published
                ? <Link className="btn primary" to="/student/results">See my score</Link>
                : <p>Your teacher will review and publish your score.</p>}
              <button className="btn ghost" onClick={() => navigate('/student')}>Back to my exams</button>
            </>
          ) : (
            <>
              <h2>Answers saved. Turn your internet back ON.</h2>
              <p className="muted">Your answers are stored on this device and upload automatically once you're online.</p>
              <NetBadge online={online} />
              {sync.state === 'syncing' && <p>Uploading…</p>}
              {sync.state === 'error' && (
                <>
                  <div className="alert error">{sync.error}</div>
                  <button className="btn primary" onClick={upload}>Retry upload</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // phase === 'in_progress'
  const q = paper.questions[session.current]
  const answered = Object.keys(session.answers).length
  const remaining = deadline - now
  const blocked = online === true

  const submit = () => {
    const left = paper.questions.length - answered
    if (confirm(left ? `You have ${left} unanswered question(s). Submit anyway?` : 'Submit your exam?')) finish()
  }

  return (
    <div className="exam-shell" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <header className="exam-bar">
        <div><b>{paper.title}</b><div className="muted small">{answered}/{paper.questions.length} answered</div></div>
        <NetBadge online={online} />
        <div className={`timer ${remaining < 60000 ? 'urgent' : ''}`}>⏱ {formatTime(remaining)}</div>
        <button className="btn primary" onClick={submit}>Submit</button>
      </header>

      <div className="exam-body">
        <aside className="palette">
          {paper.questions.map((pq, i) => (
            <button key={pq.id}
              className={`${i === session.current ? 'current' : ''} ${session.answers[pq.id] ? 'answered' : ''}`}
              onClick={() => update(() => ({ current: i }))}>{i + 1}</button>
          ))}
        </aside>

        <section className="card question-pane">
          <p className="muted small">Question {session.current + 1} of {paper.questions.length}</p>
          <h3>{q.question}</h3>
          <div className="choices">
            {q.options.map((o, i) => (
              <label key={o.id} className={`choice ${session.answers[q.id] === o.id ? 'chosen' : ''}`}>
                <input type="radio" name={q.id} checked={session.answers[q.id] === o.id}
                  onChange={() => update((s) => ({ answers: { ...s.answers, [q.id]: o.id } }))} />
                <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                <span>{o.text}</span>
              </label>
            ))}
          </div>
          <div className="row between">
            <button className="btn ghost" disabled={session.current === 0}
              onClick={() => update((s) => ({ current: s.current - 1 }))}>← Previous</button>
            {session.answers[q.id] && (
              <button className="btn ghost sm" onClick={() => update((s) => {
                const { [q.id]: _, ...rest } = s.answers
                return { answers: rest }
              })}>Clear answer</button>
            )}
            {session.current < paper.questions.length - 1
              ? <button className="btn primary" onClick={() => update((s) => ({ current: s.current + 1 }))}>Next →</button>
              : <button className="btn primary" onClick={submit}>Finish & submit</button>}
          </div>
        </section>
      </div>

      {blocked && (
        <div className="block-overlay">
          <div className="card narrow center">
            <div className="big-icon">🚫</div>
            <h2>Internet detected</h2>
            <p>Turn off Wi-Fi / mobile data to continue. This has been recorded and your teacher will see it.</p>
            <p className="muted small">The timer is still running: {formatTime(remaining)} left.</p>
          </div>
        </div>
      )}
    </div>
  )
}
