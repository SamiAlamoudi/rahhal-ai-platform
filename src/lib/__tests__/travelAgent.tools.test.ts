import { describe, it, expect } from 'vitest'
import { createDefaultAgentToolRegistry, AGENT_TOOL_NAMES } from '../agent/tools/stubs'
import { createAgentToolRegistry } from '../agent/tools/registry'
import { emptyRequirements } from '../agent/types'
import type { AgentTool } from '../agent/tools/types'

describe('agent tool registry', () => {
  it('registers future tools including attractions without provider-specific logic', async () => {
    const registry = createDefaultAgentToolRegistry()
    expect(registry.list()).toEqual(AGENT_TOOL_NAMES)
    expect(registry.list()).toContain('attractions')
    const results = await registry.runAvailable({
      requirements: emptyRequirements(),
      tripPlan: null,
      itinerary: null,
      locale: 'en',
    })
    expect(results.every((r) => r.status === 'unavailable')).toBe(true)
  })

  it('runs available custom tools through the abstraction', async () => {
    const weather: AgentTool = {
      name: 'weather',
      isAvailable: () => true,
      async execute() {
        return { tool: 'weather', status: 'ok', summary: 'sunny', data: { c: 30 } }
      },
    }
    const registry = createAgentToolRegistry([weather])
    const results = await registry.runAvailable({
      requirements: emptyRequirements(),
      tripPlan: null,
      itinerary: null,
      locale: 'ar',
    }, ['weather', 'flights'])
    expect(results[0]).toMatchObject({ tool: 'weather', status: 'ok' })
    expect(results[1]).toMatchObject({ tool: 'flights', status: 'unavailable' })
  })
})
