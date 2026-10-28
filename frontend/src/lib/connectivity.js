// Detects whether the device can reach the public internet.
//
// navigator.onLine alone isn't enough: it can say "online" on a network with
// no internet, and a backend on localhost stays reachable with Wi-Fi off. So we
// also probe a public URL. In React Native, replace this with
// @react-native-community/netinfo (NetInfo.fetch().isInternetReachable).
import { useEffect, useRef, useState } from 'react'

const PROBE_URL = import.meta.env.VITE_CONNECTIVITY_URL || 'https://www.google.com/favicon.ico'

export async function hasInternet(timeoutMs = 4000) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    // no-cors: we can't read the response, but the promise only resolves if the network round-trip worked
    await fetch(`${PROBE_URL}?_=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
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
    const goOffline = () => setOnline(false)

    check()
    const id = setInterval(check, pollMs)
    window.addEventListener('online', check)
    window.addEventListener('offline', goOffline)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', goOffline)
    }
  }, [pollMs])

  return online
}
