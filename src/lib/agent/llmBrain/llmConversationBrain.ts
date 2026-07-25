/**
 * Phase 5 — LLMConversationBrain
 *
 * Primary: mock LLM reasoning (production APIs disabled by default)
 * Fallback: Phase 4 rule-based Conversation Intelligence
 *
 * Pipeline:
 * User → Memory → Context → Intent → Entities → Travel Reasoning
 * → Tool Decision → Compose → Confidence
 */

import { analyzeConversation } from '../conversationIntelligence'
import { evaluateConfidence } from './confidenceEvaluator'
import { optimizeContext } from './contextOptimizer'
import {
  createConversationState,
  extractCorrections,
} from './conversationState'
import { planConversationStages, updateStage } from './conversationPlanner'
import { mockLlmUnderstand } from './mockLlmReasoner'
import { buildLlmBrainPrompt } from './promptBuilder'
import { composeConsultantResponse } from './responseComposer'
import { reasonAboutTravel } from './travelReasoner'
import { decideTools } from './toolDecisionEngine'
import type { LlmBrainResult, LlmBrainRunInput, ReasoningStageTrace } from './types'

export const PHASE5_LLM_CONVERSATION_BRAIN_VERSION = 'phase5-llm-conversation-brain-v1' as const

function runRulesFallback(input: LlmBrainRunInput, stages: ReasoningStageTrace[]): LlmBrainResult {
  const analysis = analyzeConversation({
    userText: input.userText,
    priorMemory: input.priorMemory,
    recentTexts: input.recentTexts,
    locale: input.locale,
    streaming: input.streaming,
  })
  let nextStages = stages
  nextStages = updateStage(nextStages, 'intent', {
    detail: analysis.intent,
    confidence: analysis.intentConfidence >= 0.75 ? 'high' : 'medium',
    source: 'rules',
  })
  nextStages = updateStage(nextStages, 'entities', {
    detail: analysis.entities.cues.join(',') || 'rules',
    source: 'rules',
  })
  nextStages = updateStage(nextStages, 'memory', {
    detail: analysis.memory.destination ?? 'empty',
    source: 'rules',
  })

  const state = createConversationState({
    userText: input.userText,
    memory: analysis.memory,
    locale: analysis.locale,
    turn: input.turn,
    corrections: extractCorrections(input.userText),
  })
  const optimized = optimizeContext({ state, recentTexts: input.recentTexts })
  const prompt = buildLlmBrainPrompt({
    state: optimized.state,
    recentCompressed: optimized.recentCompressed,
    userText: input.userText,
  })
  const reasoning = reasonAboutTravel({
    userText: input.userText,
    memory: analysis.memory,
    intent: analysis.intent,
    dialect: state.dialect,
  })
  const tool = decideTools({
    userText: input.userText,
    intent: analysis.intent,
    memory: analysis.memory,
    reasoningConfidence: analysis.intentConfidence,
  })
  const confidence = evaluateConfidence({
    memory: analysis.memory,
    intent: analysis.intent,
    tool,
    usedRulesFallback: true,
    entityCueCount: analysis.entities.cues.length,
  })
  const response = composeConsultantResponse({
    userText: input.userText,
    memory: analysis.memory,
    reasoning,
    tool,
    confidence: confidence.level,
    dialect: state.dialect,
    locale: analysis.locale,
    shouldClarify: confidence.shouldClarify,
  })

  nextStages = updateStage(nextStages, 'context', {
    detail: `facts=${optimized.state.compressedFacts.length}`,
    source: 'rules',
  })
  nextStages = updateStage(nextStages, 'travel_reasoning', {
    detail: reasoning.destinationStrategy ?? reasoning.proactiveTips[0] ?? 'ok',
    source: 'hybrid',
  })
  nextStages = updateStage(nextStages, 'tool_decision', {
    detail: tool.tool,
    confidence: tool.confidence,
    source: 'hybrid',
  })
  nextStages = updateStage(nextStages, 'compose', {
    detail: `${response.displayText.slice(0, 48)}…`,
    source: 'hybrid',
  })
  nextStages = updateStage(nextStages, 'confidence', {
    detail: confidence.level,
    confidence: confidence.level,
    source: 'hybrid',
  })

  return {
    enabled: true,
    locale: analysis.locale,
    dialect: state.dialect,
    intent: analysis.intent,
    entities: analysis.entities,
    memory: analysis.memory,
    reasoning,
    toolDecision: tool,
    confidence: confidence.level,
    response,
    state: optimized.state,
    debug: {
      stages: nextStages,
      promptChars: prompt.charCount,
      compressed: optimized.compressed,
      usedFallback: true,
      providerMode: 'rules_fallback',
    },
    usedRulesFallback: true,
  }
}

/**
 * Run the LLM Conversation Brain (mock LLM primary; rules fallback).
 */
export function runLlmConversationBrain(input: LlmBrainRunInput): LlmBrainResult {
  const stages = planConversationStages()

  if (input.forceRulesFallback) {
    return runRulesFallback(input, stages)
  }

  try {
    const draftState = createConversationState({
      userText: input.userText,
      memory: input.priorMemory,
      locale: input.locale,
      turn: input.turn,
      corrections: extractCorrections(input.userText),
    })

    const understood = mockLlmUnderstand({
      userText: input.userText,
      dialect: draftState.dialect,
      priorMemory: input.priorMemory,
    })

    const state = {
      ...draftState,
      memory: understood.memory,
      locale: input.locale ?? draftState.locale,
    }

    let nextStages = updateStage(stages, 'memory', {
      detail: understood.memory.destination ?? 'updating',
      confidence: understood.memory.destination ? 'high' : 'medium',
      source: 'llm',
    })
    nextStages = updateStage(nextStages, 'intent', {
      detail: understood.intent,
      confidence: understood.intentConfidence >= 0.75 ? 'high' : 'medium',
      source: 'llm',
    })
    nextStages = updateStage(nextStages, 'entities', {
      detail: understood.entities.cues.slice(0, 6).join(',') || 'llm',
      confidence: understood.entities.cues.length >= 2 ? 'high' : 'medium',
      source: 'llm',
    })

    const optimized = optimizeContext({ state, recentTexts: input.recentTexts })
    const prompt = buildLlmBrainPrompt({
      state: optimized.state,
      recentCompressed: optimized.recentCompressed,
      userText: input.userText,
    })
    nextStages = updateStage(nextStages, 'context', {
      detail: `chars=${prompt.charCount};facts=${optimized.state.compressedFacts.length}`,
      source: 'llm',
    })

    const reasoning = reasonAboutTravel({
      userText: input.userText,
      memory: understood.memory,
      intent: understood.intent,
      dialect: state.dialect,
    })
    nextStages = updateStage(nextStages, 'travel_reasoning', {
      detail: reasoning.destinationStrategy ?? reasoning.proactiveTips[0] ?? 'reasoned',
      confidence: reasoning.aspects.length ? 'high' : 'medium',
      source: 'llm',
    })

    const tool = decideTools({
      userText: input.userText,
      intent: understood.intent,
      memory: understood.memory,
      reasoningConfidence: understood.intentConfidence,
    })
    nextStages = updateStage(nextStages, 'tool_decision', {
      detail: tool.tool,
      confidence: tool.confidence,
      source: 'llm',
    })

    const confidence = evaluateConfidence({
      memory: understood.memory,
      intent: understood.intent,
      tool,
      usedRulesFallback: false,
      entityCueCount: understood.entities.cues.length,
    })
    nextStages = updateStage(nextStages, 'confidence', {
      detail: `${confidence.level} (${confidence.score.toFixed(2)})`,
      confidence: confidence.level,
      source: 'llm',
    })

    const response = composeConsultantResponse({
      userText: input.userText,
      memory: understood.memory,
      reasoning,
      tool,
      confidence: confidence.level,
      dialect: state.dialect,
      locale: state.locale,
      shouldClarify: confidence.shouldClarify,
    })
    nextStages = updateStage(nextStages, 'compose', {
      detail: response.displayText.slice(0, 64),
      source: 'llm',
    })

    return {
      enabled: true,
      locale: state.locale,
      dialect: state.dialect,
      intent: understood.intent,
      entities: understood.entities,
      memory: understood.memory,
      reasoning,
      toolDecision: tool,
      confidence: confidence.level,
      response,
      state: optimized.state,
      debug: {
        stages: nextStages,
        promptChars: prompt.charCount,
        compressed: optimized.compressed,
        usedFallback: false,
        providerMode: 'mock_llm',
      },
      usedRulesFallback: false,
    }
  } catch {
    return runRulesFallback(input, stages)
  }
}

export const LLMConversationBrain = {
  run: runLlmConversationBrain,
  version: PHASE5_LLM_CONVERSATION_BRAIN_VERSION,
}
