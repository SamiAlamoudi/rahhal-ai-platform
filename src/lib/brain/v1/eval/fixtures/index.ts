import type { GoldenScenario } from '../types'
import { G01_VALUE_FIRST } from './g01.valueFirst'
import { G02_ZERO_QUESTIONS } from './g02.zeroQuestions'
import { G03_MULTI_TURN_REFINE } from './g03.multiTurnRefine'
import { G04_BOOKING_DEFERRAL } from './g04.bookingDeferral'
import { G05_SAFE_FALLBACK } from './g05.safeFallback'

export {
  G01_VALUE_FIRST,
  G02_ZERO_QUESTIONS,
  G03_MULTI_TURN_REFINE,
  G04_BOOKING_DEFERRAL,
  G05_SAFE_FALLBACK,
}

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  G01_VALUE_FIRST,
  G02_ZERO_QUESTIONS,
  G03_MULTI_TURN_REFINE,
  G04_BOOKING_DEFERRAL,
  G05_SAFE_FALLBACK,
]

export function getGoldenScenario(id: GoldenScenario['id']): GoldenScenario {
  const found = GOLDEN_SCENARIOS.find((s) => s.id === id)
  if (!found) throw new Error(`Unknown golden scenario ${id}`)
  return found
}
