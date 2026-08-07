/** Time-aware greeting for Bilamo home — locale-consistent, no mixed scripts. */

const ARABIC_SCRIPT = /[\u0600-\u06FF]/

export function greetingForHour(
  hour: number,
  name: string,
  locale: 'ar' | 'en' = 'en',
): string {
  const safeName = name.trim()
  if (locale === 'ar') {
    const who = safeName || 'هناك'
    if (hour >= 5 && hour < 12) return `صباح الخير، ${who}`
    if (hour >= 12 && hour < 17) return `مساء الخير، ${who}`
    if (hour >= 17 && hour < 22) return `مساء النور، ${who}`
    return `أهلاً، ${who}`
  }
  const who = safeName || 'there'
  if (hour >= 5 && hour < 12) return `Good morning, ${who}`
  if (hour >= 12 && hour < 17) return `Good afternoon, ${who}`
  if (hour >= 17 && hour < 22) return `Good evening, ${who}`
  return `Good night, ${who}`
}

export function resolveDisplayName(
  user: {
    email?: string | null
    user_metadata?: { full_name?: string; name?: string } | null
  } | null,
  locale: 'ar' | 'en' = 'en',
): string {
  const meta = user?.user_metadata
  const raw = (meta?.full_name || meta?.name || user?.email?.split('@')[0] || '').trim()
  if (!raw) return locale === 'ar' ? 'سامي' : 'Sami'

  // Avoid mixed-script greetings (e.g. English "Good night," + Arabic demo name).
  if (locale === 'en' && ARABIC_SCRIPT.test(raw)) {
    const emailLocal = user?.email?.split('@')[0]?.trim()
    if (emailLocal && !ARABIC_SCRIPT.test(emailLocal)) return emailLocal
    return 'there'
  }
  if (locale === 'ar' && !ARABIC_SCRIPT.test(raw) && /^[A-Za-z0-9._-]+$/.test(raw)) {
    // Keep Latin given names in Arabic greetings — they read naturally.
    return raw
  }
  return raw
}
