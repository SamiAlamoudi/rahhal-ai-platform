/**
 * Sprint 25 — presentational review model from BookingSession + flow context.
 */

import type { BookingItem } from '../booking/bookingTypes'
import type { BookingSession } from '../booking/bookingTypes'
import type { BookingSummary, BookingReadinessResult } from '../booking/bookingOrchestrator'
import { bookingKindOfItem } from './searchOptionAdapter'
import type {
  BookingFlowBudgetComparison,
  BookingFlowDatesContext,
  BookingFlowReviewModel,
  BookingFlowReviewSection,
  BookingFlowStage,
  BookingFlowTravelerContext,
  BookingFlowBudgetContext,
} from './types'

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US')} ${currency}`
}

function sectionItems(
  items: BookingItem[],
  kind: ReturnType<typeof bookingKindOfItem>,
): BookingItem[] {
  return items.filter((item) => bookingKindOfItem(item) === kind)
}

export function buildBudgetComparison(
  budget: BookingFlowBudgetContext,
  summary: BookingSummary,
): BookingFlowBudgetComparison {
  const budgetAmount = budget.amount
  const delta =
    budgetAmount != null ? round2(budgetAmount - summary.total) : null
  const withinBudget =
    budgetAmount != null ? summary.total <= budgetAmount * 1.05 : null
  let label = 'No budget set'
  if (budgetAmount != null) {
    if (withinBudget) {
      label =
        delta != null && delta >= 0
          ? `Within budget · ${formatMoney(delta, summary.currency)} remaining`
          : 'Near budget limit'
    } else {
      label = `Over budget by ${formatMoney(Math.abs(delta ?? 0), summary.currency)}`
    }
  }
  return {
    budgetAmount,
    budgetCurrency: budget.currency,
    bookingTotal: summary.total,
    bookingCurrency: summary.currency,
    delta,
    withinBudget,
    label,
  }
}

export function buildReviewSections(
  session: BookingSession,
  travelers: BookingFlowTravelerContext,
  dates: BookingFlowDatesContext,
): BookingFlowReviewSection[] {
  const flights = sectionItems(session.items, 'flight')
  const hotels = sectionItems(session.items, 'hotel')
  const transport = sectionItems(session.items, 'transport')
  const activities = sectionItems(session.items, 'activity')
  const packages = sectionItems(session.items, 'package')

  return [
    {
      id: 'flights',
      title: 'Flights',
      editable: true,
      items: flights,
      emptyLabel: 'No flight selected',
      summaryLine: flights[0]?.title ?? null,
    },
    {
      id: 'hotels',
      title: 'Hotels',
      editable: true,
      items: hotels,
      emptyLabel: 'No hotel selected',
      summaryLine: hotels[0]?.title ?? null,
    },
    {
      id: 'transport',
      title: 'Transport',
      editable: true,
      items: transport,
      emptyLabel: 'No transport selected',
      summaryLine: transport[0]?.title ?? null,
    },
    {
      id: 'activities',
      title: 'Activities',
      editable: true,
      items: activities,
      emptyLabel: 'No activities selected',
      summaryLine: activities.map((a) => a.title).join(', ') || null,
    },
    {
      id: 'packages',
      title: 'Packages',
      editable: true,
      items: packages,
      emptyLabel: 'No package selected',
      summaryLine: packages[0]?.title ?? null,
    },
    {
      id: 'travelers',
      title: 'Travelers',
      editable: true,
      items: [],
      emptyLabel: 'Traveler details incomplete',
      summaryLine:
        travelers.summary ??
        (travelers.adults != null
          ? `${travelers.adults} adults` +
            (travelers.children ? `, ${travelers.children} children` : '') +
            (travelers.infants ? `, ${travelers.infants} infants` : '')
          : null),
    },
    {
      id: 'dates',
      title: 'Dates',
      editable: true,
      items: [],
      emptyLabel: 'Dates not set',
      summaryLine:
        dates.startDate || dates.durationDays
          ? [
              dates.startDate,
              dates.endDate,
              dates.durationDays != null ? `${dates.durationDays} days` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : null,
    },
  ]
}

export function buildBookingFlowReviewModel(input: {
  session: BookingSession
  stage: BookingFlowStage
  summary: BookingSummary
  readiness: BookingReadinessResult
  budget: BookingFlowBudgetContext
  dates: BookingFlowDatesContext
  travelers: BookingFlowTravelerContext
}): BookingFlowReviewModel {
  const budgetComparison = buildBudgetComparison(input.budget, input.summary)
  const warnings = [...input.readiness.warnings]
  if (budgetComparison.withinBudget === false) {
    warnings.push(budgetComparison.label)
  }
  const sections = buildReviewSections(
    input.session,
    input.travelers,
    input.dates,
  )
  // Append synthetic price / budget / warnings section markers for UI.
  sections.push({
    id: 'price_summary',
    title: 'Price summary',
    editable: false,
    items: [],
    emptyLabel: '',
    summaryLine: `${formatMoney(input.summary.total, input.summary.currency)} (${input.summary.itemCount} items)`,
  })
  sections.push({
    id: 'budget_comparison',
    title: 'Budget comparison',
    editable: false,
    items: [],
    emptyLabel: '',
    summaryLine: budgetComparison.label,
  })
  sections.push({
    id: 'warnings',
    title: 'Warnings',
    editable: false,
    items: [],
    emptyLabel: 'No warnings',
    summaryLine: warnings.length ? `${warnings.length} warning(s)` : null,
  })

  return {
    session: input.session,
    stage: input.stage,
    sections,
    travelers: input.travelers,
    dates: input.dates,
    priceSummary: input.summary,
    budgetComparison,
    warnings,
    readiness: input.readiness,
    readyForPayment:
      input.readiness.ready &&
      input.session.items.length > 0 &&
      (budgetComparison.withinBudget !== false || input.budget.amount == null),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
