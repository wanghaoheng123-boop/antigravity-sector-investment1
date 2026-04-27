import { describe, it, expect } from 'vitest'
import { truncateForModelReview } from '@/lib/ai/deepseekMcpPlaybook'

describe('truncateForModelReview', () => {
  it('returns short strings unchanged', () => {
    expect(truncateForModelReview('abc', 100)).toBe('abc')
  })

  it('truncates long strings under maxChars', () => {
    const long = 'x'.repeat(5000)
    const out = truncateForModelReview(long, 400)
    expect(out.length).toBeLessThanOrEqual(400)
    expect(out).toContain('truncated')
    expect(out.startsWith('xxx')).toBe(true)
  })
})
