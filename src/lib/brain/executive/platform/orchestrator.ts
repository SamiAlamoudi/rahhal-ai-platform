/**
 * Sprint 51 — Executive Platform orchestrator.
 * Runs selected engines through analyze → plan → execute.
 * RahhalBrain is the only caller.
 */

import { getPreferenceEngine } from '../../../ai/preferences'
import { buildExecutiveContext } from '../contextBuilder'
import { composeExecutiveReply } from '../engines/executiveResponse'
import { looksLikeDocument } from '../engines/multimodalDocument'
import type { ExecutiveEnhancement } from '../types'
import type {
  BrainIntentResult,
  ConversationUnderstanding,
} from '../../core/types'
import type { AgentMemory } from '../../../agent/types'
import type { TravelReasoningResult } from '../../../agent/reasoning/types'
import type {
  DocumentInput,
  EngineRunResult,
  ExecutiveEngine,
  ExecutiveEngineContext,
  ExecutivePlatformResult,
  TripMonitorSignals,
} from './engineContract'
import { isExecutivePlatformEnabled } from './feature'
import { createDefaultExecutiveEngines, selectEnginesForTurn } from './registry'

export interface RunExecutivePlatformInput {
  userId: string
  userText: string
  memory: AgentMemory
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  reasoningResult: TravelReasoningResult | null
  executiveEnhancement?: ExecutiveEnhancement | null
  tripSignals?: TripMonitorSignals
  documents?: DocumentInput[]
  now?: Date
  engines?: ExecutiveEngine[]
  enabled?: boolean
}

export function runExecutivePlatform(
  input: RunExecutivePlatformInput,
): ExecutivePlatformResult {
  if (!isExecutivePlatformEnabled({ enabled: input.enabled })) {
    return emptyResult()
  }

  const engines = input.engines ?? createDefaultExecutiveEngines()
  const profile = getPreferenceEngine().getProfile(input.userId)
  const executiveContext = input.executiveEnhancement?.context
    ?? buildExecutiveContext({
      memory: input.memory,
      understanding: input.understanding,
      intents: input.intents,
      profile,
      userText: input.userText,
    })

  const selected = selectEnginesForTurn(engines, {
    userText: input.userText,
    hasReasoning: Boolean(input.reasoningResult?.primary),
    hasTripPlan: Boolean(input.memory.tripPlan),
    discoveryMode: input.understanding.travelContext.discoveryMode,
  })

  // Force document engine when documents provided.
  if ((input.documents && input.documents.length > 0) || looksLikeDocument(input.userText)) {
    const docEngine = engines.find((e) => e.metadata().engineId === 'multimodal_document')
    if (docEngine && !selected.some((e) => e.metadata().engineId === 'multimodal_document')) {
      selected.unshift(docEngine)
    }
  }

  const ctx: ExecutiveEngineContext = {
    userId: input.userId,
    userText: input.userText,
    locale: input.memory.locale,
    memory: input.memory,
    understanding: input.understanding,
    intents: input.intents,
    reasoningResult: input.reasoningResult,
    profile,
    executiveContext,
    now: input.now ?? new Date(),
    tripSignals: input.tripSignals,
    documents: input.documents,
  }

  const runs: EngineRunResult[] = []
  for (const engine of selected) {
    if (engine.metadata().engineId === 'executive_response') continue
    const analysis = engine.analyze(ctx)
    const plan = engine.plan(ctx, analysis)
    const execution = engine.execute(ctx, plan)
    const confidence = engine.confidence(ctx, analysis)
    runs.push({
      engineId: engine.metadata().engineId,
      analysis,
      plan,
      execution,
      confidence,
      metadata: engine.metadata(),
    })
  }

  const primaryReply = composeExecutiveReply({
    locale: input.memory.locale,
    runs,
    summaryHint: pickSummaryHint(runs, input.memory.locale),
  })

  // Mark response engine as applied when we composed a reply.
  const responseEngine = selected.find((e) => e.metadata().engineId === 'executive_response')
  if (responseEngine && primaryReply) {
    runs.push({
      engineId: 'executive_response',
      analysis: responseEngine.analyze(ctx),
      plan: responseEngine.plan(ctx, responseEngine.analyze(ctx)),
      execution: {
        engineId: 'executive_response',
        applied: true,
        effects: ['compose_executive_reply'],
        replyFragment: primaryReply,
        alerts: [],
        recommendations: [],
        memoryNotes: [],
        nextBestAction: runs.map((r) => r.execution.nextBestAction).find(Boolean) ?? null,
        metadata: { composed: true },
      },
      confidence: responseEngine.confidence(ctx, responseEngine.analyze(ctx)),
      metadata: responseEngine.metadata(),
    })
  }

  const alerts = runs.flatMap((run) => run.execution.alerts)
  const recommendations = runs.flatMap((run) => run.execution.recommendations)
  const confidence = runs.length
    ? runs.reduce((sum, run) => sum + run.confidence, 0) / runs.length
    : 0.5

  return {
    runs,
    primaryReply,
    alerts,
    recommendations,
    nextBestAction: runs.map((r) => r.execution.nextBestAction).find(Boolean) ?? null,
    confidence,
    engineIds: runs.map((run) => run.engineId),
  }
}

function emptyResult(): ExecutivePlatformResult {
  return {
    runs: [],
    primaryReply: null,
    alerts: [],
    recommendations: [],
    nextBestAction: null,
    confidence: 0,
    engineIds: [],
  }
}

function pickSummaryHint(runs: EngineRunResult[], locale: 'ar' | 'en'): string | null {
  const concierge = runs.find((run) => run.engineId === 'live_concierge' && run.execution.applied)
  if (concierge?.execution.replyFragment) {
    return locale === 'ar'
      ? 'أنا معك الآن ككونسيرج تنفيذي.'
      : 'I am with you now as your executive concierge.'
  }
  const monitor = runs.find((run) => run.engineId === 'trip_monitor' && run.execution.alerts.length)
  if (monitor) {
    return locale === 'ar'
      ? 'رصدت تحديثات مهمة على رحلتك.'
      : 'I detected important updates on your trip.'
  }
  const explain = runs.find((run) => run.engineId === 'explainable_decision' && run.execution.applied)
  if (explain) {
    return locale === 'ar'
      ? 'رتّبت الخيارات بشفافية كاملة.'
      : 'I ranked options with full transparency.'
  }
  return null
}
