import type { AgentTool, AgentToolName } from './types'
import { createAgentToolRegistry } from './registry'

const TOOL_NAMES: AgentToolName[] = [
  'flights',
  'hotels',
  'weather',
  'maps',
  'visa',
  'currency',
  'local_recommendations',
]

function createStubTool(name: AgentToolName): AgentTool {
  return {
    name,
    isAvailable: () => false,
    async execute(ctx) {
      return {
        tool: name,
        status: 'unavailable',
        summary: ctx.locale === 'ar'
          ? `أداة ${name} ستُربط لاحقاً عبر طبقة المزودين`
          : `${name} tool will plug in later via the provider layer`,
      }
    },
  }
}

/** Default registry: all future tools registered as unavailable stubs. */
export function createDefaultAgentToolRegistry() {
  return createAgentToolRegistry(TOOL_NAMES.map(createStubTool))
}

export { TOOL_NAMES as AGENT_TOOL_NAMES }
