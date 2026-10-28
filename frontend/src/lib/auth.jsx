import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { storage } from './storage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // The user comes from storage, not the network, so the app keeps working offline during an exam.
  const [auth, setAuth] = useState(() => storage.get('auth'))

  useEffect(() => {
    const onLogout = () => setAuth(null)
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const save = (data) => {
    storage.set('auth', data)
    setAuth(data)
    return data.user
  }

  const value = {
    user: auth?.user ?? null,
    login: async (email, password) => save(await api.login({ email, password })),
    register: async (body) => save(await api.register(body)),
    logout: () => {
      storage.remove('auth')
      setAuth(null)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
