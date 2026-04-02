/**
 * Map a Yahoo-style symbol to a typical Bloomberg equity identifier.
 * Override per ticker via BLOOMBERG_TICKER_MAP JSON: {"BRK.B":"BRK/B US Equity"}
 */

const DEFAULT_SUFFIX = ' US Equity'

export function toBloombergSecurity(yahooSymbol: string, mapJson?: string | null): string {
  const u = yahooSymbol.trim().toUpperCase()
  if (mapJson) {
    try {
      const m = JSON.parse(mapJson) as Record<string, string>
      if (typeof m[u] === 'string' && m[u].length > 0) return m[u]
    } catch {
      /* ignore */
    }
  }
  if (u === '^VIX') return 'VIX Index'
  if (u.startsWith('^')) return `${u.slice(1)} Index`
  const core = u.replace(/\./g, '/')
  return `${core}${DEFAULT_SUFFIX}`
}

export function fromBloombergSecurity(security: string): string {
  const s = security.trim()
  if (s.endsWith(' Index')) return `^${s.replace(' Index', '').replace(/\s+/g, '')}`
  if (s.endsWith(DEFAULT_SUFFIX)) {
    const core = s.slice(0, -DEFAULT_SUFFIX.length).replace(/\//g, '.')
    return core.toUpperCase()
  }
  return s.toUpperCase()
}
