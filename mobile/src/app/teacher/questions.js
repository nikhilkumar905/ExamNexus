import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { confirm } from '../../components/confirm'
import Sheet from '../../components/Sheet'
import StudentPicker from '../../components/StudentPicker'
import {
  Alert, Body, Button, Card, Checkbox, Empty, Field, H2, Loading, Muted, PageHead, Row, Screen, Tag,
} from '../../components/ui'
import OptionList from '../../components/OptionList'
import { api } from '../../lib/api'
import { colors, useLayout } from '../../theme'

function QuestionCard({ q, index, selected, onToggle, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(q)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    try {
      const updated = await api.updateQuestion(q.id, {
        question: draft.question,
        options: draft.options,
        correct_option_id: draft.correct_option_id,
        explanation: draft.explanation || '',
      })
      onSaved(updated)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    }
  }

  const remove = async () => {
    if (!(await confirm('Delete question?', q.question, 'Delete', true))) return
    await api.deleteQuestion(q.id)
    onDeleted(q.id)
  }

  if (editing) {
    return (
      <Card highlight>
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Question" multiline value={draft.question} onChangeText={(question) => setDraft({ ...draft, question })} />
        <Muted small>Tap the circle to mark the correct option.</Muted>
        {draft.options.map((o, i) => (
          <Row key={o.id} wrap={false}>
            <Checkbox radio checked={draft.correct_option_id === o.id} onToggle={() => setDraft({ ...draft, correct_option_id: o.id })} />
            <Field style={{ flex: 1 }} value={o.text} onChangeText={(text) => {
              const options = [...draft.options]
              options[i] = { ...o, text }
              setDraft({ ...draft, options })
            }} />
          </Row>
        ))}
        <Field label="Explanation" multiline value={draft.explanation || ''} onChangeText={(explanation) => setDraft({ ...draft, explanation })} />
        <Row>
          <Button small title="Save" onPress={save} />
          <Button small variant="ghost" title="Cancel" onPress={() => { setDraft(q); setEditing(false) }} />
        </Row>
      </Card>
    )
  }

  return (
    <Card highlight={selected}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Checkbox checked={selected} onToggle={onToggle} />
        <Body style={{ flex: 1, fontWeight: '700' }}>Q{index + 1}. {q.question}</Body>
      </Pressable>
      <OptionList options={q.options} correctId={q.correct_option_id} />
      {q.explanation ? <Muted small>💡 {q.explanation}</Muted> : null}
      <Row between>
        <Row>
          <Tag label={q.difficulty} />
          {q.verified && <Tag tone="green" label="answer verified" />}
          {q.edited && <Tag label="edited" />}
          {q.source_pages?.length > 0 && <Tag label={`pages ${q.source_pages.join(', ')}`} />}
        </Row>
        <Row>
          <Button small variant="ghost" title="Edit" onPress={() => setEditing(true)} />
          <Button small variant="danger" title="Delete" onPress={remove} />
        </Row>
      </Row>
    </Card>
  )
}

function CreateExamSheet({ visible, questionIds, onClose, onCreated }) {
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ title: '', duration_minutes: '30', marks_per_question: '1', auto_publish: false })
  const [studentIds, setStudentIds] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (visible) api.listStudents().then(setStudents).catch((e) => setError(e.message))
  }, [visible])

  const submit = async () => {
    if (!form.title.trim()) return setError('Please enter a title.')
    setBusy(true)
    setError('')
    try {
      await api.createExam({
        title: form.title.trim(),
        duration_minutes: parseInt(form.duration_minutes, 10) || 30,
        marks_per_question: parseFloat(form.marks_per_question) || 1,
        auto_publish: form.auto_publish,
        question_ids: questionIds,
        student_ids: studentIds,
      })
      setForm({ title: '', duration_minutes: '30', marks_per_question: '1', auto_publish: false })
      setStudentIds([])
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} title={`Create exam with ${questionIds.length} questions`} onClose={onClose}>
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} autoFocus />
      <Row wrap={false}>
        <Field style={{ flex: 1 }} label="Duration (min)" keyboardType="number-pad" value={form.duration_minutes}
          onChangeText={(duration_minutes) => setForm({ ...form, duration_minutes })} />
        <Field style={{ flex: 1 }} label="Marks / question" keyboardType="decimal-pad" value={form.marks_per_question}
          onChangeText={(marks_per_question) => setForm({ ...form, marks_per_question })} />
      </Row>
      <Checkbox checked={form.auto_publish} onToggle={() => setForm({ ...form, auto_publish: !form.auto_publish })}
        label="Show score right after submission" sublabel="(otherwise you review and publish)" />
      <H2>Assign to students</H2>
      <StudentPicker students={students} selected={studentIds} onChange={setStudentIds} />
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" title="Cancel" onPress={onClose} />
        <Button title={busy ? 'Creating…' : 'Create & assign'} loading={busy} onPress={submit} />
      </Row>
    </Sheet>
  )
}

export default function QuestionBank() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [docId, setDocId] = useState(params.doc || '')
  const [docs, setDocs] = useState([])
  const [questions, setQuestions] = useState([])
  const [selected, setSelected] = useState([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const { fs } = useLayout()

  useEffect(() => { if (params.doc) setDocId(params.doc) }, [params.doc])

  const load = useCallback(() => {
    api.listDocuments().then(setDocs).catch(() => {})
    return api.listQuestions(docId).then((q) => { setQuestions(q); setError('') }).catch((e) => setError(e.message))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [docId])
  useEffect(() => { setLoading(true); load() }, [load])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const allSelected = questions.length > 0 && questions.every((q) => selected.includes(q.id))
  const filters = [{ id: '', filename: 'All documents' }, ...docs]

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={() => { setRefreshing(true); load() }} refreshing={refreshing}>
        <PageHead title="Question bank" subtitle="Correct answers are in green. Select questions to build an exam." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((d) => (
            <Pressable key={d.id} onPress={() => { setDocId(d.id); setSelected([]); router.setParams({ doc: d.id || undefined }) }}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
                borderColor: docId === d.id ? colors.primary : colors.border,
                backgroundColor: docId === d.id ? colors.primarySoft : colors.surface }}>
              <Text numberOfLines={1} style={{ maxWidth: 220, fontSize: fs(13.5), fontWeight: '600', color: docId === d.id ? colors.primary : colors.text }}>{d.filename}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {error ? <Alert>{error}</Alert> : null}
        {questions.length > 0 && (
          <Checkbox checked={allSelected} onToggle={() => setSelected(allSelected ? [] : questions.map((q) => q.id))}
            label={`Select all (${questions.length})`} />
        )}
        {loading ? <Loading /> : questions.length === 0 ? (
          <Empty>No questions yet. Generate some from the Documents tab.</Empty>
        ) : (
          questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} selected={selected.includes(q.id)} onToggle={() => toggle(q.id)}
              onSaved={(u) => setQuestions((qs) => qs.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={(id) => { setQuestions((qs) => qs.filter((x) => x.id !== id)); setSelected((s) => s.filter((x) => x !== id)) }} />
          ))
        )}
        {selected.length > 0 && <View style={{ height: 70 }} />}
      </Screen>

      {/* Sticky action bar, so the button is always reachable while scrolling a long list */}
      {selected.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button block title={`Create exam from ${selected.length} selected`} onPress={() => setCreating(true)} />
        </View>
      )}

      <CreateExamSheet visible={creating} questionIds={selected} onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); setSelected([]); router.navigate('/teacher/exams') }} />
    </View>
  )
}
