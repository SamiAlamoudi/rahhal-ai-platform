import type {
  KnowledgeCenterLocale,
  KnowledgeOrganizationKind,
} from '../types'
import { KNOWLEDGE_ORGANIZATIONS } from '../types'

export interface OrganizationBarProps {
  active: KnowledgeOrganizationKind
  locale?: KnowledgeCenterLocale
  onChange: (org: KnowledgeOrganizationKind) => void
}

const ORG_LABEL: Record<KnowledgeOrganizationKind, { ar: string; en: string }> = {
  collections: { ar: 'مجموعات', en: 'Collections' },
  folders: { ar: 'مجلدات', en: 'Folders' },
  countries: { ar: 'دول', en: 'Countries' },
  topics: { ar: 'مواضيع', en: 'Topics' },
  executive: { ar: 'تنفيذي', en: 'Executive' },
  personal: { ar: 'شخصي', en: 'Personal' },
  travel_planning: { ar: 'تخطيط السفر', en: 'Travel planning' },
  visas: { ar: 'تأشيرات', en: 'Visas' },
  hotels: { ar: 'فنادق', en: 'Hotels' },
  flights: { ar: 'رحلات', en: 'Flights' },
}

export function OrganizationBar({
  active,
  locale = 'ar',
  onChange,
}: OrganizationBarProps) {
  return (
    <div className="rahhal-kc-org" data-testid="kc-organization">
      {KNOWLEDGE_ORGANIZATIONS.map((org) => (
        <button
          key={org}
          type="button"
          data-org={org}
          className={active === org ? 'is-active' : undefined}
          aria-pressed={active === org}
          onClick={() => onChange(org)}
        >
          {locale === 'en' ? ORG_LABEL[org].en : ORG_LABEL[org].ar}
        </button>
      ))}
    </div>
  )
}
