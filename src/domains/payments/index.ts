/** Domain shim — payments. Recovery Phase 1: ONE payment = `lib/payment`. */
export * from '../../lib/payment'
/**
 * @deprecated Recovery Phase 1 — Sprint 34 payments platform (quarantined).
 * Use `lib/payment` for checkout. See `src/lib/payments/DEPRECATION.md`.
 */
export * as paymentsPlatform from '../../lib/payments'
