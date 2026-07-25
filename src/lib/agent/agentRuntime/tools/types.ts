/**
 * Mock tool adapter contracts — no production APIs.
 */

import type { LiveTravelMemory } from '../../conversationIntelligence'
import type { RuntimeToolId, ToolLifecycleStatus } from '../types'

export interface ToolAdapterRequest {
  memory: LiveTravelMemory
  userText: string
  attempt: number
}

export interface ToolAdapterResult {
  toolId: RuntimeToolId
  status: ToolLifecycleStatus
  summary: string
  payload: Record<string, unknown>
  error?: string
}

export interface ToolAdapter {
  readonly toolId: RuntimeToolId
  execute(request: ToolAdapterRequest): Promise<ToolAdapterResult>
}
