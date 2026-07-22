/**
 * Sprint 118 — EditAnalyzer
 * Parses natural-language edit intents without calling engines.
 */

import type { PipelineTripHints } from '../pipeline'

export const SPRINT118_EDITABLE_CONVERSATION_VERSION = '1.0.0-editable-conversation'

export type EditKind =
  | 'change_hotel'
  | 'change_budget'
  | 'change_destination'
  | 'extend_trip'
  | 'shorten_trip'
  | 'remove_city'
  | 'add_city'
  | 'flight_only'
  | 'hotel_only'
  | 'change_cabin'
  | 'change_travelers'
  | 'unknown'

export interface EditSnapshot {
  trip: PipelineTripHints
  flights: Array<Record<string, unknown>>
  hotels: Array<Record<string, unknown>>
  confidence: number
  budget: number | null
  pipelineResult?: import('../pipeline').PipelineResult | null
  cities?: string[] | null
}

export interface ConversationEditInput {
  conversationId?: string | null
  userId?: string | null
  editText: string
  snapshot: EditSnapshot
  basePipelineInput?: import('../pipeline').PipelineInput | null
  useStreaming?: boolean | null
}

export interface AnalyzedEdit {
  kind: EditKind
  confidence: number
  summary: string
  tripPatch: Partial<PipelineTripHints>
  removedCities: string[]
  addedCities: string[]
  dayDelta: number
  budgetValue: number | null
  cabin: string | null
  clearHotels: boolean
  clearFlights: boolean
  signals: string[]
}

function parseBudget(text: string): number | null {
  const m =
    text.match(/(?:budget|زيادة الميزانية|ميزانية).*?(?:to|إلى|=|:)?\s*([\d,]+)/i)
    || text.match(/([\d,]+)\s*(?:SAR|sar|ريال)/)
    || text.match(/(?:SAR|sar)\s*([\d,]+)/)
  if (!m?.[1]) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseDayDelta(text: string): number {
  const more =
    text.match(/(?:stay|extend|add|زيادة|أضف).*?(\d+)\s*(?:more\s+)?(?:day|days|ليلة|ليالي|يوم)/i)
    || text.match(/(\d+)\s*(?:more\s+)?(?:day|days)/i)
  if (more?.[1] && /more|extend|stay|add|زيادة|أضف|extra/i.test(text)) {
    return Number(more[1])
  }
  const fewer =
    text.match(/(?:shorten|reduce|remove|أقل).*?(\d+)\s*(?:day|days|يوم)/i)
  if (fewer?.[1]) return -Number(fewer[1])
  if (/two more days|يومين إضاف/i.test(text)) return 2
  if (/one more day|يوم إضاف/i.test(text)) return 1
  return 0
}

function parseCabin(text: string): string | null {
  if (/business\s*class|درجة رجال|бизнес|business/i.test(text)) return 'business'
  if (/first\s*class|أولى/i.test(text)) return 'first'
  if (/premium\s*economy/i.test(text)) return 'premium_economy'
  if (/economy|سياحي/i.test(text) && /class|درجة|cabin/i.test(text)) return 'economy'
  return null
}

function parseRemovedCity(text: string): string | null {
  const m =
    text.match(/remove\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i)
    || text.match(/احذف\s+(\S+)/)
    || text.match(/without\s+([A-Z][a-zA-Z]+)/i)
  return m?.[1]?.trim() ?? null
}

function parseDestination(text: string): string | null {
  const m =
    text.match(/(?:change\s+destination\s+to|go\s+to|destination\s*[:=]\s*|إلى)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i)
    || text.match(/destination\s+to\s+([A-Za-z][A-Za-z\s]+)$/i)
  return m?.[1]?.trim() ?? null
}

function addDays(iso: string | null | undefined, days: number): string | null {
  if (!iso || !days) return iso ?? null
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function analyzeEdit(editText: string, snapshot: EditSnapshot): AnalyzedEdit {
  const text = (editText || '').trim()
  const signals: string[] = []
  const tripPatch: Partial<PipelineTripHints> = {}
  let kind: EditKind = 'unknown'
  let confidence = 0.4
  let summary = 'Unrecognized edit'
  let removedCities: string[] = []
  let addedCities: string[] = []
  let dayDelta = 0
  let budgetValue: number | null = null
  let cabin: string | null = null
  let clearHotels = false
  let clearFlights = false

  const budget = parseBudget(text)
  const days = parseDayDelta(text)
  const cabinParsed = parseCabin(text)
  const removed = parseRemovedCity(text)
  const destination = parseDestination(text)

  if (/change\s+the\s+hotel|change\s+hotel|فندق\s*آخر|غير.*فندق|different\s+hotel/i.test(text)) {
    kind = 'change_hotel'
    confidence = 0.9
    summary = 'Change hotel selection'
    clearHotels = true
    signals.push('hotel_change')
  } else if (/hotel\s+only|فقط\s*الفندق|hotels?\s+only/i.test(text)) {
    kind = 'hotel_only'
    confidence = 0.88
    summary = 'Recalculate hotels only'
    clearHotels = true
    signals.push('hotel_only')
  } else if (/flight\s+only|فقط\s*الطيران|flights?\s+only/i.test(text)) {
    kind = 'flight_only'
    confidence = 0.88
    summary = 'Recalculate flights only'
    clearFlights = true
    signals.push('flight_only')
  } else if (cabinParsed && (/business|first|economy|cabin|class|درجة/i.test(text))) {
    kind = 'change_cabin'
    confidence = 0.92
    summary = `Change cabin to ${cabinParsed}`
    cabin = cabinParsed
    tripPatch.cabin = cabinParsed
    clearFlights = true
    signals.push('cabin_change', cabinParsed)
  } else if (budget != null && /budget|ميزانية|SAR|ريال/i.test(text)) {
    kind = 'change_budget'
    confidence = 0.93
    summary = `Update budget to ${budget}`
    budgetValue = budget
    tripPatch.budget = budget
    signals.push('budget_change')
  } else if (days !== 0 && /day|ليلة|يوم|extend|stay|shorten/i.test(text)) {
    kind = days > 0 ? 'extend_trip' : 'shorten_trip'
    confidence = 0.9
    dayDelta = days
    summary = days > 0 ? `Extend trip by ${days} day(s)` : `Shorten trip by ${Math.abs(days)} day(s)`
    const ret = addDays(snapshot.trip.returnDate, days)
    const co = addDays(snapshot.trip.checkOutDate ?? snapshot.trip.returnDate, days)
    if (ret) tripPatch.returnDate = ret
    if (co) tripPatch.checkOutDate = co
    signals.push('duration_change', `dayDelta:${days}`)
  } else if (removed) {
    kind = 'remove_city'
    confidence = 0.9
    summary = `Remove city ${removed}`
    removedCities = [removed]
    const cities = (snapshot.cities ?? []).filter(
      (c) => c.toLowerCase() !== removed.toLowerCase(),
    )
    if (cities.length && !tripPatch.destination) {
      // keep primary destination unless removed equals it
      if (
        snapshot.trip.destination
        && snapshot.trip.destination.toLowerCase() === removed.toLowerCase()
        && cities[0]
      ) {
        tripPatch.destination = cities[0]
      }
    }
    signals.push('remove_city', removed)
  } else if (destination) {
    kind = 'change_destination'
    confidence = 0.9
    summary = `Change destination to ${destination}`
    tripPatch.destination = destination
    clearFlights = true
    clearHotels = true
    addedCities = [destination]
    signals.push('destination_change', destination)
  } else if (/adult|مسافر|traveler|children|طفل/i.test(text)) {
    kind = 'change_travelers'
    confidence = 0.75
    const adults = text.match(/(\d+)\s*adult/i)
    const children = text.match(/(\d+)\s*child/i)
    if (adults) tripPatch.adults = Number(adults[1])
    if (children) tripPatch.children = Number(children[1])
    summary = 'Update traveler counts'
    clearFlights = true
    clearHotels = true
    signals.push('travelers_change')
  } else if (budget != null) {
    kind = 'change_budget'
    confidence = 0.7
    budgetValue = budget
    tripPatch.budget = budget
    summary = `Update budget to ${budget}`
    signals.push('budget_change_weak')
  }

  return {
    kind,
    confidence,
    summary,
    tripPatch,
    removedCities,
    addedCities,
    dayDelta,
    budgetValue,
    cabin,
    clearHotels,
    clearFlights,
    signals,
  }
}

export class EditAnalyzer {
  analyze(editText: string, snapshot: EditSnapshot): AnalyzedEdit {
    return analyzeEdit(editText, snapshot)
  }
}

export function createEditAnalyzer(): EditAnalyzer {
  return new EditAnalyzer()
}
