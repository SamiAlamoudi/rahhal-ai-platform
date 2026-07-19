/**
 * Sprint 40 — Universal Supplier Marketplace & Contract domain types.
 */

export type SupplierType =
  | 'airline'
  | 'hotel'
  | 'car_rental'
  | 'activity'
  | 'cruise'
  | 'insurance'
  | 'visa_provider'
  | 'airport_transfer'
  | 'rail'
  | 'bus'
  | 'future'

export type SupplierApprovalStatus =
  | 'draft'
  | 'submitted'
  | 'kyc_pending'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type ContractPricingModel =
  | 'commission'
  | 'markup'
  | 'net_rate'
  | 'public_rate'
  | 'corporate'
  | 'agency'
  | 'seasonal'
  | 'promotional'
  | 'revenue_share'

export type SettlementCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface SupplierContact {
  name: string
  email: string
  phone?: string | null
  role?: string | null
}

export interface SupplierOperatingHours {
  timezone: string
  weekdays: string
  weekends?: string | null
  support247?: boolean
}

export interface SupplierRegistration {
  legalName: string
  tradeName?: string | null
  supplierType: SupplierType
  countriesServed: string[]
  languages: string[]
  currencies: string[]
  taxId?: string | null
  businessLicenseId?: string | null
  bankAccountIban?: string | null
  settlementPreference?: SettlementCadence
  supportContacts: SupplierContact[]
  operatingHours: SupplierOperatingHours
}

export interface SupplierRecord {
  supplierId: string
  registration: SupplierRegistration
  status: SupplierApprovalStatus
  kycVerified: boolean
  trusted: boolean
  premium: boolean
  createdAt: string
  updatedAt: string
  approvedAt?: string | null
  rejectionReason?: string | null
}

export interface SupplierContract {
  contractId: string
  supplierId: string
  pricingModel: ContractPricingModel
  commissionPercent?: number | null
  markupPercent?: number | null
  netRateDiscountPercent?: number | null
  seasonalAdjustments?: Array<{ season: string; percent: number }>
  promotionalDiscountPercent?: number | null
  cancellationAgreement: string
  refundAgreement: string
  settlementSchedule: SettlementCadence
  revenueSharePercent?: number | null
  corporateEligible: boolean
  agencyEligible: boolean
  active: boolean
  effectiveFrom: string
  effectiveTo?: string | null
}

export interface InventoryRatePlan {
  planId: string
  name: string
  baseRate: number
  currency: string
  dynamicPricingEnabled: boolean
}

export interface SupplierInventoryItem {
  inventoryId: string
  supplierId: string
  sku: string
  title: string
  availableUnits: number
  ratePlans: InventoryRatePlan[]
  blackoutDates: string[]
  promotions: Array<{ code: string; percentOff: number; expiresAt: string }>
  lastSyncedAt: string
  realtime: boolean
}

export interface SupplierPerformanceSnapshot {
  supplierId: string
  reliabilityScore: number
  confirmationSpeedSeconds: number
  cancellationRate: number
  refundSpeedHours: number
  complaintRate: number
  customerSatisfaction: number
  responseSlaHours: number
  qualityScore: number
  updatedAt: string
}

export interface SupplierRankingContext {
  preferredTypes?: SupplierType[]
  travelerPreferences?: string[]
  conversationNotes?: string[]
  requireTrusted?: boolean
  preferPremium?: boolean
  avoidPoorRefundHistory?: boolean
  preferFastConfirmation?: boolean
  loyaltyValueWeight?: number
  maxPriceHint?: number | null
}

export interface RankedSupplier {
  supplier: SupplierRecord
  contract: SupplierContract | null
  performance: SupplierPerformanceSnapshot
  rank: number
  score: number
  factors: Record<string, number>
  reasons: string[]
  explanation: string
}

export interface SupplierDashboardKpis {
  bookings: number
  revenue: number
  currency: string
  pendingSettlements: number
  refunds: number
  disputes: number
  confirmationRate: number
  averageQualityScore: number
}

export interface SupplierDashboardSnapshot {
  supplierId: string
  kpis: SupplierDashboardKpis
  analytics: {
    bookingsByDay: Array<{ day: string; count: number }>
    revenueByService: Array<{ service: string; amount: number }>
  }
  performanceHistory: Array<{ at: string; qualityScore: number; reliabilityScore: number }>
  pendingSettlementAmount: number
  openDisputes: number
}

export interface SupplierMarketplaceResult {
  ok: true
  suppliers?: SupplierRecord[]
  supplier?: SupplierRecord | null
  contract?: SupplierContract | null
  inventory?: SupplierInventoryItem[]
  ranked?: RankedSupplier[]
  dashboard?: SupplierDashboardSnapshot | null
  explanation: string
}

export interface SupplierMarketplaceDisabledResult {
  ok: false
  code: 'FEATURE_DISABLED' | 'NOT_FOUND' | 'INVALID' | 'NOT_APPROVED'
  message: string
}
