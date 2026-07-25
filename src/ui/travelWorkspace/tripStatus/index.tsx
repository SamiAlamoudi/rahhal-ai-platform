import type { TripLifecycleStatus, TravelWorkspaceLocale } from '../types'

export function TripStatus({
  status,
  locale = 'ar',
}: {
  status: TripLifecycleStatus
  locale?: TravelWorkspaceLocale
}) {
  return (
    <div
      className={`rahhal-tw-status rahhal-tw-status--${status}`}
      data-testid="tw-trip-status"
      data-status={status}
    >
      <span>{locale === 'en' ? 'Trip status' : 'حالة الرحلة'}</span>
      <strong>{status}</strong>
    </div>
  )
}
