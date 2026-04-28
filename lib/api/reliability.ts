import { NextResponse } from 'next/server'

type RetryOptions = {
  attempts?: number
  timeoutMs?: number
  retryLabel?: string
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 2)
  let lastError: unknown = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(fn(), opts.timeoutMs ?? 8_000)
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`${opts.retryLabel ?? 'request'} failed after ${attempts} attempts: ${String(lastError)}`)
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function degradedResponse(
  code: string,
  message: string,
  details?: string,
  status = 200
): NextResponse {
  return NextResponse.json(
    {
      degraded: true,
      error: { code, message, details: details ?? null },
      timestamp: new Date().toISOString(),
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

export function errorResponse(code: string, message: string, details?: string, status = 502): NextResponse {
  return NextResponse.json(
    {
      degraded: false,
      error: { code, message, details: details ?? null },
      timestamp: new Date().toISOString(),
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}
