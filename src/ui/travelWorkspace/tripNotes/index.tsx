import type { TripNoteModel, TravelWorkspaceLocale } from '../types'

export function TripNotes({
  notes,
  locale = 'ar',
}: {
  notes: TripNoteModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-trip-notes" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Trip notes' : 'ملاحظات الرحلة'}</h2>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>
            <p>{n.body}</p>
            <time dateTime={n.updatedAt}>{n.updatedAt}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}
