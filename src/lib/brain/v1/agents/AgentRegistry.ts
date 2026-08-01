/**
 * Sprint 83 — Agent Registry.
 * Every agent registers itself. Orchestrator never hardcodes the agent set.
 */

import type { BrainAgentDefinition, BrainAgentId } from './types'

export class AgentRegistry {
  private readonly agents = new Map<BrainAgentId, BrainAgentDefinition>()

  register(agent: BrainAgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already registered: ${agent.id}`)
    }
    this.agents.set(agent.id, agent)
  }

  unregister(id: BrainAgentId): void {
    this.agents.delete(id)
  }

  get(id: BrainAgentId): BrainAgentDefinition | undefined {
    return this.agents.get(id)
  }

  has(id: BrainAgentId): boolean {
    return this.agents.has(id)
  }

  list(): BrainAgentDefinition[] {
    return [...this.agents.values()]
  }

  ids(): BrainAgentId[] {
    return [...this.agents.keys()]
  }

  size(): number {
    return this.agents.size
  }

  clear(): void {
    this.agents.clear()
  }
}

export function createAgentRegistry(): AgentRegistry {
  return new AgentRegistry()
}
