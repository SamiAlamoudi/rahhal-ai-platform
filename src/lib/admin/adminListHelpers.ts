export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function normalizePage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1
  if (totalPages < 1) return 1
  return Math.min(Math.floor(page), totalPages)
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10
  const total = items.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / size)
  const safePage = normalizePage(page, totalPages || 1)
  const start = (safePage - 1) * size
  return {
    items: items.slice(start, start + size),
    page: total === 0 ? 1 : safePage,
    pageSize: size,
    total,
    totalPages,
  }
}

export function filterByQuery<T>(
  items: T[],
  query: string,
  getHaystack: (item: T) => string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => getHaystack(item).toLowerCase().includes(q))
}

export function filterByStatus<T extends { status: string }>(
  items: T[],
  status: string,
): T[] {
  const normalized = status.trim().toLowerCase()
  if (!normalized || normalized === 'all') return items
  return items.filter((item) => item.status.toLowerCase() === normalized)
}

export function formatAdminDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatAdminMoney(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return `${safe.toLocaleString('en-US')} ${currency || 'SAR'}`
}
