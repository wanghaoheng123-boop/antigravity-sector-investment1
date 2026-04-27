/**
 * Optional `NEXT_PUBLIC_QUANTAN_FEEDBACK_URL` (GitHub issue, form, etc.);
 * otherwise a mailto draft for structured user feedback.
 */
export function quantanFeedbackHref(subjectLine: string): string {
  const u =
    typeof process.env.NEXT_PUBLIC_QUANTAN_FEEDBACK_URL === 'string'
      ? process.env.NEXT_PUBLIC_QUANTAN_FEEDBACK_URL.trim()
      : ''
  if (u) return u
  const subj = encodeURIComponent(subjectLine)
  const body = encodeURIComponent(
    'What worked / what broke:\n\nExpected:\n\nActual:\n\nBrowser / device:\n',
  )
  return `mailto:?subject=${subj}&body=${body}`
}
