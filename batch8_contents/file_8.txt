export interface OwnershipCheckResult {
  hasOwnership: boolean
  error: string | null
}

export function validateOwnership(resourceUserId: string, currentUserId: string | undefined): OwnershipCheckResult {
  if (!currentUserId) {
    return { hasOwnership: false, error: 'المستخدم غير مسجل الدخول' }
  }
  if (resourceUserId !== currentUserId) {
    return { hasOwnership: false, error: 'لا تملك صلاحية الوصول إلى هذا المورد' }
  }
  return { hasOwnership: true, error: null }
}

export function sanitizeInput(input: string): string {
  return input.trim().slice(0, 1000)
}

export function validateDestination(destination: string): string | null {
  if (!destination || !destination.trim()) return 'الوجهة مطلوبة'
  if (destination.length > 200) return 'اسم الوجهة طويل جداً'
  return null
}

export function validateSessionData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  return true
}

export interface RateLimitEntry {
  key: string
  count: number
  windowStart: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW_MS = 60_000

export function checkRateLimit(key: string, maxRequests: number = 30): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { key, count: 1, windowStart: now })
    return true
  }
  if (entry.count >= maxRequests) {
    return false
  }
  entry.count++
  return true
}

export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}
