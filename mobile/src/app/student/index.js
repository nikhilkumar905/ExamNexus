import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Button, Card, Empty, Grid, H2, Loading, Muted, PageHead, Row, Screen, Tag } from '../../components/ui'
import { api } from '../../lib/api'
import { hasInternet } from '../../lib/connectivity'
import { examStore } from '../../lib/examStore'

const STATUS = {
  not_started: { label: 'Not started', tone: 'default' },
  started: { label: 'In progress', tone: 'amber' },
  submitted: { label: 'Submitted', tone: 'green' },
}

export default function StudentDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState([])
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(0)

  const load = useCallback(async () => {
    // Upload any answers that were saved offline but never reached the server
    if ((await examStore.pending()).length && (await hasInternet())) await examStore.syncAll()
    setPending((await examStore.pending()).length)
    try {
      const list = await api.myExams()
      const sessions = await Promise.all(list.map((e) => examStore.getSession(e.id)))
      setSaved(Object.fromEntries(list.map((e, i) => [e.id, !!sessions[i]])))
      setExams(list)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])
  useFocusEffect(useCallback(() => { load() }, [load]))

  return (
    <Screen onRefresh={() => { setRefreshing(true); load() }} refreshing={refreshing}>
      <PageHead title="My exams" subtitle="You'll need to switch off your internet while taking an exam." />
      {pending > 0 && (
        <Alert tone="amber">
          {pending} submitted exam(s) are saved on this phone but not uploaded yet. Turn on the internet and pull down to refresh.
        </Alert>
      )}
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <Loading /> : exams.length === 0 ? (
        <Empty>No exams assigned to you yet.</Empty>
      ) : (
        <Grid>
          {exams.map((e) => {
            const st = STATUS[e.status]
            return (
              <Card key={e.id}>
                <Row between>
                  <H2 style={{ flex: 1 }}>{e.title}</H2>
                  <Tag tone={st.tone} label={st.label} />
                </Row>
                <Muted small>By {e.teacher} · {e.duration_minutes} min · {e.total_marks} marks</Muted>
                {e.status === 'submitted' ? (
                  e.published
                    ? <Button small title="View result" onPress={() => router.push(`/result/${e.attempt_id}`)} style={{ alignSelf: 'flex-start' }} />
                    : <Muted small>Waiting for your teacher to publish the score</Muted>
                ) : (
                  <Button small style={{ alignSelf: 'flex-start' }}
                    title={e.status === 'started' || saved[e.id] ? 'Continue exam' : 'Start exam'}
                    onPress={() => router.push(`/take-exam/${e.id}`)} />
                )}
              </Card>
            )
          })}
        </Grid>
      )}
    </Screen>
  )
}
