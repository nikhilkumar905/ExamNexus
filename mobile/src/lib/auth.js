import { createContext, useContext, useEffect, useState } from 'react'
import { api, setAuthToken, setUnauthorizedHandler } from './api'
import { storage } from './storage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // The user comes from storage, not the network, so the app keeps working offline during an exam.
  const [auth, setAuth] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    storage.get('auth').then((saved) => {
      setAuthToken(saved?.token ?? null)
      setAuth(saved)
      setReady(true)
    })
    setUnauthorizedHandler(() => {
      storage.remove('auth')
      setAuthToken(null)
      setAuth(null)
    })
  }, [])

  const save = async (data) => {
    await storage.set('auth', data)
    setAuthToken(data.token)
    setAuth(data)
    return data.user
  }

  const value = {
    ready,
    user: auth?.user ?? null,
    login: async (email, password) => save(await api.login({ email, password })),
    register: async (body) => save(await api.register(body)),
    logout: async () => {
      await storage.remove('auth')
      setAuthToken(null)
      setAuth(null)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
