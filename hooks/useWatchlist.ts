'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import { normalizeTicker } from '@/lib/tickerNormalize'

const GUEST_KEY = 'ag-watchlist-guest'
const MAX_ITEMS = 64

function safeParse(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    return v.filter((x): x is string => typeof x === 'string').map((s) => normalizeTicker(s))
  } catch {
    return []
  }
}

export function useWatchlist() {
  const { data: session, status } = useSession()
  const storageKey =
    status === 'authenticated' && session?.user?.email
      ? `ag-watchlist-${session.user.email}`
      : GUEST_KEY

  const [items, setItems] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(false)
    try {
      setItems(safeParse(typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null))
    } catch {
      setItems([])
    }
    setHydrated(true)
  }, [storageKey])

  const persist = useCallback(
    (next: string[]) => {
      const capped = Array.from(new Set(next.map((t) => normalizeTicker(t)))).slice(0, MAX_ITEMS)
      setItems(capped)
      try {
        localStorage.setItem(storageKey, JSON.stringify(capped))
      } catch {
        /* quota / private mode */
      }
    },
    [storageKey]
  )

  const toggle = useCallback(
    (ticker: string) => {
      const u = normalizeTicker(ticker)
      if (items.includes(u)) persist(items.filter((x) => x !== u))
      else persist([...items, u])
    },
    [items, persist]
  )

  const remove = useCallback(
    (ticker: string) => {
      const u = normalizeTicker(ticker)
      persist(items.filter((x) => x !== u))
    },
    [items, persist]
  )

  const has = useCallback((ticker: string) => items.includes(normalizeTicker(ticker)), [items])

  return { items, toggle, remove, has, hydrated, storageKey, isGuest: storageKey === GUEST_KEY }
}
