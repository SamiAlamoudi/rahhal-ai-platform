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
  'transportation',
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
 * Default tool registry: flights/hotels use production Search Engines (Sprint 72/73)
 * via Provider Runtime (Sprint 71). Other domains still use Aggregation Engine mocks.
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
