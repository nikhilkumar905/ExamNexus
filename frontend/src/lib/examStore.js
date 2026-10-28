// Persists an in-progress exam and finished-but-not-uploaded submissions,
// so a page refresh or a failed upload never loses the student's answers.
import { api } from './api'
import { storage } from './storage'

const sessionKey = (examId) => `exam_session:${examId}`
const PENDING_KEY = 'pending_submissions'

export const examStore = {
  getSession: (examId) => storage.get(sessionKey(examId)),
  saveSession: (examId, session) => storage.set(sessionKey(examId), session),
  clearSession: (examId) => storage.remove(sessionKey(examId)),

  pending: () => storage.get(PENDING_KEY, []),
  addPending(entry) {
    const list = this.pending().filter((p) => p.attempt_id !== entry.attempt_id)
    storage.set(PENDING_KEY, [...list, entry])
  },
  removePending(attemptId) {
    storage.set(PENDING_KEY, this.pending().filter((p) => p.attempt_id !== attemptId))
  },

  /** Upload one pending submission. Returns the server response. */
  async syncOne(attemptId) {
    const entry = this.pending().find((p) => p.attempt_id === attemptId)
    if (!entry) return null
    const res = await api.submitAttempt(attemptId, entry.payload)
    this.removePending(attemptId)
    this.clearSession(entry.exam_id)
    return res
  },

  /** Try to upload everything pending. Returns the number uploaded. */
  async syncAll() {
    let done = 0
    for (const p of this.pending()) {
      try {
        await this.syncOne(p.attempt_id)
        done++
      } catch (e) {
        // Attempt or exam was deleted on the server: nothing left to retry
        if (e.status === 404) this.removePending(p.attempt_id)
      }
    }
    return done
  },
}
