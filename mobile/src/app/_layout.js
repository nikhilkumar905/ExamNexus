import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../lib/auth'
import { colors } from '../theme'

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTransparent: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="teacher" options={{ headerShown: false }} />
        <Stack.Screen name="student" options={{ headerShown: false }} />
        <Stack.Screen name="exam-results/[examId]" options={{ title: 'Results & grading' }} />
        <Stack.Screen name="result/[attemptId]" options={{ title: 'Result' }} />
        {/* Full screen, and swipe-back is disabled so the exam can't be left by accident */}
        <Stack.Screen name="take-exam/[examId]" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </AuthProvider>
  )
}
