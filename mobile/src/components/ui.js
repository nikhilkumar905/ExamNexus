// Small set of shared building blocks. All sizes come from useLayout() so they scale.
import { Children } from 'react'
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radius, useLayout } from '../theme'

/** Scrollable page body, centred with a max width on tablets. */
export function Screen({ children, onRefresh, refreshing = false, safe = false, style }) {
  const { gutter, maxContent } = useLayout()
  const body = (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: gutter, paddingBottom: gutter * 2 }}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={[{ width: '100%', maxWidth: maxContent, alignSelf: 'center', gap: 12 }, style]}>{children}</View>
    </ScrollView>
  )
  return safe ? <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>{body}</SafeAreaView> : body
}

export function H1({ children, style }) {
  const { fs } = useLayout()
  return <Text style={[{ fontSize: fs(24), fontWeight: '700', color: colors.text }, style]}>{children}</Text>
}
export function Brand() {
  return <H1 style={{ textAlign: 'center' }}>PDF<Text style={{ color: colors.primary }}>Exam</Text></H1>
}
export function H2({ children, style, ...rest }) {
  const { fs } = useLayout()
  return <Text style={[{ fontSize: fs(18), fontWeight: '700', color: colors.text }, style]} {...rest}>{children}</Text>
}
export function Body({ children, style, ...rest }) {
  const { fs } = useLayout()
  return <Text style={[{ fontSize: fs(15), color: colors.text, lineHeight: fs(21) }, style]} {...rest}>{children}</Text>
}
export function Muted({ children, small, style }) {
  const { fs } = useLayout()
  return <Text style={[{ fontSize: fs(small ? 12.5 : 14), color: colors.muted, lineHeight: fs(small ? 17 : 20) }, style]}>{children}</Text>
}

export function Card({ children, style, highlight }) {
  const { gutter } = useLayout()
  return (
    <View style={[{
      backgroundColor: colors.surface, borderRadius: radius, padding: gutter, gap: 10,
      borderWidth: 1, borderColor: highlight ? colors.primary : colors.border,
    }, style]}>{children}</View>
  )
}

export function Row({ children, style, wrap = true, between }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: wrap ? 'wrap' : 'nowrap',
      justifyContent: between ? 'space-between' : 'flex-start',
    }, style]}>{children}</View>
  )
}

/** Lays children out in as many columns as the screen width allows. */
export function Grid({ children, columns }) {
  const layout = useLayout()
  const cols = columns ?? layout.columns
  const items = Children.toArray(children)
  if (cols === 1) return <View style={{ gap: 12 }}>{items}</View>
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, padding: 6 }}>{child}</View>
      ))}
    </View>
  )
}

const BUTTON = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  ghost: { bg: colors.surface, fg: colors.text, border: colors.border },
  danger: { bg: colors.surface, fg: colors.red, border: colors.redSoft },
}

export function Button({ title, onPress, variant = 'primary', small, disabled, loading, style, block }) {
  const { fs } = useLayout()
  const v = BUTTON[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [{
        backgroundColor: v.bg, borderColor: v.border, borderWidth: 1, borderRadius: 10,
        paddingVertical: small ? 7 : 12, paddingHorizontal: small ? 12 : 18, minHeight: small ? 34 : 46,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
        opacity: off ? 0.55 : pressed ? 0.8 : 1, alignSelf: block ? 'stretch' : 'auto',
      }, style]}
    >
      {loading && <ActivityIndicator size="small" color={v.fg} />}
      <Text style={{ color: v.fg, fontWeight: '600', fontSize: fs(small ? 13 : 15) }}>{title}</Text>
    </Pressable>
  )
}

export function Field({ label, hint, style, multiline, ...input }) {
  const { fs } = useLayout()
  return (
    <View style={[{ gap: 5 }, style]}>
      {label ? (
        <Text style={{ fontSize: fs(14), fontWeight: '600', color: colors.text }}>
          {label}{hint ? <Text style={{ fontWeight: '400', color: colors.muted }}>  {hint}</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface,
          paddingHorizontal: 12, paddingVertical: 10, fontSize: fs(15), color: colors.text,
          minHeight: multiline ? 70 : 46, textAlignVertical: multiline ? 'top' : 'center',
        }}
        {...input}
      />
    </View>
  )
}

const TONES = {
  default: [colors.bg, colors.muted],
  green: [colors.greenSoft, colors.green],
  red: [colors.redSoft, colors.red],
  amber: [colors.amberSoft, colors.amber],
  primary: [colors.primarySoft, colors.primary],
}

export function Tag({ label, tone = 'default' }) {
  const { fs } = useLayout()
  const [bg, fg] = TONES[tone]
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: fs(12), fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

export function Alert({ tone = 'red', children }) {
  const { fs } = useLayout()
  const [bg, fg] = TONES[tone === 'info' ? 'primary' : tone]
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, padding: 12 }}>
      <Text style={{ color: fg, fontSize: fs(14), lineHeight: fs(20) }}>{children}</Text>
    </View>
  )
}

export function Checkbox({ checked, onToggle, label, sublabel, radio }) {
  const { fs } = useLayout()
  return (
    <Pressable onPress={onToggle} hitSlop={6} accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, flexShrink: 1 }}>
      <View style={{
        width: 22, height: 22, borderRadius: radio ? 11 : 6, borderWidth: 2,
        borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : colors.surface,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Text style={{ color: colors.white, fontSize: 13, fontWeight: '800' }}>{radio ? '●' : '✓'}</Text>}
      </View>
      {label ? (
        <Text style={{ fontSize: fs(15), color: colors.text, flexShrink: 1 }}>
          {label}{sublabel ? <Text style={{ color: colors.muted, fontSize: fs(13) }}>  {sublabel}</Text> : null}
        </Text>
      ) : null}
    </Pressable>
  )
}

export function Segmented({ options, value, onChange }) {
  const { fs } = useLayout()
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 4, gap: 4 }}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={{
          flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center',
          backgroundColor: value === o.value ? colors.surface : 'transparent',
        }}>
          <Text style={{ fontSize: fs(14), fontWeight: value === o.value ? '700' : '500', color: value === o.value ? colors.primary : colors.muted }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Loading() {
  return <View style={{ padding: 32, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
}

export function Empty({ children }) {
  return <Card><Muted style={{ textAlign: 'center' }}>{children}</Muted></Card>
}

export function PageHead({ title, subtitle, children }) {
  return (
    <Row between style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
        <H1>{title}</H1>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {children}
    </Row>
  )
}

export function NetBadge({ online }) {
  if (online === null) return <Tag label="Checking connection…" />
  return online ? <Tag tone="red" label="● Internet ON" /> : <Tag tone="green" label="● Internet OFF" />
}
