// Offline exam flow (same state machine as the website's TakeExam.jsx):
//   download    -> (online) student downloads the paper
//   go_offline  -> questions stay hidden until the internet is off; timer starts when it is
//   in_progress -> answering offline; reconnecting or leaving the app is logged as a violation
//   submitted   -> answers saved on the phone, waiting for the internet to come back to upload
//   done        -> uploaded and graded on the server
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { confirm } from '../../components/confirm'
import { Alert, Body, Button, Card, H1, H2, Loading, Muted, NetBadge, Row } from '../../components/ui'
import { api } from '../../lib/api'
import { useInternet } from '../../lib/connectivity'
import { examStore } from '../../lib/examStore'
import { colors, radius, useLayout } from '../../theme'

const pad = (n) => String(n).padStart(2, '0')
const formatTime = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function Centered({ children }) {
  const { gutter } = useLayout()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: gutter }}>
        <Card style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 }}>{children}</Card>
      </ScrollView>
    </SafeAreaView>
  )
}

function BigIcon({ children }) {
  return <Text style={{ fontSize: 48, textAlign: 'center' }}>{children}</Text>
}

export default function TakeExam() {
  const { examId } = useLocalSearchParams()
  const router = useRouter()
  const layout = useLayout()
  const { fs, gutter } = layout
  const online = useInternet(2000)
  const [session, setSession] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sync, setSync] = useState({ state: 'idle', result: null, error: '' })
  const [now, setNow] = useState(Date.now())
  const prevOnline = useRef(online)
  const sessionRef = useRef(null)
  const finishing = useRef(false)
  sessionRef.current = session

  const phase = session?.phase ?? 'download'

  useEffect(() => {
    examStore.getSession(examId).then((s) => { setSession(s); setLoaded(true) })
  }, [examId])

  // Every change is persisted so closing the app never loses answers.
  const update = useCallback((fn) => {
    setSession((s) => {
      const next = { ...s, ...fn(s) }
      examStore.saveSession(examId, next)
      return next
    })
  }, [examId])

  const addViolation = useCallback((type) => {
    update((s) => ({ violations: [...s.violations, { type, at: new Date().toISOString() }] }))
  }, [update])

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const paper = await api.startExam(examId)
      const fresh = { phase: 'go_offline', paper, answers: {}, violations: [], offline_started_at: null, current: 0 }
      await examStore.saveSession(examId, fresh)
      setSession(fresh)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const finish = useCallback(async () => {
    const s = sessionRef.current
    if (!s || s.phase !== 'in_progress' || finishing.current) return
    finishing.current = true
    const payload = {
      answers: s.answers,
      offline_started_at: s.offline_started_at,
      submitted_at: new Date().toISOString(),
      violations: s.violations,
    }
    // Save the submission before switching phase, so the upload always finds it
    await examStore.addPending({ attempt_id: s.paper.attempt_id, exam_id: examId, payload })
    update(() => ({ phase: 'submitted' }))
  }, [update, examId])

  // Start the exam as soon as the internet goes off.
  useEffect(() => {
    if (phase === 'go_offline' && online === false) {
      update(() => ({ phase: 'in_progress', offline_started_at: new Date().toISOString() }))
    }
  }, [phase, online, update])

  // Log reconnecting during the exam (once per transition to online, incl. after reopening the app).
  useEffect(() => {
    if (phase === 'in_progress' && online === true && prevOnline.current !== true) addViolation('went_online')
    prevOnline.current = online
  }, [online, phase, addViolation])

  // Log leaving the app, and block the Android back button during the exam.
  useEffect(() => {
    if (phase !== 'in_progress') return
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'background') addViolation('tab_hidden')
    })
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => {
      appSub.remove()
      backSub.remove()
    }
  }, [phase, addViolation])

  // Timer, counted from the moment the student went offline.
  const deadline = session?.offline_started_at
    ? new Date(session.offline_started_at).getTime() + session.paper.duration_minutes * 60000
    : null
  useEffect(() => {
    if (phase !== 'in_progress') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (phase === 'in_progress' && deadline && now >= deadline) finish()
  }, [phase, deadline, now, finish])

  // Upload as soon as the internet is back.
  const upload = useCallback(async () => {
    setSync({ state: 'syncing', result: null, error: '' })
    try {
      const result = await examStore.syncOne(sessionRef.current.paper.attempt_id)
      setSync({ state: 'done', result, error: '' })
      setSession((s) => ({ ...s, phase: 'done' })) // stored session was cleared by syncOne
    } catch (e) {
      setSync({ state: 'error', result: null, error: e.message })
    }
  }, [])

  useEffect(() => {
    if (phase === 'submitted' && online === true && sync.state === 'idle') upload()
  }, [phase, online, sync.state, upload])

  // ---------- screens ----------

  if (!loaded) return <Loading />

  if (phase === 'download') {
    const rules = [
      'Tap Download paper while you are connected to the internet.',
      'Then turn off Wi-Fi and mobile data (Airplane mode works). The questions appear and the timer starts only once you are offline.',
      "Don't reconnect or switch to another app during the exam. Both are recorded and shown to your teacher.",
      'Keep this app open until you submit.',
      'After you submit, turn the internet back on and your answers upload automatically.',
    ]
    return (
      <Centered>
        <H1>Before you begin</H1>
        {rules.map((r, i) => <Body key={i}>{i + 1}. {r}</Body>)}
        {error ? <Alert>{error}</Alert> : null}
        <NetBadge online={online} />
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button variant="ghost" title="Back" onPress={() => router.back()} />
          <Button title={busy ? 'Downloading…' : 'Download paper'} loading={busy} disabled={online === false} onPress={download} />
        </Row>
        {online === false && <Muted small>You're offline. Connect to download the paper.</Muted>}
      </Centered>
    )
  }

  const { paper } = session

  if (phase === 'go_offline') {
    return (
      <Centered>
        <BigIcon>📴</BigIcon>
        <H2 style={{ textAlign: 'center' }}>Paper downloaded. Now turn off your internet.</H2>
        <Muted style={{ textAlign: 'center' }}>
          Turn off Wi-Fi and mobile data, or switch on Airplane mode. “{paper.title}” has {paper.questions.length} questions
          and {paper.duration_minutes} minutes. The timer starts the moment you go offline.
        </Muted>
        <View style={{ alignItems: 'center' }}><NetBadge online={online} /></View>
        <Muted small style={{ textAlign: 'center' }}>Waiting for the connection to drop…</Muted>
      </Centered>
    )
  }

  if (phase === 'submitted' || phase === 'done') {
    const done = phase === 'done'
    return (
      <Centered>
        <BigIcon>{done ? '✅' : '📶'}</BigIcon>
        {done ? (
          <>
            <H2 style={{ textAlign: 'center' }}>Exam submitted</H2>
            <Muted style={{ textAlign: 'center' }}>Your answers were uploaded and graded.</Muted>
            {sync.result?.published
              ? <Button title="See my score" onPress={() => router.replace('/student/results')} />
              : <Body style={{ textAlign: 'center' }}>Your teacher will review and publish your score.</Body>}
            <Button variant="ghost" title="Back to my exams" onPress={() => router.replace('/student')} />
          </>
        ) : (
          <>
            <H2 style={{ textAlign: 'center' }}>Answers saved. Turn your internet back ON.</H2>
            <Muted style={{ textAlign: 'center' }}>Your answers are stored on this phone and upload automatically once you're online.</Muted>
            <View style={{ alignItems: 'center' }}><NetBadge online={online} /></View>
            {sync.state === 'syncing' && <Body style={{ textAlign: 'center' }}>Uploading…</Body>}
            {sync.state === 'error' && (
              <>
                <Alert>{sync.error}</Alert>
                <Button title="Retry upload" onPress={upload} />
              </>
            )}
          </>
        )}
      </Centered>
    )
  }

  // phase === 'in_progress'
  const q = paper.questions[session.current]
  const answered = Object.keys(session.answers).length
  const remaining = deadline - now
  const blocked = online === true
  const sidePalette = layout.width >= 700

  const submit = async () => {
    const left = paper.questions.length - answered
    if (await confirm('Submit exam?', left ? `You have ${left} unanswered question(s). Submit anyway?` : 'Submit your exam now?', 'Submit')) finish()
  }

  const paletteButtons = paper.questions.map((pq, i) => {
    const isCurrent = i === session.current
    const isAnswered = !!session.answers[pq.id]
    return (
      <Pressable key={pq.id} onPress={() => update(() => ({ current: i }))} style={{
        width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
        borderColor: isCurrent ? colors.primary : isAnswered ? colors.green : colors.border,
        backgroundColor: isAnswered ? colors.greenSoft : colors.surface,
      }}>
        <Text style={{ fontWeight: '700', fontSize: fs(14), color: isAnswered ? colors.green : colors.text }}>{i + 1}</Text>
      </Pressable>
    )
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: gutter, paddingVertical: 10, gap: 8 }}>
        <Row between>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Body style={{ fontWeight: '700' }} numberOfLines={1}>{paper.title}</Body>
            <Muted small>{answered}/{paper.questions.length} answered</Muted>
          </View>
          <Text style={{ fontSize: fs(20), fontWeight: '800', fontVariant: ['tabular-nums'], color: remaining < 60000 ? colors.red : colors.text }}>
            ⏱ {formatTime(remaining)}
          </Text>
        </Row>
        <Row between>
          <NetBadge online={online} />
          <Button small title="Submit" onPress={submit} />
        </Row>
      </View>

      <View style={{ flex: 1, flexDirection: sidePalette ? 'row' : 'column' }}>
        {sidePalette ? (
          <ScrollView style={{ width: 160, flexGrow: 0, borderRightWidth: 1, borderRightColor: colors.border }}
            contentContainerStyle={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {paletteButtons}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 10, gap: 8 }}>
            {paletteButtons}
          </ScrollView>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: gutter, paddingTop: sidePalette ? gutter : 0 }}>
          <Card style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 14 }}>
            <Muted small>Question {session.current + 1} of {paper.questions.length}</Muted>
            <Text style={{ fontSize: fs(18), fontWeight: '700', color: colors.text, lineHeight: fs(25) }}>{q.question}</Text>
            <View style={{ gap: 10 }}>
              {q.options.map((o, i) => {
                const chosen = session.answers[q.id] === o.id
                return (
                  <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: chosen }}
                    onPress={() => update((s) => ({ answers: { ...s.answers, [q.id]: o.id } }))}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius, borderWidth: 2,
                      borderColor: chosen ? colors.primary : colors.border,
                      backgroundColor: chosen ? colors.primarySoft : pressed ? colors.bg : colors.surface,
                    })}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: chosen ? colors.primary : colors.bg,
                    }}>
                      <Text style={{ fontWeight: '700', color: chosen ? colors.white : colors.muted }}>{String.fromCharCode(65 + i)}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: fs(15.5), color: colors.text, lineHeight: fs(22) }}>{o.text}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Row between>
              <Button variant="ghost" title="← Previous" disabled={session.current === 0}
                onPress={() => update((s) => ({ current: s.current - 1 }))} />
              {session.answers[q.id] ? (
                <Button small variant="ghost" title="Clear" onPress={() => update((s) => {
                  const { [q.id]: _removed, ...rest } = s.answers
                  return { answers: rest }
                })} />
              ) : null}
              {session.current < paper.questions.length - 1
                ? <Button title="Next →" onPress={() => update((s) => ({ current: s.current + 1 }))} />
                : <Button title="Finish & submit" onPress={submit} />}
            </Row>
          </Card>
        </ScrollView>
      </View>

      {blocked && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,20,.88)', justifyContent: 'center', padding: gutter }}>
          <Card style={{ maxWidth: 480, alignSelf: 'center', width: '100%', alignItems: 'center' }}>
            <BigIcon>🚫</BigIcon>
            <H2 style={{ textAlign: 'center' }}>Internet detected</H2>
            <Body style={{ textAlign: 'center' }}>Turn off Wi-Fi and mobile data to continue. This has been recorded and your teacher will see it.</Body>
            <Muted small>The timer is still running: {formatTime(remaining)} left.</Muted>
          </Card>
        </View>
      )}
    </SafeAreaView>
  )
}
