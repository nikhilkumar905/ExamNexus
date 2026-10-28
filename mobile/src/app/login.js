import { Link, Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Brand, Button, Card, Field, Muted, Screen } from '../components/ui'
import { API_URL } from '../lib/api'
import { useAuth } from '../lib/auth'
import { colors } from '../theme'

export default function Login() {
  const { user, login } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Redirect href={`/${user.role}`} />

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const u = await login(form.email.trim(), form.password)
      router.replace(`/${u.role}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen safe style={{ maxWidth: 440, paddingTop: 40 }}>
      <Card>
        <Brand />
        <Muted style={{ textAlign: 'center' }}>Log in to continue</Muted>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={form.password} onChangeText={(password) => setForm({ ...form, password })}
          secureTextEntry autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        <Button block title={busy ? 'Logging in…' : 'Log in'} loading={busy}
          disabled={!form.email || !form.password} onPress={submit} />
        <Muted style={{ textAlign: 'center' }}>
          No account? <Link href="/register" style={{ color: colors.primary, fontWeight: '600' }}>Register</Link>
        </Muted>
      </Card>
      <Muted small style={{ textAlign: 'center' }}>Server: {API_URL}</Muted>
    </Screen>
  )
}
