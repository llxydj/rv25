export function toSentenceCase(s?: string | null) {
  try {
    const lower = (s || '').toLowerCase()
    return lower.replace(/(^\w|[\.\!\?]\s+\w)/g, (c) => c.toUpperCase())
  } catch {
    return s || ''
  }
}
