/**
 * Sprint 34 — Payments & Checkout Platform.
 *
 * @deprecated Recovery Phase 1 — quarantined experimental stack.
 * Active payment implementation: `src/lib/payment`.
 * See `./DEPRECATION.md`.
 *
 * Sits after TravelExecutionEngine and before final booking confirmation.
 * Distinct from src/lib/payment/ (hosted Moyasar/checkout stack).
 */

export * from './types'
export * from './PaymentErrors'
export * from './PaymentFeatureFlags'
export * from './PaymentValidator'
export * from './PaymentEvents'
export * from './PaymentAudit'
export * from './PaymentMetrics'
export * from './pricing'
export * from './PaymentSession'
export * from './PaymentIntentService'
export * from './PaymentResult'
export * from './PaymentReceipt'
export * from './InvoiceGenerator'
export * from './RefundEngine'
export * from './PaymentProviderRegistry'
export * from './PaymentOrchestrator'
export * from './providers'
export * from './conversation/payNowPrompt'
