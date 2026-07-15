import { getAdminStatsFromDb, getMockAdminStats, type AdminStats } from './adminStats'
import {
  getMockAdminBookings,
  getMockAdminPayments,
  getMockAdminTrips,
  getMockAdminUsers,
  summarizeMockPayments,
  type AdminBookingRecord,
  type AdminPaymentRecord,
  type AdminTripRecord,
  type AdminUserRecord,
} from './mockAdminData'
import {
  filterByQuery,
  filterByStatus,
  paginate,
  type PageResult,
} from './adminListHelpers'

export interface AdminOverviewStats extends AdminStats {
  bookingCount: number
  paymentCount: number
  revenueSar: number
  dataSource: 'database' | 'mock'
}

export interface AdminListQuery {
  query?: string
  status?: string
  page?: number
  pageSize?: number
}

async function simulateLatency(ms = 120): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export const adminDashboardService = {
  async loadOverview(): Promise<AdminOverviewStats> {
    const mockPayments = getMockAdminPayments()
    const paymentSummary = summarizeMockPayments(mockPayments)
    const bookingCount = getMockAdminBookings().length

    try {
      const stats = await getAdminStatsFromDb()
      const mock = getMockAdminStats()
      const usedMockUsers = stats.userCount === mock.userCount && stats.searchCount === mock.searchCount
      return {
        ...stats,
        bookingCount,
        paymentCount: paymentSummary.totalPayments,
        revenueSar: paymentSummary.totalRevenue,
        dataSource: usedMockUsers ? 'mock' : 'database',
      }
    } catch {
      const stats = getMockAdminStats()
      return {
        ...stats,
        bookingCount,
        paymentCount: paymentSummary.totalPayments,
        revenueSar: paymentSummary.totalRevenue,
        dataSource: 'mock',
      }
    }
  },

  async listUsers(input: AdminListQuery = {}): Promise<PageResult<AdminUserRecord>> {
    await simulateLatency()
    const filtered = filterByStatus(
      filterByQuery(
        getMockAdminUsers(),
        input.query ?? '',
        (u) => `${u.fullName} ${u.email} ${u.role} ${u.status}`,
      ),
      input.status ?? 'all',
    )
    return paginate(filtered, input.page ?? 1, input.pageSize ?? 5)
  },

  async listTrips(input: AdminListQuery = {}): Promise<PageResult<AdminTripRecord>> {
    await simulateLatency()
    const filtered = filterByStatus(
      filterByQuery(
        getMockAdminTrips(),
        input.query ?? '',
        (t) => `${t.title} ${t.destination} ${t.userEmail} ${t.status}`,
      ),
      input.status ?? 'all',
    )
    return paginate(filtered, input.page ?? 1, input.pageSize ?? 5)
  },

  async listBookings(input: AdminListQuery = {}): Promise<PageResult<AdminBookingRecord>> {
    await simulateLatency()
    const filtered = filterByStatus(
      filterByQuery(
        getMockAdminBookings(),
        input.query ?? '',
        (b) => `${b.destination} ${b.userEmail} ${b.status} ${b.id}`,
      ),
      input.status ?? 'all',
    )
    return paginate(filtered, input.page ?? 1, input.pageSize ?? 5)
  },

  /** Read-only mock payments list — never calls payment providers. */
  async listPayments(input: AdminListQuery = {}): Promise<PageResult<AdminPaymentRecord>> {
    await simulateLatency()
    const filtered = filterByStatus(
      filterByQuery(
        getMockAdminPayments(),
        input.query ?? '',
        (p) => `${p.orderNumber} ${p.userEmail} ${p.status} ${p.provider}`,
      ),
      input.status ?? 'all',
    )
    return paginate(filtered, input.page ?? 1, input.pageSize ?? 5)
  },
}
