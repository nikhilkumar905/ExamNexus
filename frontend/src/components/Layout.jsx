import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const LINKS = {
  teacher: [
    { to: '/teacher', label: 'Documents', end: true },
    { to: '/teacher/questions', label: 'Question bank' },
    { to: '/teacher/exams', label: 'Exams & results' },
  ],
  student: [
    { to: '/student', label: 'My exams', end: true },
    { to: '/student/results', label: 'My results' },
  ],
}

export default function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          PDF<span>Exam</span>
          <small className="role-chip">{user.role === 'teacher' ? 'Teacher panel' : 'Student panel'}</small>
        </div>
        <nav>
          {LINKS[user.role].map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="user">
          <span>{user.name}</span>
          <button className="btn ghost sm" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
