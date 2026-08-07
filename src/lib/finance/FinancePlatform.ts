/**
 * Sprint 41 — Universal Revenue, Finance & Settlement Platform orchestrator.
 */

import { AccountingEngine, createAccountingEngine } from './AccountingEngine'
import { AffiliateEngine, createAffiliateEngine } from './AffiliateEngine'
import { AuditLogger, createAuditLogger } from './AuditLogger'
import { CommissionEngine, createCommissionEngine } from './CommissionEngine'
import { CorporatePricing, createCorporatePricing } from './CorporatePricing'
import { CurrencyEngine, createCurrencyEngine } from './CurrencyEngine'
import { FinanceEvents } from './FinanceEvents'
import { isFinancePlatformEnabled } from './FinanceFeatureFlags'
import { FinanceMetrics } from './FinanceMetrics'
import { FinancialReports, createFinancialReports } from './FinancialReports'
import { InvoiceService, createInvoiceService } from './InvoiceService'
import { LedgerEngine, createLedgerEngine } from './LedgerEngine'
import { MarkupEngine, createMarkupEngine } from './MarkupEngine'
import { ProfitCalculator, createProfitCalculator } from './ProfitCalculator'
import { PromotionEngine, createPromotionEngine } from './PromotionEngine'
import { RevenueAnalytics, createRevenueAnalytics } from './RevenueAnalytics'
import { RevenueEngine, createRevenueEngine } from './RevenueEngine'
import { SettlementEngine, createSettlementEngine } from './SettlementEngine'
import { TaxEngine, createTaxEngine } from './TaxEngine'
import { WalletEngine, createWalletEngine } from './WalletEngine'
import type {
  FinanceDisabledResult,
  FinanceDocument,
  FinancePlatformResult,
  FinanceReportSnapshot,
  InvoiceDocKind,
  PricingChannel,
  RevenueBreakdown,
  RevenueLineInput,
  SettlementBatch,
  SettlementCadence,
  WalletAccount,
  WalletKind,
  WalletTxn,
} from './types'

export interface FinancePlatformOptions {
  enabled?: boolean
  currency?: CurrencyEngine
  tax?: TaxEngine
  ledger?: LedgerEngine
  wallets?: WalletEngine
  commission?: CommissionEngine
  markup?: MarkupEngine
  promotion?: PromotionEngine
  affiliate?: AffiliateEngine
  corporate?: CorporatePricing
  profit?: ProfitCalculator
  revenue?: RevenueEngine
  settlements?: SettlementEngine
  accounting?: AccountingEngine
  invoices?: InvoiceService
  reports?: FinancialReports
  analytics?: RevenueAnalytics
  audit?: AuditLogger
  events?: FinanceEvents
  metrics?: FinanceMetrics
}

export class FinancePlatform {
  private readonly enabledOverride: boolean | undefined
  private readonly currency: CurrencyEngine
  private readonly tax: TaxEngine
  private readonly ledger: LedgerEngine
  private readonly wallets: WalletEngine
  private readonly commission: CommissionEngine
  private readonly markup: MarkupEngine
  private readonly promotion: PromotionEngine
  private readonly affiliate: AffiliateEngine
  private readonly corporate: CorporatePricing
  private readonly profit: ProfitCalculator
  private readonly revenue: RevenueEngine
  private readonly settlements: SettlementEngine
  private readonly accounting: AccountingEngine
  private readonly invoices: InvoiceService
  private readonly reports: FinancialReports
  private readonly analytics: RevenueAnalytics
  private readonly audit: AuditLogger
  private readonly events: FinanceEvents
  private readonly metrics: FinanceMetrics
  private demoSeeded = false

  constructor(options: FinancePlatformOptions = {}) {
    this.enabledOverride = options.enabled
    this.currency = options.currency ?? createCurrencyEngine()
    this.tax = options.tax ?? createTaxEngine()
    this.ledger = options.ledger ?? createLedgerEngine()
    this.wallets = options.wallets ?? createWalletEngine()
    this.commission = options.commission ?? createCommissionEngine()
    this.markup = options.markup ?? createMarkupEngine()
    this.promotion = options.promotion ?? createPromotionEngine()
    this.affiliate = options.affiliate ?? createAffiliateEngine()
    this.corporate = options.corporate ?? createCorporatePricing()
    this.profit = options.profit ?? createProfitCalculator()
    this.revenue =
      options.revenue
      ?? createRevenueEngine({
        commission: this.commission,
        markup: this.markup,
        promotion: this.promotion,
        tax: this.tax,
        corporate: this.corporate,
        profit: this.profit,
      })
    this.settlements = options.settlements ?? createSettlementEngine(this.currency)
    this.accounting = options.accounting ?? createAccountingEngine(this.ledger)
    this.invoices = options.invoices ?? createInvoiceService()
    this.reports =
      options.reports
      ?? createFinancialReports({
        revenue: this.revenue,
        wallets: this.wallets,
        settlements: this.settlements,
        accounting: this.accounting,
      })
    this.analytics = options.analytics ?? createRevenueAnalytics(this.revenue)
    this.audit = options.audit ?? createAuditLogger()
    this.events = options.events ?? new FinanceEvents()
    this.metrics = options.metrics ?? new FinanceMetrics()
  }

  isEnabled(): boolean {
    if (typeof this.enabledOverride === 'boolean') return this.enabledOverride
    return isFinancePlatformEnabled()
  }

  recognizeRevenue(input: RevenueLineInput): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const breakdown = this.revenue.recognize(input)
    this.accounting.postRevenue(breakdown)
    if (breakdown.affiliateCommission > 0 && input.customerId) {
      const partners = this.affiliate.list()
      const partner = partners[0]
      if (partner) {
        this.affiliate.recordEarning(
          partner.affiliateId,
          input.bookingId,
          breakdown.affiliateCommission,
          breakdown.currency,
        )
      }
    }
    const document = this.invoices.fromRevenue(breakdown, input.customerId ?? input.supplierId, 'invoice')
    this.audit.log('revenue.recognized', 'booking', input.bookingId, {
      revenue: breakdown.rahhalRevenue,
      profit: breakdown.rahhalProfit,
    })
    this.metrics.recordRevenue()
    this.metrics.recordInvoice()
    this.events.emit('finance.revenue.recognized', { bookingId: input.bookingId })
    this.events.emit('finance.invoice.issued', { documentId: document.documentId })
    return {
      ok: true,
      breakdown,
      document,
      explanation: `Recognized ${breakdown.rahhalRevenue} ${breakdown.currency} revenue (profit ${breakdown.rahhalProfit}, margin ${breakdown.marginPercent}%).`,
    }
  }

  openWallet(
    ownerId: string,
    kind: WalletKind,
    currency = 'SAR',
  ): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const wallet = this.wallets.open(ownerId, kind, currency)
    this.audit.log('wallet.opened', 'wallet', wallet.walletId, { kind, ownerId })
    return { ok: true, wallet, explanation: `Opened ${kind} wallet ${wallet.walletId}.` }
  }

  walletOp(
    walletId: string,
    op: 'deposit' | 'withdraw' | 'freeze' | 'release' | 'expire',
    amount = 0,
    note?: string,
  ): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    let txn: WalletTxn | { ok: false; message: string }
    if (op === 'deposit') txn = this.wallets.deposit(walletId, amount, note)
    else if (op === 'withdraw') txn = this.wallets.withdraw(walletId, amount, note)
    else if (op === 'freeze') txn = this.wallets.freeze(walletId, amount, note)
    else if (op === 'release') txn = this.wallets.release(walletId, amount, note)
    else txn = this.wallets.expire(walletId, note)
    if ('ok' in txn) return { ok: false, code: 'INSUFFICIENT_FUNDS', message: txn.message }
    this.metrics.recordWalletOp()
    this.events.emit('finance.wallet.updated', { walletId, op })
    const wallet = this.wallets.get(walletId)
    return {
      ok: true,
      wallet: wallet ?? undefined,
      explanation: `Wallet ${op} of ${Math.abs(txn.amount)} completed.`,
    }
  }

  transferWallet(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
  ): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const txn = this.wallets.transfer(fromWalletId, toWalletId, amount)
    if ('ok' in txn) return { ok: false, code: 'INSUFFICIENT_FUNDS', message: txn.message }
    this.metrics.recordWalletOp()
    this.events.emit('finance.wallet.updated', { fromWalletId, toWalletId, amount })
    return {
      ok: true,
      wallet: this.wallets.get(fromWalletId) ?? undefined,
      explanation: `Transferred ${amount} between wallets.`,
    }
  }

  createSettlement(input: {
    supplierId: string
    amount: number
    currency: string
    settlementCurrency?: string
    cadence?: SettlementCadence
  }): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const settlement = this.settlements.create(input)
    this.metrics.recordSettlementCreated()
    this.events.emit('finance.settlement.created', { settlementId: settlement.settlementId })
    this.audit.log('settlement.created', 'settlement', settlement.settlementId, {
      supplierId: input.supplierId,
      amount: input.amount,
    })
    return {
      ok: true,
      settlement,
      explanation: `Settlement ${settlement.settlementId} created (${settlement.cadence}).`,
    }
  }

  settle(
    settlementId: string,
    amount?: number,
    mode: 'automatic' | 'manual' = 'automatic',
  ): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const settlement = this.settlements.settle(settlementId, amount, mode)
    if (!settlement) return { ok: false, code: 'NOT_FOUND', message: 'Settlement not found' }
    this.metrics.recordSettlementPaid()
    this.events.emit('finance.settlement.paid', { settlementId, status: settlement.status })
    return {
      ok: true,
      settlement,
      explanation: `Settlement ${settlementId} is now ${settlement.status}.`,
    }
  }

  issueDocument(input: {
    kind: InvoiceDocKind
    partyId: string
    currency: string
    lines: Array<{ label: string; amount: number }>
  }): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const document = this.invoices.issue(input)
    this.metrics.recordInvoice()
    this.events.emit('finance.invoice.issued', { documentId: document.documentId, kind: input.kind })
    return { ok: true, document, explanation: `Issued ${input.kind} ${document.documentId}.` }
  }

  recordRefundLoss(
    amount: number,
    currency: string,
    ref: string,
  ): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    this.accounting.recordRefundLoss(amount, currency, ref)
    this.metrics.recordRefundLoss()
    this.events.emit('finance.refund_loss.recorded', { amount, currency, ref })
    return {
      ok: true,
      explanation: `Recorded refund loss of ${amount} ${currency}.`,
    }
  }

  getReport(currency = 'SAR'): FinancePlatformResult | FinanceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const report = this.reports.snapshot(currency)
    this.metrics.recordReport()
    this.events.emit('finance.report.generated', { currency })
    return {
      ok: true,
      report,
      explanation: `Revenue ${report.revenue} ${currency}; profit ${report.profit}; VAT ${report.vatPayable}.`,
    }
  }

  seedDemoLedger(): void {
    if (this.demoSeeded) return
    this.demoSeeded = true

    const bookings: RevenueLineInput[] = [
      {
        bookingId: 'bk_paris_1',
        supplierId: 'sup_air_paris',
        serviceKind: 'flight',
        channel: 'b2c' as PricingChannel,
        destination: 'Paris',
        country: 'FR',
        customerId: 'cust_1',
        baseFare: 2200,
        currency: 'SAR',
        supplierCommissionPercent: 8,
        rahhalMarkupPercent: 10,
        agencyCommissionPercent: 2,
        taxCountry: 'SA',
      },
      {
        bookingId: 'bk_paris_2',
        supplierId: 'sup_hotel_paris',
        serviceKind: 'hotel',
        channel: 'corporate',
        destination: 'Paris',
        country: 'FR',
        customerId: 'corp_1',
        baseFare: 1800,
        currency: 'SAR',
        rahhalMarkupPercent: 12,
        corporateDiscountPercent: 10,
        taxCountry: 'SA',
      },
      {
        bookingId: 'bk_dubai_1',
        supplierId: 'sup_air_dubai',
        serviceKind: 'flight',
        channel: 'vip',
        destination: 'Dubai',
        country: 'AE',
        customerId: 'cust_2',
        baseFare: 1500,
        currency: 'SAR',
        rahhalMarkupPercent: 15,
        affiliateCommissionPercent: 5,
        taxCountry: 'SA',
      },
      {
        bookingId: 'bk_london_1',
        supplierId: 'sup_car_london',
        serviceKind: 'car',
        channel: 'b2b',
        destination: 'London',
        country: 'GB',
        customerId: 'cust_3',
        baseFare: 900,
        currency: 'SAR',
        rahhalMarkupPercent: 6,
        taxCountry: 'SA',
      },
    ]

    for (const b of bookings) {
      const breakdown = this.revenue.recognize(b)
      this.accounting.postRevenue(breakdown)
      this.invoices.fromRevenue(breakdown, b.customerId ?? b.supplierId)
      this.metrics.recordRevenue()
    }

    this.affiliate.register('Travel Partners', 5)
    this.accounting.recordRefundLoss(120, 'SAR', 'rf_demo_1')
    this.metrics.recordRefundLoss()

    this.settlements.create({
      supplierId: 'sup_air_paris',
      amount: 1500,
      currency: 'SAR',
      cadence: 'weekly',
    })
    this.settlements.create({
      supplierId: 'sup_hotel_paris',
      amount: 800,
      currency: 'EUR',
      settlementCurrency: 'SAR',
      cadence: 'monthly',
    })
    this.metrics.recordSettlementCreated()
    this.metrics.recordSettlementCreated()

    const customerWallet = this.wallets.open('cust_1', 'customer', 'SAR')
    this.wallets.deposit(customerWallet.walletId, 500, 'demo deposit')
    this.wallets.open('corp_1', 'corporate', 'SAR')
    this.wallets.open('sup_air_paris', 'supplier', 'SAR')
    this.wallets.open('cust_1', 'refund', 'SAR')
    this.wallets.open('cust_1', 'travel_credit', 'SAR')
    this.wallets.open('cust_1', 'reward', 'SAR')
  }

  ensureDemo(): void {
    if (!this.isEnabled()) return
    this.seedDemoLedger()
  }

  answerRevenueThisMonth(currency = 'SAR'): string {
    this.ensureDemo()
    this.metrics.recordConversationQuery()
    const amount = this.analytics.revenueThisMonth(currency)
    return `Bilamo generated ${amount.toFixed(2)} ${currency} in revenue this month.`
  }

  answerProfitFromDestination(destination: string, currency = 'SAR'): string {
    this.ensureDemo()
    this.metrics.recordConversationQuery()
    const profit = this.analytics.profitByDestination(destination, currency)
    return `Profit from ${destination} is ${profit.toFixed(2)} ${currency}.`
  }

  answerHighestMarginSupplier(currency = 'SAR'): string {
    this.ensureDemo()
    this.metrics.recordConversationQuery()
    const best = this.analytics.highestMarginSupplier(currency)
    if (!best) return 'No supplier margin data is available yet.'
    return `Supplier ${best.supplierId} produced the highest margin at ${best.marginPercent}% (profit ${best.netProfit.toFixed(2)} ${currency}).`
  }

  answerUnpaidSettlements(currency = 'SAR'): string {
    this.ensureDemo()
    this.metrics.recordConversationQuery()
    const unpaid = this.settlements.list('pending').concat(this.settlements.list('partial'))
    const total = this.settlements.unpaidTotal(currency)
    if (unpaid.length === 0) return 'There are no unpaid settlements.'
    const lines = unpaid
      .slice(0, 5)
      .map(
        (s) =>
          `- ${s.settlementId}: ${s.supplierId} owes ${(s.amount - s.settledAmount).toFixed(2)} ${s.currency} (${s.status})`,
      )
    return `Unpaid settlements total ${total.toFixed(2)} ${currency}:\n${lines.join('\n')}`
  }

  answerRefundLosses(currency = 'SAR'): string {
    this.ensureDemo()
    this.metrics.recordConversationQuery()
    const losses = this.accounting.snapshot(currency).refundLosses
    return `Refund losses total ${losses.toFixed(2)} ${currency}.`
  }

  answerVatReport(currency = 'SAR'): string {
    this.ensureDemo()
    this.metrics.recordConversationQuery()
    const vat = this.reports.snapshot(currency).vatPayable
    return `VAT to report is ${vat.toFixed(2)} ${currency}.`
  }

  getRevenueEngine(): RevenueEngine {
    return this.revenue
  }

  getWalletEngine(): WalletEngine {
    return this.wallets
  }

  getSettlementEngine(): SettlementEngine {
    return this.settlements
  }

  getAccountingEngine(): AccountingEngine {
    return this.accounting
  }

  getLedgerEngine(): LedgerEngine {
    return this.ledger
  }

  getInvoiceService(): InvoiceService {
    return this.invoices
  }

  getCurrencyEngine(): CurrencyEngine {
    return this.currency
  }

  getTaxEngine(): TaxEngine {
    return this.tax
  }

  getReports(): FinancialReports {
    return this.reports
  }

  getAnalytics(): RevenueAnalytics {
    return this.analytics
  }

  getAudit(): AuditLogger {
    return this.audit
  }

  getEvents(): FinanceEvents {
    return this.events
  }

  getMetrics(): FinanceMetrics {
    return this.metrics
  }

  getAffiliateEngine(): AffiliateEngine {
    return this.affiliate
  }

  listRevenue(): RevenueBreakdown[] {
    return this.revenue.list()
  }

  listSettlements(status?: SettlementBatch['status']): SettlementBatch[] {
    return this.settlements.list(status)
  }

  listDocuments(kind?: InvoiceDocKind): FinanceDocument[] {
    return this.invoices.list(kind)
  }

  listWallets(ownerId?: string): WalletAccount[] {
    return this.wallets.list(ownerId)
  }

  reportSnapshot(currency = 'SAR'): FinanceReportSnapshot {
    return this.reports.snapshot(currency)
  }
}

export function createFinancePlatform(options?: FinancePlatformOptions): FinancePlatform {
  return new FinancePlatform(options)
}

export function isFinancePlatformResult(
  value: FinancePlatformResult | FinanceDisabledResult,
): value is FinancePlatformResult {
  return value.ok === true
}

function disabled(): FinanceDisabledResult {
  return {
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Finance platform is disabled (brain.finance_platform).',
  }
}
