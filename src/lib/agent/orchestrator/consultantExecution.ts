/**
 * Phase 2 Stage 1 — Stage executors.
 * Calls existing public APIs only. Enrich context; never rewrite intelligence.
 * Lazy-loads modules when a stage runs (CPU-only, no network / LLM).
 */

import type { StageIOContext, StageResult, ConsultantStageId } from './pipelineTypes'
import { clamp01, uniqueStrings } from './pipelineTypes'
import type { ConsultantPipelineInput } from './pipelineTypes'

type StageRunner = (
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
) => Promise<StageResult>

function timed(
  stageId: ConsultantStageId,
  start: number,
  partial: Omit<StageResult, 'stageId' | 'durationMs'>,
): StageResult {
  return {
    stageId,
    durationMs: Math.max(0, Date.now() - start),
    ...partial,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

/** Conversation — CPU-only local Conversation Brain path. */
async function runConversationStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { generateLocalConversation } = await import('../conversationBrain/localConversationModel')

  const missingSlots: string[] = []
  if (!ctx.known.destination) missingSlots.push('destination')
  if (ctx.known.budgetAmount == null) missingSlots.push('budget')
  if (ctx.known.durationDays == null) missingSlots.push('duration')

  const facts = {
    locale: ctx.locale,
    objective: (ctx.known.destination ? 'confirm_understanding' : 'collect_missing') as
      | 'confirm_understanding'
      | 'collect_missing',
    known: {
      destination: ctx.known.destination ?? undefined,
      origin: ctx.known.origin ?? undefined,
      durationDays: ctx.known.durationDays ?? undefined,
      travelers:
        ctx.known.adults != null || ctx.known.children != null
          ? (ctx.known.adults ?? 0) + (ctx.known.children ?? 0)
          : undefined,
      budgetAmount: ctx.known.budgetAmount ?? undefined,
      budgetCurrency: ctx.known.budgetCurrency ?? undefined,
      interests: ctx.known.interests,
      tripPurpose: ctx.known.tripPurpose ?? undefined,
    },
    missingSlots,
    heardSummary: [ctx.userText].filter(Boolean),
  }

  const local = generateLocalConversation({
    facts: facts as never,
    userMessage: ctx.userText,
    conversationId: input.conversationId ?? 'consultant-pipeline',
  })

  const confidence = clamp01(
    0.4 +
      (ctx.known.destination ? 0.2 : 0) +
      (ctx.known.budgetAmount != null ? 0.15 : 0) +
      (ctx.known.durationDays != null ? 0.15 : 0),
  )

  return timed('conversation', start, {
    status: 'completed',
    confidence,
    evidence: uniqueStrings([
      'stage:conversation',
      ctx.userText ? `user_text_len:${ctx.userText.length}` : 'user_text:empty',
      ...missingSlots.map((m) => `missing:${m}`),
    ]),
    missingInformation: missingSlots,
    questions: missingSlots.length
      ? [
          ctx.locale === 'ar'
            ? 'هل يمكنك توضيح الوجهة أو الميزانية أو مدة الرحلة؟'
            : 'Can you clarify destination, budget, or trip duration?',
        ]
      : [],
    travelerSnapshot: {
      purpose: ctx.known.tripPurpose ?? null,
      interests: ctx.known.interests ?? [],
    },
    planningSnapshot: {
      destinations: ctx.known.destination ? [ctx.known.destination] : [],
      durationDays: ctx.known.durationDays ?? null,
      budgetAmount: ctx.known.budgetAmount ?? null,
      budgetCurrency: ctx.known.budgetCurrency ?? null,
      monthHint: ctx.known.monthHint ?? null,
    },
    output: {
      providerId: 'local_conversation',
      displayText: local.displayText,
      spokenText: local.spokenText,
      facts,
    },
    notes: ['Used generateLocalConversation (CPU-only).'],
  })
}

/**
 * Decision — call Decision Engine only when plan + tools exist.
 * Otherwise enrich with readiness (no invented rankings).
 */
async function runDecisionStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const decision = await import('../decision')
  const planningDraft = await import('../planningDraft')

  const hasPlan = input.tripPlan != null && typeof input.tripPlan === 'object'
  const tools = Array.isArray(input.toolResults) ? input.toolResults : []
  const requirements = input.requirements ?? null

  let output: unknown = {
    mode: 'readiness',
    applied: false,
    reason: 'No tripPlan/toolResults — decision deferred (no guessing).',
  }
  let confidence = clamp01(ctx.confidence * 0.95)
  const evidence = ['stage:decision']
  const missing: string[] = []
  const notes: string[] = []

  if (hasPlan && tools.length > 0 && requirements) {
    const nextPlan = decision.applyIntelligentDecisions(
      input.tripPlan as never,
      tools as never,
      requirements as never,
    )
    output = { mode: 'applied', applied: true, plan: nextPlan }
    confidence = clamp01(0.7)
    evidence.push('decision:applyIntelligentDecisions')
    notes.push('Invoked applyIntelligentDecisions with provided payloads.')
  } else if (hasPlan && requirements) {
    const conflicts = decision.detectTripConflicts(
      input.tripPlan as never,
      requirements as never,
    )
    output = { mode: 'conflicts_only', applied: false, conflicts }
    confidence = clamp01(0.55)
    evidence.push('decision:detectTripConflicts')
    notes.push('Plan present without tool offers — conflicts only.')
    if (!tools.length) missing.push('tool_offers')
  } else {
    missing.push('trip_plan', 'tool_offers')
    notes.push('Decision Engine not applied — awaiting plan/tool payloads.')
  }

  let draft: unknown = null
  if (requirements && planningDraft.canBuildPlanningDraft(requirements as never)) {
    draft = planningDraft.buildPlanningDraft({
      requirements: requirements as never,
      locale: ctx.locale,
    })
    evidence.push('planning_draft:built')
    notes.push('Planning Draft built via public API for context enrichment.')
  }

  return timed('decision', start, {
    status: 'completed',
    confidence,
    evidence,
    missingInformation: uniqueStrings(missing),
    questions: missing.includes('tool_offers')
      ? [
          ctx.locale === 'ar'
            ? 'هل تريد البحث عن عروض رحلات وفنادق لاتخاذ قرار؟'
            : 'Shall we search flight/hotel offers before deciding?',
        ]
      : [],
    output: { decision: output, planningDraft: draft },
    notes,
  })
}

async function runReasoningStage(
  ctx: StageIOContext,
  _input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { runConsultantReasoningPipeline } = await import('../reasoning/reasoningPipeline')

  const result = runConsultantReasoningPipeline({
    locale: ctx.locale,
    userText: ctx.userText,
    known: {
      destination: ctx.known.destination ?? null,
      origin: ctx.known.origin ?? null,
      budgetAmount: ctx.known.budgetAmount ?? null,
      budgetCurrency: ctx.known.budgetCurrency ?? null,
      durationDays: ctx.known.durationDays ?? null,
      adults: ctx.known.adults ?? null,
      children: ctx.known.children ?? null,
      monthHint: ctx.known.monthHint ?? null,
      interests: ctx.known.interests,
      tripPurpose: ctx.known.tripPurpose ?? null,
    },
  })

  const profile = result.profile.profile
  const altDests = result.destination.destinationFit.alternativesToConsider ?? []
  const stated = result.destination.destinationFit.statedDestination

  return timed('reasoning', start, {
    status: 'completed',
    confidence: clamp01(result.overall.confidence),
    evidence: uniqueStrings([
      'stage:reasoning',
      ...result.overall.reasoning.slice(0, 4),
    ]),
    missingInformation: [...result.overall.missingInformation],
    questions: [],
    travelerSnapshot: {
      purpose: profile.purpose,
      pace: profile.pace,
      budgetStance: profile.budgetStance,
      riskTolerance: profile.riskTolerance,
      partySize: profile.partySize,
      interests: profile.interests,
      confidence: result.profile.confidence,
    },
    planningSnapshot: {
      destinations: uniqueStrings([
        ...(stated ? [stated] : []),
        ...(ctx.known.destination ? [ctx.known.destination] : []),
        ...altDests,
      ]).slice(0, 4),
      durationDays: ctx.known.durationDays ?? null,
      budgetAmount: ctx.known.budgetAmount ?? null,
      budgetCurrency: ctx.known.budgetCurrency ?? null,
      monthHint: ctx.known.monthHint ?? null,
      confidence: result.overall.confidence,
    },
    output: result,
    notes: ['runConsultantReasoningPipeline'],
  })
}

async function runReflectionStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { createReflectionSession, reflectTurn } = await import('../reflection/reflectionPipeline')
  const { latestOverallConfidence } = await import('../reflection/confidenceTracker')

  const session = createReflectionSession(ctx.locale, input.now)
  const result = reflectTurn(session, {
    userText: ctx.userText,
    locale: ctx.locale,
    knownDelta: {
      destination: ctx.known.destination ?? null,
      origin: ctx.known.origin ?? null,
      budgetAmount: ctx.known.budgetAmount ?? null,
      budgetCurrency: ctx.known.budgetCurrency ?? null,
      durationDays: ctx.known.durationDays ?? null,
      adults: ctx.known.adults ?? null,
      children: ctx.known.children ?? null,
      monthHint: ctx.known.monthHint ?? null,
      interests: ctx.known.interests,
      tripPurpose: ctx.known.tripPurpose ?? null,
    },
    now: input.now,
  })

  const conf = clamp01(latestOverallConfidence(result.session.confidenceHistory) || 0.5)
  const queue = result.clarificationQueue ?? []

  return timed('reflection', start, {
    status: 'completed',
    confidence: conf,
    evidence: uniqueStrings([
      'stage:reflection',
      `dirty_nodes:${result.refreshedNodes.length}`,
      `reused_nodes:${result.reusedNodes.length}`,
    ]),
    missingInformation: uniqueStrings(queue.map((q) => q.field)),
    questions: uniqueStrings(queue.map((q) => q.reason)).slice(0, 5),
    travelerSnapshot: {
      summary: (result.session.state.priorities ?? []).slice(0, 3).join('; ') || null,
      confidence: conf,
    },
    output: result,
    notes: ['reflectTurn'],
  })
}

async function runPlanningGraphStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { createPlanningGraph, PlanningGraph } = await import('../planningGraph/planningGraph')

  const reasoning = asRecord(ctx.stageOutputs.reasoning)
  const reflection = asRecord(ctx.stageOutputs.reflection)
  const destFit = asRecord(asRecord(reasoning?.destination)?.destinationFit)
  const altDests = Array.isArray(destFit?.alternativesToConsider)
    ? (destFit!.alternativesToConsider as string[])
    : []
  const stated =
    typeof destFit?.statedDestination === 'string' ? destFit.statedDestination : null

  const destinations = uniqueStrings([
    ...(ctx.planningSnapshot.destinations ?? []),
    ...(ctx.known.destination ? [ctx.known.destination] : []),
    ...(stated ? [stated] : []),
    ...altDests,
  ]).slice(0, 3)

  const graph = createPlanningGraph(ctx.locale, input.now)
  const root = PlanningGraph.addRoot(graph, {
    locale: ctx.locale,
    label: destinations[0]
      ? `${destinations[0]} plan`
      : ctx.locale === 'ar'
        ? 'مسودة خطة'
        : 'Draft plan',
    intent: 'plan',
    destinations,
    budget: {
      amount: ctx.known.budgetAmount ?? null,
      currency: ctx.known.budgetCurrency ?? null,
      stance: ctx.travelerSnapshot.budgetStance ?? null,
    },
    dates: {
      durationDays: ctx.known.durationDays ?? null,
      monthHint: ctx.known.monthHint ?? null,
      flexible: ctx.known.durationDays == null,
    },
    travelerProfile: {
      purpose: ctx.travelerSnapshot.purpose ?? null,
      pace: ctx.travelerSnapshot.pace ?? null,
      budgetStance: ctx.travelerSnapshot.budgetStance ?? null,
      riskTolerance: ctx.travelerSnapshot.riskTolerance ?? null,
      partySize: ctx.travelerSnapshot.partySize ?? null,
      interests: ctx.travelerSnapshot.interests ?? [],
    },
    constraints: {
      hard: destinations.map((d) => `destination:${d}`),
      soft: [],
      flexibleDimensions: [],
    },
    confidence: ctx.confidence,
    score: Math.round(ctx.confidence * 100),
    evidence: ctx.evidence.slice(0, 8),
    assumptions: [],
    risks: [],
    tradeoffs: [],
    missingData: ctx.missingInformation.slice(0, 8),
    reasoningRef: reasoning ? 'reasoning_stage' : null,
    reflectionRef: reflection ? 'reflection_stage' : null,
    whyExists: 'Consultant pipeline planning graph root.',
    now: input.now,
  })

  if (destinations.length > 1) {
    PlanningGraph.branch(graph, root.id, {
      locale: ctx.locale,
      label: `${destinations[1]} alternative`,
      destinations: [destinations[1]!],
      confidence: clamp01(ctx.confidence * 0.9),
      score: Math.round(ctx.confidence * 90),
      whyExists: 'Alternative destination branch from reasoning candidates.',
      reason: 'pipeline_alternative_branch',
      now: input.now,
    })
  }

  return timed('planning_graph', start, {
    status: 'completed',
    confidence: clamp01(root.confidence),
    evidence: uniqueStrings(['stage:planning_graph', `graph:${graph.id}`, `root:${root.id}`]),
    missingInformation: [...(root.missingData ?? [])],
    questions: [],
    planningSnapshot: {
      destinations: root.destinations,
      durationDays: root.dates.durationDays,
      budgetAmount: root.budget.amount,
      budgetCurrency: root.budget.currency,
      monthHint: root.dates.monthHint ?? null,
      confidence: root.confidence,
      planNodeId: root.id,
      graphId: graph.id,
    },
    output: { graph, rootId: root.id },
    notes: ['createPlanningGraph + addRoot'],
  })
}

async function runTravelerIntelligenceStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { createTravelerModel, observeTraveler } = await import('../traveler/travelerModel')

  const model = createTravelerModel(ctx.locale, input.now)
  const { snapshot, signals, model: nextModel } = observeTraveler(model, {
    userText: ctx.userText,
    locale: ctx.locale,
    conversationSource: input.conversationId ?? 'consultant-pipeline',
    reasoningRef: ctx.stageOutputs.reasoning ? 'reasoning_stage' : null,
    reflectionRef: ctx.stageOutputs.reflection ? 'reflection_stage' : null,
    now: input.now,
  })

  const conf = clamp01(snapshot.overallConfidence)
  const dna = snapshot.travelDna
  const profileHints = nextModel.profile

  return timed('traveler_intelligence', start, {
    status: 'completed',
    confidence: conf,
    evidence: uniqueStrings([
      'stage:traveler_intelligence',
      `signals:${signals.length}`,
      ...dna.signature.slice(0, 3),
    ]),
    missingInformation: [],
    questions: [],
    travelerSnapshot: {
      purpose: profileHints.purposeHints[0] ?? ctx.travelerSnapshot.purpose,
      pace: dna.paceGene || ctx.travelerSnapshot.pace,
      budgetStance: dna.budgetGene || ctx.travelerSnapshot.budgetStance,
      riskTolerance: dna.riskGene || ctx.travelerSnapshot.riskTolerance,
      partySize: ctx.travelerSnapshot.partySize,
      interests: uniqueStrings([
        ...(ctx.travelerSnapshot.interests ?? []),
        ...profileHints.displayHints,
      ]),
      summary: snapshot.summary,
      confidence: conf,
    },
    output: { model: nextModel, snapshot, signals },
    notes: ['observeTraveler'],
  })
}

async function runDestinationIntelligenceStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { runDestinationIntelligence } = await import('../destination/destinationEngine')
  const { findDestinationKnowledge } = await import('../destination/destinationKnowledge')

  const query =
    ctx.known.destination ||
    ctx.planningSnapshot.destinations?.[0] ||
    ''

  if (!query) {
    return timed('destination_intelligence', start, {
      status: 'clarification',
      confidence: 0.2,
      evidence: ['stage:destination_intelligence', 'missing:destination'],
      missingInformation: ['destination'],
      questions: [
        ctx.locale === 'ar'
          ? 'إلى أي وجهة تفكر بالسفر؟'
          : 'Which destination are you considering?',
      ],
      output: { snapshot: null, comparison: null, unresolved: ['destination'], knowledge: null },
      notes: ['Skipped destination engine — no destination query.'],
    })
  }

  const result = runDestinationIntelligence({
    locale: ctx.locale,
    destinationQuery: query,
    compareWith: ctx.known.compareWith ?? undefined,
    monthHint: ctx.known.monthHint ?? null,
    traveler: {
      purpose: ctx.travelerSnapshot.purpose ?? null,
      pace: ctx.travelerSnapshot.pace ?? null,
      budgetStance: ctx.travelerSnapshot.budgetStance ?? null,
      riskTolerance: ctx.travelerSnapshot.riskTolerance ?? null,
      interests: ctx.travelerSnapshot.interests,
      monthHint: ctx.known.monthHint ?? null,
      partyHint:
        ctx.travelerSnapshot.partySize != null
          ? String(ctx.travelerSnapshot.partySize)
          : null,
    },
    now: input.now,
  })

  const knowledge = findDestinationKnowledge(query)
  const snap = result.snapshot
  const conf = clamp01(snap?.confidence ?? (result.unresolved.length ? 0.25 : 0.6))

  return timed('destination_intelligence', start, {
    status: result.unresolved.length && !snap ? 'clarification' : 'completed',
    confidence: conf,
    evidence: uniqueStrings([
      'stage:destination_intelligence',
      `query:${query}`,
      ...(snap?.destinationDna.signature ?? []).slice(0, 3),
    ]),
    missingInformation: uniqueStrings([
      ...result.unresolved,
      ...(snap?.missingKnowledge ?? []),
    ]),
    questions: result.unresolved.length
      ? [
          ctx.locale === 'ar'
            ? `لم نتعرف على الوجهة بالكامل: ${query}. هل يمكنك توضيح الاسم؟`
            : `Could not fully resolve destination: ${query}. Can you clarify the name?`,
        ]
      : [],
    planningSnapshot: {
      destinations: uniqueStrings([query, ...(ctx.planningSnapshot.destinations ?? [])]),
      confidence: conf,
    },
    output: { ...result, knowledge },
    notes: ['runDestinationIntelligence'],
  })
}

async function runRecommendationIntelligenceStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { runRecommendationEngine } = await import('../recommendation/recommendationEngine')

  const graphOut = asRecord(ctx.stageOutputs.planning_graph)
  const rootId = typeof graphOut?.rootId === 'string' ? graphOut.rootId : null

  const destinations = uniqueStrings([
    ...(ctx.planningSnapshot.destinations ?? []),
    ...(ctx.known.destination ? [ctx.known.destination] : []),
  ])

  const primaryLabel = destinations[0] ?? (ctx.locale === 'ar' ? 'خيار الرحلة' : 'Trip option')
  const altLabel = destinations[1] ?? (ctx.locale === 'ar' ? 'بديل' : 'Alternative')

  const candidates = [
    {
      id: rootId ?? 'cand_primary',
      label: primaryLabel,
      locale: ctx.locale,
      destinations: destinations.slice(0, 1),
      confidence: ctx.confidence,
      score: Math.round(ctx.confidence * 100),
      budget: {
        amount: ctx.known.budgetAmount ?? null,
        currency: ctx.known.budgetCurrency ?? null,
        stance: ctx.travelerSnapshot.budgetStance ?? null,
      },
      dates: {
        durationDays: ctx.known.durationDays ?? null,
        monthHint: ctx.known.monthHint ?? null,
        flexible: ctx.known.durationDays == null,
      },
      travelerProfile: {
        purpose: ctx.travelerSnapshot.purpose ?? null,
        pace: ctx.travelerSnapshot.pace ?? null,
        budgetStance: ctx.travelerSnapshot.budgetStance ?? null,
        riskTolerance: ctx.travelerSnapshot.riskTolerance ?? null,
        partySize: ctx.travelerSnapshot.partySize ?? null,
        interests: ctx.travelerSnapshot.interests,
      },
      evidence: ctx.evidence.slice(0, 6),
      assumptions: [],
      risks: [],
    },
    {
      id: 'cand_alternative',
      label: altLabel,
      locale: ctx.locale,
      destinations: destinations.length > 1 ? destinations.slice(1, 2) : destinations.slice(0, 1),
      confidence: clamp01(ctx.confidence * 0.85),
      score: Math.round(ctx.confidence * 85),
      budget: {
        amount: ctx.known.budgetAmount ?? null,
        currency: ctx.known.budgetCurrency ?? null,
        stance: ctx.travelerSnapshot.budgetStance ?? null,
      },
      dates: {
        durationDays: ctx.known.durationDays ?? null,
        monthHint: ctx.known.monthHint ?? null,
        flexible: true,
      },
      travelerProfile: {
        purpose: ctx.travelerSnapshot.purpose ?? null,
        interests: ctx.travelerSnapshot.interests,
      },
      evidence: ['pipeline:alternative_candidate'],
      assumptions: ['Alternative derived for comparison only'],
      risks: [],
    },
  ]

  const result = runRecommendationEngine({
    locale: ctx.locale,
    candidates,
    travelerHints: {
      preferValueOverCheapest: true,
      preferComfort: (ctx.travelerSnapshot.pace ?? '').includes('relax'),
      preferLowFriction: (ctx.travelerSnapshot.riskTolerance ?? '').includes('low'),
      favorDestinations: destinations,
    },
    reasoningRef: ctx.stageOutputs.reasoning ? 'reasoning_stage' : null,
    reflectionRef: ctx.stageOutputs.reflection ? 'reflection_stage' : null,
    travelerModelRef: ctx.stageOutputs.traveler_intelligence ? 'traveler_stage' : null,
    now: input.now,
  })

  const pkg = result.package
  return timed('recommendation_intelligence', start, {
    status: 'completed',
    confidence: clamp01(pkg.confidence),
    evidence: uniqueStrings([
      'stage:recommendation_intelligence',
      pkg.primaryRecommendation.label,
      ...pkg.whyThisOption.slice(0, 2),
    ]),
    missingInformation: [...pkg.missingInformation],
    questions: [...pkg.questionsToImproveConfidence].slice(0, 5),
    output: { ...result, rootNodeId: rootId },
    notes: ['runRecommendationEngine'],
  })
}

async function runTravelStrategyStage(
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const start = Date.now()
  const { runTravelStrategyEngine } = await import('../travelStrategy/travelStrategyEngine')

  const destOut = asRecord(ctx.stageOutputs.destination_intelligence)
  const knowledge = asRecord(destOut?.knowledge)
  const snap = asRecord(destOut?.snapshot)

  const destinationLabel =
    ctx.known.destination ||
    ctx.planningSnapshot.destinations?.[0] ||
    (typeof snap?.name === 'string' ? snap.name : null)

  const result = runTravelStrategyEngine({
    locale: ctx.locale,
    destinationLabel,
    monthHint: ctx.known.monthHint ?? null,
    budgetAmount: ctx.known.budgetAmount ?? null,
    budgetCurrency: ctx.known.budgetCurrency ?? null,
    budgetStance: ctx.travelerSnapshot.budgetStance ?? null,
    durationDays: ctx.known.durationDays ?? null,
    purpose: ctx.travelerSnapshot.purpose ?? null,
    pace: ctx.travelerSnapshot.pace ?? null,
    riskTolerance: ctx.travelerSnapshot.riskTolerance ?? null,
    partySize: ctx.travelerSnapshot.partySize ?? null,
    destinationPriors: knowledge
      ? {
          bestSeasons: (knowledge.bestSeasons as number[]) ?? undefined,
          worstSeasons: (knowledge.worstSeasons as number[]) ?? undefined,
          costBand: (knowledge.costExpectations as string) ?? null,
          safetyBand: (knowledge.safetyBand as string) ?? null,
          transportationQuality: (knowledge.transportationQuality as number) ?? null,
          recommendedStayDays: (knowledge.recommendedStayDays as {
            min: number
            ideal: number
            max: number
          }) ?? null,
          strengths: (knowledge.topStrengths as string[]) ?? undefined,
          weaknesses: (knowledge.knownWeaknesses as string[]) ?? undefined,
          crowdByMonth: (knowledge.crowdByMonth as string[]) ?? undefined,
          climateByMonth: (knowledge.climateByMonth as string[]) ?? undefined,
          visaComplexity: (knowledge.visaComplexity as string) ?? null,
          familySuitability: (knowledge.familySuitability as number) ?? null,
          luxuryScore: (knowledge.luxuryScore as number) ?? null,
          adventureScore: (knowledge.adventureScore as number) ?? null,
          walkingScore: (knowledge.walkingScore as number) ?? null,
        }
      : undefined,
    travelerHints: {
      preferComfort: (ctx.travelerSnapshot.pace ?? '').includes('relax'),
      preferValueOverCheapest: true,
      preferLowFriction: (ctx.travelerSnapshot.riskTolerance ?? '').includes('low'),
    },
    knownConstraints: [],
    missingInformation: ctx.missingInformation.slice(0, 8),
    evidence: ctx.evidence.slice(0, 8),
    now: input.now,
  })

  return timed('travel_strategy', start, {
    status: 'completed',
    confidence: clamp01(result.overallConfidence ?? result.primary.confidence ?? 0.5),
    evidence: uniqueStrings([
      'stage:travel_strategy',
      result.primary.kind,
      ...result.primary.why.slice(0, 2),
    ]),
    missingInformation: [...result.missingInformation],
    questions: [...result.suggestedClarification].slice(0, 5),
    output: result,
    notes: ['runTravelStrategyEngine'],
  })
}

const STAGE_RUNNERS: Record<
  Exclude<ConsultantStageId, 'unified_response'>,
  StageRunner
> = {
  conversation: runConversationStage,
  decision: runDecisionStage,
  reasoning: runReasoningStage,
  reflection: runReflectionStage,
  planning_graph: runPlanningGraphStage,
  traveler_intelligence: runTravelerIntelligenceStage,
  destination_intelligence: runDestinationIntelligenceStage,
  recommendation_intelligence: runRecommendationIntelligenceStage,
  travel_strategy: runTravelStrategyStage,
}

export async function executeConsultantStage(
  stageId: Exclude<ConsultantStageId, 'unified_response'>,
  ctx: StageIOContext,
  input: ConsultantPipelineInput,
): Promise<StageResult> {
  const runner = STAGE_RUNNERS[stageId]
  return runner(ctx, input)
}

export const ConsultantExecution = {
  runStage: executeConsultantStage,
  runners: STAGE_RUNNERS,
}
