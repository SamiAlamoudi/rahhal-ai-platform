/**
 * Sprint 40 — Universal Supplier Marketplace & Contract Platform orchestrator.
 */

import {
  ContractManagement,
  createContractManagement,
  type CreateContractInput,
} from './ContractManagement'
import { InventoryEngine, createInventoryEngine, type UpsertInventoryInput } from './InventoryEngine'
import {
  SupplierEvents,
  createSupplierEvent,
  type SupplierEvent,
} from './SupplierEvents'
import { SupplierExplainer, createSupplierExplainer } from './SupplierExplainer'
import { isSupplierMarketplaceEnabled } from './SupplierFeatureFlags'
import { SupplierMetrics } from './SupplierMetrics'
import { SupplierOnboarding, createSupplierOnboarding } from './SupplierOnboarding'
import {
  SupplierPerformanceEngine,
  createSupplierPerformanceEngine,
  type PerformanceInput,
} from './SupplierPerformanceEngine'
import { SupplierDashboard, createSupplierDashboard } from './SupplierDashboard'
import {
  SupplierRankingEngine,
  createSupplierRankingEngine,
} from './SupplierRankingEngine'
import type {
  SupplierMarketplaceDisabledResult,
  SupplierMarketplaceResult,
  SupplierRankingContext,
  SupplierRegistration,
  SupplierType,
} from './types'

export interface SupplierMarketplaceOptions {
  enabled?: boolean
  onboarding?: SupplierOnboarding
  contracts?: ContractManagement
  inventory?: InventoryEngine
  performance?: SupplierPerformanceEngine
  ranking?: SupplierRankingEngine
  dashboard?: SupplierDashboard
  explainer?: SupplierExplainer
  events?: SupplierEvents
  metrics?: SupplierMetrics
  onEvent?: (event: SupplierEvent) => void
}

export class SupplierMarketplace {
  private readonly enabledOverride: boolean | undefined
  private readonly onboarding: SupplierOnboarding
  private readonly contracts: ContractManagement
  private readonly inventory: InventoryEngine
  private readonly performance: SupplierPerformanceEngine
  private readonly ranking: SupplierRankingEngine
  private readonly dashboard: SupplierDashboard
  private readonly explainer: SupplierExplainer
  private readonly events: SupplierEvents
  private readonly metrics: SupplierMetrics
  private readonly onEvent: ((event: SupplierEvent) => void) | undefined
  private readonly recent: SupplierEvent[] = []

  constructor(options: SupplierMarketplaceOptions = {}) {
    this.enabledOverride = options.enabled
    this.onboarding = options.onboarding ?? createSupplierOnboarding()
    this.contracts = options.contracts ?? createContractManagement()
    this.inventory = options.inventory ?? createInventoryEngine()
    this.performance = options.performance ?? createSupplierPerformanceEngine()
    this.ranking =
      options.ranking
      ?? createSupplierRankingEngine({
        onboarding: this.onboarding,
        contracts: this.contracts,
        performance: this.performance,
        inventory: this.inventory,
      })
    this.dashboard = options.dashboard ?? createSupplierDashboard(this.performance)
    this.explainer = options.explainer ?? createSupplierExplainer()
    this.events = options.events ?? new SupplierEvents()
    this.metrics = options.metrics ?? new SupplierMetrics()
    this.onEvent = options.onEvent
  }

  isEnabled(): boolean {
    if (typeof this.enabledOverride === 'boolean') return this.enabledOverride
    return isSupplierMarketplaceEnabled()
  }

  register(
    registration: SupplierRegistration,
    locale: 'en' | 'ar' = 'en',
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const supplier = this.onboarding.register(registration)
    this.metrics.recordRegistered(registration.supplierType)
    this.emit(createSupplierEvent('SupplierRegistered', supplier.supplierId, {
      type: registration.supplierType,
    }))
    return {
      ok: true,
      supplier,
      explanation: this.explainer.explainSupplier(supplier, locale),
    }
  }

  submitForApproval(supplierId: string): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const submitted = this.onboarding.submit(supplierId)
    if (!submitted) return notFound(supplierId)
    this.onboarding.startKyc(supplierId)
    return {
      ok: true,
      supplier: this.onboarding.get(supplierId),
      explanation: `Supplier ${supplierId} submitted and KYC pending.`,
    }
  }

  approveSupplier(
    supplierId: string,
    options?: { trusted?: boolean; premium?: boolean; kycVerified?: boolean },
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    if (options?.kycVerified !== false) this.onboarding.verifyKyc(supplierId, true)
    const supplier = this.onboarding.approve(supplierId, options)
    if (!supplier) return notFound(supplierId)
    if (supplier.status !== 'approved') {
      return {
        ok: false,
        code: 'NOT_APPROVED',
        message: supplier.rejectionReason ?? 'Supplier not approved',
      }
    }
    this.metrics.recordApproved()
    this.emit(createSupplierEvent('SupplierApproved', supplierId, {
      trusted: supplier.trusted,
      premium: supplier.premium,
    }))
    return {
      ok: true,
      supplier,
      explanation: this.explainer.explainSupplier(supplier),
    }
  }

  createContract(
    input: CreateContractInput,
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const supplier = this.onboarding.get(input.supplierId)
    if (!supplier) return notFound(input.supplierId)
    if (supplier.status !== 'approved') {
      return { ok: false, code: 'NOT_APPROVED', message: 'Supplier must be approved first' }
    }
    const contract = this.contracts.create(input)
    this.metrics.recordContract()
    this.emit(createSupplierEvent('ContractCreated', input.supplierId, {
      contractId: contract.contractId,
      pricingModel: contract.pricingModel,
    }))
    return {
      ok: true,
      supplier,
      contract,
      explanation: `Contract ${contract.contractId} created (${contract.pricingModel}).`,
    }
  }

  upsertInventory(
    input: UpsertInventoryInput,
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const supplier = this.onboarding.get(input.supplierId)
    if (!supplier || supplier.status !== 'approved') {
      return { ok: false, code: 'NOT_APPROVED', message: 'Approved supplier required' }
    }
    const item = this.inventory.upsert(input)
    return {
      ok: true,
      supplier,
      inventory: [item],
      explanation: `Inventory ${item.sku} upserted with ${item.availableUnits} units.`,
    }
  }

  syncInventory(supplierId: string): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const inventory = this.inventory.sync(supplierId)
    this.metrics.recordInventorySync()
    this.emit(createSupplierEvent('InventorySynced', supplierId, { count: inventory.length }))
    return {
      ok: true,
      inventory,
      explanation: `Synced ${inventory.length} inventory item(s).`,
    }
  }

  recordPerformance(
    input: PerformanceInput,
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const performance = this.performance.record(input)
    this.emit(createSupplierEvent('PerformanceRecorded', input.supplierId, {
      qualityScore: performance.qualityScore,
    }))
    return {
      ok: true,
      supplier: this.onboarding.get(input.supplierId),
      explanation: `Performance updated. Quality ${(performance.qualityScore * 100).toFixed(0)}%.`,
    }
  }

  rankSuppliers(
    context: SupplierRankingContext = {},
    locale: 'en' | 'ar' = 'en',
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    const ranked = this.ranking.rank(context)
    if (ranked[0]) this.metrics.recordRanking(ranked[0].score)
    this.emit(createSupplierEvent('SuppliersRanked', undefined, { count: ranked.length }))
    this.emit(createSupplierEvent('SupplierHandled', ranked[0]?.supplier.supplierId, {
      action: 'rank',
    }))
    return {
      ok: true,
      ranked,
      suppliers: ranked.map((r) => r.supplier),
      explanation: this.explainer.explainRanking(ranked, locale),
    }
  }

  getDashboard(
    supplierId: string,
    locale: 'en' | 'ar' = 'en',
  ): SupplierMarketplaceResult | SupplierMarketplaceDisabledResult {
    if (!this.isEnabled()) return disabled()
    if (!this.onboarding.get(supplierId)) return notFound(supplierId)
    const dashboard = this.dashboard.snapshot(supplierId)
    this.emit(createSupplierEvent('DashboardQueried', supplierId, {
      bookings: dashboard.kpis.bookings,
    }))
    return {
      ok: true,
      dashboard,
      explanation: this.explainer.explainDashboard(dashboard, locale),
    }
  }

  /** Seed helper used by conversation demos / tests. */
  seedDemoCatalog(): void {
    const types: SupplierType[] = [
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
    types.forEach((supplierType, index) => {
      const registered = this.onboarding.register({
        legalName: `${supplierType} Legal ${index + 1}`,
        tradeName: `${title(supplierType)} Partner ${index + 1}`,
        supplierType,
        countriesServed: ['SA', 'AE', 'US'],
        languages: ['en', 'ar'],
        currencies: ['SAR', 'USD'],
        taxId: `TAX-${index + 1}`,
        businessLicenseId: `LIC-${index + 1}`,
        bankAccountIban: `SA${1000 + index}`,
        settlementPreference: 'weekly',
        supportContacts: [{ name: 'Ops', email: `${supplierType}@example.com` }],
        operatingHours: { timezone: 'Asia/Riyadh', weekdays: '09:00-18:00', support247: index % 2 === 0 },
      })
      this.onboarding.verifyKyc(registered.supplierId, true)
      this.onboarding.approve(registered.supplierId, {
        trusted: index % 2 === 0,
        premium: supplierType === 'hotel' || index === 0,
      })
      this.contracts.create({
        supplierId: registered.supplierId,
        pricingModel: index % 2 === 0 ? 'commission' : 'net_rate',
        commissionPercent: 12,
        netRateDiscountPercent: 8,
        refundAgreement: index === 3 ? 'Slow refunds up to 21 days' : 'Refunds in 5 days',
        settlementSchedule: 'weekly',
      })
      this.inventory.upsert({
        supplierId: registered.supplierId,
        sku: `${supplierType}-sku`,
        title: `${title(supplierType)} inventory`,
        availableUnits: 20 + index,
        ratePlans: [
          {
            name: 'Standard',
            baseRate: 400 + index * 50,
            currency: 'SAR',
            dynamicPricingEnabled: true,
          },
        ],
        blackoutDates: [],
        promotions: [{ code: 'WELCOME10', percentOff: 10, expiresAt: '2027-01-01' }],
      })
      this.performance.record({
        supplierId: registered.supplierId,
        confirmationSpeedSeconds: 40 + index * 25,
        cancellationRate: 0.02 + index * 0.01,
        refundSpeedHours: index === 3 ? 120 : 24 + index * 6,
        complaintRate: index === 3 ? 0.1 : 0.01,
        customerSatisfaction: 0.95 - index * 0.03,
        responseSlaHours: 1 + index * 0.5,
        completedBookings: 100 - index * 3,
        failedConfirmations: index,
      })
      this.dashboard.recordBooking(registered.supplierId, 1000 + index * 100)
      this.dashboard.recordPendingSettlement(registered.supplierId, 200)
    })
  }

  getOnboarding(): SupplierOnboarding {
    return this.onboarding
  }

  getContracts(): ContractManagement {
    return this.contracts
  }

  getInventory(): InventoryEngine {
    return this.inventory
  }

  getPerformance(): SupplierPerformanceEngine {
    return this.performance
  }

  getDashboardService(): SupplierDashboard {
    return this.dashboard
  }

  getMetrics() {
    return this.metrics.snapshot()
  }

  getRecentEvents(limit = 50): SupplierEvent[] {
    return this.recent.slice(-limit)
  }

  private emit(event: SupplierEvent): void {
    this.recent.push(event)
    this.events.emit(event)
    this.onEvent?.(event)
  }
}

export function createSupplierMarketplace(
  options?: SupplierMarketplaceOptions,
): SupplierMarketplace {
  return new SupplierMarketplace(options)
}

export function isSupplierMarketplaceResult(
  value: SupplierMarketplaceResult | SupplierMarketplaceDisabledResult,
): value is SupplierMarketplaceResult {
  return value.ok === true
}

function disabled(): SupplierMarketplaceDisabledResult {
  return {
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Supplier marketplace is disabled (brain.supplier_marketplace).',
  }
}

function notFound(supplierId: string): SupplierMarketplaceDisabledResult {
  return {
    ok: false,
    code: 'NOT_FOUND',
    message: `Supplier ${supplierId} not found`,
  }
}

function title(value: string): string {
  return value
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}
