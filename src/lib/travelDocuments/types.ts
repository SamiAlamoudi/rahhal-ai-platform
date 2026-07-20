/**
 * Sprint 39 — Universal Travel Documents & Visa Intelligence domain types.
 */

export type TravelServiceKind =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'cruise'
  | 'rail'
  | 'bus'
  | 'future'

export type DocumentKind =
  | 'passport'
  | 'visa'
  | 'transit_visa'
  | 'entry_permit'
  | 'exit_requirement'
  | 'residence_permit'
  | 'vaccination'
  | 'health_certificate'
  | 'travel_insurance'
  | 'customs_declaration'
  | 'immigration_rule'
  | 'digital_arrival_card'
  | 'airport_document'

export type VisaCategory =
  | 'visa_required'
  | 'visa_on_arrival'
  | 'evisa'
  | 'visa_free'
  | 'transit_visa'
  | 'multi_entry'

export type TravelPurpose =
  | 'tourism'
  | 'business'
  | 'transit'
  | 'study'
  | 'family'
  | 'medical'
  | 'other'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface TravelerDocumentProfile {
  userId: string
  nationality: string
  residenceCountry?: string | null
  passportNumber?: string | null
  passportExpiry?: string | null
  passportIssueCountry?: string | null
  blankPages?: number | null
  machineReadable?: boolean | null
  age?: number | null
  residencePermitExpiry?: string | null
  visaExpiry?: string | null
  vaccinationRecords?: VaccinationRecord[]
  hasTravelInsurance?: boolean
}

export interface VaccinationRecord {
  vaccine: 'yellow_fever' | 'covid' | 'other'
  name: string
  administeredAt: string
  expiresAt?: string | null
}

export interface DestinationRulesInput {
  nationality: string
  residenceCountry?: string | null
  destination: string
  transitCountries?: string[]
  purpose?: TravelPurpose
  tripDurationDays?: number
  age?: number | null
  serviceKinds?: TravelServiceKind[]
  passportExpiry?: string | null
  blankPages?: number | null
  machineReadable?: boolean | null
  hasTravelInsurance?: boolean
  vaccinationRecords?: VaccinationRecord[]
}

export interface PassportAssessment {
  valid: boolean
  expiresInDays: number | null
  blankPagesOk: boolean
  machineReadableOk: boolean
  validityRuleMonths: number
  warnings: string[]
  blockingIssues: string[]
  summary: string
}

export interface VisaAssessment {
  category: VisaCategory
  required: boolean
  multiEntry: boolean
  validityDays: number | null
  processingDaysMin: number | null
  processingDaysMax: number | null
  approvalProbability: number
  transitVisaRequired: boolean
  notes: string[]
  summary: string
}

export interface VaccinationAssessment {
  required: Array<{ vaccine: string; reason: string }>
  recommended: Array<{ vaccine: string; reason: string }>
  medicalDeclarationRequired: boolean
  healthCertificateRequired: boolean
  missing: string[]
  summary: string
}

export interface DocumentRequirement {
  kind: DocumentKind
  title: string
  required: boolean
  status: 'satisfied' | 'missing' | 'warning' | 'not_applicable'
  detail: string
  serviceKinds: TravelServiceKind[]
}

export interface DestinationRulesResult {
  destination: string
  nationality: string
  requirements: DocumentRequirement[]
  passport: PassportAssessment
  visa: VisaAssessment
  vaccination: VaccinationAssessment
  customsDeclarationRequired: boolean
  digitalArrivalCardRequired: boolean
  airportDocuments: string[]
  immigrationNotes: string[]
  canTravel: boolean
  confidence: number
}

export interface DocumentAlert {
  alertId: string
  kind:
    | 'passport_expiration'
    | 'visa_expiration'
    | 'residence_expiration'
    | 'vaccination_expiration'
    | 'document_reminder'
  severity: AlertSeverity
  title: string
  message: string
  dueAt?: string | null
  createdAt: string
}

export interface TravelDocumentsResult {
  ok: true
  rules: DestinationRulesResult
  alerts: DocumentAlert[]
  explanation: string
  confidence: number
}

export interface TravelDocumentsDisabledResult {
  ok: false
  code: 'FEATURE_DISABLED' | 'INVALID_INPUT'
  message: string
}
