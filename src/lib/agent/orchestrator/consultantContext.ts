/**
 * Phase 2 Stage 1 — Context builders.
 * Enrich-only: never overwrite another stage's output bag.
 */

import {
  clamp01,
  uniqueStrings,
  type ConsultantPipelineInput,
  type ConsultantPipelineLocale,
  type ConsultantStageId,
  type PlanningSnapshotView,
  type StageIOContext,
  type StageResult,
  type TravelerSnapshotView,
} from './pipelineTypes'

function emptyTraveler(): TravelerSnapshotView {
  return {
    purpose: null,
    pace: null,
    budgetStance: null,
    riskTolerance: null,
    partySize: null,
    interests: [],
    summary: null,
    confidence: null,
  }
}

function emptyPlanning(): PlanningSnapshotView {
  return {
    destinations: [],
    durationDays: null,
    budgetAmount: null,
    budgetCurrency: null,
    monthHint: null,
    confidence: null,
    planNodeId: null,
    graphId: null,
  }
}

/** Merge traveler snapshot — only fill empty fields; never clobber set values. */
export function enrichTravelerSnapshot(
  base: TravelerSnapshotView,
  patch?: Partial<TravelerSnapshotView> | null,
): TravelerSnapshotView {
  if (!patch) return { ...base, interests: [...(base.interests ?? [])] }
  const interests = uniqueStrings([...(base.interests ?? []), ...(patch.interests ?? [])])
  return {
    purpose: base.purpose ?? patch.purpose ?? null,
    pace: base.pace ?? patch.pace ?? null,
    budgetStance: base.budgetStance ?? patch.budgetStance ?? null,
    riskTolerance: base.riskTolerance ?? patch.riskTolerance ?? null,
    partySize: base.partySize ?? patch.partySize ?? null,
    interests,
    summary: base.summary ?? patch.summary ?? null,
    confidence:
      base.confidence != null
        ? base.confidence
        : patch.confidence != null
          ? patch.confidence
          : null,
  }
}

/** Merge planning snapshot — enrich only (no overwrite of set scalars). */
export function enrichPlanningSnapshot(
  base: PlanningSnapshotView,
  patch?: Partial<PlanningSnapshotView> | null,
): PlanningSnapshotView {
  if (!patch) {
    return { ...base, destinations: [...(base.destinations ?? [])] }
  }
  return {
    destinations: uniqueStrings([...(base.destinations ?? []), ...(patch.destinations ?? [])]),
    durationDays: base.durationDays ?? patch.durationDays ?? null,
    budgetAmount: base.budgetAmount ?? patch.budgetAmount ?? null,
    budgetCurrency: base.budgetCurrency ?? patch.budgetCurrency ?? null,
    monthHint: base.monthHint ?? patch.monthHint ?? null,
    confidence:
      base.confidence != null
        ? base.confidence
        : patch.confidence != null
          ? patch.confidence
          : null,
    planNodeId: base.planNodeId ?? patch.planNodeId ?? null,
    graphId: base.graphId ?? patch.graphId ?? null,
  }
}

export function createInitialContext(input: ConsultantPipelineInput): StageIOContext {
  const locale: ConsultantPipelineLocale = input.locale === 'en' ? 'en' : 'ar'
  const known = { ...(input.known ?? {}) }
  const destinations: string[] = []
  if (known.destination) destinations.push(known.destination)

  const partySize =
    known.adults != null || known.children != null
      ? (known.adults ?? 0) + (known.children ?? 0)
      : null

  return {
    locale,
    userText: input.userText ?? '',
    known,
    confidence: 0.5,
    evidence: known.destination
      ? [`known:destination:${known.destination}`]
      : [],
    missingInformation: [],
    questions: [],
    travelerSnapshot: {
      ...emptyTraveler(),
      purpose: known.tripPurpose ?? null,
      partySize,
      interests: [...(known.interests ?? [])],
    },
    planningSnapshot: {
      ...emptyPlanning(),
      destinations,
      durationDays: known.durationDays ?? null,
      budgetAmount: known.budgetAmount ?? null,
      budgetCurrency: known.budgetCurrency ?? null,
      monthHint: known.monthHint ?? null,
    },
    stageOutputs: {},
  }
}

/**
 * Apply a stage result into context.
 * Guarantees: existing stageOutputs[stageId] is never replaced if already set.
 */
export function enrichContextFromStage(
  ctx: StageIOContext,
  result: StageResult,
): StageIOContext {
  const stageOutputs: StageIOContext['stageOutputs'] = { ...ctx.stageOutputs }
  if (stageOutputs[result.stageId] === undefined) {
    stageOutputs[result.stageId] = result.output
  }

  const confidence = clamp01(Math.min(ctx.confidence, result.confidence))

  return {
    ...ctx,
    confidence,
    evidence: uniqueStrings([...ctx.evidence, ...result.evidence]),
    missingInformation: uniqueStrings([
      ...ctx.missingInformation,
      ...result.missingInformation,
    ]),
    questions: uniqueStrings([...ctx.questions, ...result.questions]),
    travelerSnapshot: enrichTravelerSnapshot(ctx.travelerSnapshot, result.travelerSnapshot),
    planningSnapshot: enrichPlanningSnapshot(ctx.planningSnapshot, result.planningSnapshot),
    stageOutputs,
  }
}

export function hasStageOutput(
  ctx: StageIOContext,
  stageId: ConsultantStageId,
): boolean {
  return ctx.stageOutputs[stageId] !== undefined
}

export const ConsultantContext = {
  create: createInitialContext,
  enrichFromStage: enrichContextFromStage,
  enrichTraveler: enrichTravelerSnapshot,
  enrichPlanning: enrichPlanningSnapshot,
  hasStageOutput,
}
