import { Text, View } from 'react-native'
import { colors, useLayout } from '../theme'

export default function OptionList({ options, correctId, chosenId, picks }) {
  const { fs } = useLayout()
  return (
    <View style={{ gap: 6 }}>
      {options.map((o) => {
        const correct = o.id === correctId
        const wrong = !correct && o.id === chosenId
        return (
          <View key={o.id} style={{
            borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
            backgroundColor: correct ? colors.greenSoft : wrong ? colors.redSoft : colors.bg,
          }}>
            <Text style={{ fontSize: fs(14.5), color: correct ? colors.green : wrong ? colors.red : colors.text, fontWeight: correct ? '600' : '400' }}>
              <Text style={{ fontWeight: '700' }}>{o.id.toUpperCase()}. </Text>{o.text}
              {o.id === chosenId ? <Text style={{ color: colors.muted, fontWeight: '400' }}>  (your answer)</Text> : null}
              {picks ? <Text style={{ color: colors.muted, fontWeight: '400' }}>  — {picks[o.id] || 0} picked</Text> : null}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
