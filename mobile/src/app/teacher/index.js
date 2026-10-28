import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { confirm } from '../../components/confirm'
import {
  Alert, Button, Card, Empty, Field, Grid, H2, Loading, Muted, PageHead, Row, Screen, Segmented,
} from '../../components/ui'
import { api } from '../../lib/api'

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

function GenerateForm({ doc, onDone }) {
  const [form, setForm] = useState({ num_questions: '10', topic: '', difficulty: 'medium' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async () => {
    const n = Math.min(50, Math.max(1, parseInt(form.num_questions, 10) || 10))
    setBusy(true)
    setMsg(null)
    try {
      const qs = await api.generateQuestions(doc.id, {
        num_questions: n,
        topic: form.topic.trim() || null,
        difficulty: form.difficulty,
      })
      setMsg({ tone: 'green', text: `Generated ${qs.length} verified question${qs.length === 1 ? '' : 's'}.` })
      onDone()
    } catch (err) {
      setMsg({ tone: 'red', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: '#eef0f4', paddingTop: 10 }}>
      <Row wrap={false} style={{ alignItems: 'flex-end' }}>
        <Field style={{ width: 96 }} label="Questions" keyboardType="number-pad" maxLength={2}
          value={form.num_questions} onChangeText={(num_questions) => setForm({ ...form, num_questions })} />
        <Field style={{ flex: 1 }} label="Topic" hint="(optional)" placeholder="e.g. photosynthesis"
          value={form.topic} onChangeText={(topic) => setForm({ ...form, topic })} />
      </Row>
      <Segmented options={DIFFICULTIES} value={form.difficulty} onChange={(difficulty) => setForm({ ...form, difficulty })} />
      <Button title={busy ? 'Generating… (up to a minute)' : 'Generate MCQs'} loading={busy} onPress={submit} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </View>
  )
}

export default function Documents() {
  const router = useRouter()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() =>
    api.listDocuments().then((d) => { setDocs(d); setError('') }).catch((e) => setError(e.message))
      .finally(() => { setLoading(false); setRefreshing(false) }), [])
  useEffect(() => { load() }, [load])

  const upload = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })
    if (picked.canceled) return
    const file = picked.assets[0]
    if (!file.name.toLowerCase().endsWith('.pdf')) return setError('Please choose a PDF file.')
    setUploading(true)
    setError('')
    try {
      await api.uploadDocument(file)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const remove = async (doc) => {
    if (!(await confirm('Delete document?', `Delete "${doc.filename}" and all ${doc.num_questions} questions generated from it?`, 'Delete', true))) return
    await api.deleteDocument(doc.id).catch((e) => setError(e.message))
    load()
  }

  return (
    <Screen onRefresh={() => { setRefreshing(true); load() }} refreshing={refreshing}>
      <PageHead title="Documents" subtitle="Upload a PDF, then generate multiple-choice questions from it.">
        <Button title={uploading ? 'Processing PDF…' : 'Upload PDF'} loading={uploading} onPress={upload} />
      </PageHead>
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <Loading /> : docs.length === 0 ? (
        <Empty>No documents yet. Upload a text-based PDF to get started.</Empty>
      ) : (
        <Grid columns={docs.length > 1 ? undefined : 1}>
          {docs.map((doc) => (
            <Card key={doc.id}>
              <H2 numberOfLines={2}>{doc.filename}</H2>
              <Muted small>{doc.num_pages} pages · {doc.num_chunks} chunks indexed · {doc.num_questions} questions</Muted>
              <Row>
                <Button small variant="ghost" title="View questions"
                  onPress={() => router.push({ pathname: '/teacher/questions', params: { doc: doc.id } })} />
                <Button small variant="danger" title="Delete" onPress={() => remove(doc)} />
              </Row>
              <GenerateForm doc={doc} onDone={load} />
            </Card>
          ))}
        </Grid>
      )}
    </Screen>
  )
}
