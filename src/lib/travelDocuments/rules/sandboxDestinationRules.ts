/**
 * Sprint 39 — Deterministic sandbox destination/visa rules.
 * Not live government data — structured for future adapter integrations.
 */

import type { VisaCategory } from '../types'

export interface DestinationRuleRow {
  destination: string
  aliases: string[]
  passportValidityMonths: number
  minBlankPages: number
  visaByNationality: Record<string, VisaCategory>
  defaultVisa: VisaCategory
  multiEntry: boolean
  validityDays: number | null
  processingDaysMin: number | null
  processingDaysMax: number | null
  approvalProbability: number
  yellowFeverRequired: boolean
  covidRequired: boolean
  countryVaccines: string[]
  medicalDeclaration: boolean
  healthCertificate: boolean
  customsDeclaration: boolean
  digitalArrivalCard: boolean
  airportDocuments: string[]
  immigrationNotes: string[]
  insuranceRecommended: boolean
  transitVisaNationalities?: string[]
}

const RULES: DestinationRuleRow[] = [
  {
    destination: 'Japan',
    aliases: ['japan', 'jp', 'tokyo', 'osaka'],
    passportValidityMonths: 6,
    minBlankPages: 1,
    visaByNationality: {
      SA: 'visa_free',
      US: 'visa_free',
      GB: 'visa_free',
      AE: 'visa_free',
      IN: 'evisa',
      CN: 'visa_required',
    },
    defaultVisa: 'visa_required',
    multiEntry: false,
    validityDays: 90,
    processingDaysMin: null,
    processingDaysMax: null,
    approvalProbability: 0.92,
    yellowFeverRequired: false,
    covidRequired: false,
    countryVaccines: [],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: true,
    airportDocuments: ['passport', 'return ticket', 'Visit Japan Web / digital arrival card'],
    immigrationNotes: ['Stay up to 90 days for tourism when visa-free'],
    insuranceRecommended: true,
  },
  {
    destination: 'United Kingdom',
    aliases: ['uk', 'united kingdom', 'london', 'england', 'britain', 'gb'],
    passportValidityMonths: 0,
    minBlankPages: 1,
    visaByNationality: {
      SA: 'evisa',
      US: 'visa_free',
      GB: 'visa_free',
      AE: 'evisa',
      IN: 'visa_required',
    },
    defaultVisa: 'visa_required',
    multiEntry: true,
    validityDays: 180,
    processingDaysMin: 3,
    processingDaysMax: 15,
    approvalProbability: 0.78,
    yellowFeverRequired: false,
    covidRequired: false,
    countryVaccines: [],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: false,
    airportDocuments: ['passport', 'ETA / visa if required'],
    immigrationNotes: ['Electronic Travel Authorisation (ETA) may apply'],
    insuranceRecommended: true,
    transitVisaNationalities: ['IN', 'PK', 'NG'],
  },
  {
    destination: 'United States',
    aliases: ['usa', 'us', 'united states', 'america', 'new york'],
    passportValidityMonths: 6,
    minBlankPages: 1,
    visaByNationality: {
      SA: 'visa_required',
      US: 'visa_free',
      GB: 'evisa',
      AE: 'visa_required',
      IN: 'visa_required',
    },
    defaultVisa: 'visa_required',
    multiEntry: true,
    validityDays: 365,
    processingDaysMin: 7,
    processingDaysMax: 60,
    approvalProbability: 0.65,
    yellowFeverRequired: false,
    covidRequired: false,
    countryVaccines: [],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: false,
    airportDocuments: ['passport', 'visa / ESTA', 'customs declaration'],
    immigrationNotes: ['ESTA for Visa Waiver Program nationals'],
    insuranceRecommended: true,
  },
  {
    destination: 'Thailand',
    aliases: ['thailand', 'th', 'bangkok', 'phuket'],
    passportValidityMonths: 6,
    minBlankPages: 1,
    visaByNationality: {
      SA: 'visa_free',
      US: 'visa_free',
      GB: 'visa_free',
      AE: 'visa_free',
      IN: 'visa_on_arrival',
      CN: 'visa_free',
    },
    defaultVisa: 'visa_on_arrival',
    multiEntry: false,
    validityDays: 60,
    processingDaysMin: 0,
    processingDaysMax: 1,
    approvalProbability: 0.9,
    yellowFeverRequired: true,
    covidRequired: false,
    countryVaccines: ['hepatitis_a'],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: true,
    airportDocuments: ['passport', 'TM6 / digital arrival card'],
    immigrationNotes: ['Yellow fever certificate if arriving from risk countries'],
    insuranceRecommended: true,
  },
  {
    destination: 'Schengen',
    aliases: ['schengen', 'france', 'germany', 'italy', 'spain', 'paris', 'rome', 'madrid', 'berlin'],
    passportValidityMonths: 3,
    minBlankPages: 2,
    visaByNationality: {
      SA: 'visa_required',
      US: 'visa_free',
      GB: 'visa_free',
      AE: 'visa_free',
      IN: 'visa_required',
    },
    defaultVisa: 'visa_required',
    multiEntry: true,
    validityDays: 90,
    processingDaysMin: 10,
    processingDaysMax: 30,
    approvalProbability: 0.7,
    yellowFeverRequired: false,
    covidRequired: false,
    countryVaccines: [],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: false,
    airportDocuments: ['passport', 'Schengen visa if required', 'proof of funds / hotel'],
    immigrationNotes: ['90/180 Schengen short-stay rule'],
    insuranceRecommended: true,
  },
  {
    destination: 'Brazil',
    aliases: ['brazil', 'br', 'rio', 'sao paulo'],
    passportValidityMonths: 6,
    minBlankPages: 1,
    visaByNationality: {
      SA: 'evisa',
      US: 'visa_free',
      GB: 'visa_free',
      AE: 'evisa',
    },
    defaultVisa: 'evisa',
    multiEntry: false,
    validityDays: 90,
    processingDaysMin: 2,
    processingDaysMax: 10,
    approvalProbability: 0.8,
    yellowFeverRequired: true,
    covidRequired: false,
    countryVaccines: ['yellow_fever'],
    medicalDeclaration: true,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: false,
    airportDocuments: ['passport', 'yellow fever certificate if applicable'],
    immigrationNotes: ['Yellow fever vaccination advised for many regions'],
    insuranceRecommended: true,
  },
  {
    destination: 'United Arab Emirates',
    aliases: ['uae', 'dubai', 'abu dhabi', 'ae'],
    passportValidityMonths: 6,
    minBlankPages: 1,
    visaByNationality: {
      SA: 'visa_free',
      US: 'visa_on_arrival',
      GB: 'visa_on_arrival',
      IN: 'evisa',
      PK: 'visa_required',
    },
    defaultVisa: 'evisa',
    multiEntry: true,
    validityDays: 30,
    processingDaysMin: 1,
    processingDaysMax: 5,
    approvalProbability: 0.88,
    yellowFeverRequired: false,
    covidRequired: false,
    countryVaccines: [],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: false,
    airportDocuments: ['passport', 'visa / entry permit if required'],
    immigrationNotes: ['GCC nationals often visa-free'],
    insuranceRecommended: true,
  },
]

export function resolveDestinationRule(destination: string): DestinationRuleRow {
  const key = destination.trim().toLowerCase()
  const found = RULES.find(
    (r) => r.destination.toLowerCase() === key || r.aliases.includes(key),
  )
  return found ?? defaultRule(destination)
}

export function listSandboxDestinations(): string[] {
  return RULES.map((r) => r.destination)
}

function defaultRule(destination: string): DestinationRuleRow {
  return {
    destination,
    aliases: [destination.toLowerCase()],
    passportValidityMonths: 6,
    minBlankPages: 1,
    visaByNationality: {},
    defaultVisa: 'visa_required',
    multiEntry: false,
    validityDays: 30,
    processingDaysMin: 5,
    processingDaysMax: 20,
    approvalProbability: 0.6,
    yellowFeverRequired: false,
    covidRequired: false,
    countryVaccines: [],
    medicalDeclaration: false,
    healthCertificate: false,
    customsDeclaration: true,
    digitalArrivalCard: false,
    airportDocuments: ['passport'],
    immigrationNotes: ['Rules estimated — verify with official sources before travel'],
    insuranceRecommended: true,
  }
}

export function normalizeCountryCode(input: string): string {
  const raw = input.trim().toUpperCase()
  const map: Record<string, string> = {
    SAUDI: 'SA',
    'SAUDI ARABIA': 'SA',
    KSA: 'SA',
    USA: 'US',
    'UNITED STATES': 'US',
    AMERICA: 'US',
    UK: 'GB',
    'UNITED KINGDOM': 'GB',
    BRITAIN: 'GB',
    ENGLAND: 'GB',
    UAE: 'AE',
    DUBAI: 'AE',
    INDIA: 'IN',
    CHINA: 'CN',
    PAKISTAN: 'PK',
    NIGERIA: 'NG',
  }
  if (map[raw]) return map[raw]
  if (raw.length === 2) return raw
  return raw.slice(0, 2)
}
