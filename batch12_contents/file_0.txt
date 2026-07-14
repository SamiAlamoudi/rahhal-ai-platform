export type TransferType = 'train' | 'bus' | 'private-transfer' | 'shared-shuttle' | 'taxi'

export interface TransferOffer {
  id: string
  providerId: string
  title: string
  currency: string
  price: number
  rating: number | null
  location: string
  durationMinutes: number | null
  transferType: TransferType
  origin: string
  destination: string
  familyFriendly: boolean
  cancellationPolicy: string | null
}
