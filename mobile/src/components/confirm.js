import { Alert, Platform } from 'react-native'

/** Native yes/no dialog. Resolves true when the user confirms. */
export function confirm(title, message, okLabel = 'OK', destructive = false) {
  // Alert.alert has no buttons on web, so fall back to the browser dialog there
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}
