'use client'

/**
 * useErrorToast — lightweight error notification hook.
 *
 * Provides a simple toast queue for surface-level error messages.
 * Replaces silent .catch(() => {}) patterns across app pages so traders
 * always know when a data fetch fails.
 *
 * Phase 12 Sprint 1 (H5): Added per DeepSeek V4 Pro QA audit — silent errors
 * were hiding data refresh failures from users.
 *
 * Usage:
 *   const { toasts, showToast, dismissToast } = useErrorToast()
 *   fetch('/api/prices').catch(e => showToast(`Prices failed: ${e.message}`, 'error'))
 *
 * Render toasts with <ErrorToastList toasts={toasts} onDismiss={dismissToast} />
 */

import { useState, useCallback } from 'react'

export type ToastLevel = 'error' | 'warn' | 'info'

export interface Toast {
  id: string
  message: string
  level: ToastLevel
  /** Auto-dismiss after ms (default 6000). Pass 0 to disable auto-dismiss. */
  ttl: number
}

export function useErrorToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, level: ToastLevel = 'error', ttl = 6000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const toast: Toast = { id, message, level, ttl }
    setToasts(prev => [...prev.slice(-4), toast])  // keep at most 5 toasts
    if (ttl > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, ttl)
    }
    return id
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}
