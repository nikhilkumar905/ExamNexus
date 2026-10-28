import RoleTabs from '../../components/RoleTabs'

const TABS = [
  { name: 'index', title: 'My exams', icon: '📝' },
  { name: 'results', title: 'My results', icon: '🏆' },
]

export default function StudentLayout() {
  return <RoleTabs role="student" tabs={TABS} />
}
