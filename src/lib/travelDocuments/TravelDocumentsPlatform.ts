/**
 * Sprint 39 — Universal Travel Documents & Visa Intelligence Platform.
 */

import { DestinationRulesEngine, createDestinationRulesEngine } from './DestinationRulesEngine'
import { DocumentAlerts, createDocumentAlerts } from './DocumentAlerts'
import { PassportIntelligence, createPassportIntelligence } from './PassportIntelligence'
import {
  TravelDocumentsEvents,
  createTravelDocumentsEvent,
  type TravelDocumentsEvent,
} from './TravelDocumentsEvents'
import {
  TravelDocumentsExplainer,
  createTravelDocumentsExplainer,
} from './TravelDocumentsExplainer'
import { isTravelDocumentsEnabled } from './TravelDocumentsFeatureFlags'
import { TravelDocumentsMetrics } from './TravelDocumentsMetrics'
import { VaccinationRules, createVaccinationRules } from './VaccinationRules'
import { VisaIntelligence, createVisaIntelligence } from './VisaIntelligence'
import type {
  DestinationRulesInput,
  DocumentAlert,
  TravelDocumentsDisabledResult,
  TravelDocumentsResult,
  TravelerDocumentProfile,
} from './types'

export interface TravelDocumentsPlatformOptions {
  enabled?: boolean
  rulesEngine?: DestinationRulesEngine
  passport?: PassportIntelligence
  visa?: VisaIntelligence
  vaccination?: VaccinationRules
  alerts?: DocumentAlerts
  explainer?: TravelDocumentsExplainer
  events?: TravelDocumentsEvents
  metrics?: TravelDocumentsMetrics
  onEvent?: (event: TravelDocumentsEvent) => void
}

export class TravelDocumentsPlatform {
  private readonly enabledOverride: boolean | undefined
  private readonly rulesEngine: DestinationRulesEngine
  private readonly passport: PassportIntelligence
  private readonly alertsService: DocumentAlerts
  private readonly explainer: TravelDocumentsExplainer
  private readonly events: TravelDocumentsEvents
  private readonly metrics: TravelDocumentsMetrics
  private readonly onEvent: ((event: TravelDocumentsEvent) => void) | undefined
  private readonly recent: TravelDocumentsEvent[] = []
  private readonly profiles = new Map<string, TravelerDocumentProfile>()

  constructor(options: TravelDocumentsPlatformOptions = {}) {
    this.enabledOverride = options.enabled
    this.passport = options.passport ?? createPassportIntelligence()
    this.rulesEngine =
      options.rulesEngine
      ?? createDestinationRulesEngine({
        passport: this.passport,
        visa: options.visa ?? createVisaIntelligence(),
        vaccination: options.vaccination ?? createVaccinationRules(),
      })
    this.alertsService = options.alerts ?? createDocumentAlerts()
    this.explainer = options.explainer ?? createTravelDocumentsExplainer()
    this.events = options.events ?? new TravelDocumentsEvents()
    this.metrics = options.metrics ?? new TravelDocumentsMetrics()
    this.onEvent = options.onEvent
  }

  isEnabled(): boolean {
    if (typeof this.enabledOverride === 'boolean') return this.enabledOverride
    return isTravelDocumentsEnabled()
  }

  upsertProfile(profile: TravelerDocumentProfile): TravelerDocumentProfile {
    const next = { ...profile, vaccinationRecords: [...(profile.vaccinationRecords ?? [])] }
    this.profiles.set(profile.userId, next)
    return { ...next }
  }

  getProfile(userId: string): TravelerDocumentProfile | null {
    const row = this.profiles.get(userId)
    return row ? { ...row, vaccinationRecords: [...(row.vaccinationRecords ?? [])] } : null
  }

  evaluate(
    input: DestinationRulesInput & { userId?: string },
    locale: 'en' | 'ar' = 'en',
  ): TravelDocumentsResult | TravelDocumentsDisabledResult {
    if (!this.isEnabled()) return disabled()
    if (!input.destination?.trim() || !input.nationality?.trim()) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'destination and nationality are required',
      }
    }

    const userId = input.userId ?? 'anonymous'
    const profile = this.profiles.get(userId)
    const merged: DestinationRulesInput = {
      ...input,
      residenceCountry: input.residenceCountry ?? profile?.residenceCountry,
      passportExpiry: input.passportExpiry ?? profile?.passportExpiry,
      blankPages: input.blankPages ?? profile?.blankPages,
      machineReadable: input.machineReadable ?? profile?.machineReadable,
      age: input.age ?? profile?.age,
      hasTravelInsurance: input.hasTravelInsurance ?? profile?.hasTravelInsurance,
      vaccinationRecords: input.vaccinationRecords ?? profile?.vaccinationRecords,
    }

    const rules = this.rulesEngine.evaluate(merged)
    this.emit(
      createTravelDocumentsEvent('RulesEvaluated', userId, {
        destination: rules.destination,
        canTravel: rules.canTravel,
      }),
    )
    this.emit(
      createTravelDocumentsEvent('PassportAssessed', userId, {
        valid: rules.passport.valid,
        expiresInDays: rules.passport.expiresInDays,
      }),
    )
    this.emit(
      createTravelDocumentsEvent('VisaAssessed', userId, {
        category: rules.visa.category,
        transitVisaRequired: rules.visa.transitVisaRequired,
      }),
    )
    this.emit(
      createTravelDocumentsEvent('VaccinationAssessed', userId, {
        missing: rules.vaccination.missing,
      }),
    )

    const alerts = this.buildAlerts(userId, merged, profile)
    this.emit(
      createTravelDocumentsEvent('AlertsGenerated', userId, { count: alerts.length }),
    )

    const explanation = this.explainer.explainCanTravel(rules, locale)
    this.emit(createTravelDocumentsEvent('DocumentsExplained', userId, { locale }))

    this.metrics.recordEvaluation({
      destination: rules.destination,
      visaFree: rules.visa.category === 'visa_free',
      passportWarnings: rules.passport.warnings.length,
      alerts: alerts.length,
      confidence: rules.confidence,
    })

    this.emit(
      createTravelDocumentsEvent('DocumentsHandled', userId, {
        destination: rules.destination,
        confidence: rules.confidence,
      }),
    )

    return {
      ok: true,
      rules,
      alerts,
      explanation,
      confidence: rules.confidence,
    }
  }

  assessPassportOnly(input: {
    userId?: string
    passportExpiry?: string | null
    blankPages?: number | null
    machineReadable?: boolean | null
    destination?: string
  }) {
    if (!this.isEnabled()) return disabled()
    const validityRuleMonths = input.destination
      ? this.rulesEngine.evaluate({
          nationality: 'SA',
          destination: input.destination,
        }).passport.validityRuleMonths
      : 6
    return this.passport.assess({
      passportExpiry: input.passportExpiry,
      blankPages: input.blankPages,
      machineReadable: input.machineReadable,
      validityRuleMonths,
      minBlankPages: 1,
    })
  }

  getAlerts(userId: string): DocumentAlert[] {
    const profile = this.profiles.get(userId)
    if (!profile) return []
    return this.alertsService.build(profile)
  }

  getMetrics() {
    return this.metrics.snapshot()
  }

  getRecentEvents(limit = 50): TravelDocumentsEvent[] {
    return this.recent.slice(-limit)
  }

  private buildAlerts(
    userId: string,
    input: DestinationRulesInput,
    profile?: TravelerDocumentProfile,
  ): DocumentAlert[] {
    const mergedProfile: TravelerDocumentProfile = {
      userId,
      nationality: input.nationality,
      residenceCountry: input.residenceCountry,
      passportExpiry: input.passportExpiry,
      blankPages: input.blankPages,
      machineReadable: input.machineReadable,
      age: input.age,
      residencePermitExpiry: profile?.residencePermitExpiry,
      visaExpiry: profile?.visaExpiry,
      vaccinationRecords: input.vaccinationRecords ?? profile?.vaccinationRecords,
      hasTravelInsurance: input.hasTravelInsurance,
    }
    return this.alertsService.build(mergedProfile)
  }

  private emit(event: TravelDocumentsEvent): void {
    this.recent.push(event)
    this.events.emit(event)
    this.onEvent?.(event)
  }
}

export function createTravelDocumentsPlatform(
  options?: TravelDocumentsPlatformOptions,
): TravelDocumentsPlatform {
  return new TravelDocumentsPlatform(options)
}

export function isTravelDocumentsResult(
  value: TravelDocumentsResult | TravelDocumentsDisabledResult,
): value is TravelDocumentsResult {
  return value.ok === true
}

function disabled(): TravelDocumentsDisabledResult {
  return {
    ok: false,
    code: 'FEATURE_DISABLED',
    message: 'Travel Documents platform is disabled (brain.travel_documents).',
  }
}
