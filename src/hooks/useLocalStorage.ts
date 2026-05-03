import { useState, useEffect, useRef } from 'react'

const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000 // 7 días

interface Stored<T> {
  value: T
  savedAt: number
}

/**
 * useState con persistencia en localStorage y TTL configurable.
 * Si el dato guardado supera el TTL se descarta y se usa el valor inicial.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  ttlMs: number = DEFAULT_TTL,
): [T, React.Dispatch<React.SetStateAction<T>>, number | null] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return initial
      const parsed: Stored<T> = JSON.parse(raw)
      if (Date.now() - parsed.savedAt > ttlMs) {
        localStorage.removeItem(key)
        return initial
      }
      return parsed.value
    } catch {
      return initial
    }
  })

  const [savedAt, setSavedAt] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed: Stored<T> = JSON.parse(raw)
      return Date.now() - parsed.savedAt > ttlMs ? null : parsed.savedAt
    } catch {
      return null
    }
  })

  // Evitar escribir en el primer render (ya leímos el valor guardado)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const now = Date.now()
    localStorage.setItem(key, JSON.stringify({ value: state, savedAt: now }))
    setSavedAt(now)
  }, [key, state])

  return [state, setState, savedAt]
}
