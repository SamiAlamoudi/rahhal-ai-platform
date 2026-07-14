export interface VisaInfo {
  id: string
  providerId: string
  destination: string
  visaType: string
  required: boolean
  processingDays: number
  cost: number
  currency: string
  validDays: number
  documentsRequired: string[]
  notes: string
}
