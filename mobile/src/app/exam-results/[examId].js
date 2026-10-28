import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { confirm } from '../../components/confirm'
import OptionList from '../../components/OptionList'
import {
  Alert, Body, Button, Card, Checkbox, Field, Grid, H1, H2, Loading, Muted, Row, Screen, Tag,
} from '../../components/ui'
import { api } from '../../lib/api'
import { colors, useLayout } from '../../theme'

const FLAG_LABELS = {
  late_upload: 'Uploaded late',
  over_time: 'Exceeded time',
  never_offline: 'Never went offline',
  paper_redownloaded: 'Paper re-downloaded',
}
const VIOLATION_LABELS = { went_online: 'came back online', tab_hidden: 'left the exam' }
const fmt = (d) => (d ? new Date(d).toLocaleString() : '—')

function StatTile({ label, value, suffix }) {
  const { fs } = useLayout()
  return (
    <Card style={{ gap: 2 }}>
      <Muted small>{label}</Muted>
      <Text style={{ fontSize: fs(22), fontWeight: '700', color: colors.text }}>
        {value}{suffix ? <Text style={{ fontSize: fs(13), color: colors.muted, fontWeight: '400' }}> {suffix}</Text> : null}
      </Text>
    </Card>
  )
}

function Bar({ pct, low }) {
  return (
    <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: low ? colors.red : colors.green }} />
    </View>
  )
}

function GradeCard({ a, total, onSaved }) {
  const [score, setScore] = useState(String(a.final_score ?? a.auto_score ?? 0))
  const [remarks, setRemarks] = useState(a.remarks || '')
  const [published, setPublished] = useState(!!a.published)
  const [state, setState] = useState('')
  const [open, setOpen] = useState(false)

  if (a.status !== 'submitted') {
    return (
      <Card>
        <Body style={{ fontWeight: '700' }}>{a.student_name}</Body>
        <Muted small>{a.student_email}</Muted>
        <Row><Tag tone="amber" label="In progress" /><Muted small>downloaded {fmt(a.downloaded_at)}</Muted></Row>
      </Card>
    )
  }

  const save = async () => {
    setState('saving')
    try {
      await api.gradeAttempt(a.id, { final_score: Number(score), remarks, published })
      setState('saved')
      onSaved()
    } catch (e) {
      setState(e.message)
    }
  }

  const issues = (a.flags?.length || 0) + (a.violations?.length || 0)
  return (
    <Card>
      <Row between>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Body style={{ fontWeight: '700' }}>{a.student_name}</Body>
          <Muted small>{a.student_email}</Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Body><Text style={{ fontWeight: '700' }}>{a.auto_score}</Text> / {total}</Body>
          <Muted small>{a.correct_count}/{a.total_questions} correct</Muted>
        </View>
      </Row>
      {issues ? (
        <Button small variant="ghost" title={`⚠ ${issues} issue${issues > 1 ? 's' : ''} ${open ? '▲' : '▼'}`} onPress={() => setOpen(!open)} style={{ alignSelf: 'flex-start' }} />
      ) : <Tag tone="green" label="Clean" />}
      {open && (
        <View style={{ gap: 6, backgroundColor: colors.bg, borderRadius: 8, padding: 10 }}>
          <Muted small>Offline from {fmt(a.offline_started_at)} · submitted {fmt(a.submitted_at)} · uploaded {fmt(a.synced_at)}</Muted>
          <Row>{a.flags?.map((f) => <Tag key={f} tone="amber" label={FLAG_LABELS[f] || f} />)}</Row>
          {a.violations?.map((v, i) => <Muted key={i} small>• {fmt(v.at)}: {VIOLATION_LABELS[v.type] || v.type}</Muted>)}
        </View>
      )}
      <Row wrap={false} style={{ alignItems: 'flex-end' }}>
        <Field style={{ width: 100 }} label="Final score" keyboardType="decimal-pad" value={score} onChangeText={setScore} />
        <Field style={{ flex: 1 }} label="Remarks" placeholder="For the student" value={remarks} onChangeText={setRemarks} />
      </Row>
      <Row between>
        <Checkbox checked={published} onToggle={() => setPublished(!published)} label="Publish" />
        <Button small title={state === 'saving' ? 'Saving…' : 'Save'} loading={state === 'saving'} onPress={save} />
      </Row>
      {state && state !== 'saving' ? (
        <Text style={{ color: state === 'saved' ? colors.green : colors.red }}>{state === 'saved' ? 'Saved' : state}</Text>
      ) : null}
    </Card>
  )
}

export default function ExamResults() {
  const { examId } = useLocalSearchParams()
  const { fs, columns } = useLayout()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() =>
    api.examResults(examId).then(setData).catch((e) => setError(e.message)).finally(() => setRefreshing(false)), [examId])
  useEffect(() => { load() }, [load])

  if (error) return <Screen><Alert>{error}</Alert></Screen>
  if (!data) return <Loading />

  const { exam, stats, attempts, per_question, not_started } = data
  const total = exam.total_marks
  const maxBucket = Math.max(1, ...stats.distribution)

  const publishAll = async () => {
    if (!(await confirm('Publish all results?', 'Ungraded attempts will use their auto-calculated score.', 'Publish'))) return
    await api.publishAll(examId).catch((e) => setError(e.message))
    load()
  }

  return (
    <Screen onRefresh={() => { setRefreshing(true); load() }} refreshing={refreshing}>
      <Stack.Screen options={{ title: exam.title }} />
      <Row between>
        <View style={{ flex: 1, minWidth: 200 }}>
          <H1>{exam.title}</H1>
          <Muted>{exam.duration_minutes} min · {total} marks</Muted>
        </View>
        <Button title="Publish all results" onPress={publishAll} disabled={!stats.submitted} />
      </Row>

      <Grid columns={columns === 1 ? 2 : columns + 2}>
        <StatTile label="Submitted" value={`${stats.submitted}/${stats.assigned}`} />
        <StatTile label="Average" value={stats.average} suffix={`/ ${total}`} />
        <StatTile label="Highest" value={stats.highest} />
        <StatTile label="Lowest" value={stats.lowest} />
        <StatTile label="Pass rate (≥40%)" value={`${stats.pass_rate}%`} />
      </Grid>

      <Grid columns={columns === 1 ? 1 : 2}>
        <Card>
          <H2>Score distribution</H2>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 }}>
            {stats.distribution.map((n, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ fontSize: fs(11), color: colors.muted }}>{n || ''}</Text>
                <View style={{ width: '80%', height: `${(n / maxBucket) * 75}%`, minHeight: n ? 4 : 1, backgroundColor: colors.primary, borderRadius: 3 }} />
                <Text style={{ fontSize: fs(9.5), color: colors.muted, marginTop: 3 }}>{i * 10}</Text>
              </View>
            ))}
          </View>
          <Muted small>Score bands in %.</Muted>
        </Card>
        <Card>
          <H2>Question accuracy</H2>
          {per_question.map((q, i) => (
            <View key={q.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ width: 34, color: colors.muted, fontSize: fs(13) }}>Q{i + 1}</Text>
              <Bar pct={q.accuracy} low={q.accuracy < 40} />
              <Text style={{ width: 48, textAlign: 'right', fontSize: fs(13), color: colors.text }}>{q.accuracy}%</Text>
            </View>
          ))}
          <Muted small>Below 40% is shown in red.</Muted>
        </Card>
      </Grid>

      <H2>Students — review & assign scores</H2>
      {attempts.length === 0 ? <Muted>No attempts yet.</Muted> : (
        <Grid columns={columns === 1 ? 1 : 2}>
          {attempts.map((a) => <GradeCard key={a.id} a={a} total={total} onSaved={load} />)}
        </Grid>
      )}
      {not_started.length > 0 && <Muted small>Not started: {not_started.map((s) => s.name).join(', ')}</Muted>}

      <H2>Question breakdown</H2>
      {per_question.map((q, i) => (
        <Card key={q.id}>
          <Body style={{ fontWeight: '700' }}>Q{i + 1}. {q.question}</Body>
          <OptionList options={q.options} correctId={q.correct_option_id} picks={q.picks} />
        </Card>
      ))}
    </Screen>
  )
}
