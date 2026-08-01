import type { GoldenScenario } from '../types'

/**
 * G03 — Multi-turn refinement: revise affected fields only; preserve context;
 * provenance for changed + preserved values via WorkingMemoryAdapter.
 */
export const G03_MULTI_TURN_REFINE: GoldenScenario = {
  id: 'G03',
  title: 'Multi-turn Refinement',
  locale: 'en',
  turns: [
    { text: 'I want to travel to Morocco from Riyadh' },
    { text: 'Actually make it Agadir' },
  ],
  expected: [
    { kind: 'known_slot_equals', slot: 'destination', value: 'Agadir' },
    { kind: 'known_slot_preserved', slot: 'origin', value: 'Riyadh' },
    { kind: 'plan_id_preserved' },
    { kind: 'revised_slots_include', slots: ['destination'] },
    { kind: 'revised_slots_exclude', slots: ['origin', 'budget', 'adults'] },
    { kind: 'provenance_changed', fields: ['destination'] },
    { kind: 'provenance_preserved', fields: ['origin'] },
    { kind: 'question_count_max', max: 1 },
    { kind: 'provided_value', equals: true },
    { kind: 'router_path', path: 'brain' },
    { kind: 'tool_batch_null' },
    { kind: 'provider_gateway_not_called' },
  ],
  forbidden: [
    'discard_prior_context',
    'exceed_one_question',
    'invoke_search',
    'invoke_provider_gateway',
    'ask_passport_in_explore',
  ],
  metadata: { theme: 'incremental_revise' },
}
