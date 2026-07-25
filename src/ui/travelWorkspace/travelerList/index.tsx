import type { TravelerModel, TravelWorkspaceLocale } from '../types'

export function TravelerList({
  travelers,
  locale = 'ar',
}: {
  travelers: TravelerModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-traveler-list" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Travelers' : 'المسافرون'}</h2>
      <ul className="rahhal-tw-travelers">
        {travelers.map((t) => (
          <li key={t.id} data-testid="tw-traveler" data-checkin={t.checkInStatus}>
            <span className="rahhal-tw-avatar" aria-hidden="true">
              {t.avatarInitials}
            </span>
            <div>
              <strong>{t.name}</strong>
              <p>
                {t.role} · {t.checkInStatus}
              </p>
              <p className="rahhal-tw-muted">
                {t.passportPlaceholder
                  ? locale === 'en'
                    ? 'Passport placeholder'
                    : 'جواز — واجهة'
                  : null}
                {t.seatPlaceholder ? ` · ${t.seatPlaceholder}` : ''}
                {t.hotelRoomPlaceholder ? ` · #${t.hotelRoomPlaceholder}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
