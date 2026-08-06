/**
 * Entity extraction — natural language → trip requirements patch.
 * Wraps the product extractFromUserText pipeline (AR/EN).
 */

import { extractFromUserText, type ExtractionResult } from '../../agent/extractRequirements'
import type { AgentLocale, TripRequirements } from '../../agent/types'
import { mergeRequirements } from '../../agent/memory'
import { inferSoftRequirements } from '../../agent/clarification'
import { applyPreferencesToRequirements } from './smartMemory'
import type { BilamoConsultantMemory } from './types'

export interface BilamoExtraction {
  locale: AgentLocale
  intent: ExtractionResult['intent']
  patch: Partial<TripRequirements>
  flags?: ExtractionResult['flags']
  /** Requirements after merge + soft inference + preference recall. */
  requirements: TripRequirements
}

export function extractBilamoEntities(input: {
  userText: string
  memory: BilamoConsultantMemory
}): BilamoExtraction {
  const extracted = extractFromUserText(input.userText, input.memory.locale)
  const locale = extracted.locale || input.memory.locale
  const merged = mergeRequirements(input.memory.agent.requirements, extracted.patch, {
    replaceDestinations: extracted.flags?.replaceDestinations === true,
  })
  const withPrefs = applyPreferencesToRequirements(merged, input.memory.preferences)
  const soft = inferSoftRequirements(withPrefs, { locale: locale === 'en' ? 'en' : 'ar' })

  return {
    locale,
    intent: extracted.intent,
    patch: extracted.patch,
    flags: extracted.flags,
    requirements: soft.requirements,
  }
}
