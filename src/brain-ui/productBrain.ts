/**
 * Sole production conversation controller — TravelBrain only.
 * One shared BrainSessionController for the entire app.
 */

import { BrainSessionController } from './BrainSessionController'

let shared: BrainSessionController | null = null

export function getProductBrainController(): BrainSessionController {
  if (!shared) {
    shared = new BrainSessionController()
  }
  return shared
}

/** Test / reset helper — tears down the singleton. */
export function resetProductBrainController(): void {
  shared?.dispose()
  shared = null
}

export const PRODUCT_TURN_OWNER = 'TravelBrain.processTurn' as const
export const PRODUCT_CONVERSATION_UI = 'BrainChatPage' as const
export const PRODUCT_CONVERSATION = 'BrainProvider+BrainSessionController+TravelBrain' as const
