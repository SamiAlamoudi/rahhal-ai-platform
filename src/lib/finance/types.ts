/**
 * Sprint 41 — Universal Revenue, Finance & Settlement domain types.
 */

export type PricingChannel = 'b2c' | 'b2b' | 'corporate' | 'vip' | 'membership'

export type FinanceServiceKind =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'insurance'
  | 'visa'
  | 'future'

export type WalletKind =
  | 'customer'
  | 'corporate'
  | 'supplier'
  | 'refund'
  | 'travel_credit'
  | 'reward'

export type WalletOp =
  | 'deposit'
  | 'withdraw'
  | 'freeze'
  | 'release'
  | 'transfer'
  | 'rollback'
  | 'expiration'

export type SettlementCadence = 'daily' | 'weekly' | 'monthly' | 'manual' | 'automatic'

export type SettlementStatus = 'pending' | 'partial' | 'settled' | 'failed'

export type InvoiceDocKind =
  | 'invoice'
  | 'receipt'
  | 'credit_note'
  | 'debit_note'
  | 'settlement_report'
  | 'supplier_statement'
  | 'customer_statement'
  | 'corporate_statement'

export type TaxKind = 'vat' | 'gst' | 'sales_tax' | 'custom'

export type LedgerAccountKind =
  | 'cash'
  | 'receivable'
  | 'payable'
  | 'revenue'
  | 'expense'
  | 'tax'
  | 'commission'
  | 'refund_loss'
  | 'wallet'

export interface Money {
  amount: number
  currency: string
}

export interface RevenueLineInput {
  bookingId: string
  supplierId: string
  serviceKind: FinanceServiceKind
  channel: PricingChannel
  destination?: string | null
  country?: string | null
  customerId?: string | null
  baseFare: number
  currency: string
  supplierCommissionPercent?: number
  rahhalMarkupPercent?: number
  agencyCommissionPercent?: number
  affiliateCommissionPercent?: number
  corporateDiscountPercent?: number
  couponDiscount?: number
  promoDiscountPercent?: number
  cashbackAmount?: number
  rewardPointsRedeemed?: number
  walletAmountUsed?: number
  partialPaymentAmount?: number
  serviceFee?: number
  otherFees?: number
  taxCountry?: string
}

export interface RevenueBreakdown {
  bookingId: string
  supplierId: string
  serviceKind: FinanceServiceKind
  channel: PricingChannel
  destination: string | null
  country: string | null
  customerId: string | null
  currency: string
  recognizedAt: string
  baseFare: number
  supplierCommission: number
  rahhalMarkup: number
  agencyCommission: number
  affiliateCommission: number
  corporateDiscount: number
  couponDiscount: number
  promoDiscount: number
  cashback: number
  rewardRedemptionValue: number
  walletUsed: number
  partialPayment: number
  serviceFee: number
  otherFees: number
  tax: number
  taxKind: TaxKind
  customerTotal: number
  rahhalRevenue: number
  rahhalProfit: number
  marginPercent: number
}

export interface FinanceAuditEntry {
  entryId: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown>
  at: string
}

export interface LedgerEntry {
  entryId: string
  account: LedgerAccountKind
  debit: number
  credit: number
  currency: string
  ref: string
  note: string
  at: string
}

export interface WalletAccount {
  walletId: string
  ownerId: string
  kind: WalletKind
  balance: number
  frozen: number
  currency: string
  expiresAt?: string | null
}

export interface WalletTxn {
  txnId: string
  walletId: string
  op: WalletOp
  amount: number
  balanceAfter: number
  note: string
  at: string
  relatedTxnId?: string | null
}

export interface SettlementBatch {
  settlementId: string
  supplierId: string
  cadence: SettlementCadence
  status: SettlementStatus
  amount: number
  settledAmount: number
  currency: string
  settlementCurrency: string
  fxRate: number
  createdAt: string
  settledAt?: string | null
}

export interface FinanceDocument {
  documentId: string
  kind: InvoiceDocKind
  partyId: string
  currency: string
  total: number
  lines: Array<{ label: string; amount: number }>
  createdAt: string
}

export interface FinanceReportSnapshot {
  revenue: number
  profit: number
  marginPercent: number
  commissionTotal: number
  refundLosses: number
  walletBalances: Record<WalletKind, number>
  outstandingSuppliers: number
  outstandingCustomers: number
  salesByCountry: Record<string, number>
  salesByProvider: Record<string, number>
  salesByDestination: Record<string, number>
  salesByService: Record<string, number>
  topSuppliers: Array<{ supplierId: string; margin: number; revenue: number }>
  topCustomers: Array<{ customerId: string; spend: number }>
  vatPayable: number
  currency: string
}

export interface FinancePlatformResult {
  ok: true
  breakdown?: RevenueBreakdown
  wallet?: WalletAccount
  settlement?: SettlementBatch
  document?: FinanceDocument
  report?: FinanceReportSnapshot
  explanation: string
}

export interface FinanceDisabledResult {
  ok: false
  code: 'FEATURE_DISABLED' | 'NOT_FOUND' | 'INVALID' | 'INSUFFICIENT_FUNDS'
  message: string
}
