/**
 * Sprint 40 — Universal Supplier Marketplace & Contract Platform tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  SUPPLIER_MARKETPLACE_FEATURE_ID,
  createSupplierMarketplace,
  createSupplierOnboarding,
  createContractManagement,
  createInventoryEngine,
  createSupplierPerformanceEngine,
  detectSupplierConversationQuery,
  answerSupplierQuery,
  isSupplierMarketplaceEnabled,
  isSupplierMarketplaceResult,
  type SupplierRegistration,
  type SupplierType,
} from '../suppliers'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { ConversationController } from '../chat/conversationExperience/ConversationController'

const SUPPLIER_TYPES: SupplierType[] = [
  'airline',
  'hotel',
  'car_rental',
  'activity',
  'cruise',
  'insurance',
  'visa_provider',
  'airport_transfer',
  'rail',
  'bus',
  'future',
]

function enableSupplierChain(): void {
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
}

function baseRegistration(
  type: SupplierType,
  overrides: Partial<SupplierRegistration> = {},
): SupplierRegistration {
  return {
    legalName: `${type} Co`,
    tradeName: `${type} Brand`,
    supplierType: type,
    countriesServed: ['SA', 'AE'],
    languages: ['en', 'ar'],
    currencies: ['SAR'],
    taxId: 'TAX-1',
    businessLicenseId: 'LIC-1',
    bankAccountIban: 'SA0001',
    settlementPreference: 'weekly',
    supportContacts: [{ name: 'Support', email: 'ops@example.com', phone: '+9665' }],
    operatingHours: {
      timezone: 'Asia/Riyadh',
      weekdays: '09:00-18:00',
      weekends: '10:00-14:00',
      support247: false,
    },
    ...overrides,
  }
}

describe('Sprint 40 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.supplier_marketplace disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(SUPPLIER_MARKETPLACE_FEATURE_ID)).toBe(false)
    expect(isSupplierMarketplaceEnabled()).toBe(false)
  })

  it('requires brain.travel_documents before brain.supplier_marketplace', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.supplier_marketplace', true)
    expect(registry.isEnabled('brain.supplier_marketplace')).toBe(false)
    enableSupplierChain()
    expect(registry.isEnabled('brain.supplier_marketplace')).toBe(true)
    expect(isSupplierMarketplaceEnabled()).toBe(true)
  })

  it('feature definition depends on travel_documents', () => {
    const def = getFeatureRegistry().list().find((f) => f.id === SUPPLIER_MARKETPLACE_FEATURE_ID)
    expect(def?.dependsOn).toContain('brain.travel_documents')
    expect(def?.enabled).toBe(false)
  })
})

describe('Supplier onboarding workflow', () => {
  it('registers all supplier types with KYC and approval', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    for (const type of SUPPLIER_TYPES) {
      const registered = marketplace.register(baseRegistration(type))
      expect(isSupplierMarketplaceResult(registered)).toBe(true)
      if (!isSupplierMarketplaceResult(registered)) continue
      const id = registered.supplier!.supplierId
      marketplace.submitForApproval(id)
      const approved = marketplace.approveSupplier(id, { trusted: true, premium: type === 'hotel' })
      expect(isSupplierMarketplaceResult(approved)).toBe(true)
      if (!isSupplierMarketplaceResult(approved)) continue
      expect(approved.supplier?.status).toBe('approved')
      expect(approved.supplier?.kycVerified).toBe(true)
    }
    expect(marketplace.getOnboarding().listApproved().length).toBe(SUPPLIER_TYPES.length)
  })

  it('rejects approval when bank/tax/license missing', () => {
    const onboarding = createSupplierOnboarding()
    const record = onboarding.register(
      baseRegistration('hotel', {
        taxId: null,
        businessLicenseId: null,
        bankAccountIban: null,
      }),
    )
    onboarding.verifyKyc(record.supplierId, true)
    const approved = onboarding.approve(record.supplierId)
    expect(approved?.status).toBe('rejected')
  })

  it('supports suspend and trusted/premium markers', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('airline'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id, { trusted: true, premium: true })
    const trusted = marketplace.getOnboarding().markTrusted(id, true)
    const premium = marketplace.getOnboarding().markPremium(id, true)
    expect(trusted?.trusted).toBe(true)
    expect(premium?.premium).toBe(true)
    const suspended = marketplace.getOnboarding().suspend(id, 'SLA breach')
    expect(suspended?.status).toBe('suspended')
  })
})

describe('Contract management', () => {
  it('creates commission markup net seasonal promotional and settlement terms', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('hotel'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id)

    const commission = marketplace.createContract({
      supplierId: id,
      pricingModel: 'commission',
      commissionPercent: 15,
      cancellationAgreement: 'Free cancel 48h',
      refundAgreement: 'Refund in 5 days',
      settlementSchedule: 'monthly',
      corporateEligible: true,
      agencyEligible: true,
      seasonalAdjustments: [{ season: 'summer', percent: 10 }],
      promotionalDiscountPercent: 5,
      revenueSharePercent: 2,
    })
    expect(isSupplierMarketplaceResult(commission)).toBe(true)
    if (!isSupplierMarketplaceResult(commission)) return
    expect(commission.contract?.pricingModel).toBe('commission')
    expect(commission.contract?.settlementSchedule).toBe('monthly')
    expect(commission.contract?.seasonalAdjustments?.[0].season).toBe('summer')

    const contracts = createContractManagement()
    const net = contracts.create({
      supplierId: id,
      pricingModel: 'net_rate',
      netRateDiscountPercent: 12,
    })
    expect(net.pricingModel).toBe('net_rate')
    contracts.updatePricing(net.contractId, { markupPercent: 8 })
    expect(contracts.get(net.contractId)?.markupPercent).toBe(8)
    contracts.deactivate(net.contractId)
    expect(contracts.get(net.contractId)?.active).toBe(false)
  })
})

describe('Inventory engine', () => {
  it('upserts inventory with rate plans blackouts promotions and sync', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('activity'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id)
    const inv = marketplace.upsertInventory({
      supplierId: id,
      sku: 'act-1',
      title: 'Desert safari',
      availableUnits: 12,
      ratePlans: [
        {
          name: 'Standard',
          baseRate: 350,
          currency: 'SAR',
          dynamicPricingEnabled: true,
        },
      ],
      blackoutDates: ['2026-12-25'],
      promotions: [{ code: 'SAVE10', percentOff: 10, expiresAt: '2027-01-01' }],
      realtime: true,
    })
    expect(isSupplierMarketplaceResult(inv)).toBe(true)
    if (!isSupplierMarketplaceResult(inv)) return
    const inventoryId = inv.inventory![0].inventoryId
    expect(marketplace.getInventory().isAvailable(inventoryId, '2026-12-20')).toBe(true)
    expect(marketplace.getInventory().isAvailable(inventoryId, '2026-12-25')).toBe(false)
    marketplace.getInventory().applyDynamicPrice(inventoryId, 1.2)
    const synced = marketplace.syncInventory(id)
    expect(isSupplierMarketplaceResult(synced)).toBe(true)
    if (!isSupplierMarketplaceResult(synced)) return
    expect(synced.inventory?.length).toBe(1)
  })

  it('standalone inventory engine updates existing sku', () => {
    const engine = createInventoryEngine()
    const first = engine.upsert({
      supplierId: 's1',
      sku: 'sku',
      title: 'A',
      availableUnits: 5,
      ratePlans: [{ name: 'Base', baseRate: 100, currency: 'SAR', dynamicPricingEnabled: false }],
    })
    const second = engine.upsert({
      supplierId: 's1',
      sku: 'sku',
      title: 'B',
      availableUnits: 8,
      ratePlans: [{ name: 'Base', baseRate: 120, currency: 'SAR', dynamicPricingEnabled: true }],
    })
    expect(second.inventoryId).toBe(first.inventoryId)
    expect(second.availableUnits).toBe(8)
    expect(engine.get(first.inventoryId)?.title).toBe('B')
  })
})

describe('Performance and ranking', () => {
  it('records performance metrics and ranks with all factor keys', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    const ranked = marketplace.rankSuppliers({
      requireTrusted: true,
      preferFastConfirmation: true,
      avoidPoorRefundHistory: true,
      travelerPreferences: ['hotel', 'premium'],
      conversationNotes: ['Book carefully'],
      loyaltyValueWeight: 0.9,
      maxPriceHint: 2000,
    })
    expect(isSupplierMarketplaceResult(ranked)).toBe(true)
    if (!isSupplierMarketplaceResult(ranked)) return
    expect(ranked.ranked!.length).toBeGreaterThan(0)
    const top = ranked.ranked![0]
    expect(top.rank).toBe(1)
    expect(top.factors.price).toBeDefined()
    expect(top.factors.quality).toBeDefined()
    expect(top.factors.historical_performance).toBeDefined()
    expect(top.factors.reliability).toBeDefined()
    expect(top.factors.refund_performance).toBeDefined()
    expect(top.factors.traveler_preferences).toBeDefined()
    expect(top.factors.conversation_context).toBeDefined()
    expect(top.factors.loyalty_value).toBeDefined()
    expect(top.factors.business_rules).toBeDefined()
    expect(top.explanation).toContain('Rank #1')
  })

  it('flags poor refund history and fast confirmation helpers', () => {
    const performance = createSupplierPerformanceEngine()
    performance.record({
      supplierId: 'slow',
      refundSpeedHours: 130,
      complaintRate: 0.12,
      confirmationSpeedSeconds: 200,
    })
    performance.record({
      supplierId: 'fast',
      refundSpeedHours: 12,
      complaintRate: 0.01,
      confirmationSpeedSeconds: 45,
    })
    expect(performance.hasPoorRefundHistory('slow')).toBe(true)
    expect(performance.isFastConfirmation('fast')).toBe(true)
  })

  it('premium hotel filter prefers premium hotel suppliers', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    const ranked = marketplace.rankSuppliers({
      preferPremium: true,
      preferredTypes: ['hotel'],
    })
    expect(isSupplierMarketplaceResult(ranked)).toBe(true)
    if (!isSupplierMarketplaceResult(ranked)) return
    expect(ranked.ranked!.every((r) => r.supplier.registration.supplierType === 'hotel')).toBe(true)
    expect(ranked.ranked!.every((r) => r.supplier.premium)).toBe(true)
  })
})

describe('Supplier dashboard', () => {
  it('tracks bookings revenue settlements refunds disputes and history', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('rail'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id)
    marketplace.recordPerformance({
      supplierId: id,
      confirmationSpeedSeconds: 50,
      customerSatisfaction: 0.9,
    })
    const dash = marketplace.getDashboardService()
    dash.recordBooking(id, 1500, 'SAR')
    dash.recordBooking(id, 500, 'SAR')
    dash.recordPendingSettlement(id, 400)
    dash.recordRefund(id, 100)
    dash.openDispute(id)
    const snapshot = marketplace.getDashboard(id)
    expect(isSupplierMarketplaceResult(snapshot)).toBe(true)
    if (!isSupplierMarketplaceResult(snapshot)) return
    expect(snapshot.dashboard?.kpis.bookings).toBe(2)
    expect(snapshot.dashboard?.kpis.revenue).toBe(1900)
    expect(snapshot.dashboard?.kpis.pendingSettlements).toBe(400)
    expect(snapshot.dashboard?.kpis.refunds).toBe(1)
    expect(snapshot.dashboard?.kpis.disputes).toBe(1)
    expect(snapshot.dashboard?.performanceHistory.length).toBeGreaterThan(0)
    expect(snapshot.explanation).toMatch(/Bookings|Revenue/)
  })
})

describe('Marketplace orchestration', () => {
  it('returns FEATURE_DISABLED when override off', () => {
    const marketplace = createSupplierMarketplace({ enabled: false })
    const result = marketplace.register(baseRegistration('bus'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FEATURE_DISABLED')
  })

  it('records metrics and events across lifecycle', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('cruise'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id)
    marketplace.createContract({ supplierId: id, pricingModel: 'agency', commissionPercent: 10 })
    marketplace.upsertInventory({
      supplierId: id,
      sku: 'cruise-1',
      title: 'Red Sea cruise',
      availableUnits: 4,
      ratePlans: [{ name: 'Inside', baseRate: 900, currency: 'SAR', dynamicPricingEnabled: false }],
    })
    marketplace.syncInventory(id)
    marketplace.recordPerformance({ supplierId: id, completedBookings: 20 })
    marketplace.rankSuppliers({ preferFastConfirmation: true })
    const metrics = marketplace.getMetrics()
    expect(metrics.registered).toBe(1)
    expect(metrics.approved).toBe(1)
    expect(metrics.contracts).toBe(1)
    expect(metrics.inventorySyncs).toBe(1)
    expect(metrics.rankings).toBe(1)
    const events = marketplace.getRecentEvents()
    expect(events.some((e) => e.type === 'SupplierRegistered')).toBe(true)
    expect(events.some((e) => e.type === 'SupplierApproved')).toBe(true)
    expect(events.some((e) => e.type === 'ContractCreated')).toBe(true)
    expect(events.some((e) => e.type === 'InventorySynced')).toBe(true)
    expect(events.some((e) => e.type === 'SuppliersRanked')).toBe(true)
  })
})

describe('Conversation supplier integration', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('detects supplier conversation commands', () => {
    expect(detectConversationCommand('Book only trusted suppliers.')).toBe('trusted_suppliers_only')
    expect(detectConversationCommand('Use premium hotel providers.')).toBe('premium_hotel_providers')
    expect(detectConversationCommand('Avoid suppliers with poor refund history.')).toBe(
      'avoid_poor_refunds',
    )
    expect(detectConversationCommand('Choose suppliers with fastest confirmation.')).toBe(
      'fastest_confirmation',
    )
    expect(detectSupplierConversationQuery('Book only trusted suppliers.')).toBe(
      'trusted_suppliers_only',
    )
  })

  it('answers trusted and poor-refund preferences', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const trusted = answerSupplierQuery({
      kind: 'trusted_suppliers_only',
      marketplace,
    })
    expect(trusted).toMatch(/trusted/i)
    expect(trusted).toMatch(/Best supplier|Quality/i)

    const refunds = answerSupplierQuery({
      kind: 'avoid_poor_refunds',
      marketplace,
    })
    expect(refunds).toMatch(/poor refund|refund/i)
  })

  it('ConversationController invokes SupplierMarketplace when flag on', async () => {
    enableSupplierChain()
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    const controller = ConversationController({
      enabled: true,
      supplierMarketplace: marketplace,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_sup_s40',
      userId: 'user_sup',
      userText: 'Book only trusted suppliers.',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('trusted_suppliers_only')
    expect(turn.assistantMessage.meta?.supplierMarketplace).toBe(true)
    expect(turn.renderedText).toMatch(/trusted/i)
  })

  it('handles premium hotels and fastest confirmation in conversation', async () => {
    enableSupplierChain()
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    const controller = ConversationController({
      enabled: true,
      supplierMarketplace: marketplace,
      skipPlannerOrchestrator: true,
    })
    const premium = await controller.handleTurn({
      conversationId: 'conv_prem',
      userId: 'u2',
      userText: 'Use premium hotel providers.',
      locale: 'en',
    })
    expect(premium.commandKind).toBe('premium_hotel_providers')
    expect(premium.assistantMessage.meta?.supplierMarketplace).toBe(true)

    const fast = await controller.handleTurn({
      conversationId: 'conv_fast',
      userId: 'u2',
      userText: 'Choose suppliers with fastest confirmation.',
      locale: 'en',
    })
    expect(fast.commandKind).toBe('fastest_confirmation')
    expect(fast.renderedText).toMatch(/fastest confirmation|Best supplier|Quality/i)
  })

  it('does not invoke supplier marketplace when feature flag is off', async () => {
    resetFeatureRegistry()
    const controller = ConversationController({
      enabled: true,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_flag_off_s40',
      userId: 'u1',
      userText: 'Book only trusted suppliers.',
      locale: 'en',
    })
    expect(turn.assistantMessage.meta?.supplierMarketplace).not.toBe(true)
  })
})

describe('Helpers and edge cases', () => {
  it('isEnabled respects override', () => {
    resetFeatureRegistry()
    expect(createSupplierMarketplace().isEnabled()).toBe(false)
    expect(createSupplierMarketplace({ enabled: true }).isEnabled()).toBe(true)
  })

  it('detects all supplier conversation kinds', () => {
    expect(detectSupplierConversationQuery('Book only trusted suppliers.')).toBe(
      'trusted_suppliers_only',
    )
    expect(detectSupplierConversationQuery('Use premium hotel providers.')).toBe(
      'premium_hotel_providers',
    )
    expect(detectSupplierConversationQuery('Avoid suppliers with poor refund history.')).toBe(
      'avoid_poor_refunds',
    )
    expect(detectSupplierConversationQuery('Choose suppliers with fastest confirmation.')).toBe(
      'fastest_confirmation',
    )
    expect(detectSupplierConversationQuery('Rank suppliers for me')).toBe('rank_suppliers')
    expect(detectSupplierConversationQuery('hello')).toBeNull()
  })

  it.each(SUPPLIER_TYPES)('seed demo includes supplier type %s', (type) => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    expect(
      marketplace.getOnboarding().listApproved().some((s) => s.registration.supplierType === type),
    ).toBe(true)
  })

  it('rejects unknown supplier dashboard lookup', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const result = marketplace.getDashboard('missing')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_FOUND')
  })

  it('blocks inventory upsert for unapproved supplier', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('bus'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    const result = marketplace.upsertInventory({
      supplierId: id,
      sku: 'x',
      title: 'x',
      availableUnits: 1,
      ratePlans: [{ name: 'a', baseRate: 1, currency: 'SAR', dynamicPricingEnabled: false }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_APPROVED')
  })

  it('answers rank_suppliers conversation kind', () => {
    const text = answerSupplierQuery({
      kind: 'rank_suppliers',
      marketplace: createSupplierMarketplace({ enabled: true }),
    })
    expect(text).toMatch(/Best supplier|Quality|matching suppliers/i)
  })

  it('ConversationController handles avoid poor refunds', async () => {
    enableSupplierChain()
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    const turn = await ConversationController({
      enabled: true,
      supplierMarketplace: marketplace,
      skipPlannerOrchestrator: true,
    }).handleTurn({
      conversationId: 'conv_refund_filter',
      userId: 'u3',
      userText: 'Avoid suppliers with poor refund history.',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('avoid_poor_refunds')
    expect(turn.assistantMessage.meta?.supplierMarketplace).toBe(true)
  })

  it('onboarding list filters by status', () => {
    const onboarding = createSupplierOnboarding()
    const a = onboarding.register(baseRegistration('hotel'))
    onboarding.submit(a.supplierId)
    expect(onboarding.list('submitted').length).toBe(1)
    expect(onboarding.list('approved').length).toBe(0)
  })

  it('contract listForSupplier returns created contracts', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('insurance'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id)
    marketplace.createContract({ supplierId: id, pricingModel: 'public_rate' })
    marketplace.createContract({ supplierId: id, pricingModel: 'corporate', corporateEligible: true })
    expect(marketplace.getContracts().listForSupplier(id).length).toBe(2)
    expect(marketplace.getContracts().getActiveContract(id)?.active).toBe(true)
  })

  it('explains Arabic ranking output', () => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    marketplace.seedDemoCatalog()
    const ranked = marketplace.rankSuppliers({ requireTrusted: true }, 'ar')
    expect(isSupplierMarketplaceResult(ranked)).toBe(true)
    if (!isSupplierMarketplaceResult(ranked)) return
    expect(ranked.explanation).toMatch(/أفضل مورد|درجة الجودة/)
  })

  it('kyc failure rejects supplier', () => {
    const onboarding = createSupplierOnboarding()
    const record = onboarding.register(baseRegistration('visa_provider'))
    const failed = onboarding.verifyKyc(record.supplierId, false)
    expect(failed?.status).toBe('rejected')
    expect(failed?.kycVerified).toBe(false)
  })

  it.each([
    'commission',
    'markup',
    'net_rate',
    'public_rate',
    'corporate',
    'agency',
    'seasonal',
    'promotional',
    'revenue_share',
  ] as const)('supports pricing model %s', (pricingModel) => {
    const marketplace = createSupplierMarketplace({ enabled: true })
    const registered = marketplace.register(baseRegistration('future'))
    const id = isSupplierMarketplaceResult(registered) ? registered.supplier!.supplierId : ''
    marketplace.approveSupplier(id)
    const contract = marketplace.createContract({
      supplierId: id,
      pricingModel,
      commissionPercent: 10,
      markupPercent: 5,
      netRateDiscountPercent: 7,
      revenueSharePercent: 3,
    })
    expect(isSupplierMarketplaceResult(contract)).toBe(true)
    if (!isSupplierMarketplaceResult(contract)) return
    expect(contract.contract?.pricingModel).toBe(pricingModel)
  })
})
