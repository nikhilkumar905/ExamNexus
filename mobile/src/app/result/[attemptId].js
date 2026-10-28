import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import OptionList from '../../components/OptionList'
import { Alert, Body, Card, H1, Loading, Muted, Row, Screen, Tag } from '../../components/ui'
import { api } from '../../lib/api'
import { colors, useLayout } from '../../theme'

export default function ResultDetail() {
  const { attemptId } = useLocalSearchParams()
  const { fs } = useLayout()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.resultDetail(attemptId).then(setData).catch((e) => setError(e.message)) }, [attemptId])

  if (error) return <Screen><Alert>{error}</Alert></Screen>
  if (!data) return <Loading />

  return (
    <Screen>
      <Stack.Screen options={{ title: data.title }} />
      <Row between>
        <View style={{ flex: 1, minWidth: 180 }}>
          <H1>{data.title}</H1>
          <Muted>{data.correct_count} of {data.total_questions} correct</Muted>
        </View>
        <Text style={{ fontSize: fs(34), fontWeight: '800', color: colors.text }}>
          {data.score}<Text style={{ fontSize: fs(16), color: colors.muted, fontWeight: '400' }}> / {data.total_marks}</Text>
        </Text>
      </Row>
      {data.remarks ? <Alert tone="info">Teacher's remarks: {data.remarks}</Alert> : null}
      {data.review.map((q, i) => {
        const right = q.chosen === q.correct_option_id
        return (
          <Card key={q.id}>
            <Row between style={{ alignItems: 'flex-start' }} wrap={false}>
              <Body style={{ flex: 1, fontWeight: '700' }}>Q{i + 1}. {q.question}</Body>
              <Tag tone={right ? 'green' : q.chosen ? 'red' : 'default'} label={right ? 'Correct' : q.chosen ? 'Wrong' : 'Skipped'} />
            </Row>
            <OptionList options={q.options} correctId={q.correct_option_id} chosenId={q.chosen} />
            {q.explanation ? <Muted small>💡 {q.explanation}</Muted> : null}
          </Card>
        )
      })}
    </Screen>
  )
}
