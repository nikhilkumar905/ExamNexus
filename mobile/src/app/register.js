import { Link, Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Brand, Button, Card, Field, Muted, Screen, Segmented } from '../components/ui'
import { useAuth } from '../lib/auth'
import { colors } from '../theme'

export default function Register() {
  const { user, register } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', teacher_code: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setForm({ ...form, [k]: v })

  if (user) return <Redirect href={`/${user.role}`} />

  const submit = async () => {
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setBusy(true)
    setError('')
    try {
      const u = await register({ ...form, email: form.email.trim(), teacher_code: form.teacher_code || null })
      router.replace(`/${u.role}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen safe style={{ maxWidth: 440, paddingTop: 24 }}>
      <Card>
        <Brand />
        <Muted style={{ textAlign: 'center' }}>Create your account</Muted>
        {error ? <Alert>{error}</Alert> : null}
        <Segmented value={form.role} onChange={set('role')}
          options={[{ value: 'student', label: "I'm a student" }, { value: 'teacher', label: "I'm a teacher" }]} />
        <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" />
        <Field label="Email" value={form.email} onChangeText={set('email')}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
        <Field label="Password" hint="(at least 6 characters)" value={form.password} onChangeText={set('password')}
          secureTextEntry autoComplete="new-password" />
        {form.role === 'teacher' && (
          <Field label="Teacher invite code" hint="(if your admin set one)" value={form.teacher_code}
            onChangeText={set('teacher_code')} autoCapitalize="none" />
        )}
        <Button block title={busy ? 'Creating…' : 'Create account'} loading={busy}
          disabled={!form.name || !form.email || !form.password} onPress={submit} />
        <Muted style={{ textAlign: 'center' }}>
          Already registered? <Link href="/login" style={{ color: colors.primary, fontWeight: '600' }}>Log in</Link>
        </Muted>
      </Card>
    </Screen>
  )
}
