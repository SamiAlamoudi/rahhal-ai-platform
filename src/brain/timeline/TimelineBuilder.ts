import type { TripPlanSkeleton } from '../planner/TripPlanner'
import type { IsoDate } from '../types'

export type TimelineItem = {
  day: number
  dateLabel: string
  title: string
  kind: string
}

/**
 * Builds a calm journey timeline from a plan skeleton (mock dates).
 */
export class TimelineBuilder {
  build(plan: TripPlanSkeleton, startDate?: IsoDate): TimelineItem[] {
    return plan.steps.map((step) => ({
      day: step.dayOffset + 1,
      dateLabel: startDate
        ? shiftDate(startDate, step.dayOffset)
        : `Day ${step.dayOffset + 1}`,
      title: step.title,
      kind: step.kind,
    }))
  }
}

function shiftDate(iso: IsoDate, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return `Day ${days + 1}`
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
