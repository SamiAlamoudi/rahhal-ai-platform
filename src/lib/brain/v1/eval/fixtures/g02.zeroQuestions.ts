import type { GoldenScenario } from '../types'

/** G02 — Zero questions when enough information is known. */
export const G02_ZERO_QUESTIONS: GoldenScenario = {
  id: 'G02',
  title: 'Zero Questions When Enough Is Known',
  locale: 'en',
  turns: [
    {
      text: 'flight to Morocco from Riyadh 2026-10-01 adults 2 budget 5000',
    },
  ],
  expected: [
    { kind: 'provided_value', equals: true },
    { kind: 'question_count_equals', equals: 0 },
    { kind: 'question_slot_is', slot: null },
    { kind: 'reply_not_question_only' },
    { kind: 'reply_matches', pattern: 'morocco|marrakech|riyadh|preliminary|plan|flight' },
    { kind: 'known_slot_equals', slot: 'destination', value: 'Morocco' },
    { kind: 'known_slot_equals', slot: 'origin', value: 'Riyadh' },
    { kind: 'router_path', path: 'brain' },
    { kind: 'tool_batch_null' },
    { kind: 'provider_gateway_not_called' },
  ],
  forbidden: [
    'exceed_one_question',
    'question_only_reply',
    'invoke_search',
    'invoke_provider_gateway',
    'ask_passport_in_explore',
    'ask_payment_in_explore',
    'ask_traveler_identity_in_explore',
  ],
  metadata: { theme: 'zero_questions_when_sufficient' },
}
