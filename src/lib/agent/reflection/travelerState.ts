/**
 * Evolution Sprint 2 — TravelerState
 * Merges slot deltas into durable traveler state; tracks changing priorities.
 */

import type { ConsultantLocale } from '../reasoning/consultantTypes'
import {
  emptySlots,
  isoNow,
  uniqueStrings,
  type ConversationTurn,
  type KnownSlots,
  type TravelerStateSnapshot,
} from './reflectionTypes'

function mergeInterests(prev: string[] | undefined, next: string[] | undefined): string[] | undefined {
  if (!prev && !next) return undefined
  return uniqueStrings([...(prev ?? []), ...(next ?? [])])
}

/** Merge delta into slots — only overwrite when delta provides a defined non-null value (arrays merge). */
export function mergeSlots(prev: KnownSlots, delta: Partial<KnownSlots>): KnownSlots {
  const out: KnownSlots = { ...prev }
  const keys = Object.keys(delta) as Array<keyof KnownSlots>
  for (const key of keys) {
    const value = delta[key]
    if (value === undefined) continue
    if (key === 'interests') {
      out.interests = mergeInterests(prev.interests, value as string[] | undefined)
      continue
    }
    if (value === null) continue
    if (key === 'destination') out.destination = value as string
    else if (key === 'origin') out.origin = value as string
    else if (key === 'budgetAmount') out.budgetAmount = value as number
    else if (key === 'budgetCurrency') out.budgetCurrency = value as string
    else if (key === 'durationDays') out.durationDays = value as number
    else if (key === 'adults') out.adults = value as number
    else if (key === 'children') out.children = value as number
    else if (key === 'monthHint') out.monthHint = value as number
    else if (key === 'tripPurpose') out.tripPurpose = value as string
  }
  return out
}

/** Derive soft priority labels from slots + latest turn text. */
export function derivePriorities(slots: KnownSlots, latestText: string): string[] {
  const priorities: string[] = []
  if (slots.tripPurpose) priorities.push(`purpose:${slots.tripPurpose}`)
  if (typeof slots.budgetAmount === 'number') priorities.push('budget_clarity')
  if (slots.destination) priorities.push('destination_lock')
  else if (/suggest|recommend|وين|اقترح|ideas/i.test(latestText)) {
    priorities.push('destination_discovery')
  }
  if (typeof slots.durationDays === 'number') priorities.push('duration_set')
  if (/safe|آمن|kids|أطفال|family|عائلة/i.test(latestText) || slots.tripPurpose === 'family') {
    priorities.push('low_friction')
  }
  if (/luxury|فخم|comfort|راحة/i.test(latestText)) priorities.push('comfort')
  if (/cheap|أرخص|tight|ضيقة/i.test(latestText)) priorities.push('cost_control')
  if (/flexible|مرن/i.test(latestText)) priorities.push('flexibility')
  return uniqueStrings(priorities)
}

export function applyTurnToState(
  state: TravelerStateSnapshot,
  turn: ConversationTurn,
  now?: Date,
): TravelerStateSnapshot {
  const slots = mergeSlots(state.slots, turn.slotDelta)
  const priorities = derivePriorities(slots, turn.text)
  return {
    locale: turn.locale || state.locale,
    slots,
    priorities,
    turnCount: state.turnCount + 1,
    updatedAt: isoNow(now),
  }
}

export function createInitialState(locale: ConsultantLocale, now?: Date): TravelerStateSnapshot {
  return {
    locale,
    slots: emptySlots(),
    priorities: [],
    turnCount: 0,
    updatedAt: isoNow(now),
  }
}

/** Diff which slot keys changed between two snapshots. */
export function changedSlotKeys(before: KnownSlots, after: KnownSlots): Array<keyof KnownSlots> {
  const keys: Array<keyof KnownSlots> = [
    'destination',
    'origin',
    'budgetAmount',
    'budgetCurrency',
    'durationDays',
    'adults',
    'children',
    'monthHint',
    'interests',
    'tripPurpose',
  ]
  const changed: Array<keyof KnownSlots> = []
  for (const key of keys) {
    const a = before[key]
    const b = after[key]
    if (key === 'interests') {
      const as = JSON.stringify([...(a as string[] | undefined ?? [])].sort())
      const bs = JSON.stringify([...(b as string[] | undefined ?? [])].sort())
      if (as !== bs) changed.push(key)
      continue
    }
    if (a !== b) changed.push(key)
  }
  return changed
}

export const TravelerState = {
  mergeSlots,
  derivePriorities,
  applyTurnToState,
  createInitialState,
  changedSlotKeys,
}
