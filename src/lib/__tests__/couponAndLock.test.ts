import { describe, it, expect, beforeEach } from 'vitest'
import { validateCoupon, registerCoupon, clearCoupons, getCoupon } from '../payment/couponValidator'
import { acquireLock, releaseLock, verifyLock, getLock, clearAllLocks } from '../payment/bookingLock'
import type { CheckoutCart } from '../payment/checkoutTypes'

function sampleCart(overrides: Partial<CheckoutCart> = {}): CheckoutCart {
  return {
    items: [],
    subtotal: 5000,
    taxes: 750,
    fees: 0,
    discount: 0,
    total: 5750,
    currency: 'SAR',
    ...overrides,
  }
}

// ── Coupon Validator Tests ───────────────────────────────────────────────────

describe('CouponValidator', () => {
  beforeEach(() => {
    clearCoupons()
    registerCoupon({
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      currency: null,
      minOrderAmount: 500,
      maxDiscount: 500,
      expiresAt: null,
      active: true,
      description: '10% off',
    })
    registerCoupon({
      code: 'FLAT100',
      type: 'fixed',
      value: 100,
      currency: 'SAR',
      minOrderAmount: null,
      maxDiscount: null,
      expiresAt: null,
      active: true,
      description: '100 SAR off',
    })
    registerCoupon({
      code: 'EXPIRED',
      type: 'percentage',
      value: 20,
      currency: null,
      minOrderAmount: null,
      maxDiscount: null,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
      active: true,
      description: 'Expired coupon',
    })
    registerCoupon({
      code: 'INACTIVE',
      type: 'percentage',
      value: 15,
      currency: null,
      minOrderAmount: null,
      maxDiscount: null,
      expiresAt: null,
      active: false,
      description: 'Inactive coupon',
    })
  })

  it('validates a percentage coupon', () => {
    const result = validateCoupon('SAVE10', sampleCart({ subtotal: 1000 }))
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(100)
  })

  it('validates a fixed coupon', () => {
    const result = validateCoupon('FLAT100', sampleCart({ subtotal: 1000 }))
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(100)
  })

  it('rejects non-existent coupon', () => {
    const result = validateCoupon('NONEXISTENT', sampleCart())
    expect(result.valid).toBe(false)
    expect(result.message).toContain('not found')
  })

  it('rejects expired coupon', () => {
    const result = validateCoupon('EXPIRED', sampleCart())
    expect(result.valid).toBe(false)
    expect(result.message).toContain('expired')
  })

  it('rejects inactive coupon', () => {
    const result = validateCoupon('INACTIVE', sampleCart())
    expect(result.valid).toBe(false)
    expect(result.message).toContain('no longer active')
  })

  it('rejects coupon with unmet minimum order', () => {
    const result = validateCoupon('SAVE10', sampleCart({ subtotal: 100 }))
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Minimum order amount')
  })

  it('caps percentage discount at max discount', () => {
    const result = validateCoupon('SAVE10', sampleCart({ subtotal: 10000 }))
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(500)
  })

  it('rejects fixed coupon with currency mismatch', () => {
    registerCoupon({
      code: 'USD50',
      type: 'fixed',
      value: 50,
      currency: 'USD',
      minOrderAmount: null,
      maxDiscount: null,
      expiresAt: null,
      active: true,
      description: '50 USD off',
    })
    const result = validateCoupon('USD50', sampleCart({ currency: 'SAR' }))
    expect(result.valid).toBe(false)
    expect(result.message).toContain('currency')
  })

  it('getCoupon returns coupon by code', () => {
    const coupon = getCoupon('SAVE10')
    expect(coupon).not.toBeNull()
    expect(coupon!.code).toBe('SAVE10')
  })

  it('getCoupon returns null for non-existent', () => {
    expect(getCoupon('NONEXISTENT')).toBeNull()
  })

  it('is case-insensitive', () => {
    const result = validateCoupon('save10', sampleCart({ subtotal: 1000 }))
    expect(result.valid).toBe(true)
  })
})

// ── Booking Lock Tests ───────────────────────────────────────────────────────

describe('BookingLock', () => {
  beforeEach(() => {
    clearAllLocks()
  })

  it('acquires a lock for an order', () => {
    const lock = acquireLock('order-1', 'user-1')
    expect(lock).not.toBeNull()
    expect(lock!.status).toBe('active')
    expect(lock!.lockToken).toBeTruthy()
  })

  it('prevents duplicate lock for same order', () => {
    const lock1 = acquireLock('order-1', 'user-1')
    expect(lock1).not.toBeNull()
    const lock2 = acquireLock('order-1', 'user-1')
    expect(lock2).toBeNull()
  })

  it('verifies a valid lock', () => {
    const lock = acquireLock('order-1', 'user-1')
    expect(verifyLock('order-1', lock!.lockToken)).toBe(true)
  })

  it('rejects verification with wrong token', () => {
    acquireLock('order-1', 'user-1')
    expect(verifyLock('order-1', 'wrong-token')).toBe(false)
  })

  it('rejects verification for non-existent lock', () => {
    expect(verifyLock('non-existent', 'any-token')).toBe(false)
  })

  it('releases a lock', () => {
    const lock = acquireLock('order-1', 'user-1')
    const released = releaseLock('order-1', lock!.lockToken)
    expect(released).toBe(true)
    expect(verifyLock('order-1', lock!.lockToken)).toBe(false)
  })

  it('cannot release with wrong token', () => {
    acquireLock('order-1', 'user-1')
    expect(releaseLock('order-1', 'wrong-token')).toBe(false)
  })

  it('allows new lock after release', () => {
    const lock1 = acquireLock('order-1', 'user-1')
    releaseLock('order-1', lock1!.lockToken)
    const lock2 = acquireLock('order-1', 'user-1')
    expect(lock2).not.toBeNull()
  })

  it('getLock returns current lock', () => {
    const lock = acquireLock('order-1', 'user-1')
    const retrieved = getLock('order-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(lock!.id)
  })

  it('getLock returns null when no lock exists', () => {
    expect(getLock('non-existent')).toBeNull()
  })

  it('prevents double click — second acquire returns null', () => {
    const first = acquireLock('order-2', 'user-2')
    expect(first).not.toBeNull()
    const second = acquireLock('order-2', 'user-2')
    expect(second).toBeNull()
  })

  it('prevents refresh duplication — lock persists across calls', () => {
    acquireLock('order-3', 'user-3')
    const retry = acquireLock('order-3', 'user-3')
    expect(retry).toBeNull()
  })
})
