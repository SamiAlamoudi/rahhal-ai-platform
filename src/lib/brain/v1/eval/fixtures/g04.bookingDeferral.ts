import type { GoldenScenario } from '../types'

/**
 * G04 — Booking deferral: explore/planning must not ask passport, identity, payment.
 */
export const G04_BOOKING_DEFERRAL: GoldenScenario = {
  id: 'G04',
  title: 'Booking Deferral',
  locale: 'en',
  turns: [
    {
      text: 'Plan a leisure trip to Morocco from Jeddah with flexible dates',
      stage: 'explore',
    },
  ],
  expected: [
    { kind: 'provided_value', equals: true },
    { kind: 'question_count_max', max: 1 },
    {
      kind: 'question_slot_not_in',
      slots: ['passport', 'payment_consent', 'traveler_identity'],
    },
    { kind: 'router_path', path: 'brain' },
    { kind: 'tool_batch_null' },
    { kind: 'provider_gateway_not_called' },
  ],
  forbidden: [
    'ask_passport_in_explore',
    'ask_payment_in_explore',
    'ask_traveler_identity_in_explore',
    'invoke_search',
    'invoke_provider_gateway',
    'exceed_one_question',
  ],
  metadata: { theme: 'booking_fields_deferred' },
}
