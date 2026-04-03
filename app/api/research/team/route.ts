import { NextResponse } from 'next/server'
import { RESEARCH_TEAM } from '@/lib/research/team'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      team: RESEARCH_TEAM,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    },
    {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      },
    }
  )
}
