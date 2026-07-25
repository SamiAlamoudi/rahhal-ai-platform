import type { SharedItemModel, TravelWorkspaceLocale } from '../types'

export function SharedItems({
  items,
  locale = 'ar',
}: {
  items: SharedItemModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-shared-items" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Shared items' : 'عناصر مشتركة'}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span>
              {' '}
              · {locale === 'en' ? 'with' : 'مع'} {item.sharedWith}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
