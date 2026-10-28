import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentPicker from '../../components/StudentPicker'
import { api } from '../../lib/api'

function AssignModal({ exam, onClose }) {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(exam.assigned_student_ids)
  const [error, setError] = useState('')

  useEffect(() => { api.listStudents().then(setStudents).catch((e) => setError(e.message)) }, [])

  const save = async () => {
    try {
      await api.assignExam(exam.id, selected)
      onClose(true)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false) }}>
      <div className="card modal">
        <h3>Assign “{exam.title}”</h3>
        {error && <div className="alert error">{error}</div>}
        <StudentPicker students={students} selected={selected} onChange={setSelected} />
        <div className="row gap end">
          <button className="btn ghost" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn primary" onClick={save}>Save assignment</button>
        </div>
      </div>
    </div>
  )
}

export default function Exams() {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(null)

  const load = () => api.listExams().then(setExams).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const remove = async (exam) => {
    if (!confirm(`Delete "${exam.title}" and all student attempts?`)) return
    await api.deleteExam(exam.id)
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Exams & results</h2>
          <p className="muted">Create exams from the Question bank. Assign them to students and review scores here.</p>
        </div>
        <Link className="btn primary" to="/teacher/questions">+ New exam</Link>
      </div>
      {loading ? <p className="muted">Loading…</p> : exams.length === 0 ? (
        <div className="empty card">No exams yet.</div>
      ) : (
        <div className="grid">
          {exams.map((e) => (
            <div className="card" key={e.id}>
              <h3>{e.title}</h3>
              <p className="muted small">
                {e.duration_minutes} min · {e.total_marks} marks · {e.auto_publish ? 'auto-publish' : 'teacher publishes'}
              </p>
              <div className="stat-row">
                <div><b>{e.num_assigned}</b><span>assigned</span></div>
                <div><b>{e.num_submitted}</b><span>submitted</span></div>
              </div>
              <div className="row gap">
                <Link className="btn primary sm" to={`/teacher/exams/${e.id}`}>Results & grading</Link>
                <button className="btn ghost sm" onClick={() => setAssigning(e)}>Assign</button>
                <button className="btn danger sm" onClick={() => remove(e)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {assigning && <AssignModal exam={assigning} onClose={(changed) => { setAssigning(null); if (changed) load() }} />}
    </>
  )
}
