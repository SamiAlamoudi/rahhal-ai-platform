/**
 * Sprint 41 — Financial report generators.
 */

import type { AccountingEngine } from './AccountingEngine'
import type { RevenueEngine } from './RevenueEngine'
import type { SettlementEngine } from './SettlementEngine'
import type { WalletEngine } from './WalletEngine'
import type { FinanceReportSnapshot, FinanceServiceKind, WalletKind } from './types'

export class FinancialReports {
  private readonly revenue: RevenueEngine
  private readonly wallets: WalletEngine
  private readonly settlements: SettlementEngine
  private readonly accounting: AccountingEngine

  constructor(input: {
    revenue: RevenueEngine
    wallets: WalletEngine
    settlements: SettlementEngine
    accounting: AccountingEngine
  }) {
    this.revenue = input.revenue
    this.wallets = input.wallets
    this.settlements = input.settlements
    this.accounting = input.accounting
  }

  snapshot(currency = 'SAR'): FinanceReportSnapshot {
    const rows = this.revenue.list().filter((r) => r.currency === currency)
    const salesByCountry: Record<string, number> = {}
    const salesByProvider: Record<string, number> = {}
    const salesByDestination: Record<string, number> = {}
    const salesByService: Record<string, number> = {}
    const supplierAgg = new Map<string, { marginSum: number; revenue: number; count: number }>()
    const customerAgg = new Map<string, number>()

    let revenue = 0
    let profit = 0
    let commissionTotal = 0
    let vatPayable = 0
    let marginSum = 0

    for (const r of rows) {
      revenue += r.rahhalRevenue
      profit += r.rahhalProfit
      commissionTotal += r.supplierCommission + r.agencyCommission + r.affiliateCommission
      vatPayable += r.tax
      marginSum += r.marginPercent

      const country = r.country ?? 'XX'
      const destination = r.destination ?? 'unknown'
      salesByCountry[country] = round2((salesByCountry[country] ?? 0) + r.rahhalRevenue)
      salesByProvider[r.supplierId] = round2((salesByProvider[r.supplierId] ?? 0) + r.rahhalRevenue)
      salesByDestination[destination] = round2((salesByDestination[destination] ?? 0) + r.rahhalRevenue)
      salesByService[r.serviceKind] = round2((salesByService[r.serviceKind] ?? 0) + r.rahhalRevenue)

      const s = supplierAgg.get(r.supplierId) ?? { marginSum: 0, revenue: 0, count: 0 }
      s.marginSum += r.marginPercent
      s.revenue += r.rahhalRevenue
      s.count += 1
      supplierAgg.set(r.supplierId, s)

      if (r.customerId) {
        customerAgg.set(r.customerId, round2((customerAgg.get(r.customerId) ?? 0) + r.customerTotal))
      }
    }

    const accounting = this.accounting.snapshot(currency)
    const walletBalances = this.wallets.totalsByKind()

    return {
      revenue: round2(revenue),
      profit: round2(profit),
      marginPercent: rows.length ? round2(marginSum / rows.length) : 0,
      commissionTotal: round2(commissionTotal),
      refundLosses: accounting.refundLosses,
      walletBalances: walletBalances as Record<WalletKind, number>,
      outstandingSuppliers: this.settlements.unpaidTotal(currency),
      outstandingCustomers: accounting.receivables,
      salesByCountry,
      salesByProvider,
      salesByDestination,
      salesByService,
      topSuppliers: [...supplierAgg.entries()]
        .map(([supplierId, v]) => ({
          supplierId,
          margin: v.count ? round2(v.marginSum / v.count) : 0,
          revenue: round2(v.revenue),
        }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 10),
      topCustomers: [...customerAgg.entries()]
        .map(([customerId, spend]) => ({ customerId, spend }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10),
      vatPayable: round2(vatPayable),
      currency,
    }
  }

  salesByService(currency = 'SAR'): Partial<Record<FinanceServiceKind, number>> {
    return this.snapshot(currency).salesByService as Partial<Record<FinanceServiceKind, number>>
  }
}

export function createFinancialReports(input: {
  revenue: RevenueEngine
  wallets: WalletEngine
  settlements: SettlementEngine
  accounting: AccountingEngine
}): FinancialReports {
  return new FinancialReports(input)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
