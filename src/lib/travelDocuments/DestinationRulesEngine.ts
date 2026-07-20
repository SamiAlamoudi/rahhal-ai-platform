/**
 * Sprint 39 — Destination Rules Engine
 * Determines required documents from nationality, residence, passport, transit, destination, purpose, duration, age.
 */

import { PassportIntelligence, createPassportIntelligence } from './PassportIntelligence'
import { VaccinationRules, createVaccinationRules } from './VaccinationRules'
import { VisaIntelligence, createVisaIntelligence } from './VisaIntelligence'
import {
  normalizeCountryCode,
  resolveDestinationRule,
} from './rules/sandboxDestinationRules'
import type {
  DestinationRulesInput,
  DestinationRulesResult,
  DocumentRequirement,
  TravelServiceKind,
} from './types'

const ALL_SERVICES: TravelServiceKind[] = [
  'flight',
  'hotel',
  'car',
  'activity',
  'cruise',
  'rail',
  'bus',
  'future',
]

export class DestinationRulesEngine {
  private readonly passport: PassportIntelligence
  private readonly visa: VisaIntelligence
  private readonly vaccination: VaccinationRules

  constructor(options?: {
    passport?: PassportIntelligence
    visa?: VisaIntelligence
    vaccination?: VaccinationRules
  }) {
    this.passport = options?.passport ?? createPassportIntelligence()
    this.visa = options?.visa ?? createVisaIntelligence()
    this.vaccination = options?.vaccination ?? createVaccinationRules()
  }

  evaluate(input: DestinationRulesInput): DestinationRulesResult {
    const rule = resolveDestinationRule(input.destination)
    const nationality = normalizeCountryCode(input.nationality)
    const services = input.serviceKinds?.length ? input.serviceKinds : ALL_SERVICES

    const passport = this.passport.assess({
      passportExpiry: input.passportExpiry,
      blankPages: input.blankPages,
      machineReadable: input.machineReadable,
      validityRuleMonths: rule.passportValidityMonths,
      minBlankPages: rule.minBlankPages,
    })

    const visa = this.visa.assess({
      rule,
      nationality,
      transitCountries: input.transitCountries,
      purpose: input.purpose,
    })

    const vaccination = this.vaccination.assess({
      rule,
      records: input.vaccinationRecords,
    })

    const requirements: DocumentRequirement[] = []

    requirements.push({
      kind: 'passport',
      title: 'Passport',
      required: true,
      status: passport.valid ? (passport.warnings.length ? 'warning' : 'satisfied') : 'missing',
      detail: passport.summary,
      serviceKinds: [...services],
    })

    requirements.push({
      kind: 'visa',
      title: 'Visa / entry authorization',
      required: visa.required,
      status: visa.required ? 'missing' : 'not_applicable',
      detail: visa.summary,
      serviceKinds: services.filter((s) => s === 'flight' || s === 'cruise' || s === 'rail' || s === 'bus' || s === 'future'),
    })

    if (visa.transitVisaRequired) {
      requirements.push({
        kind: 'transit_visa',
        title: 'Transit visa',
        required: true,
        status: 'missing',
        detail: 'Transit visa may be required for one or more layover countries',
        serviceKinds: ['flight', 'rail', 'bus', 'future'],
      })
    } else {
      requirements.push({
        kind: 'transit_visa',
        title: 'Transit visa',
        required: false,
        status: 'not_applicable',
        detail: 'No transit visa is required',
        serviceKinds: ['flight', 'rail', 'bus', 'future'],
      })
    }

    requirements.push({
      kind: 'entry_permit',
      title: 'Entry permit / ETA',
      required: visa.category === 'evisa',
      status: visa.category === 'evisa' ? 'missing' : 'not_applicable',
      detail:
        visa.category === 'evisa'
          ? 'Electronic entry permit / ETA must be obtained before travel'
          : 'No separate entry permit beyond visa rules',
      serviceKinds: [...services],
    })

    requirements.push({
      kind: 'exit_requirement',
      title: 'Exit / return requirements',
      required: true,
      status: 'warning',
      detail:
        input.tripDurationDays && input.tripDurationDays > (visa.validityDays ?? 90)
          ? 'Trip duration may exceed allowed stay — check exit/extension rules'
          : 'Proof of onward/return travel is commonly required',
      serviceKinds: ['flight', 'cruise', 'rail', 'bus', 'future'],
    })

    requirements.push({
      kind: 'residence_permit',
      title: 'Residence permit',
      required: Boolean(input.residenceCountry && input.residenceCountry !== nationality),
      status:
        input.residenceCountry && input.residenceCountry !== nationality
          ? 'warning'
          : 'not_applicable',
      detail:
        input.residenceCountry && input.residenceCountry !== nationality
          ? `Traveling on residence in ${input.residenceCountry} — carry residence permit`
          : 'Residence permit not required for this profile',
      serviceKinds: [...services],
    })

    requirements.push({
      kind: 'vaccination',
      title: 'Vaccinations',
      required: vaccination.required.length > 0,
      status:
        vaccination.missing.length > 0
          ? 'missing'
          : vaccination.required.length > 0
            ? 'satisfied'
            : 'not_applicable',
      detail: vaccination.summary,
      serviceKinds: [...services],
    })

    requirements.push({
      kind: 'health_certificate',
      title: 'Health certificate',
      required: vaccination.healthCertificateRequired,
      status: vaccination.healthCertificateRequired ? 'missing' : 'not_applicable',
      detail: vaccination.healthCertificateRequired
        ? 'Health certificate required'
        : 'No health certificate required',
      serviceKinds: [...services],
    })

    const insuranceRequired = rule.insuranceRecommended && services.includes('flight')
    requirements.push({
      kind: 'travel_insurance',
      title: 'Travel insurance',
      required: insuranceRequired,
      status: input.hasTravelInsurance
        ? 'satisfied'
        : insuranceRequired
          ? 'warning'
          : 'not_applicable',
      detail: input.hasTravelInsurance
        ? 'Travel insurance on file'
        : insuranceRecommendedText(rule.destination, insuranceRequired),
      serviceKinds: [...services],
    })

    requirements.push({
      kind: 'customs_declaration',
      title: 'Customs declaration',
      required: rule.customsDeclaration,
      status: rule.customsDeclaration ? 'warning' : 'not_applicable',
      detail: rule.customsDeclaration
        ? 'Complete customs declaration on arrival / digitally'
        : 'No customs declaration highlighted',
      serviceKinds: ['flight', 'cruise', 'rail', 'bus', 'car', 'future'],
    })

    requirements.push({
      kind: 'immigration_rule',
      title: 'Immigration rules',
      required: true,
      status: 'warning',
      detail: rule.immigrationNotes.join('; ') || 'Follow local immigration instructions',
      serviceKinds: [...services],
    })

    requirements.push({
      kind: 'digital_arrival_card',
      title: 'Digital arrival card',
      required: rule.digitalArrivalCard,
      status: rule.digitalArrivalCard ? 'missing' : 'not_applicable',
      detail: rule.digitalArrivalCard
        ? 'Complete digital arrival card before landing'
        : 'No digital arrival card required',
      serviceKinds: ['flight', 'cruise', 'future'],
    })

    requirements.push({
      kind: 'airport_document',
      title: 'Airport document checks',
      required: true,
      status: 'warning',
      detail: rule.airportDocuments.join(', '),
      serviceKinds: ['flight', 'future'],
    })

    if (input.age != null && input.age < 18) {
      requirements.push({
        kind: 'immigration_rule',
        title: 'Minor travel consent',
        required: true,
        status: 'warning',
        detail: 'Travelers under 18 may need parental consent letters',
        serviceKinds: [...services],
      })
    }

    const canTravel =
      passport.valid
      && vaccination.missing.length === 0
      && !(visa.category === 'visa_required' && false) // visa can be obtained later

    const confidence = clamp01(
      0.55
        + (passport.valid ? 0.2 : 0)
        + (vaccination.missing.length === 0 ? 0.15 : 0)
        + (input.passportExpiry ? 0.05 : 0)
        + (input.machineReadable != null ? 0.05 : 0),
    )

    return {
      destination: rule.destination,
      nationality,
      requirements,
      passport,
      visa,
      vaccination,
      customsDeclarationRequired: rule.customsDeclaration,
      digitalArrivalCardRequired: rule.digitalArrivalCard,
      airportDocuments: [...rule.airportDocuments],
      immigrationNotes: [...rule.immigrationNotes],
      canTravel,
      confidence,
    }
  }
}

export function createDestinationRulesEngine(options?: {
  passport?: PassportIntelligence
  visa?: VisaIntelligence
  vaccination?: VaccinationRules
}): DestinationRulesEngine {
  return new DestinationRulesEngine(options)
}

function insuranceRecommendedText(destination: string, required: boolean): string {
  return required
    ? `Travel insurance is strongly recommended for ${destination}`
    : `Travel insurance optional for ${destination}`
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
