import { RequirementExtractor } from '../requirementExtractor'
import type { BrainLocale, ConversationMemory } from '../types'
import type { CorrectionKind, CorrectionPatch, PlanningField, PlanningSession } from './types'
import { PlanningSessionApi } from './planningSession'

const DEST_SWAP: Array<{ keys: string[]; value: string }> = [
  { keys: ['tokyo', 'طوكيو'], value: 'Tokyo' },
  { keys: ['kyoto', 'كيوتو', 'كيوتو'], value: 'Kyoto' },
  { keys: ['osaka', 'اوساكا', 'أوساكا'], value: 'Osaka' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['paris', 'باريس'], value: 'Paris' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول'], value: 'Istanbul' },
  { keys: ['cairo', 'القاهرة'], value: 'Cairo' },
  { keys: ['bali', 'بالي'], value: 'Bali' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['riyadh', 'الرياض'], value: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], value: 'Jeddah' },
  { keys: ['japan', 'اليابان'], value: 'Tokyo' },
]

/**
 * Detect natural corrections without restarting the planning session.
 * "I actually want Kyoto instead of Tokyo" → destination only.
 */
export function detectCorrections(input: {
  text: string
  session: PlanningSession
  locale?: BrainLocale
}): { corrections: CorrectionPatch[]; patch: Partial<PlanningSession> } {
  const text = input.text.trim()
  const lower = text.toLowerCase()
  const corrections: CorrectionPatch[] = []
  const patch: Partial<PlanningSession> = {}

  const instead =
    lower.match(
      /\b(?:actually\s+)?(?:want|prefer|change(?:\s+to)?|switch(?:\s+to)?)\s+([a-z][a-z\s]{1,24}?)\s+instead\s+of\b/,
    ) ||
    lower.match(/\binstead\s+of\s+[a-z][a-z\s]{1,24}[,.]?\s*(?:i\s+)?(?:want|prefer)?\s*([a-z][a-z\s]{1,24})/) ||
    lower.match(/\bchange(?:\s+destination)?\s+to\s+([a-z][a-z\s]{1,24})/) ||
    text.match(/(?:بدلا|بدلاً|في الحقيقة)\s+(?:أريد|اريد)?\s*([^\s،,]{2,40})\s+بدلا(?:ً|)\s+من/)

  if (instead?.[1]) {
    const raw = instead[1].replace(/[?.!].*$/, '').trim()
    const dest = resolveCity(raw) ?? (raw.charAt(0).toUpperCase() + raw.slice(1))
    if (dest && dest !== input.session.destination) {
      corrections.push({
        kind: 'destination',
        field: 'destination',
        previous: input.session.destination,
        next: dest,
        signal: 'instead_of',
      })
      patch.destination = dest
    }
  }

  if (/\bcheaper\s+flight|\blowest\s+fare|\bcheapest\b|رحلة أرخص|أرخص طيران/.test(lower)) {
    const note = appendNote(input.session.notes, 'prefer_cheaper_flight')
    corrections.push({
      kind: 'cheaper_flight',
      field: 'notes',
      previous: input.session.notes,
      next: note,
      signal: 'cheaper_flight',
    })
    patch.notes = note
    if (!input.session.transportation.includes('flight')) {
      patch.transportation = [...input.session.transportation, 'flight']
    }
  }

  if (/\bbetter\s+hotel|\bnicer\s+hotel|\bupgrade(?:\s+hotel)?\b|فندق أفضل|ترقية الفندق/.test(lower)) {
    const prefs = unique([...input.session.hotelPreferences, 'upgraded'])
    if (!prefs.includes('5-star') && /\b5|luxury|فاخر/.test(lower)) prefs.push('5-star')
    corrections.push({
      kind: 'hotel_upgrade',
      field: 'hotelPreferences',
      previous: [...input.session.hotelPreferences],
      next: prefs,
      signal: 'better_hotel',
    })
    patch.hotelPreferences = prefs
  }

  if (/\bhigher\s+budget|\bincrease\s+budget|\bmore\s+budget|ميزانية أعلى|زد الميزانية/.test(lower)) {
    const amount =
      input.session.budget.amount != null
        ? Math.round(input.session.budget.amount * 1.25)
        : null
    if (amount != null) {
      corrections.push({
        kind: 'budget_increase',
        field: 'budget',
        previous: input.session.budget.amount,
        next: amount,
        signal: 'higher_budget',
      })
      patch.budget = {
        ...input.session.budget,
        amount,
        flexible: false,
      }
    } else {
      patch.budget = { ...input.session.budget, flexible: true }
      corrections.push({
        kind: 'budget_increase',
        field: 'budget',
        previous: input.session.budget.flexible,
        next: true,
        signal: 'higher_budget_flexible',
      })
    }
  }

  if (/\bmore\s+travelers?|\badd\s+(?:an?\s+)?(?:adult|child|traveler)|\bextra\s+(?:person|people)|مسافر إضافي|زد عدد/.test(lower)) {
    const addMatch = lower.match(/\b(?:add|plus|\+)\s*(\d+)/) || lower.match(/(\d+)\s+more/)
    const add = addMatch ? Number(addMatch[1]) : 1
    const current = input.session.travelerCount ?? input.session.adults ?? 0
    const nextCount = current + (Number.isFinite(add) ? add : 1)
    corrections.push({
      kind: 'travelers',
      field: 'travelerCount',
      previous: current,
      next: nextCount,
      signal: 'more_travelers',
    })
    patch.travelerCount = nextCount
    patch.adults = (input.session.adults ?? current) + (Number.isFinite(add) ? add : 1)
    patch.children = input.session.children
    patch.infants = input.session.infants
  }

  // Generic extract still applies for normal updates / date changes.
  const extracted = RequirementExtractor({ text, locale: input.locale ?? input.session.locale })
  const fromExtract = memoryPatchToSessionPatch(extracted.patch)

  // Destination from extract when correction language or modify intent cues present.
  if (
    fromExtract.destination &&
    fromExtract.destination !== input.session.destination &&
    (corrections.some((c) => c.kind === 'destination') ||
      /\bactually\b|\binstead\b|\bchange\b|\bupdate\b|بدلا|غير|غيّر/.test(lower) ||
      !input.session.destination)
  ) {
    if (!patch.destination) {
      patch.destination = fromExtract.destination
      if (!corrections.some((c) => c.field === 'destination')) {
        corrections.push({
          kind: 'destination',
          field: 'destination',
          previous: input.session.destination,
          next: fromExtract.destination,
          signal: 'extract_destination',
        })
      }
    }
  }

  if (fromExtract.departureCity && fromExtract.departureCity !== input.session.departureCity) {
    patch.departureCity = fromExtract.departureCity
    if (input.session.departureCity) {
      corrections.push({
        kind: 'departureCity',
        field: 'departureCity',
        previous: input.session.departureCity,
        next: fromExtract.departureCity,
        signal: 'extract_origin',
      })
    }
  }

  if (fromExtract.travelDates) {
    const datesChanged =
      (fromExtract.travelDates.startDate &&
        fromExtract.travelDates.startDate !== input.session.travelDates.startDate) ||
      (fromExtract.travelDates.endDate &&
        fromExtract.travelDates.endDate !== input.session.travelDates.endDate) ||
      (fromExtract.travelDates.durationDays != null &&
        fromExtract.travelDates.durationDays !== input.session.travelDates.durationDays) ||
      (fromExtract.travelDates.flexible && !input.session.travelDates.flexible)
    if (datesChanged) {
      patch.travelDates = fromExtract.travelDates
      if (
        input.session.answeredFields.includes('travelDates') ||
        /\bchange\b|\bdifferent\s+dates?\b|\bnew\s+dates?\b|تواريخ مختلفة|غير التواريخ/.test(lower)
      ) {
        corrections.push({
          kind: 'travelDates',
          field: 'travelDates',
          previous: { ...input.session.travelDates },
          next: fromExtract.travelDates,
          signal: 'date_change',
        })
      }
    } else if (!input.session.answeredFields.includes('travelDates')) {
      patch.travelDates = fromExtract.travelDates
    }
  }

  mergeIfNew(patch, fromExtract, 'cabinClass', corrections, input.session, 'cabinClass')
  mergeIfNew(patch, fromExtract, 'budget', corrections, input.session, 'budget')
  if (fromExtract.travelerCount != null || fromExtract.adults != null) {
    if (!corrections.some((c) => c.kind === 'travelers')) {
      const prev = input.session.travelerCount
      const next =
        fromExtract.travelerCount ??
        (fromExtract.adults ?? 0) +
          (fromExtract.children ?? 0) +
          (fromExtract.infants ?? 0)
      if (prev != null && next !== prev) {
        corrections.push({
          kind: 'travelers',
          field: 'travelerCount',
          previous: prev,
          next,
          signal: 'traveler_update',
        })
      }
      Object.assign(patch, {
        travelerCount: fromExtract.travelerCount,
        adults: fromExtract.adults,
        children: fromExtract.children,
        infants: fromExtract.infants,
      })
    }
  }
  if (fromExtract.hotelPreferences?.length) {
    patch.hotelPreferences = unique([
      ...(patch.hotelPreferences ?? input.session.hotelPreferences),
      ...fromExtract.hotelPreferences,
    ])
  }
  if (fromExtract.airlinePreferences?.length) {
    patch.airlinePreferences = unique([
      ...(patch.airlinePreferences ?? input.session.airlinePreferences),
      ...fromExtract.airlinePreferences,
    ])
  }
  if (fromExtract.activities?.length) {
    patch.activities = unique([
      ...(patch.activities ?? input.session.activities),
      ...fromExtract.activities,
    ])
  }
  if (fromExtract.roomRequirements) patch.roomRequirements = fromExtract.roomRequirements
  if (fromExtract.transportation?.length) {
    patch.transportation = unique([
      ...(patch.transportation ?? input.session.transportation),
      ...fromExtract.transportation,
    ])
  }
  if (fromExtract.notes && !patch.notes) patch.notes = fromExtract.notes
  if (fromExtract.flexibility) patch.flexibility = true

  // Room requirements from free text
  const room =
    lower.match(/\b(\d+)\s*(?:rooms?|doubles?|twins?|suites?)\b/) ||
    text.match(/(\d+)\s*(?:غرف|غرفة)/)
  if (room) {
    patch.roomRequirements = `${room[1]} rooms`
  }

  if (/\btrain\b|قطار/.test(lower)) {
    patch.transportation = unique([
      ...(patch.transportation ?? input.session.transportation),
      'train',
    ])
  }
  if (/\bflight|\bfly\b|طيران/.test(lower)) {
    patch.transportation = unique([
      ...(patch.transportation ?? input.session.transportation),
      'flight',
    ])
  }

  return { corrections, patch }
}

function memoryPatchToSessionPatch(
  patch: Partial<ConversationMemory>,
): Partial<PlanningSession> {
  const out: Partial<PlanningSession> = {}
  if (patch.destination) out.destination = patch.destination
  if (patch.origin) out.departureCity = patch.origin
  if (patch.travelDates) out.travelDates = patch.travelDates
  if (patch.travelers) {
    out.travelerCount = patch.travelers.count
    out.adults = patch.travelers.adults
    out.children = patch.travelers.children
    out.infants = patch.travelers.infants
  }
  if (patch.cabinClass) out.cabinClass = patch.cabinClass
  if (patch.hotelPreferences) out.hotelPreferences = patch.hotelPreferences
  if (patch.airlinePreferences) out.airlinePreferences = patch.airlinePreferences
  if (patch.activities) out.activities = patch.activities
  if (patch.budget) out.budget = patch.budget
  return out
}

function resolveCity(raw: string): string | null {
  const lower = raw.toLowerCase().trim()
  for (const row of DEST_SWAP) {
    if (row.keys.some((k) => lower.includes(k))) return row.value
  }
  return null
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out
}

function appendNote(existing: string | null, note: string): string {
  if (!existing) return note
  if (existing.includes(note)) return existing
  return `${existing}; ${note}`
}

function mergeIfNew(
  patch: Partial<PlanningSession>,
  fromExtract: Partial<PlanningSession>,
  key: keyof PlanningSession,
  corrections: CorrectionPatch[],
  session: PlanningSession,
  field: PlanningField,
): void {
  const nextVal = fromExtract[key]
  if (nextVal == null || nextVal === '') return
  const prev = session[key]
  if (JSON.stringify(prev) === JSON.stringify(nextVal)) return
  ;(patch as Record<string, unknown>)[key as string] = nextVal
  if (prev != null && prev !== '' && !(Array.isArray(prev) && prev.length === 0)) {
    const kindMap: Partial<Record<PlanningField, CorrectionKind>> = {
      cabinClass: 'cabinClass',
      budget: 'budget_increase',
      airlinePreferences: 'airlinePreferences',
      activities: 'activities',
    }
    corrections.push({
      kind: kindMap[field] ?? 'notes',
      field,
      previous: prev,
      next: nextVal,
      signal: `extract_${field}`,
    })
  }
}

/** Apply correction/collect patch onto session without resetting planning. */
export function applyCollectAndCorrections(
  session: PlanningSession,
  text: string,
  locale?: BrainLocale,
): { session: PlanningSession; corrections: CorrectionPatch[] } {
  const { corrections, patch } = detectCorrections({ text, session, locale })
  const next = PlanningSessionApi.applyPartial(session, patch)
  return { session: next, corrections }
}
