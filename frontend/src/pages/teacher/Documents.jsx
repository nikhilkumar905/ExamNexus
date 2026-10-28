import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

function GenerateForm({ doc, onDone }) {
  const [form, setForm] = useState({ num_questions: 10, topic: '', difficulty: 'medium' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const qs = await api.generateQuestions(doc.id, {
        ...form,
        num_questions: Number(form.num_questions),
        topic: form.topic.trim() || null,
      })
      setMsg({ type: 'success', text: `Generated ${qs.length} verified question${qs.length === 1 ? '' : 's'}.` })
      onDone()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="generate-form" onSubmit={submit}>
      <label>Questions
        <input type="number" min={1} max={50} value={form.num_questions}
          onChange={(e) => setForm({ ...form, num_questions: e.target.value })} />
      </label>
      <label className="grow">Topic / focus <small className="muted">(optional, used for retrieval)</small>
        <input placeholder="e.g. photosynthesis, chapter 3…" value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })} />
      </label>
      <label>Difficulty
        <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <button className="btn primary" disabled={busy}>{busy ? 'Generating…' : 'Generate MCQs'}</button>
      {msg && <div className={`alert ${msg.type} full`}>{msg.text}</div>}
    </form>
  )
}

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const load = () =>
    api.listDocuments().then(setDocs).catch((e) => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      await api.uploadDocument(file)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const remove = async (doc) => {
    if (!confirm(`Delete "${doc.filename}" and all ${doc.num_questions} questions generated from it?`)) return
    await api.deleteDocument(doc.id).catch((e) => setError(e.message))
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Documents</h2>
          <p className="muted">Upload a PDF, then generate multiple-choice questions from it with RAG.</p>
        </div>
        <label className={`btn primary ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Processing PDF…' : 'Upload PDF'}
          <input type="file" accept="application/pdf" hidden onChange={upload} disabled={uploading} />
        </label>
      </div>
      {error && <div className="alert error">{error}</div>}
      {loading ? <p className="muted">Loading…</p> : docs.length === 0 ? (
        <div className="empty card">No documents yet. Upload a text-based PDF to get started.</div>
      ) : (
        docs.map((doc) => (
          <div className="card" key={doc.id}>
            <div className="row between">
              <div>
                <h3>{doc.filename}</h3>
                <p className="muted small">
                  {doc.num_pages} pages · {doc.num_chunks} chunks indexed · {doc.num_questions} questions
                </p>
              </div>
              <div className="row gap">
                <Link className="btn ghost sm" to={`/teacher/questions?doc=${doc.id}`}>View questions</Link>
                <button className="btn danger sm" onClick={() => remove(doc)}>Delete</button>
              </div>
            </div>
            <GenerateForm doc={doc} onDone={load} />
          </div>
        ))
      )}
    </>
  )
}
