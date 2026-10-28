import { useState } from 'react'
import { View } from 'react-native'
import { colors } from '../theme'
import { Button, Checkbox, Field, Muted, Row } from './ui'

export default function StudentPicker({ students, selected, onChange }) {
  const [filter, setFilter] = useState('')
  const shown = students.filter((s) =>
    `${s.name} ${s.email}`.toLowerCase().includes(filter.toLowerCase()),
  )
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const allShown = shown.length > 0 && shown.every((s) => selected.includes(s.id))

  if (students.length === 0) return <Muted small>No students have registered yet.</Muted>
  return (
    <View style={{ gap: 8 }}>
      <Row wrap={false}>
        <Field style={{ flex: 1 }} placeholder="Search students…" value={filter} onChangeText={setFilter} autoCapitalize="none" />
        <Button small variant="ghost" title={allShown ? 'Clear' : 'Select all'} onPress={() =>
          onChange(allShown
            ? selected.filter((id) => !shown.some((s) => s.id === id))
            : [...new Set([...selected, ...shown.map((s) => s.id)])])} />
      </Row>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 4 }}>
        {shown.map((s) => (
          <Checkbox key={s.id} checked={selected.includes(s.id)} onToggle={() => toggle(s.id)} label={s.name} sublabel={s.email} />
        ))}
      </View>
      <Muted small>{selected.length} selected</Muted>
    </View>
  )
}
