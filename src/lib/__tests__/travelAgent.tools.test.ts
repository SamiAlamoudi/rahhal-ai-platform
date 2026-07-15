import { describe, it, expect } from 'vitest'
import {
  AGENT_TOOL_NAMES,
  createMockAgentToolRegistry,
  createUnavailableAgentToolRegistry,
} from '../agent/tools/stubs'
import { createAgentToolRegistry } from '../agent/tools/registry'
import { emptyRequirements } from '../agent/types'
import type { AgentTool } from '../agent/tools/types'

const emptySchema = { type: 'object' as const, properties: {} }

describe('agent tool registry', () => {
  it('registers mock tools with schemas and provider ids', async () => {
    const registry = createMockAgentToolRegistry()
    expect(registry.list()).toEqual(expect.arrayContaining(AGENT_TOOL_NAMES.filter((n) => n !== 'local_recommendations')))
    expect(registry.list()).toContain('attractions')
    const flights = registry.get('flights')
    expect(flights?.isAvailable()).toBe(true)
    expect(flights?.inputSchema.properties.destination).toBeTruthy()
    expect(flights?.outputSchema.properties.offers).toBeTruthy()
    expect(flights?.providerId).toBe('aggregate-flights')

    const results = await registry.runAvailable({
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
      },
      tripPlan: null,
      itinerary: null,
      locale: 'en',
    }, ['flights', 'hotels', 'weather'])
    expect(results.every((r) => r.status === 'ok')).toBe(true)
    expect(results.every((r) => r.meta?.durationMs != null)).toBe(true)
  })

  it('keeps an unavailable registry for isolation tests', async () => {
    const registry = createUnavailableAgentToolRegistry()
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
      providerId: 'test-weather',
      defaultTimeoutMs: 200,
      inputSchema: emptySchema,
      outputSchema: emptySchema,
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
