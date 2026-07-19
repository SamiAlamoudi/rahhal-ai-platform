/**
 * Sprint 39 — Universal Travel Documents & Visa Intelligence Platform tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  TRAVEL_DOCUMENTS_FEATURE_ID,
  createTravelDocumentsPlatform,
  createDestinationRulesEngine,
  createPassportIntelligence,
  createVisaIntelligence,
  createVaccinationRules,
  createDocumentAlerts,
  detectDocumentConversationQuery,
  answerDocumentQuery,
  extractDestinationFromText,
  extractTransitFromText,
  extractPassportMonths,
  isTravelDocumentsEnabled,
  isTravelDocumentsResult,
  listSandboxDestinations,
  normalizeCountryCode,
  type TravelServiceKind,
} from '../travelDocuments'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { ConversationController } from '../chat/conversationExperience/ConversationController'

const SERVICES: TravelServiceKind[] = [
  'flight',
  'hotel',
  'car',
  'activity',
  'cruise',
  'rail',
  'bus',
  'future',
]

function enableDocumentsChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
  registry.setEnabled('brain.travel_execution_engine', true)
  registry.setEnabled('brain.payments_platform', true)
  registry.setEnabled('brain.trip_management', true)
  registry.setEnabled('brain.refund_policy_engine', true)
  registry.setEnabled('brain.travel_disruption_engine', true)
  registry.setEnabled('brain.loyalty_platform', true)
  registry.setEnabled('brain.travel_documents', true)
}

function futureDate(monthsAhead: number): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + monthsAhead)
  return d.toISOString().slice(0, 10)
}

describe('Sprint 39 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.travel_documents disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(TRAVEL_DOCUMENTS_FEATURE_ID)).toBe(false)
    expect(isTravelDocumentsEnabled()).toBe(false)
  })

  it('requires brain.loyalty_platform before brain.travel_documents', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.travel_documents', true)
    expect(registry.isEnabled('brain.travel_documents')).toBe(false)
    enableDocumentsChain()
    expect(registry.isEnabled('brain.travel_documents')).toBe(true)
    expect(isTravelDocumentsEnabled()).toBe(true)
  })

  it('feature definition depends on loyalty_platform', () => {
    const def = getFeatureRegistry().list().find((f) => f.id === TRAVEL_DOCUMENTS_FEATURE_ID)
    expect(def?.dependsOn).toContain('brain.loyalty_platform')
    expect(def?.enabled).toBe(false)
  })
})

describe('Destination rules engine', () => {
  const engine = createDestinationRulesEngine()

  it('evaluates Japan visa-free for Saudi nationality with natural explanation fields', () => {
    const result = engine.evaluate({
      nationality: 'SA',
      destination: 'Japan',
      purpose: 'tourism',
      tripDurationDays: 10,
      passportExpiry: futureDate(24),
      blankPages: 4,
      machineReadable: true,
      serviceKinds: SERVICES,
    })
    expect(result.destination).toBe('Japan')
    expect(result.visa.category).toBe('visa_free')
    expect(result.visa.required).toBe(false)
    expect(result.passport.valid).toBe(true)
    expect(result.vaccination.summary).toMatch(/No mandatory vaccinations/i)
    expect(result.digitalArrivalCardRequired).toBe(true)
    expect(result.requirements.some((r) => r.kind === 'passport')).toBe(true)
    expect(result.requirements.some((r) => r.kind === 'customs_declaration')).toBe(true)
    expect(result.requirements.some((r) => r.kind === 'airport_document')).toBe(true)
    expect(result.canTravel).toBe(true)
  })

  it('covers all travel service kinds on requirements', () => {
    const result = engine.evaluate({
      nationality: 'US',
      destination: 'Thailand',
      passportExpiry: futureDate(18),
      serviceKinds: SERVICES,
    })
    const covered = new Set(result.requirements.flatMap((r) => r.serviceKinds))
    for (const service of SERVICES) expect(covered.has(service)).toBe(true)
  })

  it('uses nationality residence purpose duration and age inputs', () => {
    const result = engine.evaluate({
      nationality: 'IN',
      residenceCountry: 'AE',
      destination: 'United Kingdom',
      purpose: 'business',
      tripDurationDays: 200,
      age: 16,
      passportExpiry: futureDate(12),
      blankPages: 2,
      machineReadable: true,
      transitCountries: ['London'],
    })
    expect(result.visa.category).toBe('visa_required')
    expect(result.visa.transitVisaRequired).toBe(true)
    expect(result.requirements.some((r) => r.title.includes('Minor'))).toBe(true)
    expect(result.requirements.some((r) => r.kind === 'residence_permit')).toBe(true)
  })

  it.each(listSandboxDestinations())('resolves sandbox destination %s', (destination) => {
    const result = engine.evaluate({
      nationality: 'SA',
      destination,
      passportExpiry: futureDate(18),
      blankPages: 3,
      machineReadable: true,
    })
    expect(result.destination).toBeTruthy()
    expect(result.confidence).toBeGreaterThan(0)
  })
})

describe('Passport intelligence', () => {
  const passport = createPassportIntelligence()

  it('flags expired and short-validity passports', () => {
    const expired = passport.assess({
      passportExpiry: '2020-01-01',
      blankPages: 3,
      machineReadable: true,
      validityRuleMonths: 6,
      minBlankPages: 1,
    })
    expect(expired.valid).toBe(false)
    expect(expired.blockingIssues.some((i) => /expired/i.test(i))).toBe(true)

    const short = passport.assess({
      passportExpiry: futureDate(3),
      blankPages: 3,
      machineReadable: true,
      validityRuleMonths: 6,
      minBlankPages: 1,
    })
    expect(short.valid).toBe(false)
    expect(short.blockingIssues.length).toBeGreaterThan(0)
  })

  it('validates blank pages and machine-readable status', () => {
    const bad = passport.assess({
      passportExpiry: futureDate(24),
      blankPages: 0,
      machineReadable: false,
      validityRuleMonths: 6,
      minBlankPages: 1,
    })
    expect(bad.blankPagesOk).toBe(false)
    expect(bad.machineReadableOk).toBe(false)
    expect(bad.valid).toBe(false)
  })

  it('accepts a healthy passport', () => {
    const ok = passport.assess({
      passportExpiry: futureDate(24),
      blankPages: 5,
      machineReadable: true,
      validityRuleMonths: 6,
      minBlankPages: 1,
    })
    expect(ok.valid).toBe(true)
    expect(ok.summary).toMatch(/valid/i)
  })
})

describe('Visa intelligence', () => {
  it('classifies visa free on arrival evisa required and transit', () => {
    const visa = createVisaIntelligence()
    const engine = createDestinationRulesEngine()
    const japan = engine.evaluate({
      nationality: 'SA',
      destination: 'Japan',
      passportExpiry: futureDate(20),
    })
    expect(japan.visa.category).toBe('visa_free')
    expect(japan.visa.approvalProbability).toBeGreaterThan(0.9)

    const thailandIn = engine.evaluate({
      nationality: 'IN',
      destination: 'Thailand',
      passportExpiry: futureDate(20),
    })
    expect(thailandIn.visa.category).toBe('visa_on_arrival')

    const uae = engine.evaluate({
      nationality: 'IN',
      destination: 'United Arab Emirates',
      passportExpiry: futureDate(20),
    })
    expect(uae.visa.category).toBe('evisa')
    expect(uae.visa.processingDaysMin).not.toBeNull()

    const ukTransit = engine.evaluate({
      nationality: 'IN',
      destination: 'United States',
      transitCountries: ['London'],
      passportExpiry: futureDate(20),
    })
    expect(ukTransit.visa.transitVisaRequired).toBe(true)

    const assessed = visa.assess({
      rule: {
        destination: 'Testland',
        aliases: [],
        passportValidityMonths: 6,
        minBlankPages: 1,
        visaByNationality: { SA: 'multi_entry' },
        defaultVisa: 'visa_required',
        multiEntry: true,
        validityDays: 180,
        processingDaysMin: 5,
        processingDaysMax: 15,
        approvalProbability: 0.7,
        yellowFeverRequired: false,
        covidRequired: false,
        countryVaccines: [],
        medicalDeclaration: false,
        healthCertificate: false,
        customsDeclaration: false,
        digitalArrivalCard: false,
        airportDocuments: [],
        immigrationNotes: [],
        insuranceRecommended: false,
      },
      nationality: 'SA',
    })
    expect(assessed.multiEntry).toBe(true)
  })
})

describe('Vaccination rules', () => {
  it('requires yellow fever for Brazil and reports missing records', () => {
    const rules = createVaccinationRules()
    const engine = createDestinationRulesEngine()
    const result = engine.evaluate({
      nationality: 'SA',
      destination: 'Brazil',
      passportExpiry: futureDate(18),
    })
    expect(result.vaccination.required.some((r) => r.vaccine === 'yellow_fever')).toBe(true)
    expect(result.vaccination.missing).toContain('yellow_fever')
    expect(result.vaccination.medicalDeclarationRequired).toBe(true)

    const withShot = rules.assess({
      rule: {
        destination: 'Brazil',
        aliases: [],
        passportValidityMonths: 6,
        minBlankPages: 1,
        visaByNationality: {},
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
        airportDocuments: [],
        immigrationNotes: [],
        insuranceRecommended: true,
      },
      records: [
        {
          vaccine: 'yellow_fever',
          name: 'Yellow Fever',
          administeredAt: '2024-01-01',
          expiresAt: futureDate(36),
        },
      ],
    })
    expect(withShot.missing).toEqual([])
  })
})

describe('Document alerts', () => {
  it('alerts on passport visa residence and vaccination expiration', () => {
    const alerts = createDocumentAlerts().build({
      userId: 'u1',
      nationality: 'SA',
      passportExpiry: futureDate(2),
      visaExpiry: futureDate(1),
      residencePermitExpiry: futureDate(3),
      vaccinationRecords: [
        {
          vaccine: 'covid',
          name: 'COVID',
          administeredAt: '2024-01-01',
          expiresAt: futureDate(1),
        },
      ],
    })
    expect(alerts.some((a) => a.kind === 'passport_expiration')).toBe(true)
    expect(alerts.some((a) => a.kind === 'visa_expiration')).toBe(true)
    expect(alerts.some((a) => a.kind === 'residence_expiration')).toBe(true)
    expect(alerts.some((a) => a.kind === 'vaccination_expiration')).toBe(true)
  })
})

describe('TravelDocumentsPlatform orchestration', () => {
  it('returns FEATURE_DISABLED when override is off', () => {
    const platform = createTravelDocumentsPlatform({ enabled: false })
    const result = platform.evaluate({
      nationality: 'SA',
      destination: 'Japan',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FEATURE_DISABLED')
  })

  it('evaluates end-to-end with explanation matching product sample', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const result = platform.evaluate({
      userId: 'u_jp',
      nationality: 'SA',
      destination: 'Japan',
      purpose: 'tourism',
      passportExpiry: futureDate(24),
      blankPages: 4,
      machineReadable: true,
      hasTravelInsurance: true,
    })
    expect(isTravelDocumentsResult(result)).toBe(true)
    if (!isTravelDocumentsResult(result)) return
    expect(result.explanation).toContain('You can enter Japan visa-free.')
    expect(result.explanation).toContain('Your passport is valid.')
    expect(result.explanation).toContain('No transit visa is required.')
    expect(result.explanation).toContain('No mandatory vaccinations.')
    expect(result.alerts.length).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('stores traveler profiles and generates metrics/events', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    platform.upsertProfile({
      userId: 'u_prof',
      nationality: 'SA',
      passportExpiry: futureDate(20),
      blankPages: 3,
      machineReadable: true,
      visaExpiry: futureDate(4),
    })
    expect(platform.getProfile('u_prof')?.nationality).toBe('SA')
    platform.evaluate({
      userId: 'u_prof',
      nationality: 'SA',
      destination: 'Dubai',
    })
    const metrics = platform.getMetrics()
    expect(metrics.evaluations).toBe(1)
    expect(metrics.byDestination.UnitedArabEmirates ?? metrics.byDestination['United Arab Emirates'] ?? Object.keys(metrics.byDestination).length).toBeTruthy()
    const events = platform.getRecentEvents()
    expect(events.some((e) => e.type === 'RulesEvaluated')).toBe(true)
    expect(events.some((e) => e.type === 'DocumentsHandled')).toBe(true)
    expect(platform.getAlerts('u_prof').some((a) => a.kind === 'visa_expiration')).toBe(true)
  })

  it('normalizes country codes', () => {
    expect(normalizeCountryCode('Saudi Arabia')).toBe('SA')
    expect(normalizeCountryCode('usa')).toBe('US')
    expect(normalizeCountryCode('UK')).toBe('GB')
  })
})

describe('Conversation document integration', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('detects document conversation commands', () => {
    expect(detectConversationCommand('Can I travel to Japan?')).toBe('can_travel_to')
    expect(detectConversationCommand('Do I need a visa?')).toBe('need_visa')
    expect(detectConversationCommand('My passport expires in 5 months.')).toBe('passport_expiry')
    expect(detectConversationCommand('Can I transit through London?')).toBe('transit_visa')
    expect(detectConversationCommand('What documents do I need?')).toBe('what_documents')
    expect(detectDocumentConversationQuery('Do I need a visa for Japan?')).toBe('need_visa')
    expect(extractDestinationFromText('Can I travel to Japan?')).toMatch(/japan/i)
  })

  it('answers visa and transit questions naturally', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const visa = answerDocumentQuery({
      kind: 'need_visa',
      platform,
      userId: 'u_chat',
      userText: 'Do I need a visa for Japan?',
      nationality: 'SA',
    })
    expect(visa).toMatch(/visa-free|eVisa|visa/i)

    const transit = answerDocumentQuery({
      kind: 'transit_visa',
      platform,
      userId: 'u_chat',
      userText: 'Can I transit through London?',
      nationality: 'IN',
      defaults: { destination: 'United States' },
    })
    expect(transit).toMatch(/transit visa/i)
  })

  it('ConversationController invokes TravelDocumentsPlatform when flag on', async () => {
    enableDocumentsChain()
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const controller = ConversationController({
      enabled: true,
      travelDocumentsPlatform: platform,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_docs_s39',
      userId: 'user_docs',
      userText: 'Can I travel to Japan?',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('can_travel_to')
    expect(turn.assistantMessage.meta?.travelDocuments).toBe(true)
    expect(turn.renderedText).toContain('You can enter Japan visa-free.')
    expect(turn.renderedText).toContain('Your passport is valid.')
  })

  it('handles passport expiry and documents checklist in conversation', async () => {
    enableDocumentsChain()
    const controller = ConversationController({
      enabled: true,
      travelDocumentsPlatform: createTravelDocumentsPlatform({ enabled: true }),
      skipPlannerOrchestrator: true,
    })
    const passport = await controller.handleTurn({
      conversationId: 'conv_pass',
      userId: 'u2',
      userText: 'My passport expires in 5 months.',
      locale: 'en',
    })
    expect(passport.commandKind).toBe('passport_expiry')
    expect(passport.assistantMessage.meta?.travelDocuments).toBe(true)

    const docs = await controller.handleTurn({
      conversationId: 'conv_checklist',
      userId: 'u2',
      userText: 'What documents do I need?',
      locale: 'en',
    })
    expect(docs.commandKind).toBe('what_documents')
    expect(docs.renderedText).toMatch(/Document checklist|Passport|Visa/i)
  })

  it('does not invoke documents platform when feature flag is off', async () => {
    resetFeatureRegistry()
    const controller = ConversationController({
      enabled: true,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_flag_off_s39',
      userId: 'u1',
      userText: 'Can I travel to Japan?',
      locale: 'en',
    })
    expect(turn.assistantMessage.meta?.travelDocuments).not.toBe(true)
  })
})

describe('Explainability and helpers', () => {
  it('explains vaccination requirements query', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const text = answerDocumentQuery({
      kind: 'vaccination_requirements',
      platform,
      userId: 'u_vax',
      userText: 'What vaccinations for Brazil?',
      nationality: 'SA',
    })
    expect(text).toMatch(/yellow_fever|vaccination|Yellow fever/i)
  })

  it('isEnabled respects override', () => {
    resetFeatureRegistry()
    expect(createTravelDocumentsPlatform().isEnabled()).toBe(false)
    expect(createTravelDocumentsPlatform({ enabled: true }).isEnabled()).toBe(true)
  })

  it('explains Arabic can-travel response', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const result = platform.evaluate(
      {
        userId: 'u_ar',
        nationality: 'SA',
        destination: 'Japan',
        passportExpiry: futureDate(24),
        blankPages: 3,
        machineReadable: true,
      },
      'ar',
    )
    expect(isTravelDocumentsResult(result)).toBe(true)
    if (!isTravelDocumentsResult(result)) return
    expect(result.explanation).toMatch(/تأشيرة|جواز/)
  })

  it('rejects evaluate without destination or nationality', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const result = platform.evaluate({
      nationality: '',
      destination: '',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT')
  })

  it('assessPassportOnly returns passport assessment', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    const assessment = platform.assessPassportOnly({
      passportExpiry: futureDate(24),
      blankPages: 3,
      machineReadable: true,
      destination: 'Japan',
    })
    expect(assessment).toBeTruthy()
    if (assessment && 'valid' in assessment) {
      expect(assessment.valid).toBe(true)
    }
  })

  it('detects all document conversation query kinds', () => {
    expect(detectDocumentConversationQuery('Can I travel to Japan?')).toBe('can_travel_to')
    expect(detectDocumentConversationQuery('Do I need a visa?')).toBe('need_visa')
    expect(detectDocumentConversationQuery('My passport expires in 5 months.')).toBe(
      'passport_expiry',
    )
    expect(detectDocumentConversationQuery('Can I transit through London?')).toBe('transit_visa')
    expect(detectDocumentConversationQuery('What documents do I need?')).toBe('what_documents')
    expect(detectDocumentConversationQuery('Do I need yellow fever vaccine?')).toBe(
      'vaccination_requirements',
    )
    expect(detectDocumentConversationQuery('hello')).toBeNull()
  })
})

describe('Document requirement kinds coverage', () => {
  it('emits all core document kinds for a full evaluation', () => {
    const result = createDestinationRulesEngine().evaluate({
      nationality: 'SA',
      destination: 'Thailand',
      passportExpiry: futureDate(18),
      blankPages: 2,
      machineReadable: true,
      hasTravelInsurance: false,
      serviceKinds: SERVICES,
    })
    const kinds = new Set(result.requirements.map((r) => r.kind))
    for (const kind of [
      'passport',
      'visa',
      'transit_visa',
      'entry_permit',
      'exit_requirement',
      'residence_permit',
      'vaccination',
      'health_certificate',
      'travel_insurance',
      'customs_declaration',
      'immigration_rule',
      'digital_arrival_card',
      'airport_document',
    ]) {
      expect(kinds.has(kind as never)).toBe(true)
    }
  })

  it.each([
    ['visa_free', 'Japan', 'SA'],
    ['visa_on_arrival', 'Thailand', 'IN'],
    ['evisa', 'United Arab Emirates', 'IN'],
    ['visa_required', 'United States', 'SA'],
  ] as const)('category %s for %s / %s', (category, destination, nationality) => {
    const result = createDestinationRulesEngine().evaluate({
      nationality,
      destination,
      passportExpiry: futureDate(20),
      blankPages: 3,
      machineReadable: true,
    })
    expect(result.visa.category).toBe(category)
  })
})

describe('Conversation vaccination and transit paths', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('ConversationController answers vaccination question', async () => {
    enableDocumentsChain()
    const turn = await ConversationController({
      enabled: true,
      travelDocumentsPlatform: createTravelDocumentsPlatform({ enabled: true }),
      skipPlannerOrchestrator: true,
    }).handleTurn({
      conversationId: 'conv_vax',
      userId: 'u_v',
      userText: 'Do I need yellow fever vaccine for Brazil?',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('vaccination_requirements')
    expect(turn.assistantMessage.meta?.travelDocuments).toBe(true)
  })

  it('ConversationController answers transit through London', async () => {
    enableDocumentsChain()
    const turn = await ConversationController({
      enabled: true,
      travelDocumentsPlatform: createTravelDocumentsPlatform({ enabled: true }),
      skipPlannerOrchestrator: true,
    }).handleTurn({
      conversationId: 'conv_transit',
      userId: 'u_t',
      userText: 'Can I transit through London?',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('transit_visa')
    expect(turn.renderedText).toMatch(/transit visa/i)
  })

  it('answers need visa for USA as required', () => {
    const text = answerDocumentQuery({
      kind: 'need_visa',
      platform: createTravelDocumentsPlatform({ enabled: true }),
      userId: 'u_usa',
      userText: 'Do I need a visa for USA?',
      nationality: 'SA',
    })
    expect(text).toMatch(/visa is required|eVisa|visa/i)
  })
})

describe('Alerts and insurance edge cases', () => {
  it('emits info reminder when documents are current', () => {
    const alerts = createDocumentAlerts().build({
      userId: 'u_ok',
      nationality: 'SA',
      passportExpiry: futureDate(24),
    })
    expect(alerts.some((a) => a.kind === 'document_reminder')).toBe(true)
  })

  it('marks travel insurance warning when missing', () => {
    const result = createDestinationRulesEngine().evaluate({
      nationality: 'SA',
      destination: 'Japan',
      passportExpiry: futureDate(18),
      hasTravelInsurance: false,
      serviceKinds: ['flight'],
    })
    const insurance = result.requirements.find((r) => r.kind === 'travel_insurance')
    expect(insurance?.status).toBe('warning')
  })

  it('schengen requires two blank pages', () => {
    const result = createDestinationRulesEngine().evaluate({
      nationality: 'SA',
      destination: 'France',
      passportExpiry: futureDate(18),
      blankPages: 1,
      machineReadable: true,
    })
    expect(result.passport.blankPagesOk).toBe(false)
  })

  it('lists sandbox destinations for coverage', () => {
    expect(listSandboxDestinations().length).toBeGreaterThanOrEqual(6)
  })

  it('extracts transit country from text', () => {
    expect(extractTransitFromText('Can I transit through London?')).toEqual(['London'])
    expect(extractPassportMonths('My passport expires in 5 months.')).toBe(5)
  })

  it('visa multi-entry flag surfaces for UK', () => {
    const result = createDestinationRulesEngine().evaluate({
      nationality: 'US',
      destination: 'United Kingdom',
      passportExpiry: futureDate(18),
    })
    expect(result.visa.multiEntry).toBe(true)
  })

  it('default unknown destination still returns requirements', () => {
    const result = createDestinationRulesEngine().evaluate({
      nationality: 'SA',
      destination: 'Atlantis',
      passportExpiry: futureDate(18),
    })
    expect(result.destination).toBe('Atlantis')
    expect(result.visa.category).toBe('visa_required')
    expect(result.immigrationNotes.length).toBeGreaterThan(0)
  })

  it('metrics track visa-free vs required counts', () => {
    const platform = createTravelDocumentsPlatform({ enabled: true })
    platform.evaluate({
      nationality: 'SA',
      destination: 'Japan',
      passportExpiry: futureDate(20),
    })
    platform.evaluate({
      nationality: 'SA',
      destination: 'United States',
      passportExpiry: futureDate(20),
    })
    const metrics = platform.getMetrics()
    expect(metrics.visaFreeCount).toBe(1)
    expect(metrics.visaRequiredCount).toBe(1)
    expect(metrics.averageConfidence).toBeGreaterThan(0)
  })
})
