import type { ChecklistItemModel, TravelWorkspaceLocale } from '../types'

export function Checklists({
  items,
  locale = 'ar',
  onToggle,
}: {
  items: ChecklistItemModel[]
  locale?: TravelWorkspaceLocale
  onToggle?: (id: string) => void
}) {
  return (
    <section data-testid="tw-checklists" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Checklists' : 'قوائم التحقق'}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggle?.(item.id)}
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
