/**
 * Phase 6 — Runtime ExecutionPipeline
 *
 * Reuses existing modules — does NOT duplicate intelligence:
 * ConversationMemory / Intent / Entities / ReferenceResolver (CI)
 * ConversationState / ContextOptimizer / PromptBuilder / TravelReasoner /
 * ToolDecisionEngine / ConversationPlanner / ResponseComposer (llmBrain)
 *
 * Distinct from Sprint 113 orchestrator ExecutionPipeline.
 */

import {
  applyReferencesToEntities,
  extractEntities,
  detectConversationIntent,
  resolveReferences,
  updateLiveTravelMemory,
} from '../conversationIntelligence'
import {
  buildLlmBrainPrompt,
  composeConsultantResponse,
  createConversationState,
  decideTools,
  evaluateConfidence,
  optimizeContext,
  planConversationStages,
  reasonAboutTravel,
  updateStage,
} from '../llmBrain'
import type { ToolDecisionKind, TravelReasoningResult } from '../llmBrain'
import type { RuntimeExecutionContext } from './executionContext'
import { buildRuntimeExecutionResult } from './executionResult'
import { executeRuntimeTool } from './tools/toolExecutor'
import type { AgentRuntimeResult } from './types'

function chunkStream(text: string): string[] {
  const parts = text.split(/(?<=[.!?\n])\s+/).map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [text]
}

export async function runRuntimeExecutionPipeline(
  ctx: RuntimeExecutionContext,
  options?: {
    interruptAfter?: 'thinking' | 'tool' | 'reasoning' | null
    forceToolFailureOnce?: boolean
  },
): Promise<AgentRuntimeResult> {
  const interruptAfter = options?.interruptAfter ?? null
  let stages = planConversationStages()

  ctx.events.publish('ThinkingStarted', 'runtime')
  ctx.trace.mark('thinking', 'started')
  stages = updateStage(stages, 'memory', { detail: 'loading', source: 'hybrid' })

  if (interruptAfter === 'thinking') {
    ctx.interrupt('after_thinking')
  }

  let conversation = createConversationState({
    userText: ctx.userText,
    memory: ctx.memory,
    locale: ctx.locale,
  })
  const optimized = optimizeContext({
    state: conversation,
    recentTexts: ctx.recentTexts,
  })
  conversation = optimized.state
  ctx.conversation = conversation
  buildLlmBrainPrompt({
    state: conversation,
    recentCompressed: optimized.recentCompressed,
    userText: ctx.userText,
  })
  ctx.trace.mark('context', `facts=${conversation.compressedFacts.length}`)

  if (ctx.interrupted) {
    return finishInterrupted(ctx, conversation)
  }

  const intentResult = detectConversationIntent(ctx.userText)
  const rawEntities = extractEntities(ctx.userText)
  const references = resolveReferences(ctx.userText, ctx.memory, ctx.recentTexts)
  const entities = applyReferencesToEntities(rawEntities, references, ctx.memory)
  ctx.memory = updateLiveTravelMemory(ctx.memory, entities)
  ctx.events.publish('MemoryUpdated', `destination=${ctx.memory.destination ?? 'none'}`)
  ctx.trace.mark('intent', intentResult.intent)
  ctx.trace.mark('entities', entities.cues.slice(0, 6).join(',') || 'none')
  stages = updateStage(stages, 'intent', { detail: intentResult.intent, source: 'rules' })
  stages = updateStage(stages, 'entities', { detail: 'extracted', source: 'rules' })

  const reasoning = reasonAboutTravel({
    userText: ctx.userText,
    memory: ctx.memory,
    intent: intentResult.intent,
    dialect: conversation.dialect,
  })
  ctx.events.publish('ReasoningFinished', reasoning.destinationStrategy ?? 'ok')
  ctx.trace.mark('reasoning', reasoning.proactiveTips[0] ?? 'done')
  stages = updateStage(stages, 'travel_reasoning', {
    detail: reasoning.destinationStrategy ?? 'ok',
    source: 'hybrid',
  })

  if (interruptAfter === 'reasoning') {
    ctx.interrupt('after_reasoning')
  }
  if (ctx.interrupted) {
    return finishInterrupted(ctx, conversation, {
      intent: intentResult.intent,
      reasoning,
    })
  }

  const tool = decideTools({
    userText: ctx.userText,
    intent: intentResult.intent,
    memory: ctx.memory,
    reasoningConfidence: intentResult.confidence,
  })
  ctx.trace.mark('tool_decision', tool.tool)
  stages = updateStage(stages, 'tool_decision', { detail: tool.tool, source: 'hybrid' })

  const toolExecution = await executeRuntimeTool({
    decision: tool.tool,
    memory: ctx.memory,
    userText: ctx.userText,
    events: ctx.events,
    forceFailureOnce: options?.forceToolFailureOnce,
    cancelled: interruptAfter === 'tool',
  })
  if (interruptAfter === 'tool') {
    ctx.interrupt('during_tool')
  }
  if (toolExecution?.resultSummary) {
    if (!ctx.memory.specialRequests.includes(`tool:${toolExecution.toolId}`)) {
      ctx.memory = {
        ...ctx.memory,
        specialRequests: [...ctx.memory.specialRequests, `tool:${toolExecution.toolId}`],
      }
      ctx.events.publish('MemoryUpdated', `tool=${toolExecution.toolId}`)
    }
  }

  if (ctx.interrupted) {
    return finishInterrupted(ctx, conversation, {
      intent: intentResult.intent,
      reasoning,
      toolDecision: tool.tool,
      toolExecution,
    })
  }

  const confidence = evaluateConfidence({
    memory: ctx.memory,
    intent: intentResult.intent,
    tool,
    usedRulesFallback: false,
    entityCueCount: entities.cues.length,
  })
  const composed = composeConsultantResponse({
    userText: ctx.userText,
    memory: ctx.memory,
    reasoning,
    tool,
    confidence: confidence.level,
    dialect: conversation.dialect,
    locale: ctx.locale,
    shouldClarify: confidence.shouldClarify,
  })
  ctx.trace.mark('compose', composed.displayText.slice(0, 48))

  ctx.events.publish('StreamingStarted', 'chunks')
  const streamedChunks = chunkStream(composed.displayText)
  ctx.events.publish('StreamingFinished', `${streamedChunks.length} chunks`)
  ctx.trace.mark('stream', `${streamedChunks.length} chunks`)
  ctx.voice = 'speaking'

  conversation = {
    ...conversation,
    memory: ctx.memory,
    compressedFacts: optimizeContext({
      state: { ...conversation, memory: ctx.memory },
      recentTexts: ctx.recentTexts,
    }).state.compressedFacts,
  }

  return buildRuntimeExecutionResult({
    locale: ctx.locale,
    dialect: conversation.dialect,
    intent: intentResult.intent,
    toolDecision: tool.tool,
    toolExecution,
    reasoning,
    confidence: confidence.level,
    memory: ctx.memory,
    responseText: composed.displayText,
    spokenText: composed.spokenText,
    streamedChunks,
    events: ctx.events.list(),
    trace: ctx.trace.list(),
    synced: {
      conversation,
      voice: ctx.voice,
      executionPhase: 'streaming',
      memory: ctx.memory,
    },
    interrupted: false,
    durationMs: ctx.trace.elapsedMs(),
  })
}

function finishInterrupted(
  ctx: RuntimeExecutionContext,
  conversation: ReturnType<typeof createConversationState>,
  partial?: {
    intent?: string
    reasoning?: TravelReasoningResult
    toolDecision?: ToolDecisionKind
    toolExecution?: AgentRuntimeResult['toolExecution']
  },
): AgentRuntimeResult {
  const reply =
    ctx.locale === 'ar'
      ? 'توقفت لحظياً — حدّثني وأكمل من نفس النقطة.'
      : 'Paused — tell me the change and I’ll continue from here.'
  return buildRuntimeExecutionResult({
    locale: ctx.locale,
    dialect: conversation.dialect,
    intent: partial?.intent ?? 'unknown',
    toolDecision: partial?.toolDecision ?? 'continue_conversation',
    toolExecution: partial?.toolExecution ?? null,
    reasoning: partial?.reasoning ?? {
      destinationStrategy: null,
      seasonNotes: [],
      riskNotes: [],
      travelerNotes: [],
      flightStrategy: null,
      hotelStrategy: null,
      aspects: [],
      proactiveTips: [],
    },
    confidence: 'medium',
    memory: ctx.memory,
    responseText: reply,
    spokenText: reply,
    streamedChunks: [reply],
    events: ctx.events.list(),
    trace: ctx.trace.list(),
    synced: {
      conversation: { ...conversation, memory: ctx.memory },
      voice: 'interrupted',
      executionPhase: 'paused',
      memory: ctx.memory,
    },
    interrupted: true,
    durationMs: ctx.trace.elapsedMs(),
  })
}

export const ExecutionPipeline = {
  run: runRuntimeExecutionPipeline,
}
