import { describe, it, expect } from 'vitest'
import {
  createAgentLlmProvider,
  createAgentLlmRegistry,
  getDefaultAgentLlmProviderId,
} from '../agent/llm/factory'
import { emptyMemory } from '../agent/types'

describe('agent LLM provider abstraction', () => {
  it('defaults to local provider in foundation', () => {
    expect(getDefaultAgentLlmProviderId()).toBe('local')
    expect(createAgentLlmProvider().providerId).toBe('local')
    expect(createAgentLlmProvider().isAvailable()).toBe(true)
  })

  it('registers future vendors as unavailable stubs', async () => {
    const registry = createAgentLlmRegistry('local')
    expect(registry.list()).toEqual(['local', 'openai', 'anthropic', 'gemini', 'deepseek'])
    for (const id of ['openai', 'anthropic', 'gemini', 'deepseek'] as const) {
      const provider = registry.get(id)!
      expect(provider.isAvailable()).toBe(false)
      const result = await provider.complete({
        conversationId: 'c1',
        messages: [],
        memory: emptyMemory('en'),
        locale: 'en',
      })
      expect(result.status).toBe('unavailable')
    }
    expect(registry.getActive().providerId).toBe('local')
  })
})
