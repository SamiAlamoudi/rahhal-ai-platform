import type {
  KnowledgeCenterLocale,
  KnowledgeMainSection,
  KnowledgeSidebarNav,
} from '../types'
import { KNOWLEDGE_MAIN_SECTIONS, KNOWLEDGE_SIDEBAR_NAV } from '../types'

export interface KnowledgeSidebarProps {
  locale?: KnowledgeCenterLocale
  activeSection: KnowledgeMainSection
  sidebar: KnowledgeSidebarNav
  searchQuery: string
  onSectionChange: (section: KnowledgeMainSection) => void
  onSidebarChange: (nav: KnowledgeSidebarNav) => void
  onSearchChange: (query: string) => void
}

const SECTION_LABEL: Record<KnowledgeMainSection, { ar: string; en: string }> = {
  travel_guides: { ar: 'أدلة السفر', en: 'Travel Guides' },
  country_guides: { ar: 'أدلة الدول', en: 'Country Guides' },
  visa_library: { ar: 'مكتبة التأشيرات', en: 'Visa Library' },
  airline_information: { ar: 'معلومات الطيران', en: 'Airline Information' },
  airport_guides: { ar: 'أدلة المطارات', en: 'Airport Guides' },
  hotel_guides: { ar: 'أدلة الفنادق', en: 'Hotel Guides' },
  transportation: { ar: 'التنقل', en: 'Transportation' },
  emergency_contacts: { ar: 'جهات الطوارئ', en: 'Emergency Contacts' },
  embassies: { ar: 'السفارات', en: 'Embassies' },
  travel_tips: { ar: 'نصائح السفر', en: 'Travel Tips' },
  faq: { ar: 'الأسئلة الشائعة', en: 'FAQ' },
  company_policies: { ar: 'سياسات الشركة', en: 'Company Policies' },
  executive_travel_manuals: { ar: 'أدلة السفر التنفيذي', en: 'Executive Travel Manuals' },
  books: { ar: 'الكتب', en: 'Books' },
}

const NAV_LABEL: Record<KnowledgeSidebarNav, { ar: string; en: string }> = {
  navigation: { ar: 'التنقل', en: 'Navigation' },
  collections: { ar: 'المجموعات', en: 'Collections' },
  countries: { ar: 'الدول', en: 'Countries' },
  search: { ar: 'بحث', en: 'Search' },
  pinned: { ar: 'مثبّت', en: 'Pinned' },
  recent: { ar: 'الأخيرة', en: 'Recent' },
  favorites: { ar: 'المفضلة', en: 'Favorites' },
}

/** Knowledge sidebar — navigation, collections, countries, search, pinned/recent/favorites. */
export function KnowledgeSidebar({
  locale = 'ar',
  activeSection,
  sidebar,
  searchQuery,
  onSectionChange,
  onSidebarChange,
  onSearchChange,
}: KnowledgeSidebarProps) {
  return (
    <aside className="rahhal-kc-sidebar" data-testid="kc-sidebar">
      <header className="rahhal-kc-sidebar__brand" data-testid="kc-brand">
        <p className="rahhal-kc-sidebar__name">رحّال</p>
        <h2>{locale === 'en' ? 'Knowledge Center' : 'مركز المعرفة'}</h2>
      </header>

      <nav className="rahhal-kc-sidebar__nav" data-testid="kc-sidebar-nav">
        {KNOWLEDGE_SIDEBAR_NAV.map((id) => (
          <button
            key={id}
            type="button"
            data-sidebar={id}
            className={sidebar === id ? 'is-active' : undefined}
            aria-pressed={sidebar === id}
            onClick={() => onSidebarChange(id)}
          >
            {locale === 'en' ? NAV_LABEL[id].en : NAV_LABEL[id].ar}
          </button>
        ))}
      </nav>

      <label className="rahhal-kc-sidebar__search">
        <span className="rahhal-kc-sr-only">
          {locale === 'en' ? 'Global search' : 'بحث عام'}
        </span>
        <input
          type="search"
          data-testid="kc-global-search"
          value={searchQuery}
          placeholder={locale === 'en' ? 'Search knowledge…' : 'ابحث في المعرفة…'}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>

      <div className="rahhal-kc-sidebar__sections" data-testid="kc-sections">
        {KNOWLEDGE_MAIN_SECTIONS.map((section) => (
          <button
            key={section}
            type="button"
            data-section={section}
            className={activeSection === section ? 'is-active' : undefined}
            aria-pressed={activeSection === section}
            onClick={() => onSectionChange(section)}
          >
            {locale === 'en' ? SECTION_LABEL[section].en : SECTION_LABEL[section].ar}
          </button>
        ))}
      </div>
    </aside>
  )
}
