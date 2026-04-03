/**
 * Data Verification & Provenance System
 * Provides transparent, auditable data lineage for all quantitative calculations
 */

export type DataSource = 'yahoo' | 'bloomberg' | 'finra' | 'exchange' | 'calculated' | 'model' | 'illustrative'

export interface DataVerification {
  source: DataSource
  timestamp: string
  confidence: number       // 0-1
  methodology: string      // human-readable explanation
  rawFields?: string[]     // which API fields were used
  notes?: string
}

export interface VerificationResult {
  verified: boolean
  confidence: number
  warnings: string[]
  sources: DataVerification[]
}

export function createVerification(
  source: DataSource,
  methodology: string,
  options?: {
    confidence?: number
    rawFields?: string[]
    notes?: string
  }
): DataVerification {
  return {
    source,
    timestamp: new Date().toISOString(),
    confidence: options?.confidence ?? (source === 'illustrative' ? 0.3 : source === 'calculated' ? 0.7 : 0.95),
    methodology,
    rawFields: options?.rawFields,
    notes: options?.notes,
  }
}

export function combineVerifications(verifications: DataVerification[]): VerificationResult {
  const verified = verifications.every(v => v.confidence > 0.5)
  const avgConfidence = verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length
  const warnings = verifications
    .filter(v => v.source === 'illustrative' || v.confidence < 0.6)
    .map(v => `[${v.source}] ${v.notes ?? v.methodology}`)

  return { verified, confidence: avgConfidence, warnings, sources: verifications }
}

export function sourceLabel(source: DataSource): string {
  const labels: Record<DataSource, string> = {
    yahoo: 'Yahoo Finance',
    bloomberg: 'Bloomberg',
    finra: 'FINRA',
    exchange: 'Exchange',
    calculated: 'Calculated',
    model: 'Model-Based',
    illustrative: 'Illustrative',
  }
  return labels[source]
}

export function sourceColor(source: DataSource): string {
  const colors: Record<DataSource, string> = {
    yahoo: 'text-cyan-400',
    bloomberg: 'text-blue-400',
    finra: 'text-purple-400',
    exchange: 'text-green-400',
    calculated: 'text-amber-400',
    model: 'text-orange-400',
    illustrative: 'text-slate-500',
  }
  return colors[source]
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.85) return 'text-green-400'
  if (confidence >= 0.6) return 'text-amber-400'
  return 'text-red-400'
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

/** Merge two verifications, taking the lower confidence */
export function mergeVerification(a: DataVerification, b: DataVerification): DataVerification {
  const lower = a.confidence < b.confidence ? a : b
  return {
    source: lower.source,
    timestamp: new Date().toISOString(),
    confidence: Math.min(a.confidence, b.confidence),
    methodology: `${a.methodology}; ${b.methodology}`,
    rawFields: [...(a.rawFields ?? []), ...(b.rawFields ?? [])],
  }
}
