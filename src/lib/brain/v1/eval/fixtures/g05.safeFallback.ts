import type { GoldenScenario } from '../types'

/**
 * G05 — Safe fallback when preview processing fails.
 * No silent failure · no provider execution · BrainRouter → fallback path.
 */
export const G05_SAFE_FALLBACK: GoldenScenario = {
  id: 'G05',
  title: 'Safe Fallback',
  locale: 'en',
  turns: [{ text: 'I want to travel to Morocco.' }],
  injectBrainFailure: true,
  expected: [
    { kind: 'router_path', path: 'fallback' },
    { kind: 'fallback_reason_present' },
    { kind: 'provider_gateway_not_called' },
  ],
  forbidden: [
    'silent_empty_failure',
    'invoke_search',
    'invoke_provider_gateway',
    'enable_ai_tie_v1',
  ],
  metadata: { theme: 'safe_fallback', inject: 'brain_exception' },
}
