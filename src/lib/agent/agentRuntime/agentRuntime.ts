/**
 * Phase 6 — AgentRuntime
 * Single executable runtime connecting Conversation Intelligence + LLM Brain + mock tools.
 */

import { RuntimeExecutionContext } from './executionContext'
import { runRuntimeExecutionPipeline } from './executionPipeline'
import { AgentSession } from './agentSession'
import type { AgentRuntimeInput, AgentRuntimeResult } from './types'

export const PHASE6_AGENT_RUNTIME_VERSION = 'phase6-agent-runtime-v1' as const

const sessions = new Map<string, AgentSession>()

export function getOrCreateAgentSession(sessionId: string): AgentSession {
  let session = sessions.get(sessionId)
  if (!session) {
    session = new AgentSession(sessionId)
    sessions.set(sessionId, session)
  }
  return session
}

export function resetAgentRuntimeSessions(): void {
  sessions.clear()
}

/**
 * Run one agent runtime turn (async for tool lifecycle; mock tools are sync-fast).
 */
export async function runAgentRuntime(input: AgentRuntimeInput): Promise<AgentRuntimeResult> {
  const sessionId = input.sessionId ?? 'default'
  const session = getOrCreateAgentSession(sessionId)
  session.nextTurn()
  session.setVoice(input.voiceState ?? 'thinking')
  session.setExecutionPhase('thinking')

  const ctx = new RuntimeExecutionContext({
    sessionId,
    userText: input.userText,
    locale: input.locale,
    priorMemory: input.priorMemory ?? session.getMemory(),
    recentTexts: input.recentTexts,
    voiceState: input.voiceState ?? 'thinking',
  })

  const result = await runRuntimeExecutionPipeline(ctx, {
    interruptAfter: input.interruptAfter ?? null,
    forceToolFailureOnce: input.forceToolFailureOnce,
  })

  session.replaceMemory(result.memory)
  session.setVoice(result.synced.voice)
  session.setExecutionPhase(result.synced.executionPhase)

  return {
    ...result,
    synced: session.sync(result.synced.conversation),
  }
}

export class AgentRuntime {
  private readonly sessionId: string

  constructor(sessionId = 'default') {
    this.sessionId = sessionId
  }

  async run(input: Omit<AgentRuntimeInput, 'sessionId'>): Promise<AgentRuntimeResult> {
    return runAgentRuntime({ ...input, sessionId: this.sessionId })
  }
}
