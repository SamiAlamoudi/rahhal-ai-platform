/** Time-aware greeting for Bilamo home. */

export function greetingForHour(hour: number, name: string): string {
  const safeName = name.trim() || 'there'
  if (hour >= 5 && hour < 12) return `Good morning, ${safeName}`
  if (hour >= 12 && hour < 17) return `Good afternoon, ${safeName}`
  if (hour >= 17 && hour < 22) return `Good evening, ${safeName}`
  return `Good night, ${safeName}`
}

export function resolveDisplayName(user: {
  email?: string | null
  user_metadata?: { full_name?: string; name?: string } | null
} | null): string {
  const meta = user?.user_metadata
  return meta?.full_name || meta?.name || user?.email?.split('@')[0] || 'Sami'
}
