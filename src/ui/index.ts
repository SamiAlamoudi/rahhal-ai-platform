/**
 * Sprint 119 — Bilamo Experience Phase 1 (UI Foundation) barrel.
 * Presentation architecture only — no engines, APIs, or business logic.
 */

export {
  UI_EXPERIENCE_V1_FEATURE_ID,
  isUiExperienceV1Enabled,
} from './feature'

export {
  SPRINT119_UI_EXPERIENCE_VERSION,
  spacing,
  radius,
  typography,
  elevation,
  animation,
  iconSize,
  componentSize,
  designTokens,
  tokenCssVariables,
  type DesignTokens,
} from './tokens'

export * from './common'
export * from './layout'
export * from './chat'
export * from './cards'
export * from './timeline'
export * from './loading'
export * from './home'

import { CARD_UI_MODELS } from './cards'
import { CONVERSATION_UI_PARTS } from './chat'
import { HOME_EXPERIENCE_SECTIONS } from './layout'
import { LOADING_UI_PARTS } from './loading'
import { TIMELINE_UI_PARTS } from './timeline'

/** Architecture inventory for Phase 1 — used by tests / docs. */
export const UI_EXPERIENCE_V1_ARCHITECTURE = {
  version: '1.0.0-experience-v1',
  homeSections: HOME_EXPERIENCE_SECTIONS,
  conversationParts: CONVERSATION_UI_PARTS,
  cardModels: CARD_UI_MODELS,
  timelineParts: TIMELINE_UI_PARTS,
  loadingParts: LOADING_UI_PARTS,
} as const
