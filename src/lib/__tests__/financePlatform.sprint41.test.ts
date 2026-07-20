/**
 * Sprint 41 — Universal Revenue, Finance & Settlement Platform tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  FINANCE_PLATFORM_FEATURE_ID,
  createFinancePlatform,
  createCurrencyEngine,
  createTaxEngine,
  createLedgerEngine,
  createWalletEngine,
  createCommissionEngine,
  createMarkupEngine,
  createPromotionEngine,
  createAffiliateEngine,
  createCorporatePricing,
  createProfitCalculator,
  createRevenueEngine,
  createSettlementEngine,
  createAccountingEngine,
  createInvoiceService,
  createFinancialReports,
  createRevenueAnalytics,
  createAuditLogger,
  FinanceEvents,
  FinanceMetrics,
  detectFinanceConversationQuery,
  answerFinanceQuery,
  extractDestinationFromFinanceQuery,
  isFinancePlatformEnabled,
  isFinancePlatformResult,
  type RevenueLineInput,
  type WalletKind,
} from '../finance'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { ConversationController } from '../chat/conversationExperience/ConversationController'

const WALLET_KINDS: WalletKind[] = [
  'customer',
  'corporate',
  'supplier',
  'refund',
  'travel_credit',
  'reward',
]

function enableFinanceChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
  registry.setEnabled('brain.travel_execution_engine', true)
  registry.setEnabled('brain.payments_platform', true)
  registry.setEnabled('brain.trip_management', true)
  registry.setEnabled('brain.refund_policy_engine', true)
  registry.setEnabled('brain.travel_disruption_engine', true)
  registry.setEnabled('brain.loyalty_platform', true)
  registry.setEnabled('brain.travel_documents', true)
  registry.setEnabled('brain.supplier_marketplace', true)
  registry.setEnabled('brain.finance_platform', true)
}

function sampleRevenue(overrides: Partial<RevenueLineInput> = {}): RevenueLineInput {
  return {
    bookingId: 'bk_test_1',
    supplierId: 'sup_air_1',
    serviceKind: 'flight',
    channel: 'b2c',
    destination: 'Paris',
    country: 'FR',
    customerId: 'cust_1',
    baseFare: 1000,
    currency: 'SAR',
    supplierCommissionPercent: 10,
    rahhalMarkupPercent: 8,
    agencyCommissionPercent: 2,
    taxCountry: 'SA',
    ...overrides,
  }
}

describe('Sprint 41 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.finance_platform disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(FINANCE_PLATFORM_FEATURE_ID)).toBe(false)
    expect(isFinancePlatformEnabled()).toBe(false)
  })

  it('requires brain.supplier_marketplace before brain.finance_platform', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.finance_platform', true)
    expect(registry.isEnabled('brain.finance_platform')).toBe(false)
    enableFinanceChain()
    expect(registry.isEnabled('brain.finance_platform')).toBe(true)
    expect(isFinancePlatformEnabled()).toBe(true)
  })

  it('feature definition depends on supplier_marketplace', () => {
    const def = getFeatureRegistry().list().find((f) => f.id === FINANCE_PLATFORM_FEATURE_ID)
    expect(def?.dependsOn).toContain('brain.supplier_marketplace')
    expect(def?.enabled).toBe(false)
  })

  it('platform returns FEATURE_DISABLED when off', () => {
    const platform = createFinancePlatform({ enabled: false })
    const result = platform.recognizeRevenue(sampleRevenue())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FEATURE_DISABLED')
  })
})

describe('Currency and tax engines', () => {
  it('converts multi-currency amounts via SAR pivot', () => {
    const fx = createCurrencyEngine()
    expect(fx.convert(10, 'USD', 'USD')).toBe(10)
    expect(fx.rate('USD', 'SAR')).toBeGreaterThan(1)
    fx.setRate('JPY', 0.025)
    expect(fx.supported()).toContain('JPY')
    expect(fx.historical('JPY/SAR').length).toBeGreaterThan(0)
  })

  it('resolves VAT/GST/sales tax adapters by country', () => {
    const tax = createTaxEngine()
    expect(tax.calculate(100, 'SA').kind).toBe('vat')
    expect(tax.calculate(100, 'SA').tax).toBe(15)
    expect(tax.calculate(100, 'IN').kind).toBe('gst')
    expect(tax.calculate(100, 'US').kind).toBe('sales_tax')
    const custom = tax.registerCustom('EG', 14)
    expect(custom.kind).toBe('custom')
    expect(tax.listAdapters().some((a) => a.country === 'EG')).toBe(true)
  })
})

describe('Commission, markup, promotion, corporate pricing', () => {
  it('computes supplier, agency, and affiliate commissions', () => {
    const c = createCommissionEngine()
    expect(c.supplierCommission(1000, 10)).toBe(100)
    expect(c.agencyCommission(500, 5)).toBe(25)
    expect(c.affiliateCommission(200, 3)).toBe(6)
  })

  it('applies channel markup factors', () => {
    const m = createMarkupEngine()
    expect(m.rahhalMarkup(1000, 8, 'b2c')).toBe(80)
    expect(m.rahhalMarkup(1000, 8, 'corporate')).toBeLessThan(80)
    expect(m.channelFactor('vip')).toBeGreaterThan(1)
  })

  it('applies coupons, promo percent, cashback, and reward points', () => {
    const p = createPromotionEngine()
    expect(p.couponDiscount(200, 50)).toBe(50)
    expect(p.promoPercentDiscount(200, 10)).toBe(20)
    expect(p.cashback(200, 30)).toBe(30)
    expect(p.rewardPointsValue(1000, 100)).toBe(10)
  })

  it('supports corporate / VIP / membership / country pricing', () => {
    const corp = createCorporatePricing()
    expect(corp.discountPercent('corporate')).toBe(12)
    expect(corp.discountPercent('membership', 'diamond')).toBe(10)
    expect(corp.countryMultiplier('US')).toBeGreaterThan(1)
    expect(corp.apply(1000, 'b2b', 'SA')).toBeLessThan(1000)
  })

  it('calculates profit and margin', () => {
    const profit = createProfitCalculator()
    const p = profit.profit({
      rahhalMarkup: 100,
      serviceFee: 25,
      otherFees: 0,
      agencyCommission: 10,
      affiliateCommission: 5,
      cashback: 5,
    })
    expect(p).toBe(105)
    expect(profit.marginPercent(50, 200)).toBe(25)
    expect(profit.marginPercent(10, 0)).toBe(0)
  })
})

describe('Ledger and accounting', () => {
  it('posts balanced double-entry pairs', () => {
    const ledger = createLedgerEngine()
    ledger.postPair({
      debitAccount: 'cash',
      creditAccount: 'revenue',
      amount: 100,
      currency: 'SAR',
      ref: 'bk1',
      note: 'test',
    })
    expect(ledger.balance('cash', 'SAR')).toBe(100)
    expect(ledger.balance('revenue', 'SAR')).toBe(-100)
    expect(ledger.list('cash')).toHaveLength(1)
  })

  it('tracks payables, receivables, and refund losses', () => {
    const ledger = createLedgerEngine()
    const accounting = createAccountingEngine(ledger)
    const platform = createFinancePlatform({ enabled: true, ledger, accounting })
    const recognized = platform.recognizeRevenue(
      sampleRevenue({ partialPaymentAmount: 100, baseFare: 1000 }),
    )
    expect(isFinancePlatformResult(recognized)).toBe(true)
    platform.recordRefundLoss(40, 'SAR', 'rf1')
    const snap = accounting.snapshot('SAR')
    expect(snap.refundLosses).toBe(40)
    expect(snap.revenue).toBeGreaterThan(0)
  })
})

describe('Wallet engine', () => {
  it('supports all wallet kinds and core operations', () => {
    const wallets = createWalletEngine()
    for (const kind of WALLET_KINDS) {
      const w = wallets.open(`owner_${kind}`, kind, 'SAR')
      expect(w.kind).toBe(kind)
      const dep = wallets.deposit(w.walletId, 100)
      expect('ok' in dep).toBe(false)
      const fr = wallets.freeze(w.walletId, 40)
      expect('ok' in fr).toBe(false)
      const rel = wallets.release(w.walletId, 20)
      expect('ok' in rel).toBe(false)
      const wd = wallets.withdraw(w.walletId, 10)
      expect('ok' in wd).toBe(false)
    }
    expect(Object.keys(wallets.totalsByKind())).toHaveLength(6)
  })

  it('transfers, rolls back, and expires wallets', () => {
    const wallets = createWalletEngine()
    const a = wallets.open('u1', 'customer', 'SAR')
    const b = wallets.open('u2', 'customer', 'SAR')
    wallets.deposit(a.walletId, 100)
    const tx = wallets.transfer(a.walletId, b.walletId, 30)
    expect('ok' in tx).toBe(false)
    expect(wallets.get(b.walletId)?.balance).toBe(30)
    const dep = wallets.deposit(a.walletId, 20)
    if (!('ok' in dep)) {
      wallets.rollback(dep.txnId)
      expect(wallets.get(a.walletId)?.balance).toBe(70)
    }
    const expiring = wallets.open('u3', 'travel_credit', 'SAR', '2000-01-01T00:00:00.000Z')
    wallets.deposit(expiring.walletId, 50)
    const expired = wallets.expire(expiring.walletId)
    expect('ok' in expired).toBe(false)
    expect(wallets.get(expiring.walletId)?.balance).toBe(0)
  })

  it('rejects insufficient funds', () => {
    const wallets = createWalletEngine()
    const w = wallets.open('u1', 'customer')
    const result = wallets.withdraw(w.walletId, 10)
    expect('ok' in result && result.ok === false).toBe(true)
  })
})

describe('Revenue recognition', () => {
  it('recognizes full revenue stack including taxes and wallet usage', () => {
    const platform = createFinancePlatform({ enabled: true })
    const result = platform.recognizeRevenue(
      sampleRevenue({
        couponDiscount: 50,
        promoDiscountPercent: 5,
        cashbackAmount: 10,
        rewardPointsRedeemed: 500,
        walletAmountUsed: 100,
        serviceFee: 25,
        otherFees: 5,
        affiliateCommissionPercent: 4,
      }),
    )
    expect(isFinancePlatformResult(result)).toBe(true)
    if (!isFinancePlatformResult(result)) return
    expect(result.breakdown?.tax).toBeGreaterThan(0)
    expect(result.breakdown?.rahhalRevenue).toBeGreaterThan(0)
    expect(result.breakdown?.customerTotal).toBeGreaterThan(0)
    expect(result.document?.kind).toBe('invoice')
  })

  it('supports all pricing channels', () => {
    const platform = createFinancePlatform({ enabled: true })
    for (const channel of ['b2c', 'b2b', 'corporate', 'vip', 'membership'] as const) {
      const result = platform.recognizeRevenue(
        sampleRevenue({ bookingId: `bk_${channel}`, channel }),
      )
      expect(isFinancePlatformResult(result)).toBe(true)
    }
    expect(platform.listRevenue()).toHaveLength(5)
  })

  it('supports all finance service kinds', () => {
    const platform = createFinancePlatform({ enabled: true })
    for (const serviceKind of [
      'flight',
      'hotel',
      'car',
      'activity',
      'insurance',
      'visa',
      'future',
    ] as const) {
      const result = platform.recognizeRevenue(
        sampleRevenue({ bookingId: `bk_${serviceKind}`, serviceKind, supplierId: `sup_${serviceKind}` }),
      )
      expect(isFinancePlatformResult(result)).toBe(true)
    }
  })
})

describe('Settlement engine', () => {
  it('creates and settles daily/weekly/monthly/manual/automatic/partial batches', () => {
    const fx = createCurrencyEngine()
    const settlements = createSettlementEngine(fx)
    const daily = settlements.create({
      supplierId: 'airline_1',
      amount: 1000,
      currency: 'SAR',
      cadence: 'daily',
    })
    expect(daily.status).toBe('pending')
    const partial = settlements.settle(daily.settlementId, 400, 'automatic')
    expect(partial?.status).toBe('partial')
    const done = settlements.settle(daily.settlementId, 600, 'manual')
    expect(done?.status).toBe('settled')
    expect(done?.cadence).toBe('manual')

    const multi = settlements.create({
      supplierId: 'hotel_1',
      amount: 100,
      currency: 'EUR',
      settlementCurrency: 'SAR',
      cadence: 'monthly',
    })
    expect(multi.fxRate).toBeGreaterThan(0)
    expect(settlements.unpaidTotal('SAR')).toBeGreaterThan(0)
  })

  it('platform settlement APIs emit metrics', () => {
    const platform = createFinancePlatform({ enabled: true })
    const created = platform.createSettlement({
      supplierId: 'sup_x',
      amount: 250,
      currency: 'SAR',
      cadence: 'weekly',
    })
    expect(isFinancePlatformResult(created)).toBe(true)
    if (!isFinancePlatformResult(created)) return
    const settled = platform.settle(created.settlement!.settlementId)
    expect(isFinancePlatformResult(settled)).toBe(true)
    expect(platform.getMetrics().snapshot().settlementsCreated).toBe(1)
    expect(platform.getMetrics().snapshot().settlementsPaid).toBe(1)
  })
})

describe('Invoices and documents', () => {
  it('issues invoice, receipt, credit/debit notes, and statements', () => {
    const invoices = createInvoiceService()
    const kinds = [
      'invoice',
      'receipt',
      'credit_note',
      'debit_note',
      'settlement_report',
      'supplier_statement',
      'customer_statement',
      'corporate_statement',
    ] as const
    for (const kind of kinds) {
      const doc = invoices.issue({
        kind,
        partyId: 'party_1',
        currency: 'SAR',
        lines: [{ label: 'Line', amount: 10 }],
      })
      expect(doc.kind).toBe(kind)
      expect(doc.total).toBe(10)
    }
    expect(invoices.list()).toHaveLength(kinds.length)
  })
})

describe('Reports and analytics', () => {
  it('builds full financial report snapshot', () => {
    const platform = createFinancePlatform({ enabled: true })
    platform.seedDemoLedger()
    const report = platform.reportSnapshot('SAR')
    expect(report.revenue).toBeGreaterThan(0)
    expect(report.profit).not.toBeUndefined()
    expect(report.vatPayable).toBeGreaterThan(0)
    expect(report.outstandingSuppliers).toBeGreaterThan(0)
    expect(report.refundLosses).toBeGreaterThan(0)
    expect(Object.keys(report.salesByDestination).length).toBeGreaterThan(0)
    expect(report.topSuppliers.length).toBeGreaterThan(0)
  })

  it('analytics answers month revenue, destination profit, and top margin supplier', () => {
    const platform = createFinancePlatform({ enabled: true })
    platform.seedDemoLedger()
    const analytics = platform.getAnalytics()
    expect(analytics.revenueThisMonth('SAR')).toBeGreaterThan(0)
    expect(analytics.profitByDestination('Paris', 'SAR')).toBeGreaterThan(0)
    const best = analytics.highestMarginSupplier('SAR')
    expect(best?.supplierId).toBeTruthy()
    expect(analytics.summary('SAR').bookings).toBeGreaterThan(0)
  })

  it('financial reports factory wires engines', () => {
    const currency = createCurrencyEngine()
    const commission = createCommissionEngine()
    const markup = createMarkupEngine()
    const promotion = createPromotionEngine()
    const tax = createTaxEngine()
    const corporate = createCorporatePricing()
    const profit = createProfitCalculator()
    const revenue = createRevenueEngine({
      commission,
      markup,
      promotion,
      tax,
      corporate,
      profit,
    })
    revenue.recognize(sampleRevenue())
    const wallets = createWalletEngine()
    const settlements = createSettlementEngine(currency)
    const accounting = createAccountingEngine(createLedgerEngine())
    const reports = createFinancialReports({ revenue, wallets, settlements, accounting })
    expect(reports.snapshot('SAR').revenue).toBeGreaterThan(0)
    expect(createRevenueAnalytics(revenue).summary().bookings).toBe(1)
  })
})

describe('Affiliate, audit, events, metrics', () => {
  it('tracks affiliate earnings', () => {
    const aff = createAffiliateEngine()
    const partner = aff.register('Partner A', 4)
    aff.recordEarning(partner.affiliateId, 'bk1', 12, 'SAR')
    expect(aff.totalFor(partner.affiliateId)).toBe(12)
    expect(aff.list()).toHaveLength(1)
  })

  it('logs audit entries and emits finance events', () => {
    const audit = createAuditLogger()
    audit.log('test', 'booking', 'bk1', { x: 1 })
    expect(audit.list({ action: 'test' })).toHaveLength(1)
    const events = new FinanceEvents()
    let seen = 0
    events.on('finance.report.generated', () => {
      seen += 1
    })
    events.emit('finance.report.generated', { currency: 'SAR' })
    expect(seen).toBe(1)
    expect(events.list()).toHaveLength(1)
  })

  it('records finance metrics counters', () => {
    const metrics = new FinanceMetrics()
    metrics.recordRevenue()
    metrics.recordWalletOp()
    metrics.recordSettlementCreated()
    metrics.recordSettlementPaid()
    metrics.recordInvoice()
    metrics.recordRefundLoss()
    metrics.recordReport()
    metrics.recordConversationQuery()
    const snap = metrics.snapshot()
    expect(snap.revenueRecognitions).toBe(1)
    expect(snap.conversationQueries).toBe(1)
    metrics.reset()
    expect(metrics.snapshot().revenueRecognitions).toBe(0)
  })
})

describe('Finance conversation detection', () => {
  it('detects all six finance conversation intents', () => {
    expect(detectFinanceConversationQuery('How much revenue did Rahhal generate this month?')).toBe(
      'finance_revenue_month',
    )
    expect(detectFinanceConversationQuery('What was our profit from Paris?')).toBe(
      'finance_profit_destination',
    )
    expect(detectFinanceConversationQuery('Which supplier produced the highest margin?')).toBe(
      'finance_highest_margin_supplier',
    )
    expect(detectFinanceConversationQuery('Show unpaid settlements.')).toBe(
      'finance_unpaid_settlements',
    )
    expect(detectFinanceConversationQuery('Show refund losses.')).toBe('finance_refund_losses')
    expect(detectFinanceConversationQuery('How much VAT should be reported?')).toBe(
      'finance_vat_report',
    )
  })

  it('extracts destination from profit queries', () => {
    expect(extractDestinationFromFinanceQuery('What was our profit from Dubai?')).toBe('Dubai')
    expect(extractDestinationFromFinanceQuery('profit in London')).toBe('London')
  })

  it('answers finance queries via platform helpers', () => {
    const platform = createFinancePlatform({ enabled: true })
    const revenue = answerFinanceQuery({ kind: 'finance_revenue_month', platform })
    expect(revenue).toMatch(/revenue this month/i)
    expect(answerFinanceQuery({ kind: 'finance_profit_destination', platform, userText: 'profit from Paris' })).toMatch(
      /Paris/i,
    )
    expect(answerFinanceQuery({ kind: 'finance_highest_margin_supplier', platform })).toMatch(/margin/i)
    expect(answerFinanceQuery({ kind: 'finance_unpaid_settlements', platform })).toMatch(/settlement/i)
    expect(answerFinanceQuery({ kind: 'finance_refund_losses', platform })).toMatch(/Refund losses/i)
    expect(answerFinanceQuery({ kind: 'finance_vat_report', platform })).toMatch(/VAT/i)
  })

  it('maps conversation commands for finance phrases', () => {
    expect(detectConversationCommand('How much revenue did Rahhal generate this month?')).toBe(
      'finance_revenue_month',
    )
    expect(detectConversationCommand('Which supplier produced the highest margin?')).toBe(
      'finance_highest_margin_supplier',
    )
    expect(detectConversationCommand('Show unpaid settlements.')).toBe('finance_unpaid_settlements')
    expect(detectConversationCommand('How much VAT should be reported?')).toBe('finance_vat_report')
  })
})

describe('ConversationController finance integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    enableFinanceChain()
  })
  afterEach(() => resetFeatureRegistry())

  it('answers revenue month via conversation controller', async () => {
    const platform = createFinancePlatform({ enabled: true })
    const controller = ConversationController({
      enabled: true,
      financePlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const result = await controller.handleTurn({
      conversationId: 'fin-conv-1',
      userText: 'How much revenue did Rahhal generate this month?',
      locale: 'en',
    })
    expect(result.commandKind).toBe('finance_revenue_month')
    expect(result.renderedText).toMatch(/revenue this month/i)
    expect(result.assistantMessage.meta?.financePlatform).toBe(true)
  })

  it('answers unpaid settlements and VAT via conversation controller', async () => {
    const platform = createFinancePlatform({ enabled: true })
    const controller = ConversationController({
      enabled: true,
      financePlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const unpaid = await controller.handleTurn({
      conversationId: 'fin-conv-2',
      userText: 'Show unpaid settlements.',
      locale: 'en',
    })
    expect(unpaid.commandKind).toBe('finance_unpaid_settlements')
    expect(unpaid.renderedText.toLowerCase()).toMatch(/settlement/)

    const vat = await controller.handleTurn({
      conversationId: 'fin-conv-3',
      userText: 'How much VAT should be reported?',
      locale: 'en',
    })
    expect(vat.commandKind).toBe('finance_vat_report')
    expect(vat.renderedText).toMatch(/VAT/i)
  })
})

describe('Platform wallet and document APIs', () => {
  it('opens wallets and performs ops through platform', () => {
    const platform = createFinancePlatform({ enabled: true })
    const opened = platform.openWallet('cust_x', 'customer', 'SAR')
    expect(isFinancePlatformResult(opened)).toBe(true)
    if (!isFinancePlatformResult(opened)) return
    const dep = platform.walletOp(opened.wallet!.walletId, 'deposit', 200)
    expect(isFinancePlatformResult(dep)).toBe(true)
    const other = platform.openWallet('cust_y', 'customer', 'SAR')
    if (!isFinancePlatformResult(other)) return
    const transfer = platform.transferWallet(opened.wallet!.walletId, other.wallet!.walletId, 50)
    expect(isFinancePlatformResult(transfer)).toBe(true)
  })

  it('issues settlement report documents', () => {
    const platform = createFinancePlatform({ enabled: true })
    const doc = platform.issueDocument({
      kind: 'settlement_report',
      partyId: 'sup_1',
      currency: 'SAR',
      lines: [{ label: 'Week 1', amount: 300 }],
    })
    expect(isFinancePlatformResult(doc)).toBe(true)
    expect(platform.listDocuments('settlement_report')).toHaveLength(1)
  })

  it('getReport returns snapshot explanation', () => {
    const platform = createFinancePlatform({ enabled: true })
    platform.seedDemoLedger()
    const report = platform.getReport('SAR')
    expect(isFinancePlatformResult(report)).toBe(true)
    if (!isFinancePlatformResult(report)) return
    expect(report.report?.currency).toBe('SAR')
    expect(report.explanation).toMatch(/Revenue/)
  })

  it('freeze and release through platform walletOp', () => {
    const platform = createFinancePlatform({ enabled: true })
    const opened = platform.openWallet('cust_z', 'refund', 'SAR')
    if (!isFinancePlatformResult(opened)) return
    platform.walletOp(opened.wallet!.walletId, 'deposit', 80)
    const frozen = platform.walletOp(opened.wallet!.walletId, 'freeze', 30)
    expect(isFinancePlatformResult(frozen)).toBe(true)
    expect(platform.getWalletEngine().get(opened.wallet!.walletId)?.frozen).toBe(30)
    const released = platform.walletOp(opened.wallet!.walletId, 'release', 10)
    expect(isFinancePlatformResult(released)).toBe(true)
  })
})

describe('Settlement cadences and supplier counterparties', () => {
  it('supports cadence variants across supplier categories', () => {
    const platform = createFinancePlatform({ enabled: true })
    const cadences = ['daily', 'weekly', 'monthly', 'manual', 'automatic'] as const
    const suppliers = [
      'airline_x',
      'hotel_x',
      'car_x',
      'activity_x',
      'insurance_x',
      'visa_x',
      'future_x',
    ]
    let i = 0
    for (const supplierId of suppliers) {
      const created = platform.createSettlement({
        supplierId,
        amount: 100 + i,
        currency: 'SAR',
        cadence: cadences[i % cadences.length],
      })
      expect(isFinancePlatformResult(created)).toBe(true)
      i += 1
    }
    expect(platform.listSettlements('pending').length).toBe(suppliers.length)
  })

  it('partial multi-currency settlement converts outstanding', () => {
    const platform = createFinancePlatform({ enabled: true })
    const created = platform.createSettlement({
      supplierId: 'hotel_eur',
      amount: 200,
      currency: 'EUR',
      settlementCurrency: 'SAR',
      cadence: 'weekly',
    })
    if (!isFinancePlatformResult(created)) return
    platform.settle(created.settlement!.settlementId, 50)
    expect(platform.getSettlementEngine().unpaidTotal('SAR')).toBeGreaterThan(0)
    expect(platform.listSettlements('partial')).toHaveLength(1)
  })
})

describe('Additional conversation coverage', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    enableFinanceChain()
  })
  afterEach(() => resetFeatureRegistry())

  it('answers profit destination and refund losses via controller', async () => {
    const platform = createFinancePlatform({ enabled: true })
    const controller = ConversationController({
      enabled: true,
      financePlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const profit = await controller.handleTurn({
      conversationId: 'fin-conv-4',
      userText: 'What was our profit from Paris?',
      locale: 'en',
    })
    expect(profit.commandKind).toBe('finance_profit_destination')
    expect(profit.renderedText).toMatch(/Paris/i)

    const losses = await controller.handleTurn({
      conversationId: 'fin-conv-5',
      userText: 'Show refund losses.',
      locale: 'en',
    })
    expect(losses.commandKind).toBe('finance_refund_losses')
    expect(losses.renderedText).toMatch(/Refund losses/i)
  })

  it('answers highest margin supplier via controller', async () => {
    const platform = createFinancePlatform({ enabled: true })
    const controller = ConversationController({
      enabled: true,
      financePlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const result = await controller.handleTurn({
      conversationId: 'fin-conv-6',
      userText: 'Which supplier produced the highest margin?',
      locale: 'en',
    })
    expect(result.commandKind).toBe('finance_highest_margin_supplier')
    expect(result.renderedText.toLowerCase()).toMatch(/margin/)
  })

  it('detects Arabic finance phrases', () => {
    expect(detectFinanceConversationQuery('كم الإيرادات هذا الشهر')).toBe('finance_revenue_month')
    expect(detectFinanceConversationQuery('تسويات غير مدفوعة')).toBe('finance_unpaid_settlements')
    expect(detectFinanceConversationQuery('ضريبة القيمة المضافة')).toBe('finance_vat_report')
  })
})

describe('Edge cases', () => {
  it('seedDemoLedger is idempotent', () => {
    const platform = createFinancePlatform({ enabled: true })
    platform.seedDemoLedger()
    const first = platform.listRevenue().length
    platform.seedDemoLedger()
    expect(platform.listRevenue().length).toBe(first)
  })

  it('outstanding ledger helpers distinguish payable vs receivable', () => {
    const ledger = createLedgerEngine()
    ledger.postPair({
      debitAccount: 'commission',
      creditAccount: 'payable',
      amount: 40,
      currency: 'SAR',
      ref: 'p1',
      note: 'payable',
    })
    ledger.postPair({
      debitAccount: 'receivable',
      creditAccount: 'revenue',
      amount: 25,
      currency: 'SAR',
      ref: 'r1',
      note: 'receivable',
    })
    expect(ledger.outstanding('payable', 'SAR')).toBe(40)
    expect(ledger.outstanding('receivable', 'SAR')).toBe(25)
  })

  it('platform accessors expose engines', () => {
    const platform = createFinancePlatform({ enabled: true })
    expect(platform.getCurrencyEngine().supported()).toContain('SAR')
    expect(platform.getTaxEngine().resolve('SA').kind).toBe('vat')
    expect(platform.getLedgerEngine().list()).toEqual([])
    expect(platform.getAffiliateEngine().list()).toEqual([])
    expect(platform.getEvents().list()).toEqual([])
    expect(platform.getAudit().list()).toEqual([])
  })

  it('dynamic pricing path via promo + membership channel', () => {
    const platform = createFinancePlatform({ enabled: true })
    const result = platform.recognizeRevenue(
      sampleRevenue({
        bookingId: 'bk_dyn',
        channel: 'membership',
        promoDiscountPercent: 12,
        rahhalMarkupPercent: 9,
        country: 'US',
      }),
    )
    expect(isFinancePlatformResult(result)).toBe(true)
    if (!isFinancePlatformResult(result)) return
    expect(result.breakdown?.promoDiscount).toBeGreaterThan(0)
    expect(result.breakdown?.corporateDiscount).toBeGreaterThan(0)
  })
})
