/**
 * Phase AD — itinerary optimization scoring and reshaping.
 */

import type {
  ActivitySlot,
  ItineraryDay,
  ItineraryOptimizationGoal,
  OptimizationResult,
  OptimizationScores,
} from './models'

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function uniqueTags(days: ItineraryDay[]): string[] {
  const tags = new Set<string>()
  for (const day of days) {
    for (const slot of day.slots) {
      for (const tag of slot.preferenceTags) tags.add(tag.toLowerCase())
    }
  }
  return [...tags]
}

export function scoreTravelTime(days: ItineraryDay[], transportMinutes: number): number {
  const activityCount = days.reduce(
    (n, d) => n + d.slots.filter((s) => s.kind === 'activity' || s.kind === 'transport').length,
    0,
  )
  const avgTransport = activityCount > 0 ? transportMinutes / activityCount : transportMinutes
  // Lower transport time → higher score
  if (avgTransport <= 25) return 0.95
  if (avgTransport <= 40) return 0.8
  if (avgTransport <= 60) return 0.6
  if (avgTransport <= 90) return 0.4
  return 0.25
}

export function scoreBudgetFit(total: number, budgetAmount: number | null): number {
  if (budgetAmount == null || budgetAmount <= 0) return 0.55
  const ratio = total / budgetAmount
  if (ratio <= 0.75) return 0.95
  if (ratio <= 1) return 0.85
  if (ratio <= 1.1) return 0.6
  if (ratio <= 1.25) return 0.4
  return 0.2
}

export function scorePreferenceFit(days: ItineraryDay[], interests: string[]): number {
  if (!interests.length) return 0.55
  const tags = uniqueTags(days)
  const hits = interests.filter((i) => tags.includes(i.toLowerCase())).length
  return clamp01(0.35 + (hits / interests.length) * 0.65)
}

export function scoreActivityDiversity(days: ItineraryDay[]): number {
  const tags = uniqueTags(days)
  const activitySlots = days.reduce(
    (n, d) => n + d.slots.filter((s) => s.kind === 'activity').length,
    0,
  )
  if (activitySlots === 0) return 0.3
  const ratio = tags.length / activitySlots
  return clamp01(0.3 + Math.min(1, ratio) * 0.7)
}

export function computeOptimizationScores(input: {
  days: ItineraryDay[]
  transportMinutes: number
  totalCost: number
  budgetAmount: number | null
  interests: string[]
}): OptimizationScores {
  const travelTime = scoreTravelTime(input.days, input.transportMinutes)
  const budgetFit = scoreBudgetFit(input.totalCost, input.budgetAmount)
  const preferenceScore = scorePreferenceFit(input.days, input.interests)
  const activityDiversity = scoreActivityDiversity(input.days)
  const overall = clamp01(
    travelTime * 0.25
    + budgetFit * 0.25
    + preferenceScore * 0.3
    + activityDiversity * 0.2,
  )
  return {
    travelTime: Number(travelTime.toFixed(4)),
    budgetFit: Number(budgetFit.toFixed(4)),
    preferenceScore: Number(preferenceScore.toFixed(4)),
    activityDiversity: Number(activityDiversity.toFixed(4)),
    overall: Number(overall.toFixed(4)),
  }
}

/** Reorder day activity slots to cluster related tags (min travel time heuristic). */
export function optimizeDayForTravelTime(day: ItineraryDay): ItineraryDay {
  const anchored = day.slots.filter((s) => s.kind === 'flight' || s.kind === 'hotel')
  const movable = day.slots.filter((s) => s.kind !== 'flight' && s.kind !== 'hotel')
  movable.sort((a, b) => {
    const ta = a.preferenceTags[0] ?? a.location
    const tb = b.preferenceTags[0] ?? b.location
    if (ta !== tb) return ta.localeCompare(tb)
    return a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
  })
  const slots = [...anchored, ...movable].sort((a, b) =>
    a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
  )
  return projectDay({ ...day, slots })
}

/** Drop the most expensive non-essential activity when over budget. */
export function optimizeDaysForBudget(days: ItineraryDay[], budgetAmount: number | null): {
  days: ItineraryDay[]
  applied: string[]
} {
  if (budgetAmount == null) return { days, applied: [] }
  let working = days.map((d) => structuredClone(d))
  const applied: string[] = []
  const totalOf = () => working.reduce((n, d) => n + d.estimatedDayCost, 0)

  while (totalOf() > budgetAmount) {
    let target: { dayIdx: number; slotIdx: number; cost: number } | null = null
    for (let di = 0; di < working.length; di += 1) {
      const day = working[di]!
      day.slots.forEach((slot, si) => {
        if (slot.kind !== 'activity') return
        if (!target || slot.estimatedCost > target.cost) {
          target = { dayIdx: di, slotIdx: si, cost: slot.estimatedCost }
        }
      })
    }
    if (!target) break
    const { dayIdx, slotIdx, cost } = target
    const day = working[dayIdx]!
    const removed = day.slots[slotIdx]!
    const free: ActivitySlot = {
      id: `free_${removed.id}`,
      kind: 'free_time',
      title: 'Free time',
      startTime: removed.startTime,
      endTime: removed.endTime,
      location: day.location,
      estimatedCost: 0,
      currency: removed.currency,
      preferenceTags: [],
      notes: 'Opened to improve budget fit',
    }
    day.slots = day.slots.map((s, i) => (i === slotIdx ? free : s))
    working[dayIdx] = projectDay(day)
    applied.push(`Replaced activity "${removed.title}" (cost ${cost}) with free time`)
    if (applied.length >= 3) break
  }
  return { days: working, applied }
}

/** Prefer slots matching requested interests near the front of each day. */
export function optimizeDaysForPreferences(days: ItineraryDay[], interests: string[]): ItineraryDay[] {
  const wanted = new Set(interests.map((i) => i.toLowerCase()))
  return days.map((day) => {
    const fixed = day.slots.filter((s) => s.kind === 'flight' || s.kind === 'hotel' || s.kind === 'free_time')
    const rest = day.slots.filter((s) => !fixed.includes(s))
    rest.sort((a, b) => {
      const ah = a.preferenceTags.some((t) => wanted.has(t.toLowerCase())) ? 1 : 0
      const bh = b.preferenceTags.some((t) => wanted.has(t.toLowerCase())) ? 1 : 0
      if (bh !== ah) return bh - ah
      return a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
    })
    // reassign times in sorted order for determinism while preserving duration windows loosely
    const timed = rest.map((slot, idx) => ({
      ...slot,
      startTime: slot.startTime || `${9 + idx * 2}:00`,
      endTime: slot.endTime || `${10 + idx * 2}:00`,
    }))
    return projectDay({ ...day, slots: [...fixed, ...timed].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)) })
  })
}

/** Boost diversity by rotating tags / avoiding consecutive same-tag activities. */
export function optimizeDaysForDiversity(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => {
    const activities = day.slots.filter((s) => s.kind === 'activity')
    const others = day.slots.filter((s) => s.kind !== 'activity')
    const sorted = [...activities].sort((a, b) => a.id.localeCompare(b.id))
    const arranged: ActivitySlot[] = []
    const pool = [...sorted]
    let lastTag: string | null = null
    while (pool.length) {
      let pickIdx = pool.findIndex((s) => (s.preferenceTags[0] ?? '') !== lastTag)
      if (pickIdx < 0) pickIdx = 0
      const [picked] = pool.splice(pickIdx, 1)
      arranged.push(picked!)
      lastTag = picked!.preferenceTags[0] ?? null
    }
    const slots = [...others, ...arranged].sort((a, b) =>
      a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
    )
    return projectDay({ ...day, slots })
  })
}

export function buildOptimizationResult(input: {
  goal: ItineraryOptimizationGoal
  scores: OptimizationScores
  locale: 'ar' | 'en'
  applied: string[]
}): OptimizationResult {
  const ar = input.locale === 'ar'
  const goalLabel: Record<ItineraryOptimizationGoal, [string, string]> = {
    minimum_travel_time: ['Minimum travel time', 'أقل وقت تنقل'],
    budget_fit: ['Budget fit', 'ملاءمة الميزانية'],
    preference_score: ['Preference score', 'درجة التفضيلات'],
    activity_diversity: ['Activity diversity', 'تنوع الأنشطة'],
  }
  const [en, arLabel] = goalLabel[input.goal]
  const summary = ar
    ? `تم تحسين الخطة لهدف: ${arLabel}. الدرجة الكلية ${input.scores.overall.toFixed(2)}.`
    : `Optimized itinerary for goal: ${en}. Overall score ${input.scores.overall.toFixed(2)}.`

  const tradeOffs: string[] = []
  if (input.scores.budgetFit < 0.6) {
    tradeOffs.push(ar ? 'الميزانية تحت ضغط مقارنة بالتكلفة التقديرية' : 'Budget is under pressure relative to estimated cost')
  }
  if (input.scores.travelTime < 0.6) {
    tradeOffs.push(ar ? 'وقت التنقل بين الأنشطة مرتفع نسبياً' : 'Inter-activity travel time is relatively high')
  }
  if (input.scores.activityDiversity < 0.55) {
    tradeOffs.push(ar ? 'تنوع الأنشطة محدود' : 'Activity diversity is limited')
  }
  if (!tradeOffs.length) {
    tradeOffs.push(ar ? 'لا توجد مقايضات حرجة' : 'No critical trade-offs detected')
  }

  return {
    goal: input.goal,
    scores: input.scores,
    summary,
    tradeOffs,
    improvementsApplied: [...input.applied],
  }
}

function projectDay(day: ItineraryDay): ItineraryDay {
  const activities = day.slots.filter((s) => s.kind !== 'free_time')
  const freeTimeMinutes = day.slots
    .filter((s) => s.kind === 'free_time')
    .reduce((n, s) => n + minutesBetween(s.startTime, s.endTime), 0)
  const estimatedDayCost = day.slots.reduce((n, s) => n + s.estimatedCost, 0)
  return {
    ...day,
    activities,
    freeTimeMinutes,
    estimatedDayCost: Number(estimatedDayCost.toFixed(2)),
  }
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const a = (sh ?? 0) * 60 + (sm ?? 0)
  const b = (eh ?? 0) * 60 + (em ?? 0)
  return Math.max(0, b - a)
}
