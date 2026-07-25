/**
 * Phase 6 — TaskPlanner
 * Builds ordered mission tasks from the travel goal (honeymoon Japan example, etc.).
 */

import type { MissionTask, PriorityLevel, TaskKind, TravelGoal } from './types'

let taskSeq = 0
function tid(kind: TaskKind): string {
  taskSeq += 1
  return `task-${kind}-${taskSeq}`
}

function task(
  kind: TaskKind,
  title: string,
  priority: PriorityLevel,
  tool: MissionTask['tool'],
  dependsOn: string[],
  explanation: string,
  unblockQuestion: string | null = null,
): MissionTask {
  return {
    id: tid(kind),
    kind,
    title,
    status: 'pending',
    priority,
    tool,
    dependsOn,
    unblockQuestion,
    estimateOnly: false,
    explanation,
    resultSummary: null,
  }
}

/** Classic honeymoon / complete-trip mission ladder. */
export function planMissionTasks(goal: TravelGoal): MissionTask[] {
  taskSeq = 0
  const t1 = task(
    'understand_request',
    'Understand request',
    'urgent',
    'none',
    [],
    'Parse destination, purpose, and constraints from conversation',
  )
  const t2 = task(
    'collect_missing',
    'Collect missing information',
    goal.destination && goal.monthHint ? 'deferred' : 'high',
    'none',
    [t1.id],
    'Ask only questions that unblock the mission',
    !goal.monthHint && goal.destination
      ? 'Do you have an approximate month, or should I pick the best season?'
      : !goal.destination
        ? 'Would you rather a lively city vibe, or somewhere quieter?'
        : null,
  )
  const t3 = task(
    'determine_season',
    'Determine best season',
    'high',
    'weather',
    [t2.id],
    'Season affects weather, crowds, and prices',
  )
  const t4 = task(
    'estimate_budget',
    'Estimate budget',
    goal.budgetAmount != null ? 'normal' : 'high',
    'currency',
    [t2.id],
    'Budget frames flight/hotel strategy (estimate if unknown)',
  )
  const t5 = task(
    'flight_strategy',
    'Flight strategy',
    'normal',
    'flights',
    [t3.id, t4.id],
    'Direct vs one-stop tradeoff for the couple/party',
  )
  const t6 = task(
    'hotel_strategy',
    'Hotel strategy',
    'normal',
    'hotels',
    [t3.id, t4.id],
    goal.purpose === 'honeymoon'
      ? 'Quiet romantic stay near transit'
      : 'Stay fit to purpose and area',
  )
  const t7 = task(
    'activities',
    'Activities',
    'normal',
    'activities',
    [t6.id],
    'Curate activities matching travel style',
  )
  const t8 = task(
    'visa_check',
    'Visa check',
    'high',
    'visa',
    [t1.id],
    'Never invent visa approvals — verify requirements',
  )
  const t9 = task(
    'search',
    'Search',
    'normal',
    goal.destination ? 'flights' : 'none',
    [t5.id, t6.id, t8.id],
    'Search only after core strategy exists',
  )
  const t10 = task(
    'compare',
    'Compare options',
    'normal',
    'flights',
    [t9.id],
    'Compare shortlisted offers',
  )
  const t11 = task(
    'reason',
    'Reason over options',
    'normal',
    'none',
    [t10.id],
    'Consultant reasoning before recommendation',
  )
  const t12 = task(
    'recommend',
    'Recommend',
    'high',
    'none',
    [t11.id, t7.id],
    'Present a clear recommendation',
  )
  const t13 = task(
    'wait_approval',
    'Wait for approval',
    'normal',
    'none',
    [t12.id],
    'Pause for traveler approval before booking actions',
  )
  const t14 = task(
    'build_itinerary',
    'Final itinerary',
    'normal',
    'maps',
    [t13.id],
    'Assemble day-by-day itinerary after approval',
  )

  // Duration short trips: compress activities priority
  if (goal.durationDays != null && goal.durationDays <= 5) {
    t7.priority = 'high'
    t7.explanation = 'Only 5 days — prioritize must-see, cut transit-heavy days'
  }
  if (goal.notes.includes('companion_unavailable')) {
    t6.explanation = 'Solo stay — drop couple/honeymoon suite assumptions'
    t5.explanation = 'Solo traveler — one adult passenger search'
  }

  return [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14]
}

export const TaskPlanner = {
  plan: planMissionTasks,
}
