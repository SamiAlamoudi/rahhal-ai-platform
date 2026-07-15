import type { AgentTool, AgentToolName, AgentToolRegistry, AgentToolResult } from './types'

export function createAgentToolRegistry(initial: AgentTool[] = []): AgentToolRegistry {
  const tools = new Map<AgentToolName, AgentTool>()
  for (const tool of initial) tools.set(tool.name, tool)

  return {
    list() {
      return [...tools.keys()]
    },
    get(name) {
      return tools.get(name)
    },
    register(tool) {
      tools.set(tool.name, tool)
    },
    async runAvailable(ctx, names) {
      const selected = names ?? [...tools.keys()]
      const results: AgentToolResult[] = []
      for (const name of selected) {
        const tool = tools.get(name)
        if (!tool) {
          results.push({
            tool: name,
            status: 'unavailable',
            summary: `Tool ${name} is not registered`,
          })
          continue
        }
        if (!tool.isAvailable()) {
          results.push({
            tool: name,
            status: 'unavailable',
            summary: `Tool ${name} is not available yet`,
          })
          continue
        }
        results.push(await tool.execute(ctx))
      }
      return results
    },
  }
}
