// Tab navigator shared by the teacher and student areas, guarded by role.
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../lib/auth'
import { colors, useLayout } from '../theme'

function HeaderUser() {
  const { user, logout } = useAuth()
  const { fs, width } = useLayout()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 12 }}>
      {width >= 400 && <Text style={{ color: colors.muted, fontSize: fs(13) }} numberOfLines={1}>{user?.name}</Text>}
      <Pressable onPress={logout} hitSlop={8} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.text }}>Log out</Text>
      </Pressable>
    </View>
  )
}

export default function RoleTabs({ role, tabs }) {
  const { ready, user } = useAuth()
  const { fs } = useLayout()
  if (!ready) return null
  if (!user) return <Redirect href="/login" />
  if (user.role !== role) return <Redirect href={`/${user.role}`} />

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: fs(11.5), fontWeight: '600' },
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { fontSize: fs(17), fontWeight: '700' },
      headerShadowVisible: false,
      headerRight: () => <HeaderUser />,
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{t.icon}</Text>,
        }} />
      ))}
    </Tabs>
  )
}
