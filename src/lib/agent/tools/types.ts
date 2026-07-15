import type { AgentLocale, TripRequirements, TripPlan } from '../types'

/**
 * Provider-agnostic travel tool contracts.
 * Future vendor adapters (Amadeus, Duffel, Booking.com, OpenWeather, etc.)
 * plug in behind these interfaces — never into the agent core.
 */
export type AgentToolName =
  | 'flights'
  | 'hotels'
  | 'weather'
  | 'maps'
  | 'visa'
  | 'currency'
  | 'attractions'
  | 'local_recommendations'

export type AgentToolStatus = 'ok' | 'skipped' | 'unavailable' | 'error' | 'timeout'

export interface ToolJsonSchema {
  type: 'object'
  title?: string
  required?: string[]
  properties: Record<string, {
    type: string
    description?: string
    enum?: string[]
  }>
}

export interface ToolExecutionMeta {
  startedAt: string
  finishedAt: string
  durationMs: number
  timeoutMs: number
  providerId: string
  attempt: number
}

export interface AgentToolContext {
  requirements: TripRequirements
  tripPlan: TripPlan | null
  /** Compatibility alias */
  itinerary: TripPlan | null
  locale: AgentLocale
  signal?: AbortSignal
  /** Structured input derived for this invocation */
  input?: Record<string, unknown>
}

export interface AgentToolResult {
  tool: AgentToolName
  status: AgentToolStatus
  summary: string
  data?: unknown
  error?: string | null
  meta?: ToolExecutionMeta
}

export interface AgentTool {
  readonly name: AgentToolName
  readonly providerId: string
  readonly inputSchema: ToolJsonSchema
  readonly outputSchema: ToolJsonSchema
  readonly defaultTimeoutMs: number
  isAvailable(): boolean
  execute(ctx: AgentToolContext): Promise<AgentToolResult>
}

export interface AgentToolRegistry {
  list(): AgentToolName[]
  get(name: AgentToolName): AgentTool | undefined
  register(tool: AgentTool): void
  runAvailable(ctx: AgentToolContext, names?: AgentToolName[]): Promise<AgentToolResult[]>
}

export interface ToolExecutionRequest {
  names?: AgentToolName[]
  ctx: AgentToolContext
  /** Override per-run timeout (ms) applied to every tool */
  timeoutMs?: number
}

export interface ToolExecutionBatch {
  results: AgentToolResult[]
  selected: AgentToolName[]
  okCount: number
  failedCount: number
  durationMs: number
}
