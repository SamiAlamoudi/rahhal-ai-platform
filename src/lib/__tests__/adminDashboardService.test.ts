import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { adminDashboardService } from '../admin/adminDashboardService'
import * as adminStats from '../admin/adminStats'
import { getMockAdminPayments } from '../admin/mockAdminData'

describe('adminDashboardService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loadOverview merges stats with mock payment analytics', async () => {
    vi.spyOn(adminStats, 'getAdminStatsFromDb').mockResolvedValue({
      ...adminStats.getMockAdminStats(),
      userCount: 42,
      searchCount: 7,
    })

    const overview = await adminDashboardService.loadOverview()
    expect(overview.userCount).toBe(42)
    expect(overview.paymentCount).toBe(getMockAdminPayments().length)
    expect(overview.bookingCount).toBeGreaterThan(0)
    expect(overview.revenueSar).toBeGreaterThan(0)
    expect(overview.dataSource).toBe('database')
  })

  it('loadOverview falls back when stats throw', async () => {
    vi.spyOn(adminStats, 'getAdminStatsFromDb').mockRejectedValue(new Error('stats down'))
    const overview = await adminDashboardService.loadOverview()
    expect(overview.dataSource).toBe('mock')
    expect(overview.userCount).toBeGreaterThan(0)
  })

  it('listUsers supports search, status filter, and pagination', async () => {
    const page1 = await adminDashboardService.listUsers({
      query: 'sara',
      status: 'active',
      page: 1,
      pageSize: 5,
    })
    expect(page1.total).toBe(1)
    expect(page1.items[0]?.email).toBe('sara@example.com')

    const pending = await adminDashboardService.listUsers({ status: 'pending', page: 1, pageSize: 10 })
    expect(pending.items.every((u) => u.status === 'pending')).toBe(true)
  })

  it('listTrips and listBookings filter by destination', async () => {
    const trips = await adminDashboardService.listTrips({ query: 'japan', page: 1, pageSize: 10 })
    expect(trips.total).toBeGreaterThan(0)
    expect(trips.items.every((t) => t.destination.toLowerCase().includes('japan'))).toBe(true)

    const bookings = await adminDashboardService.listBookings({
      status: 'confirmed',
      page: 1,
      pageSize: 10,
    })
    expect(bookings.items.every((b) => b.status === 'confirmed')).toBe(true)
  })

  it('listPayments is mock-only and never uses live providers', async () => {
    const payments = await adminDashboardService.listPayments({ page: 1, pageSize: 10 })
    expect(payments.total).toBe(getMockAdminPayments().length)
    expect(payments.items.every((p) => p.provider === 'mock')).toBe(true)

    const paid = await adminDashboardService.listPayments({ status: 'paid', page: 1, pageSize: 20 })
    expect(paid.items.every((p) => p.status === 'paid')).toBe(true)
  })
})
