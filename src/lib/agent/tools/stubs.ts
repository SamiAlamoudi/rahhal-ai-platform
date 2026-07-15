import { createDefaultAggregationEngine } from '../aggregation'
import type { AgentTool, AgentToolName, ToolJsonSchema } from './types'
import { createAgentToolRegistry } from './registry'
import { createAllMockTools } from './mockTools'

export const AGENT_TOOL_NAMES: AgentToolName[] = [
  'flights',
  'hotels',
  'weather',
  'maps',
  'visa',
  'currency',
  'attractions',
  'local_recommendations',
]

const emptySchema: ToolJsonSchema = {
  type: 'object',
  properties: {},
}

function createStubTool(name: AgentToolName): AgentTool {
  return {
    name,
    providerId: `stub-${name}`,
    defaultTimeoutMs: 500,
    inputSchema: emptySchema,
    outputSchema: emptySchema,
    isAvailable: () => false,
    async execute(ctx) {
      return {
        tool: name,
        status: 'unavailable',
        summary: ctx.locale === 'ar'
          ? `أداة ${name} غير متاحة`
          : `${name} tool is unavailable`,
        error: 'not_available',
      }
    },
  }
}

/** Unavailable stubs only — useful for isolation tests. */
export function createUnavailableAgentToolRegistry() {
  return createAgentToolRegistry(AGENT_TOOL_NAMES.map(createStubTool))
}

/**
 * Default tool registry: tools call the multi-provider Aggregation Engine
 * (mock Amadeus/Duffel/Booking/… adapters). Real vendor HTTP comes later.
 */
export function createMockAgentToolRegistry() {
  const engine = createDefaultAggregationEngine()
  const registry = createAgentToolRegistry(createAllMockTools(engine))
  // Keep local_recommendations as an unavailable extension slot
  registry.register(createStubTool('local_recommendations'))
  return registry
}

/** @deprecated Prefer createMockAgentToolRegistry — default tools are mocks now. */
export function createDefaultAgentToolRegistry() {
  return createMockAgentToolRegistry()
}
