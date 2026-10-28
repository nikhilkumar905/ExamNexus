// Async key/value store (JSON values). The mobile counterpart of frontend/src/lib/storage.js.
import AsyncStorage from '@react-native-async-storage/async-storage'

export const storage = {
  async get(key, fallback = null) {
    try {
      const raw = await AsyncStorage.getItem(key)
      return raw == null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or unavailable */
    }
  },
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}
