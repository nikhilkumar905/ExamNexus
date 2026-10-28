// Detects whether the phone can reach the public internet.
//
// NetInfo says whether a network is connected; a probe to a public URL confirms the
// internet is really reachable (Wi-Fi can be "connected" with no internet, and the
// backend on the local network stays reachable with mobile data off).
import NetInfo from '@react-native-community/netinfo'
import { useEffect, useRef, useState } from 'react'

const PROBE_URL = process.env.EXPO_PUBLIC_CONNECTIVITY_URL || 'https://www.google.com/favicon.ico'

export async function hasInternet(timeoutMs = 4000) {
  const state = await NetInfo.fetch()
  if (state.isConnected === false) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    // no-cors only matters on web (the app can also run in a browser); native ignores it
    await fetch(`${PROBE_URL}?_=${Date.now()}`, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Returns true / false once known, null while the first check is running. */
export function useInternet(pollMs = 3000) {
  const [online, setOnline] = useState(null)
  const running = useRef(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      if (running.current) return
      running.current = true
      const result = await hasInternet()
      running.current = false
      if (alive) setOnline(result)
    }

    check()
    const id = setInterval(check, pollMs)
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) setOnline(false)
      else check()
    })
    return () => {
      alive = false
      clearInterval(id)
      unsubscribe()
    }
  }, [pollMs])

  return online
}
