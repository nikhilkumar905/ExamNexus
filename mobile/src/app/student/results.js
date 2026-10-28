import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { Alert, Body, Button, Card, Empty, Grid, H2, Loading, Muted, PageHead, Screen, Tag } from '../../components/ui'
import { api } from '../../lib/api'
import { colors, useLayout } from '../../theme'

export default function StudentResults() {
  const router = useRouter()
  const { fs } = useLayout()
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() =>
    api.myResults().then((r) => { setResults(r); setError('') }).catch((e) => setError(e.message))
      .finally(() => setRefreshing(false)), [])
  useFocusEffect(useCallback(() => { load() }, [load]))

  if (error && !results) return <Screen><Alert>{error}</Alert></Screen>
  if (!results) return <Loading />

  const published = results.filter((r) => r.published)
  const avg = published.length
    ? Math.round(published.reduce((s, r) => s + (r.score / r.total_marks) * 100, 0) / published.length)
    : null

  return (
    <Screen onRefresh={() => { setRefreshing(true); load() }} refreshing={refreshing}>
      <PageHead title="My results"
        subtitle={avg !== null ? `Average across ${published.length} published exam(s): ${avg}%` : undefined} />
      {results.length === 0 ? <Empty>You haven't submitted any exams yet.</Empty> : (
        <Grid>
          {results.map((r) => {
            const pct = r.published ? Math.round((r.score / r.total_marks) * 100) : null
            return (
              <Card key={r.attempt_id}>
                <H2>{r.title}</H2>
                <Muted small>Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''}</Muted>
                {r.published ? (
                  <>
                    <Text style={{ fontSize: fs(30), fontWeight: '800', color: colors.text }}>
                      {r.score}<Text style={{ fontSize: fs(15), color: colors.muted, fontWeight: '400' }}> / {r.total_marks}</Text>
                    </Text>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' }}>
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct < 40 ? colors.red : colors.green }} />
                    </View>
                    {r.remarks ? <Body>Teacher: “{r.remarks}”</Body> : null}
                    <Button small variant="ghost" title="Review answers" style={{ alignSelf: 'flex-start' }}
                      onPress={() => router.push(`/result/${r.attempt_id}`)} />
                  </>
                ) : <Tag tone="amber" label="Awaiting teacher" />}
              </Card>
            )
          })}
        </Grid>
      )}
    </Screen>
  )
}
