import { describe, it, expect } from 'vitest'
import { createToolExecutor } from '../agent/tools/executor'
import { createAgentToolRegistry } from '../agent/tools/registry'
import { createMockFlightSearchTool, createMockWeatherTool } from '../agent/tools/mockTools'
import { emptyRequirements } from '../agent/types'
import type { AgentTool } from '../agent/tools/types'

describe('tool executor', () => {
  it('executes tools with timeout and metadata', async () => {
    const registry = createAgentToolRegistry([
      createMockWeatherTool(),
      createMockFlightSearchTool(),
    ])
    const executor = createToolExecutor(registry)
    const batch = await executor.execute({
      names: ['weather', 'flights'],
      ctx: {
        requirements: {
          ...emptyRequirements(),
          destination: 'Japan',
          destinations: ['Japan'],
          durationDays: 5,
          startDate: '2027-04-01',
        },
        tripPlan: null,
        itinerary: null,
        locale: 'en',
      },
    })
    expect(batch.selected).toEqual(['weather', 'flights'])
    expect(batch.okCount).toBe(2)
    const weather = batch.results.find((r) => r.tool === 'weather')
    const flights = batch.results.find((r) => r.tool === 'flights')
    expect(weather?.meta?.providerId).toBe('aggregate-weather')
    expect(flights?.meta?.providerId).toBe('flight-search-engine')
    expect(batch.results.every((r) => typeof r.meta?.timeoutMs === 'number')).toBe(true)
  })

  it('returns timeout status when a tool exceeds the limit', async () => {
    const slow: AgentTool = {
      name: 'maps',
      providerId: 'slow-maps',
      defaultTimeoutMs: 5,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      isAvailable: () => true,
      async execute() {
        await new Promise((r) => setTimeout(r, 40))
        return { tool: 'maps', status: 'ok', summary: 'late' }
      },
    }
    const executor = createToolExecutor(createAgentToolRegistry([slow]))
    const batch = await executor.execute({
      names: ['maps'],
      timeoutMs: 5,
      ctx: {
        requirements: emptyRequirements(),
        tripPlan: null,
        itinerary: null,
        locale: 'en',
      },
    })
    expect(batch.results[0]?.status).toBe('timeout')
    expect(batch.failedCount).toBe(1)
  })
})
