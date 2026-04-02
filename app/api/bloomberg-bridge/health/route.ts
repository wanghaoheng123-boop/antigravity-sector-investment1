import { NextResponse } from 'next/server'
import { bridgeHealthCheck, isBloombergBridgeConfigured } from '@/lib/data/bloomberg/bridgeClient'

/** Check optional self-hosted Bloomberg HTTP bridge (no secrets returned). */
export async function GET() {
  if (!isBloombergBridgeConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        'Set BLOOMBERG_BRIDGE_URL to enable. See README “Bloomberg bridge” and scripts/bloomberg-bridge-example.py.',
    })
  }

  const h = await bridgeHealthCheck()
  return NextResponse.json({
    configured: true,
    reachable: h.ok,
    latencyMs: h.latencyMs,
    error: h.error,
  })
}
