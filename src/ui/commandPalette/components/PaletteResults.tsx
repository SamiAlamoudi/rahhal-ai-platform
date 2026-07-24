import type {
  CommandPaletteLocale,
  PaletteItem,
  ResultCollection,
  ResultLayout,
} from '../types'
import { RESULT_COLLECTIONS } from '../types'

function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.trim().toLowerCase())
  if (idx < 0) return text
  const end = idx + query.trim().length
  return `${text.slice(0, idx)}⟨${text.slice(idx, end)}⟩${text.slice(end)}`
}

export function PaletteResults({
  items,
  layout,
  query,
  locale = 'ar',
  onSelect,
}: {
  items: PaletteItem[]
  layout: ResultLayout
  query: string
  locale?: CommandPaletteLocale
  onSelect?: (item: PaletteItem) => void
}) {
  if (layout === 'grouped') {
    return (
      <div
        className="rahhal-cp-results rahhal-cp-results--grouped"
        data-testid="cp-results"
        data-layout="grouped"
      >
        {RESULT_COLLECTIONS.map((collection) => {
          const group = items.filter((i) => i.collection === collection)
          if (group.length === 0) return null
          return (
            <section key={collection} data-collection={collection}>
              <h3>{collectionLabel(collection, locale)}</h3>
              <ResultList
                items={group}
                query={query}
                layout="list"
                onSelect={onSelect}
              />
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={`rahhal-cp-results rahhal-cp-results--${layout}`}
      data-testid="cp-results"
      data-layout={layout}
    >
      <ResultList items={items} query={query} layout={layout} onSelect={onSelect} />
    </div>
  )
}

function ResultList({
  items,
  query,
  layout,
  onSelect,
}: {
  items: PaletteItem[]
  query: string
  layout: ResultLayout
  onSelect?: (item: PaletteItem) => void
}) {
  return (
    <ul className={`rahhal-cp-list rahhal-cp-list--${layout}`}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="rahhal-cp-item"
            data-testid="cp-result-item"
            data-kind={item.kind}
            data-domain={item.domain ?? ''}
            data-destination={item.destination ?? ''}
            data-collection={item.collection ?? ''}
            data-pinned={item.pinned ? 'true' : 'false'}
            data-favorite={item.favorite ? 'true' : 'false'}
            onClick={() => onSelect?.(item)}
          >
            <span className="rahhal-cp-item__title" data-testid="cp-highlight">
              {highlightMatch(item.title, query)}
            </span>
            <span className="rahhal-cp-item__sub">{item.subtitle}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function collectionLabel(
  collection: ResultCollection,
  locale: CommandPaletteLocale,
): string {
  const map: Record<ResultCollection, { ar: string; en: string }> = {
    pinned: { ar: 'مثبّت', en: 'Pinned' },
    favorites: { ar: 'المفضلة', en: 'Favorites' },
    recent: { ar: 'الأخيرة', en: 'Recent' },
    suggested: { ar: 'مقترحة', en: 'Suggested' },
    frequently_used: { ar: 'الأكثر استخداماً', en: 'Frequently used' },
  }
  return locale === 'en' ? map[collection].en : map[collection].ar
}
