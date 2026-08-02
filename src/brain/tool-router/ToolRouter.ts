import type { TravelIntentId } from '../intent/intents'
import { INTENT_TOOL_MAP, type BrainToolId } from './tools'

export type ToolRoute = {
  toolId: BrainToolId
  intentId: TravelIntentId
  execute: false
  reason: string
}

/**
 * Maps intents → tool ids. Never executes integrations.
 */
export class ToolRouter {
  route(intentId: TravelIntentId): ToolRoute {
    const toolId = INTENT_TOOL_MAP[intentId]
    return {
      toolId,
      intentId,
      execute: false,
      reason: 'Foundation router — catalog selection only; no runtime integration.',
    }
  }
}
