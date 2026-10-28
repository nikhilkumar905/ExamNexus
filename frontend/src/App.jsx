// Pages are imported eagerly (no lazy loading) on purpose: once the app is
// loaded, every screen must keep working with the internet switched off.
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentResults from './pages/student/StudentResults'
import ResultDetail from './pages/student/ResultDetail'
import TakeExam from './pages/student/TakeExam'
import Documents from './pages/teacher/Documents'
import ExamResults from './pages/teacher/ExamResults'
import Exams from './pages/teacher/Exams'
import QuestionBank from './pages/teacher/QuestionBank'

function RequireRole({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  const home = user ? `/${user.role}` : '/login'

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={home} replace /> : <Register />} />

      <Route path="/teacher" element={<RequireRole role="teacher"><Layout /></RequireRole>}>
        <Route index element={<Documents />} />
        <Route path="questions" element={<QuestionBank />} />
        <Route path="exams" element={<Exams />} />
        <Route path="exams/:examId" element={<ExamResults />} />
      </Route>

      <Route path="/student" element={<RequireRole role="student"><Layout /></RequireRole>}>
        <Route index element={<StudentDashboard />} />
        <Route path="results" element={<StudentResults />} />
        <Route path="results/:attemptId" element={<ResultDetail />} />
      </Route>
      {/* Full-screen, outside the layout */}
      <Route path="/student/exam/:examId" element={<RequireRole role="student"><TakeExam /></RequireRole>} />

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  )
}
