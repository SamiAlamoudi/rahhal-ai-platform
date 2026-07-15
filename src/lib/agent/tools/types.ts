import type { AgentLocale, TripRequirements, TravelItinerary } from '../types'

/**
 * Future-facing tool abstraction. Concrete providers (Amadeus, Booking, etc.)
 * must plug in behind these interfaces — never leak vendor logic into the agent core.
 */
export type AgentToolName =
  | 'flights'
  | 'hotels'
  | 'weather'
  | 'maps'
  | 'visa'
  | 'currency'
  | 'local_recommendations'

export interface AgentToolContext {
  requirements: TripRequirements
  itinerary: TravelItinerary | null
  locale: AgentLocale
  signal?: AbortSignal
}

export interface AgentToolResult {
  tool: AgentToolName
  status: 'ok' | 'skipped' | 'unavailable'
  summary: string
  data?: unknown
}

export interface AgentTool {
  readonly name: AgentToolName
  isAvailable(): boolean
  execute(ctx: AgentToolContext): Promise<AgentToolResult>
}

export interface AgentToolRegistry {
  list(): AgentToolName[]
  get(name: AgentToolName): AgentTool | undefined
  register(tool: AgentTool): void
  runAvailable(ctx: AgentToolContext, names?: AgentToolName[]): Promise<AgentToolResult[]>
}
