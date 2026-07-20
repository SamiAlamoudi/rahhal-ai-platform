/**
 * Sprint 51 — Executive Platform orchestrator.
 * Sprint 52 — optionally runs Executive OS engines (lazy, strategy-gated).
 * RahhalBrain is the only caller.
 */

import { getPreferenceEngine } from '../../../ai/preferences'
import { buildExecutiveContext } from '../contextBuilder'
import { composeExecutiveReply } from '../engines/executiveResponse'
import { looksLikeDocument } from '../engines/multimodalDocument'
import { improveReplyOnce, reviewDraft } from '../engines/os/selfReviewEngine'
import { detectTravelGoal } from '../os/goalDetection'
import { isExecutiveOsEnabled } from '../os/feature'
import { optimizeDecisions } from '../os/scoring'
import { selectExecutiveStrategy } from '../os/strategySelection'
import type { PredictionResult } from '../os/types'
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
  ExecutiveOsSnapshot,
  ExecutivePlatformResult,
  TripMonitorSignals,
} from './engineContract'
import { isExecutivePlatformEnabled } from './feature'
import {
  createAllExecutiveEngines,
  createDefaultExecutiveEngines,
  selectEnginesForTurn,
} from './registry'

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
  osEnabled?: boolean
}

export function runExecutivePlatform(
  input: RunExecutivePlatformInput,
): ExecutivePlatformResult {
  if (!isExecutivePlatformEnabled({ enabled: input.enabled })) {
    return emptyResult()
  }

  const osEnabled = isExecutiveOsEnabled({ enabled: input.osEnabled })
  const engines = input.engines
    ?? (osEnabled ? createAllExecutiveEngines({ includeOs: true }) : createDefaultExecutiveEngines())
  const profile = getPreferenceEngine().getProfile(input.userId)
  const executiveContext = input.executiveEnhancement?.context
    ?? buildExecutiveContext({
      memory: input.memory,
      understanding: input.understanding,
      intents: input.intents,
      profile,
      userText: input.userText,
    })

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

  const selected = selectEnginesForTurn(engines, {
    userText: input.userText,
    hasReasoning: Boolean(input.reasoningResult?.primary),
    hasTripPlan: Boolean(input.memory.tripPlan),
    discoveryMode: input.understanding.travelContext.discoveryMode,
    osEnabled,
    strategyContext: osEnabled ? ctx : null,
  })

  // Force document engine when documents provided.
  if ((input.documents && input.documents.length > 0) || looksLikeDocument(input.userText)) {
    const docEngine = engines.find((e) => e.metadata().engineId === 'multimodal_document')
    if (docEngine && !selected.some((e) => e.metadata().engineId === 'multimodal_document')) {
      selected.unshift(docEngine)
    }
  }

  const runs: EngineRunResult[] = []
  for (const engine of selected) {
    const id = engine.metadata().engineId
    if (id === 'executive_response' || id === 'self_review') continue
    const analysis = engine.analyze(ctx)
    const plan = engine.plan(ctx, analysis)
    const execution = engine.execute(ctx, plan)
    const confidence = engine.confidence(ctx, analysis)
    runs.push({
      engineId: id,
      analysis,
      plan,
      execution,
      confidence,
      metadata: engine.metadata(),
    })
  }

  let primaryReply = composeExecutiveReply({
    locale: input.memory.locale,
    runs,
    summaryHint: pickSummaryHint(runs, input.memory.locale),
  })

  // Sprint 52 — Self Review improves the reply once.
  let osSnapshot: ExecutiveOsSnapshot | undefined
  if (osEnabled) {
    const selfReviewEngine = selected.find((e) => e.metadata().engineId === 'self_review')
    const findings = reviewDraft({
      locale: input.memory.locale,
      userText: input.userText,
      reply: primaryReply,
      runs,
      rejectedDestinations: profile.travelStyle.rejectedDestinations,
      primaryName: input.reasoningResult?.primary?.name ?? null,
    })
    const improved = improveReplyOnce({
      locale: input.memory.locale,
      reply: primaryReply,
      findings,
      runs,
    })
    primaryReply = improved.reply

    if (selfReviewEngine) {
      const analysis = selfReviewEngine.analyze(ctx)
      runs.push({
        engineId: 'self_review',
        analysis,
        plan: selfReviewEngine.plan(ctx, analysis),
        execution: {
          engineId: 'self_review',
          applied: true,
          effects: improved.improvedOnce ? ['self_review', 'improve_once'] : ['self_review'],
          replyFragment: improved.improvedOnce
            ? (input.memory.locale === 'ar' ? 'تم تحسين الرد مرة واحدة.' : 'Reply improved once.')
            : null,
          alerts: findings
            .filter((f) => f.severity === 'high')
            .map((f) => ({
              priority: 'high' as const,
              message: f.message,
              category: 'self_review',
            })),
          recommendations: [],
          memoryNotes: [],
          nextBestAction: null,
          metadata: {
            findings,
            improvedOnce: improved.improvedOnce,
          },
        },
        confidence: selfReviewEngine.confidence(ctx, analysis),
        metadata: selfReviewEngine.metadata(),
      })
    }

    osSnapshot = buildOsSnapshot(ctx, runs, findings, improved.improvedOnce)
  }

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
        metadata: { composed: true, os: Boolean(osSnapshot) },
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
    os: osSnapshot,
  }
}

function buildOsSnapshot(
  ctx: ExecutiveEngineContext,
  runs: EngineRunResult[],
  findings: Array<{ kind: string; message: string; severity: string }>,
  improvedOnce: boolean,
): ExecutiveOsSnapshot {
  const strategy = selectExecutiveStrategy(ctx)
  const goal = detectTravelGoal(ctx)
  const { strongest } = optimizeDecisions({
    memory: ctx.memory,
    profile: ctx.profile,
    reasoningResult: ctx.reasoningResult,
    goal,
    month: ctx.memory.requirements.startDate
      ? new Date(ctx.memory.requirements.startDate).getMonth() + 1
      : ctx.now.getMonth() + 1,
  })

  const predictionRun = runs.find((run) => run.engineId === 'prediction')
  const prediction = (predictionRun?.execution.metadata.prediction as PredictionResult | undefined) ?? null
  const negotiationCount = runs.find((run) => run.engineId === 'smart_negotiation')
    ?.execution.recommendations.length ?? 0

  return {
    strategy,
    goal,
    prediction: prediction as unknown as Record<string, unknown> | null,
    topOptions: strongest.slice(0, 3).map((row) => ({
      id: row.id,
      name: row.name,
      score: row.score,
    })),
    negotiationCount,
    selfReviewFindings: findings,
    improvedOnce,
    engineIds: runs
      .map((run) => run.engineId)
      .filter((id) =>
        id === 'global_knowledge'
        || id === 'decision_optimizer'
        || id === 'multi_objective_optimizer'
        || id === 'travel_graph'
        || id === 'prediction'
        || id === 'smart_negotiation'
        || id === 'goal_planning'
        || id === 'executive_strategy'
        || id === 'explanation_v2'
        || id === 'self_review'),
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
  const strategy = runs.find((run) => run.engineId === 'executive_strategy' && run.execution.applied)
  if (strategy) {
    return locale === 'ar'
      ? 'أفكر كمسؤول تنفيذي للسفر قبل التوصية.'
      : 'I am thinking as your Chief Travel Officer before recommending.'
  }
  const monitor = runs.find((run) => run.engineId === 'trip_monitor' && run.execution.alerts.length)
  if (monitor) {
    return locale === 'ar'
      ? 'رصدت تحديثات مهمة على رحلتك.'
      : 'I detected important updates on your trip.'
  }
  const explain = runs.find((run) =>
    (run.engineId === 'explainable_decision' || run.engineId === 'explanation_v2')
    && run.execution.applied)
  if (explain) {
    return locale === 'ar'
      ? 'رتّبت الخيارات بشفافية كاملة.'
      : 'I ranked options with full transparency.'
  }
  return null
}
