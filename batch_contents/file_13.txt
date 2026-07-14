import type { Coupon, CouponValidationResult, CheckoutCart } from './checkoutTypes'

const COUPONS: Map<string, Coupon> = new Map()

export function registerCoupon(coupon: Coupon): void {
  COUPONS.set(coupon.code.toUpperCase(), coupon)
}

export function getCoupon(code: string): Coupon | null {
  return COUPONS.get(code.toUpperCase()) ?? null
}

export function clearCoupons(): void {
  COUPONS.clear()
}

export function validateCoupon(
  code: string,
  cart: CheckoutCart,
): CouponValidationResult {
  const coupon = getCoupon(code)
  if (!coupon) {
    return { valid: false, coupon: null, discountAmount: 0, message: 'Coupon code not found' }
  }
  if (!coupon.active) {
    return { valid: false, coupon, discountAmount: 0, message: 'Coupon is no longer active' }
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return { valid: false, coupon, discountAmount: 0, message: 'Coupon has expired' }
  }
  if (coupon.minOrderAmount && cart.subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      message: `Minimum order amount is ${coupon.minOrderAmount} ${cart.currency}`,
    }
  }

  let discount = 0
  if (coupon.type === 'percentage') {
    discount = Math.round(cart.subtotal * (coupon.value / 100))
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount)
    }
  } else {
    discount = coupon.value
    if (coupon.currency && coupon.currency !== cart.currency) {
      return {
        valid: false,
        coupon,
        discountAmount: 0,
        message: `Coupon currency (${coupon.currency}) does not match cart (${cart.currency})`,
      }
    }
  }

  discount = Math.min(discount, cart.subtotal)

  return {
    valid: true,
    coupon,
    discountAmount: discount,
    message: `Coupon applied: ${coupon.description}`,
  }
}

registerCoupon({
  code: 'WELCOME10',
  type: 'percentage',
  value: 10,
  currency: null,
  minOrderAmount: 500,
  maxDiscount: 500,
  expiresAt: null,
  active: true,
  description: '10% off on orders above 500',
})

registerCoupon({
  code: 'RAHHAL50',
  type: 'fixed',
  value: 50,
  currency: 'SAR',
  minOrderAmount: 1000,
  maxDiscount: null,
  expiresAt: null,
  active: true,
  description: '50 SAR off on orders above 1000',
})
