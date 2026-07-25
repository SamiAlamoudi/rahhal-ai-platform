import type { AttachmentModel, TravelWorkspaceLocale } from '../types'

export function Attachments({
  attachments,
  locale = 'ar',
}: {
  attachments: AttachmentModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-attachments" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Attachments' : 'المرفقات'}</h2>
      <ul>
        {attachments.map((a) => (
          <li key={a.id} data-kind={a.kindLabel}>
            {a.name}
          </li>
        ))}
      </ul>
    </section>
  )
}
