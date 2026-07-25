/**
 * Integration Sprint 11 — safe provider execution bridge.
 * Reuses Provider Runtime mock adapter only. Never enables live booking APIs.
 */

import {
  getDefaultProviderRuntimeRegistry,
  type ProviderRuntimeAdapter,
} from '../providerRuntime'
import type {
  ActionExecutionMode,
  ActionExecutionResultPayload,
  ActionKind,
} from './types'
import { FUTURE_LIVE_ACTION_CAPABILITIES } from './types'

export interface ActionExecuteDeps {
  /** Inject adapter for tests; default uses Provider Runtime mock. */
  runtimeAdapter?: ProviderRuntimeAdapter | null
  /** Force mode; live always blocked. */
  mode?: ActionExecutionMode
}

function resolveOfferId(action: ActionKind, offerId?: string | null): string {
  if (offerId?.trim()) return offerId.trim()
  switch (action) {
    case 'book_flight':
      return 'preview_flight_offer'
    case 'reserve_hotel':
      return 'preview_hotel_offer'
    case 'cancel_booking':
    case 'modify_booking':
      return 'preview_order'
    default:
      return 'preview_local'
  }
}

function localResult(
  action: ActionKind,
  mode: ActionExecutionMode,
): ActionExecutionResultPayload {
  const labels: Record<ActionKind, { en: string; ar: string }> = {
    book_flight: { en: 'Flight booking prepared', ar: 'تم تجهيز حجز الرحلة' },
    reserve_hotel: { en: 'Hotel reservation prepared', ar: 'تم تجهيز حجز الفندق' },
    save_itinerary: { en: 'Itinerary saved (local preview)', ar: 'حُفظت الخطة (معاينة محلية)' },
    share_trip: { en: 'Share link prepared (preview)', ar: 'رابط المشاركة جاهز (معاينة)' },
    cancel_booking: { en: 'Cancellation prepared', ar: 'تم تجهيز الإلغاء' },
    modify_booking: { en: 'Modification prepared', ar: 'تم تجهيز التعديل' },
  }
  return {
    success: true,
    mode,
    providerId: 'local',
    orderId: null,
    reference: `local_${action}_${Date.now().toString(36)}`,
    detailEn: labels[action].en,
    detailAr: labels[action].ar,
    liveBlocked: mode === 'live',
  }
}

function resolveMockAdapter(
  deps?: ActionExecuteDeps,
): ProviderRuntimeAdapter {
  if (deps?.runtimeAdapter) return deps.runtimeAdapter
  const registry = getDefaultProviderRuntimeRegistry()
  return registry.getProvider('mock') ?? registry.getPreferredProvider('flights')
}

/**
 * Execute in dry_run / preview / mock. Live is always blocked (future ready only).
 */
export async function executeActionSafely(input: {
  action: ActionKind
  mode: ActionExecutionMode
  offerId?: string | null
  orderId?: string | null
  deps?: ActionExecuteDeps
}): Promise<ActionExecutionResultPayload> {
  const mode = input.deps?.mode ?? input.mode

  if (mode === 'live') {
    return {
      success: false,
      mode: 'live',
      providerId: null,
      orderId: null,
      reference: null,
      detailEn:
        'Live execution is prepared (Amadeus / hotel / car / payments) but not enabled.',
      detailAr:
        'التنفيذ الحي مُجهّز (أماديوس / فندق / سيارة / دفع) لكنه غير مفعّل.',
      liveBlocked: true,
    }
  }

  if (mode === 'dry_run' || mode === 'preview') {
    const base = localResult(input.action, mode)
    return {
      ...base,
      detailEn: `${base.detailEn} · ${mode} (no provider side-effects).`,
      detailAr: `${base.detailAr} · ${mode} (بدون أثر على المزوّد).`,
      reference: `${mode}_${input.action}`,
    }
  }

  // mock — local-only for save/share; Provider Runtime mock for book/cancel/modify
  if (input.action === 'save_itinerary' || input.action === 'share_trip') {
    return localResult(input.action, 'mock')
  }

  const adapter = resolveMockAdapter(input.deps)

  if (input.action === 'cancel_booking') {
    const orderId = input.orderId ?? resolveOfferId(input.action, input.offerId)
    const cancel = await adapter.cancel({ orderId })
    return {
      success: cancel.ok,
      mode: 'mock',
      providerId: cancel.providerId,
      orderId,
      reference: cancel.ok ? `cancel_${orderId}` : null,
      detailEn: cancel.ok
        ? `Mock cancellation recorded for ${orderId}.`
        : (cancel.error ?? 'Mock cancellation failed'),
      detailAr: cancel.ok
        ? `سُجّل إلغاء تجريبي لـ ${orderId}.`
        : (cancel.error ?? 'فشل الإلغاء التجريبي'),
      liveBlocked: false,
    }
  }

  if (input.action === 'modify_booking') {
    const orderId = input.orderId ?? resolveOfferId(input.action, input.offerId)
    const refresh = await adapter.refresh({ orderId })
    return {
      success: refresh.ok,
      mode: 'mock',
      providerId: refresh.providerId,
      orderId,
      reference: `modify_${orderId}`,
      detailEn: refresh.ok
        ? `Mock modification preview for return flight / booking ${orderId}.`
        : (refresh.error ?? 'Mock modify failed'),
      detailAr: refresh.ok
        ? `معاينة تعديل تجريبية لرحلة العودة / الحجز ${orderId}.`
        : (refresh.error ?? 'فشل التعديل التجريبي'),
      liveBlocked: false,
    }
  }

  const offerId = resolveOfferId(input.action, input.offerId)
  const domain = input.action === 'reserve_hotel' ? 'hotels' as const : 'flights' as const
  const book = await adapter.book({ offerId, domain })
  return {
    success: book.ok,
    mode: 'mock',
    providerId: book.providerId,
    orderId: book.orderId ?? null,
    reference: book.orderId ?? `mock_${offerId}`,
    detailEn: book.ok
      ? `Mock ${input.action === 'reserve_hotel' ? 'hotel' : 'flight'} booking · ${book.orderId}.`
      : (book.error ?? 'Mock book failed'),
    detailAr: book.ok
      ? `حجز تجريبي (${input.action === 'reserve_hotel' ? 'فندق' : 'رحلة'}) · ${book.orderId}.`
      : (book.error ?? 'فشل الحجز التجريبي'),
    liveBlocked: false,
  }
}

export function describeFutureLiveSupport(): string {
  const caps = FUTURE_LIVE_ACTION_CAPABILITIES
  return [
    `amadeusBooking=${caps.amadeusBooking}`,
    `hotelReservation=${caps.hotelReservation}`,
    `carBooking=${caps.carBooking}`,
    `paymentGateway=${caps.paymentGateway}`,
  ].join(' · ')
}
