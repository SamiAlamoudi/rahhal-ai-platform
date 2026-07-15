import type { SavedTripRow } from '../types'

export interface SavedTripItemSnapshot {
  type: string
  title: string
  providerName: string
  price: number
  currency: string
  bookingUrl?: string | null
}

export interface SavedTripData {
  currency: string
  items: SavedTripItemSnapshot[]
  travelSessionId: string | null
  bookingSessionId: string | null
  savedFrom: string
  total: number | null
}

export function buildSavedTripTitle(destination: string, itemCount: number): string {
  const dest = destination.trim() || 'رحلة محفوظة'
  if (itemCount <= 0) return dest
  return `${dest} · ${itemCount} عنصر`
}

export function buildSavedTripData(input: {
  currency: string
  items: SavedTripItemSnapshot[]
  travelSessionId: string | null
  bookingSessionId: string | null
  savedFrom?: string
}): SavedTripData {
  const total = input.items.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0)
  return {
    currency: input.currency || 'SAR',
    items: input.items.map((item) => ({
      type: item.type,
      title: item.title,
      providerName: item.providerName,
      price: item.price,
      currency: item.currency || input.currency || 'SAR',
      bookingUrl: item.bookingUrl ?? null,
    })),
    travelSessionId: input.travelSessionId,
    bookingSessionId: input.bookingSessionId,
    savedFrom: input.savedFrom ?? 'booking_review',
    total: input.items.length > 0 ? total : null,
  }
}

export function parseSavedTripData(raw: Record<string, unknown> | null | undefined): SavedTripData {
  const currency = typeof raw?.currency === 'string' && raw.currency ? raw.currency : 'SAR'
  const itemsRaw = Array.isArray(raw?.items) ? raw.items : []
  const items: SavedTripItemSnapshot[] = []
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const title = typeof row.title === 'string' ? row.title : ''
    if (!title) continue
    items.push({
      type: typeof row.type === 'string' ? row.type : 'unknown',
      title,
      providerName: typeof row.providerName === 'string' ? row.providerName : '',
      price: typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : 0,
      currency: typeof row.currency === 'string' && row.currency ? row.currency : currency,
      bookingUrl: typeof row.bookingUrl === 'string' ? row.bookingUrl : null,
    })
  }

  const totalFromRaw = typeof raw?.total === 'number' && Number.isFinite(raw.total) ? raw.total : null
  const computed = items.reduce((sum, item) => sum + item.price, 0)

  return {
    currency,
    items,
    travelSessionId: typeof raw?.travelSessionId === 'string' ? raw.travelSessionId : null,
    bookingSessionId: typeof raw?.bookingSessionId === 'string' ? raw.bookingSessionId : null,
    savedFrom: typeof raw?.savedFrom === 'string' ? raw.savedFrom : 'unknown',
    total: totalFromRaw ?? (items.length > 0 ? computed : null),
  }
}

export function filterSavedTrips(trips: SavedTripRow[], query: string): SavedTripRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return trips
  return trips.filter((trip) => {
    const haystack = `${trip.title} ${trip.destination}`.toLowerCase()
    return haystack.includes(q)
  })
}

export function formatSavedTripTotal(data: SavedTripData): string | null {
  if (data.total == null) return null
  return `${data.total.toLocaleString('en-US')} ${data.currency}`
}
