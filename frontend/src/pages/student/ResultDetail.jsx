import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'

export default function ResultDetail() {
  const { attemptId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.resultDetail(attemptId).then(setData).catch((e) => setError(e.message)) }, [attemptId])

  if (error) return <div className="alert error">{error}</div>
  if (!data) return <p className="muted">Loading…</p>

  return (
    <>
      <Link to="/student/results" className="muted small">← My results</Link>
      <div className="page-head">
        <div>
          <h2>{data.title}</h2>
          <p className="muted">{data.correct_count} of {data.total_questions} correct</p>
        </div>
        <div className="score-big">{data.score}<small> / {data.total_marks}</small></div>
      </div>
      {data.remarks && <div className="alert info">Teacher's remarks: {data.remarks}</div>}
      {data.review.map((q, i) => {
        const right = q.chosen === q.correct_option_id
        return (
          <div className="card question" key={q.id}>
            <div className="row between top">
              <strong>Q{i + 1}. {q.question}</strong>
              <span className={`tag ${right ? 'green' : q.chosen ? 'red' : ''}`}>{right ? 'Correct' : q.chosen ? 'Wrong' : 'Skipped'}</span>
            </div>
            <ul className="options">
              {q.options.map((o) => (
                <li key={o.id} className={o.id === q.correct_option_id ? 'correct' : o.id === q.chosen ? 'wrong' : ''}>
                  {o.text}
                  {o.id === q.chosen && <span className="muted small"> (your answer)</span>}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="muted small">💡 {q.explanation}</p>}
          </div>
        )
      })}
    </>
  )
}
