/** AI sub-module shim — tool-calling (tools has no package index). */
export {
  createDefaultAgentToolRegistry,
  createMockAgentToolRegistry,
  createUnavailableAgentToolRegistry,
  AGENT_TOOL_NAMES,
} from '../../../lib/agent/tools/stubs'
export { createAgentToolRegistry } from '../../../lib/agent/tools/registry'
export { createToolExecutor } from '../../../lib/agent/tools/executor'
export { selectToolsForTurn } from '../../../lib/agent/tools/selectTools'
export { mergeToolResultsIntoPlan } from '../../../lib/agent/tools/mergeToolResults'
export { buildToolInput } from '../../../lib/agent/tools/buildToolInput'
export type {
  AgentTool,
  AgentToolName,
  AgentToolRegistry,
  AgentToolResult,
  ToolExecutionBatch,
  ToolJsonSchema,
  ToolExecutionMeta,
} from '../../../lib/agent/tools/types'
