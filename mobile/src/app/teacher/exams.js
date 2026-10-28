import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { confirm } from '../../components/confirm'
import Sheet from '../../components/Sheet'
import StudentPicker from '../../components/StudentPicker'
import { Alert, Button, Card, Empty, Grid, H2, Loading, Muted, PageHead, Row, Screen } from '../../components/ui'
import { api } from '../../lib/api'
import { colors, useLayout } from '../../theme'

function AssignSheet({ exam, onClose }) {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!exam) return
    setSelected(exam.assigned_student_ids)
    setError('')
    api.listStudents().then(setStudents).catch((e) => setError(e.message))
  }, [exam])

  const save = async () => {
    try {
      await api.assignExam(exam.id, selected)
      onClose(true)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Sheet visible={!!exam} title={`Assign “${exam?.title ?? ''}”`} onClose={() => onClose(false)}>
      {error ? <Alert>{error}</Alert> : null}
      <StudentPicker students={students} selected={selected} onChange={setSelected} />
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" title="Cancel" onPress={() => onClose(false)} />
        <Button title="Save assignment" onPress={save} />
      </Row>
    </Sheet>
  )
}

function Stat({ value, label }) {
  const { fs } = useLayout()
  return (
    <View>
      <Text style={{ fontSize: fs(22), fontWeight: '700', color: colors.text }}>{value}</Text>
      <Muted small>{label}</Muted>
    </View>
  )
}

export default function Exams() {
  const router = useRouter()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [assigning, setAssigning] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() =>
    api.listExams().then((e) => { setExams(e); setError('') }).catch((e) => setError(e.message))
      .finally(() => { setLoading(false); setRefreshing(false) }), [])
  // Reload whenever the tab is shown, e.g. right after creating an exam
  useFocusEffect(useCallback(() => { load() }, [load]))

  const remove = async (exam) => {
    if (!(await confirm('Delete exam?', `Delete "${exam.title}" and all student attempts?`, 'Delete', true))) return
    await api.deleteExam(exam.id).catch((e) => setError(e.message))
    load()
  }

  return (
    <Screen onRefresh={() => { setRefreshing(true); load() }} refreshing={refreshing}>
      <PageHead title="Exams & results" subtitle="Create exams from the Question bank. Assign them and review scores here.">
        <Button title="+ New exam" onPress={() => router.navigate('/teacher/questions')} />
      </PageHead>
      {error ? <Alert>{error}</Alert> : null}
      {loading ? <Loading /> : exams.length === 0 ? (
        <Empty>No exams yet.</Empty>
      ) : (
        <Grid>
          {exams.map((e) => (
            <Card key={e.id}>
              <H2>{e.title}</H2>
              <Muted small>
                {e.duration_minutes} min · {e.total_marks} marks · {e.auto_publish ? 'auto-publish' : 'teacher publishes'}
              </Muted>
              <Row style={{ gap: 28 }}>
                <Stat value={e.num_assigned} label="assigned" />
                <Stat value={e.num_submitted} label="submitted" />
              </Row>
              <Row>
                <Button small title="Results & grading" onPress={() => router.push(`/exam-results/${e.id}`)} />
                <Button small variant="ghost" title="Assign" onPress={() => setAssigning(e)} />
                <Button small variant="danger" title="Delete" onPress={() => remove(e)} />
              </Row>
            </Card>
          ))}
        </Grid>
      )}
      <AssignSheet exam={assigning} onClose={(changed) => { setAssigning(null); if (changed) load() }} />
    </Screen>
  )
}
