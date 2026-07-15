import { createToolExecutor } from './executor'
import type { AgentTool, AgentToolName, AgentToolRegistry } from './types'

export function createAgentToolRegistry(initial: AgentTool[] = []): AgentToolRegistry {
  const tools = new Map<AgentToolName, AgentTool>()
  for (const tool of initial) tools.set(tool.name, tool)

  const asRegistry = (): AgentToolRegistry => ({
    list: () => [...tools.keys()],
    get: (name) => tools.get(name),
    register: (tool) => {
      tools.set(tool.name, tool)
    },
    runAvailable: async (ctx, names) => {
      const executor = createToolExecutor(asRegistry())
      const batch = await executor.execute({ ctx, names })
      return batch.results
    },
  })

  return asRegistry()
}
