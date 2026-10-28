import RoleTabs from '../../components/RoleTabs'

const TABS = [
  { name: 'index', title: 'Documents', icon: '📄' },
  { name: 'questions', title: 'Question bank', icon: '❓' },
  { name: 'exams', title: 'Exams', icon: '📝' },
]

export default function TeacherLayout() {
  return <RoleTabs role="teacher" tabs={TABS} />
}
