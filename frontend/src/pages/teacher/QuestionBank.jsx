import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StudentPicker from '../../components/StudentPicker'
import { api } from '../../lib/api'

function QuestionCard({ q, index, selected, onToggle, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(q)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    try {
      const updated = await api.updateQuestion(q.id, {
        question: draft.question,
        options: draft.options,
        correct_option_id: draft.correct_option_id,
        explanation: draft.explanation || '',
      })
      onSaved(updated)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    }
  }

  const remove = async () => {
    if (!confirm('Delete this question?')) return
    await api.deleteQuestion(q.id)
    onDeleted(q.id)
  }

  if (editing) {
    return (
      <div className="card question editing">
        {error && <div className="alert error">{error}</div>}
        <label>Question<textarea rows={2} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></label>
        {draft.options.map((o, i) => (
          <div className="row gap option-edit" key={o.id}>
            <input type="radio" name={`correct-${q.id}`} checked={draft.correct_option_id === o.id}
              onChange={() => setDraft({ ...draft, correct_option_id: o.id })} title="Mark as correct" />
            <input className="grow" value={o.text} onChange={(e) => {
              const options = [...draft.options]
              options[i] = { ...o, text: e.target.value }
              setDraft({ ...draft, options })
            }} />
          </div>
        ))}
        <label>Explanation<textarea rows={2} value={draft.explanation || ''} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></label>
        <div className="row gap">
          <button className="btn primary sm" onClick={save}>Save</button>
          <button className="btn ghost sm" onClick={() => { setDraft(q); setEditing(false) }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`card question ${selected ? 'selected' : ''}`}>
      <div className="row between top">
        <label className="check">
          <input type="checkbox" checked={selected} onChange={onToggle} />
          <strong>Q{index + 1}. {q.question}</strong>
        </label>
        <div className="row gap nowrap">
          <button className="btn ghost sm" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn danger sm" onClick={remove}>Delete</button>
        </div>
      </div>
      <ul className="options">
        {q.options.map((o) => (
          <li key={o.id} className={o.id === q.correct_option_id ? 'correct' : ''}>
            <b>{o.id.toUpperCase()}.</b> {o.text}
          </li>
        ))}
      </ul>
      {q.explanation && <p className="muted small">💡 {q.explanation}</p>}
      <div className="tags">
        <span className="tag">{q.difficulty}</span>
        {q.verified && <span className="tag green">answer verified</span>}
        {q.edited && <span className="tag">edited</span>}
        {q.source_pages?.length > 0 && <span className="tag">pages {q.source_pages.join(', ')}</span>}
      </div>
    </div>
  )
}

function CreateExamPanel({ questionIds, onCancel }) {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ title: '', duration_minutes: 30, marks_per_question: 1, auto_publish: false })
  const [studentIds, setStudentIds] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.listStudents().then(setStudents).catch((e) => setError(e.message)) }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.createExam({
        ...form,
        duration_minutes: Number(form.duration_minutes),
        marks_per_question: Number(form.marks_per_question),
        question_ids: questionIds,
        student_ids: studentIds,
      })
      navigate('/teacher/exams')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <form className="card modal" onSubmit={submit}>
        <h3>Create exam with {questionIds.length} questions</h3>
        {error && <div className="alert error">{error}</div>}
        <label>Title<input required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <div className="row gap">
          <label className="grow">Duration (minutes)
            <input type="number" min={1} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          </label>
          <label className="grow">Marks per question
            <input type="number" min={0.25} step={0.25} value={form.marks_per_question} onChange={(e) => setForm({ ...form, marks_per_question: e.target.value })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.auto_publish} onChange={(e) => setForm({ ...form, auto_publish: e.target.checked })} />
          <span>Show score to students right after submission <small className="muted">(otherwise you review and publish)</small></span>
        </label>
        <h4>Assign to students</h4>
        <StudentPicker students={students} selected={studentIds} onChange={setStudentIds} />
        <div className="row gap end">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create & assign'}</button>
        </div>
      </form>
    </div>
  )
}

export default function QuestionBank() {
  const [params, setParams] = useSearchParams()
  const docId = params.get('doc') || ''
  const [docs, setDocs] = useState([])
  const [questions, setQuestions] = useState([])
  const [selected, setSelected] = useState([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.listDocuments().then(setDocs) }, [])
  useEffect(() => {
    setLoading(true)
    api.listQuestions(docId).then(setQuestions).finally(() => setLoading(false))
  }, [docId])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allSelected = questions.length > 0 && questions.every((q) => selected.includes(q.id))

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Question bank</h2>
          <p className="muted">Review generated questions (correct answer in green), edit if needed, then select questions to build an exam.</p>
        </div>
        <div className="row gap">
          <select value={docId} onChange={(e) => setParams(e.target.value ? { doc: e.target.value } : {})}>
            <option value="">All documents</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
          </select>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="toolbar card">
          <label className="check">
            <input type="checkbox" checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : questions.map((q) => q.id))} />
            <span>Select all ({questions.length})</span>
          </label>
          <button className="btn primary" disabled={!selected.length} onClick={() => setCreating(true)}>
            Create exam from {selected.length} selected
          </button>
        </div>
      )}

      {loading ? <p className="muted">Loading…</p> : questions.length === 0 ? (
        <div className="empty card">No questions yet. Generate some from the Documents page.</div>
      ) : (
        questions.map((q, i) => (
          <QuestionCard key={q.id} q={q} index={i} selected={selected.includes(q.id)} onToggle={() => toggle(q.id)}
            onSaved={(u) => setQuestions((qs) => qs.map((x) => (x.id === u.id ? u : x)))}
            onDeleted={(id) => { setQuestions((qs) => qs.filter((x) => x.id !== id)); setSelected((s) => s.filter((x) => x !== id)) }} />
        ))
      )}

      {creating && <CreateExamPanel questionIds={selected} onCancel={() => setCreating(false)} />}
    </>
  )
}
