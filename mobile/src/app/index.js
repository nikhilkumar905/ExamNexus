import { Redirect } from 'expo-router'
import { Loading } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Index() {
  const { ready, user } = useAuth()
  if (!ready) return <Loading />
  return <Redirect href={user ? `/${user.role}` : '/login'} />
}
