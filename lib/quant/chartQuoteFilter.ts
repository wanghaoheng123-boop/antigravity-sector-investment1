/** Yahoo chart rows: filter valid daily closes for typed downstream arrays. */
export function hasPositiveClose(
  c: { close: number | null; date: Date }
): c is { close: number; date: Date } {
  return c.close != null && c.close > 0
}
