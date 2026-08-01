/**
 * Destination Knowledge catalog bootstrap.
 * To add a country: create data/<key>.ts and register it here — no planner changes.
 */

import { registerDestinationKnowledgeMany } from '../registry'
import { agadirKnowledge, moroccoKnowledge } from './morocco'
import { japanKnowledge } from './japan'
import { londonKnowledge } from './london'
import { dubaiKnowledge } from './dubai'
import { switzerlandKnowledge } from './switzerland'

let bootstrapped = false

export function ensureDestinationKnowledgeLoaded(): void {
  if (bootstrapped) return
  // Register country first, then city overlays so city aliases win (Agadir → agadir).
  registerDestinationKnowledgeMany([
    moroccoKnowledge,
    japanKnowledge,
    londonKnowledge,
    dubaiKnowledge,
    switzerlandKnowledge,
    agadirKnowledge,
  ])
  bootstrapped = true
}

/** Test helper — allows re-register after clearDestinationKnowledgeRegistryForTests. */
export function resetDestinationKnowledgeBootstrapForTests(): void {
  bootstrapped = false
}
