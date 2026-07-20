/**
 * Sprint 40 — Supplier dashboard KPIs, analytics, settlements, disputes.
 */

import type { SupplierPerformanceEngine } from './SupplierPerformanceEngine'
import type { SupplierDashboardSnapshot } from './types'

interface DashboardLedger {
  bookings: number
  revenue: number
  currency: string
  pendingSettlements: number
  refunds: number
  disputes: number
  history: Array<{ at: string; qualityScore: number; reliabilityScore: number }>
}

export class SupplierDashboard {
  private readonly performance: SupplierPerformanceEngine
  private readonly ledger = new Map<string, DashboardLedger>()

  constructor(performance: SupplierPerformanceEngine) {
    this.performance = performance
  }

  recordBooking(supplierId: string, amount: number, currency = 'SAR'): void {
    const row = this.ensure(supplierId, currency)
    row.bookings += 1
    row.revenue = round2(row.revenue + amount)
  }

  recordRefund(supplierId: string, amount: number): void {
    const row = this.ensure(supplierId)
    row.refunds += 1
    row.revenue = round2(Math.max(0, row.revenue - amount))
  }

  recordPendingSettlement(supplierId: string, amount: number): void {
    const row = this.ensure(supplierId)
    row.pendingSettlements = round2(row.pendingSettlements + amount)
  }

  openDispute(supplierId: string): void {
    this.ensure(supplierId).disputes += 1
  }

  snapshot(supplierId: string): SupplierDashboardSnapshot {
    const row = this.ensure(supplierId)
    const perf = this.performance.get(supplierId)
    row.history.push({
      at: new Date().toISOString(),
      qualityScore: perf.qualityScore,
      reliabilityScore: perf.reliabilityScore,
    })
    if (row.history.length > 30) row.history.splice(0, row.history.length - 30)

    return {
      supplierId,
      kpis: {
        bookings: row.bookings,
        revenue: row.revenue,
        currency: row.currency,
        pendingSettlements: row.pendingSettlements,
        refunds: row.refunds,
        disputes: row.disputes,
        confirmationRate: round2(1 - Math.min(0.5, perf.cancellationRate)),
        averageQualityScore: perf.qualityScore,
      },
      analytics: {
        bookingsByDay: [
          { day: new Date().toISOString().slice(0, 10), count: row.bookings },
        ],
        revenueByService: [
          { service: 'all', amount: row.revenue },
        ],
      },
      performanceHistory: row.history.map((h) => ({ ...h })),
      pendingSettlementAmount: row.pendingSettlements,
      openDisputes: row.disputes,
    }
  }

  private ensure(supplierId: string, currency = 'SAR'): DashboardLedger {
    let row = this.ledger.get(supplierId)
    if (!row) {
      row = {
        bookings: 0,
        revenue: 0,
        currency,
        pendingSettlements: 0,
        refunds: 0,
        disputes: 0,
        history: [],
      }
      this.ledger.set(supplierId, row)
    }
    return row
  }
}

export function createSupplierDashboard(
  performance: SupplierPerformanceEngine,
): SupplierDashboard {
  return new SupplierDashboard(performance)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
