/**
 * Sprint 41 — Revenue analytics helpers for ops / conversation.
 */

import type { PricingChannel, FinanceServiceKind } from './types'
import type { RevenueEngine } from './RevenueEngine'

export class RevenueAnalytics {
  private readonly revenue: RevenueEngine

  constructor(revenue: RevenueEngine) {
    this.revenue = revenue
  }

  summary(currency = 'SAR'): {
    bookings: number
    grossRevenue: number
    netProfit: number
    averageMargin: number
    byChannel: Partial<Record<PricingChannel, number>>
    byCategory: Partial<Record<FinanceServiceKind, number>>
  } {
    const rows = this.revenue.list().filter((r) => r.currency === currency)
    const byChannel: Partial<Record<PricingChannel, number>> = {}
    const byCategory: Partial<Record<FinanceServiceKind, number>> = {}
    let gross = 0
    let profit = 0
    let marginSum = 0
    for (const r of rows) {
      gross += r.rahhalRevenue
      profit += r.rahhalProfit
      marginSum += r.marginPercent
      byChannel[r.channel] = round2((byChannel[r.channel] ?? 0) + r.rahhalRevenue)
      byCategory[r.serviceKind] = round2((byCategory[r.serviceKind] ?? 0) + r.rahhalRevenue)
    }
    return {
      bookings: rows.length,
      grossRevenue: round2(gross),
      netProfit: round2(profit),
      averageMargin: rows.length ? round2(marginSum / rows.length) : 0,
      byChannel,
      byCategory,
    }
  }

  profitByDestination(destination: string, currency = 'SAR'): number {
    return round2(
      this.revenue
        .list()
        .filter(
          (r) =>
            (r.destination ?? '').toLowerCase() === destination.toLowerCase()
            && r.currency === currency,
        )
        .reduce((s, r) => s + r.rahhalProfit, 0),
    )
  }

  highestMarginSupplier(currency = 'SAR'): {
    supplierId: string
    marginPercent: number
    netProfit: number
  } | null {
    const map = new Map<string, { profit: number; revenue: number }>()
    for (const r of this.revenue.list()) {
      if (r.currency !== currency) continue
      const cur = map.get(r.supplierId) ?? { profit: 0, revenue: 0 }
      cur.profit += r.rahhalProfit
      cur.revenue += r.rahhalRevenue
      map.set(r.supplierId, cur)
    }
    let best: { supplierId: string; marginPercent: number; netProfit: number } | null = null
    for (const [supplierId, v] of map) {
      const margin = v.revenue > 0 ? round2((v.profit / v.revenue) * 100) : 0
      if (!best || margin > best.marginPercent) {
        best = { supplierId, marginPercent: margin, netProfit: round2(v.profit) }
      }
    }
    return best
  }

  revenueThisMonth(currency = 'SAR', now = new Date()): number {
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    return round2(
      this.revenue
        .list()
        .filter((r) => {
          const d = new Date(r.recognizedAt)
          return (
            d.getUTCFullYear() === y
            && d.getUTCMonth() === m
            && r.currency === currency
          )
        })
        .reduce((s, r) => s + r.rahhalRevenue, 0),
    )
  }
}

export function createRevenueAnalytics(revenue: RevenueEngine): RevenueAnalytics {
  return new RevenueAnalytics(revenue)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
