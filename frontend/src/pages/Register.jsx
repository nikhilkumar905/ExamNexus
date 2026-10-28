import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', teacher_code: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await register({ ...form, teacher_code: form.teacher_code || null })
      navigate(`/${user.role}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>PDF<span>Exam</span></h1>
        <p className="muted">Create your account</p>
        {error && <div className="alert error">{error}</div>}
        <div className="segmented">
          {['student', 'teacher'].map((r) => (
            <button type="button" key={r} className={form.role === r ? 'active' : ''} onClick={() => setForm({ ...form, role: r })}>
              I'm a {r}
            </button>
          ))}
        </div>
        <label>Full name<input required value={form.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
        <label>Password<input type="password" required minLength={6} value={form.password} onChange={set('password')} /></label>
        {form.role === 'teacher' && (
          <label>Teacher invite code <small className="muted">(if your admin set one)</small>
            <input value={form.teacher_code} onChange={set('teacher_code')} />
          </label>
        )}
        <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="muted center">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  )
}
