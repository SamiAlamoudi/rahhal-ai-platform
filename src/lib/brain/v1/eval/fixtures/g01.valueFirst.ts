import type { GoldenScenario } from '../types'

/** G01 — Value first: preliminary value before ≤1 clarification; reject question-only. */
export const G01_VALUE_FIRST: GoldenScenario = {
  id: 'G01',
  title: 'Value First',
  locale: 'en',
  turns: [{ text: 'I want to travel to Morocco.' }],
  expected: [
    { kind: 'provided_value', equals: true },
    { kind: 'question_count_max', max: 1 },
    { kind: 'reply_not_question_only' },
    { kind: 'reply_matches', pattern: 'marrakech|agadir|casablanca|morocco' },
    { kind: 'reply_matches', pattern: 'sar|budget|indicative|preliminary|season|day' },
    { kind: 'router_path', path: 'brain' },
    { kind: 'tool_batch_null' },
    { kind: 'provider_gateway_not_called' },
  ],
  forbidden: [
    'question_only_reply',
    'exceed_one_question',
    'invoke_search',
    'invoke_provider_gateway',
    'ask_passport_in_explore',
    'ask_payment_in_explore',
    'enable_ai_tie_v1',
  ],
  metadata: { theme: 'value_before_questions' },
}
