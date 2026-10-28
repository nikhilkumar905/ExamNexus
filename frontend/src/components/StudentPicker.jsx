import { useState } from 'react'

export default function StudentPicker({ students, selected, onChange }) {
  const [filter, setFilter] = useState('')
  const shown = students.filter((s) =>
    `${s.name} ${s.email}`.toLowerCase().includes(filter.toLowerCase()),
  )
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const allShown = shown.length > 0 && shown.every((s) => selected.includes(s.id))

  if (students.length === 0) return <p className="muted small">No students have registered yet.</p>
  return (
    <div className="picker">
      <div className="row gap">
        <input placeholder="Search students…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button type="button" className="btn ghost sm" onClick={() =>
          onChange(allShown
            ? selected.filter((id) => !shown.some((s) => s.id === id))
            : [...new Set([...selected, ...shown.map((s) => s.id)])])}>
          {allShown ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div className="picker-list">
        {shown.map((s) => (
          <label key={s.id} className="check">
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
            <span>{s.name} <small className="muted">{s.email}</small></span>
          </label>
        ))}
      </div>
      <p className="muted small">{selected.length} selected</p>
    </div>
  )
}
