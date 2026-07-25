/**
 * Phase 6 — DecisionEngine (orchestrator-local)
 * Explains recommendations for debug only — never production UI.
 */

import type { DecisionRecord, MissionPlan, TravelGoal } from './types'

let decisionSeq = 0

function decide(topic: string, choice: string, why: string): DecisionRecord {
  decisionSeq += 1
  return {
    id: `dec-${decisionSeq}`,
    topic,
    choice,
    why,
    debugOnly: true,
  }
}

export function explainMissionDecisions(input: {
  goal: TravelGoal
  mission: MissionPlan
}): DecisionRecord[] {
  decisionSeq = 0
  const out: DecisionRecord[] = []
  const g = input.goal

  if (g.destination) {
    out.push(
      decide(
        'city',
        g.destination,
        g.purpose === 'honeymoon'
          ? `${g.destination} fits a romantic honeymoon pace with strong culture + food`
          : `${g.destination} matches stated destination intent`,
      ),
    )
  }
  if (g.monthHint) {
    out.push(
      decide(
        'season',
        g.monthHint,
        `${g.monthHint} balances weather and crowds for ${g.destination ?? 'the trip'}`,
      ),
    )
  }
  if (g.purpose === 'honeymoon') {
    out.push(
      decide(
        'hotel',
        'quiet boutique / view',
        'Honeymoon preference → quiet hotels over party hostels',
      ),
    )
    out.push(
      decide(
        'flight',
        'prefer direct when budget allows',
        'Couples usually value shorter travel days over max savings',
      ),
    )
  }
  if (g.durationDays != null && g.durationDays <= 5) {
    out.push(
      decide(
        'itinerary',
        'compact 5-day plan',
        'Short duration → fewer cities, less transit',
      ),
    )
  }
  if (g.notes.includes('companion_unavailable')) {
    out.push(
      decide(
        'party_size',
        '1 adult',
        'Companion cannot travel — drop couple assumptions',
      ),
    )
  }
  if (g.budgetAmount != null) {
    out.push(
      decide(
        'budget',
        `${g.budgetAmount} ${g.currency ?? 'SAR'}`,
        'Budget frames search caps; prices still come from tools only',
      ),
    )
  }

  return out
}

export const DecisionEngine = {
  explain: explainMissionDecisions,
}
