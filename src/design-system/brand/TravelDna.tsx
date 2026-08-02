/**
 * Rahhal Travel DNA — connected category marks for the whole journey.
 */

import type { ReactNode } from 'react'
import {
  IconBell,
  IconCar,
  IconCheck,
  IconClock,
  IconCompass,
  IconHeart,
  IconHotel,
  IconMap,
  IconPackage,
  IconPlane,
  IconSpark,
  IconWallet,
} from '../icons/OutlinedIcons'
import { DsText } from '../components/primitives'

export type TravelDnaId =
  | 'flights'
  | 'hotels'
  | 'packages'
  | 'experiences'
  | 'restaurants'
  | 'transportation'
  | 'visa'
  | 'insurance'
  | 'loyalty'
  | 'rewards'
  | 'maps'
  | 'timeline'
  | 'weather'
  | 'emergency'

export const TRAVEL_DNA_CATALOG: Array<{
  id: TravelDnaId
  label: string
  labelAr: string
}> = [
  { id: 'flights', label: 'Flights', labelAr: 'طيران' },
  { id: 'hotels', label: 'Hotels', labelAr: 'فنادق' },
  { id: 'packages', label: 'Packages', labelAr: 'باقات' },
  { id: 'experiences', label: 'Experiences', labelAr: 'تجارب' },
  { id: 'restaurants', label: 'Restaurants', labelAr: 'مطاعم' },
  { id: 'transportation', label: 'Transportation', labelAr: 'تنقّل' },
  { id: 'visa', label: 'Visa', labelAr: 'تأشيرة' },
  { id: 'insurance', label: 'Insurance', labelAr: 'تأمين' },
  { id: 'loyalty', label: 'Loyalty', labelAr: 'ولاء' },
  { id: 'rewards', label: 'Rewards', labelAr: 'مكافآت' },
  { id: 'maps', label: 'Maps', labelAr: 'خرائط' },
  { id: 'timeline', label: 'Timeline', labelAr: 'جدول' },
  { id: 'weather', label: 'Weather', labelAr: 'طقس' },
  { id: 'emergency', label: 'Emergency', labelAr: 'طوارئ' },
]

function dnaIcon(id: TravelDnaId): ReactNode {
  switch (id) {
    case 'flights':
      return <IconPlane size={20} />
    case 'hotels':
      return <IconHotel size={20} />
    case 'packages':
      return <IconPackage size={20} />
    case 'experiences':
      return <IconSpark size={20} />
    case 'restaurants':
      return <IconHeart size={20} />
    case 'transportation':
      return <IconCar size={20} />
    case 'visa':
      return <IconCheck size={20} />
    case 'insurance':
      return <IconWallet size={20} />
    case 'loyalty':
      return <IconCompass size={20} />
    case 'rewards':
      return <IconSpark size={20} />
    case 'maps':
      return <IconMap size={20} />
    case 'timeline':
      return <IconClock size={20} />
    case 'weather':
      return <IconCompass size={20} />
    case 'emergency':
      return <IconBell size={20} />
  }
}

/** Shared optical frame — every category sits in the same brand vessel. */
export function TravelDnaMark({
  id,
  size = 56,
  showLabel = true,
}: {
  id: TravelDnaId
  size?: number
  showLabel?: boolean
}) {
  const meta = TRAVEL_DNA_CATALOG.find((c) => c.id === id)!
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center', width: size + 24 }}>
      <span
        className="rh-surface-signature"
        style={{
          width: size,
          height: size,
          borderRadius: 'var(--ds-radius-md)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ds-primary)',
          background:
            'linear-gradient(160deg, var(--ds-primary-soft), var(--ds-secondary-soft))',
          boxShadow: 'var(--rh-shadow-card)',
        }}
        aria-hidden={!showLabel}
      >
        {dnaIcon(id)}
      </span>
      {showLabel ? (
        <DsText variant="micro" tone="secondary" style={{ textAlign: 'center', fontWeight: 700 }}>
          {meta.label}
          <br />
          <span style={{ color: 'var(--ds-ink-tertiary)' }}>{meta.labelAr}</span>
        </DsText>
      ) : null}
    </div>
  )
}

export function TravelDnaGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
        gap: 14,
      }}
    >
      {TRAVEL_DNA_CATALOG.map((item) => (
        <TravelDnaMark key={item.id} id={item.id} />
      ))}
    </div>
  )
}
