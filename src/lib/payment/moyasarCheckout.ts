/**
 * Client helpers for Moyasar hosted checkout (redirect + return).
 * No secrets — only session continuity across the external payment hop.
 */

const ORDER_KEY = 'rahhal_checkout_order_id'
const LOCK_KEY = 'rahhal_checkout_lock_token'
const PAYMENT_KEY = 'rahhal_checkout_payment_id'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getSessionStorage(): StorageLike | null {
  try {
    const storage = (globalThis as { sessionStorage?: StorageLike }).sessionStorage
    if (!storage || typeof storage.getItem !== 'function') return null
    return storage
  } catch {
    return null
  }
}

export interface CheckoutReturnContext {
  orderId: string
  lockToken: string | null
  paymentSessionId: string | null
}

export function saveCheckoutReturnContext(ctx: CheckoutReturnContext): void {
  const storage = getSessionStorage()
  if (!storage) return
  storage.setItem(ORDER_KEY, ctx.orderId)
  if (ctx.lockToken) storage.setItem(LOCK_KEY, ctx.lockToken)
  else storage.removeItem(LOCK_KEY)
  if (ctx.paymentSessionId) storage.setItem(PAYMENT_KEY, ctx.paymentSessionId)
  else storage.removeItem(PAYMENT_KEY)
}

export function loadCheckoutReturnContext(): CheckoutReturnContext | null {
  const storage = getSessionStorage()
  if (!storage) return null
  const orderId = storage.getItem(ORDER_KEY)
  if (!orderId) return null
  return {
    orderId,
    lockToken: storage.getItem(LOCK_KEY),
    paymentSessionId: storage.getItem(PAYMENT_KEY),
  }
}

export function clearCheckoutReturnContext(): void {
  const storage = getSessionStorage()
  if (!storage) return
  storage.removeItem(ORDER_KEY)
  storage.removeItem(LOCK_KEY)
  storage.removeItem(PAYMENT_KEY)
}

/** True when URL looks like a hosted Moyasar payment page. */
export function isHostedMoyasarPaymentUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return host === 'moyasar.com' || host.endsWith('.moyasar.com')
  } catch {
    return false
  }
}

export function buildCheckoutReturnUrl(origin: string, orderId: string): string {
  const base = origin.replace(/\/+$/, '')
  return `${base}/checkout/return?orderId=${encodeURIComponent(orderId)}`
}

export function resolveOrderIdFromReturn(
  searchParams: URLSearchParams,
  stored: CheckoutReturnContext | null,
): string | null {
  return searchParams.get('orderId')
    ?? searchParams.get('order_id')
    ?? stored?.orderId
    ?? null
}

export function resolvePaymentIdFromReturn(
  searchParams: URLSearchParams,
  stored: CheckoutReturnContext | null,
): string | null {
  return searchParams.get('id')
    ?? searchParams.get('payment_id')
    ?? searchParams.get('invoice_id')
    ?? stored?.paymentSessionId
    ?? null
}

/**
 * Maps Moyasar return query `status` + refreshed provider status into a UI route.
 */
export function chooseCheckoutOutcomeRoute(
  refreshedStatus: string | null | undefined,
  queryStatus: string | null | undefined,
): '/checkout/success' | '/checkout/failure' | '/checkout/return' {
  const status = (refreshedStatus ?? queryStatus ?? '').toLowerCase()
  if (status === 'paid' || status === 'captured' || status === 'confirmed') {
    return '/checkout/success'
  }
  if (
    status === 'failed'
    || status === 'cancelled'
    || status === 'canceled'
    || status === 'voided'
    || status === 'expired'
  ) {
    return '/checkout/failure'
  }
  // Still pending — stay on return page / show pending UI via failure with message
  if (status === 'pending' || status === 'initiated' || status === 'authorized' || status === 'created') {
    return '/checkout/return'
  }
  return '/checkout/failure'
}

/** Webhook / status → order status mapping (shared with Edge Function semantics). */
export function orderStatusFromMoyasarPayment(status: string): 'paid' | 'failed' | 'cancelled' | 'pending_payment' {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'captured':
      return 'paid'
    case 'failed':
    case 'expired':
      return 'failed'
    case 'cancelled':
    case 'canceled':
    case 'voided':
      return 'cancelled'
    default:
      return 'pending_payment'
  }
}
