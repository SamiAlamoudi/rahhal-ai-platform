/**
 * Sprint 85 — Tool missing-field handoff.
 * Tools return structured missing fields; ConversationManager decides questions.
 * Never expands into a multi-question questionnaire here.
 */

import type { ClarificationTier } from './types'

export interface ToolMissingField {
  field: string
  tier: ClarificationTier
  reason: string
}

/**
 * Normalize provider/tool missing-field reports into structured entries.
 * Does not generate user-facing questions.
 */
export function normalizeToolMissingFields(
  fields: Array<string | ToolMissingField>,
): ToolMissingField[] {
  return fields.map((field) => {
    if (typeof field !== 'string') return field
    const optional = [
      'hotelPreference',
      'activities',
      'cabin',
      'transportation',
      'language',
      'currency',
      'specialRequests',
    ]
    const blocking = ['passport', 'payment_consent', 'traveler_identity', 'destination']
    const tier: ClarificationTier = blocking.includes(field)
      ? 'blocking'
      : optional.includes(field)
        ? 'optional'
        : 'high_impact'
    return {
      field,
      tier,
      reason: `Tool reported missing field: ${field}`,
    }
  })
}

/**
 * Guard: never turn a tool missing-field list into multiple questions.
 * Returns at most one preferred field for the conversation layer to consider.
 */
export function pickSingleToolField(
  fields: ToolMissingField[],
): ToolMissingField | null {
  if (!fields.length) return null
  const blocking = fields.find((f) => f.tier === 'blocking')
  if (blocking) return blocking
  const high = fields.find((f) => f.tier === 'high_impact')
  return high ?? null
}
