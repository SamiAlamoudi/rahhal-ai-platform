import { describe, it, expect } from 'vitest'
import {
  getMockAdminBookings,
  getMockAdminPayments,
  getMockAdminTrips,
  getMockAdminUsers,
  summarizeMockPayments,
} from '../admin/mockAdminData'

describe('mockAdminData', () => {
  it('provides non-empty admin entities', () => {
    expect(getMockAdminUsers().length).toBeGreaterThan(0)
    expect(getMockAdminTrips().length).toBeGreaterThan(0)
    expect(getMockAdminBookings().length).toBeGreaterThan(0)
    expect(getMockAdminPayments().length).toBeGreaterThan(0)
  })

  it('keeps every payment provider as mock', () => {
    for (const payment of getMockAdminPayments()) {
      expect(payment.provider).toBe('mock')
      expect(payment.amount).toBeGreaterThanOrEqual(0)
      expect(payment.orderNumber).toMatch(/^RH-/)
    }
  })

  it('summarizeMockPayments computes revenue from paid only', () => {
    const summary = summarizeMockPayments(getMockAdminPayments())
    const expected = getMockAdminPayments()
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0)
    expect(summary.totalRevenue).toBe(expected)
    expect(summary.paidCount + summary.pendingCount + summary.failedCount + summary.refundedCount)
      .toBeLessThanOrEqual(summary.totalPayments)
  })
})
