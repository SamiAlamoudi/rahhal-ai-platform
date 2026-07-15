import { describe, it, expect } from 'vitest'
import {
  filterByQuery,
  filterByStatus,
  formatAdminDate,
  formatAdminMoney,
  normalizePage,
  paginate,
} from '../admin/adminListHelpers'

describe('adminListHelpers: paginate', () => {
  const items = [1, 2, 3, 4, 5, 6, 7]

  it('returns first page slice', () => {
    const page = paginate(items, 1, 3)
    expect(page.items).toEqual([1, 2, 3])
    expect(page.total).toBe(7)
    expect(page.totalPages).toBe(3)
    expect(page.page).toBe(1)
  })

  it('clamps out-of-range page', () => {
    const page = paginate(items, 99, 3)
    expect(page.page).toBe(3)
    expect(page.items).toEqual([7])
  })

  it('handles empty lists', () => {
    const page = paginate([], 2, 10)
    expect(page.items).toEqual([])
    expect(page.totalPages).toBe(0)
    expect(page.page).toBe(1)
  })

  it('normalizePage bounds values', () => {
    expect(normalizePage(0, 5)).toBe(1)
    expect(normalizePage(3, 2)).toBe(2)
  })
})

describe('adminListHelpers: filters', () => {
  const rows = [
    { id: '1', name: 'سارة', status: 'active' },
    { id: '2', name: 'عمر', status: 'pending' },
    { id: '3', name: 'نورة', status: 'active' },
  ]

  it('filterByQuery matches haystack', () => {
    expect(filterByQuery(rows, 'عمر', (r) => r.name)).toHaveLength(1)
    expect(filterByQuery(rows, '  ', (r) => r.name)).toHaveLength(3)
  })

  it('filterByStatus supports all sentinel', () => {
    expect(filterByStatus(rows, 'all')).toHaveLength(3)
    expect(filterByStatus(rows, 'active')).toHaveLength(2)
    expect(filterByStatus(rows, 'suspended')).toHaveLength(0)
  })
})

describe('adminListHelpers: formatting', () => {
  it('formats money and dates', () => {
    expect(formatAdminMoney(1200, 'SAR')).toBe('1,200 SAR')
    expect(formatAdminDate('not-a-date')).toBe('—')
    expect(formatAdminDate('2026-07-15T00:00:00.000Z')).not.toBe('—')
  })
})
