import { storage } from './storage'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = storage.get('auth')?.token
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) {
      storage.remove('auth')
      window.dispatchEvent(new Event('auth:logout'))
    }
    const detail = data?.detail
    const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : detail
    throw new ApiError(msg || `Request failed (${res.status})`, res.status)
  }
  return data
}

export const api = {
  // auth
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),

  // teacher: documents & questions
  listDocuments: () => request('/api/documents'),
  uploadDocument: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/documents/upload', { method: 'POST', form })
  },
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: 'DELETE' }),
  generateQuestions: (id, body) => request(`/api/documents/${id}/generate`, { method: 'POST', body }),
  listQuestions: (documentId) =>
    request(`/api/questions${documentId ? `?document_id=${documentId}` : ''}`),
  updateQuestion: (id, body) => request(`/api/questions/${id}`, { method: 'PUT', body }),
  deleteQuestion: (id) => request(`/api/questions/${id}`, { method: 'DELETE' }),

  // teacher: exams
  listStudents: () => request('/api/students'),
  createExam: (body) => request('/api/exams', { method: 'POST', body }),
  listExams: () => request('/api/exams'),
  assignExam: (id, studentIds) =>
    request(`/api/exams/${id}/assign`, { method: 'PUT', body: { student_ids: studentIds } }),
  deleteExam: (id) => request(`/api/exams/${id}`, { method: 'DELETE' }),
  examResults: (id) => request(`/api/exams/${id}/results`),
  gradeAttempt: (id, body) => request(`/api/attempts/${id}/grade`, { method: 'PUT', body }),
  publishAll: (id) => request(`/api/exams/${id}/publish-all`, { method: 'POST' }),

  // student
  myExams: () => request('/api/student/exams'),
  startExam: (examId) => request(`/api/student/exams/${examId}/start`, { method: 'POST' }),
  submitAttempt: (attemptId, body) =>
    request(`/api/student/attempts/${attemptId}/submit`, { method: 'POST', body }),
  myResults: () => request('/api/student/results'),
  resultDetail: (attemptId) => request(`/api/student/results/${attemptId}`),
}
