/**
 * Evolution Sprint 4 — PlanNode factory + helpers.
 */

import {
  clamp01,
  clampScore,
  emptyBudget,
  emptyConstraints,
  emptyDates,
  emptyProfile,
  isoNow,
  newId,
  uniqueStrings,
  type CreatePlanInput,
  type PlanNodeData,
  type PlanningLocale,
} from './planningGraphTypes'

export function createPlanNode(
  input: CreatePlanInput,
  options: {
    branchId: string
    parentIds?: string[]
    version?: number
    status?: PlanNodeData['status']
  },
): PlanNodeData {
  const now = input.now
  const stamp = isoNow(now)
  const locale: PlanningLocale = input.locale ?? 'ar'
  const profile = { ...emptyProfile(), ...input.travelerProfile }
  const constraints = {
    ...emptyConstraints(),
    ...input.constraints,
    hard: uniqueStrings(input.constraints?.hard ?? []),
    soft: uniqueStrings(input.constraints?.soft ?? []),
    flexibleDimensions: uniqueStrings(input.constraints?.flexibleDimensions ?? []),
  }

  return {
    id: newId('plan', now),
    label: input.label ?? (locale === 'ar' ? 'خطة سفر' : 'Travel plan'),
    status: options.status ?? 'active',
    locale,
    intent: input.intent ?? 'plan',
    travelerProfile: {
      ...profile,
      interests: uniqueStrings(profile.interests),
      styleNotes: uniqueStrings(profile.styleNotes),
    },
    constraints,
    budget: { ...emptyBudget(), ...input.budget },
    dates: { ...emptyDates(), ...input.dates },
    destinations: uniqueStrings(input.destinations ?? []),
    confidence: clamp01(input.confidence ?? 0.5),
    score: clampScore(input.score ?? 50),
    reasoningRef: input.reasoningRef ?? null,
    reflectionRef: input.reflectionRef ?? null,
    evidence: uniqueStrings(input.evidence ?? []),
    assumptions: uniqueStrings(input.assumptions ?? []),
    risks: uniqueStrings(input.risks ?? []),
    tradeoffs: uniqueStrings(input.tradeoffs ?? []),
    missingData: uniqueStrings(input.missingData ?? []),
    whyExists: input.whyExists ?? 'Root planning scenario.',
    parentIds: [...(options.parentIds ?? [])],
    branchId: options.branchId,
    version: options.version ?? 1,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export function clonePlanNodeData(
  source: PlanNodeData,
  patch: Partial<PlanNodeData> & { now?: Date; whyExists?: string },
): PlanNodeData {
  const now = patch.now
  const stamp = isoNow(now)
  const { now: _n, ...rest } = patch
  void _n
  return {
    ...source,
    ...rest,
    id: newId('plan', now),
    parentIds: rest.parentIds ?? [source.id],
    version: rest.version ?? source.version + 1,
    evidence: uniqueStrings(rest.evidence ?? source.evidence),
    assumptions: uniqueStrings(rest.assumptions ?? source.assumptions),
    risks: uniqueStrings(rest.risks ?? source.risks),
    tradeoffs: uniqueStrings(rest.tradeoffs ?? source.tradeoffs),
    missingData: uniqueStrings(rest.missingData ?? source.missingData),
    destinations: uniqueStrings(rest.destinations ?? source.destinations),
    constraints: rest.constraints ?? {
      hard: [...source.constraints.hard],
      soft: [...source.constraints.soft],
      flexibleDimensions: [...source.constraints.flexibleDimensions],
    },
    travelerProfile: rest.travelerProfile ?? {
      ...source.travelerProfile,
      interests: [...source.travelerProfile.interests],
      styleNotes: [...source.travelerProfile.styleNotes],
    },
    budget: rest.budget ?? { ...source.budget },
    dates: rest.dates ?? { ...source.dates },
    whyExists: rest.whyExists ?? source.whyExists,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export function scorePlanNode(node: PlanNodeData): number {
  let score = node.score
  score += node.confidence * 20
  if (node.destinations.length) score += 8
  if (typeof node.budget.amount === 'number') score += 6
  if (typeof node.dates.durationDays === 'number') score += 4
  if (node.risks.length > 3) score -= 5
  if (node.missingData.length > 4) score -= 6
  if (node.status === 'rejected') score -= 40
  return clampScore(score)
}

export const PlanNode = {
  create: createPlanNode,
  cloneData: clonePlanNodeData,
  score: scorePlanNode,
}
