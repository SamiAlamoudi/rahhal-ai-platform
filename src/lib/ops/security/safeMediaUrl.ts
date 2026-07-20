/**
 * Allowlist media/link URLs for chat attachments and previews.
 * Blocks javascript:, data: (non-image), and other unexpected schemes.
 */

export function isSafeMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim()
  if (!trimmed) return false

  // Same-origin relative paths only (reject protocol-relative //evil.com)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return true
    if (parsed.protocol === 'blob:') return true
    if (parsed.protocol === 'data:' && /^data:image\//i.test(trimmed)) return true
    return false
  } catch {
    return false
  }
}

/** Returns the URL when safe, otherwise null. */
export function safeMediaUrl(url: string | null | undefined): string | null {
  return isSafeMediaUrl(url) ? String(url).trim() : null
}
