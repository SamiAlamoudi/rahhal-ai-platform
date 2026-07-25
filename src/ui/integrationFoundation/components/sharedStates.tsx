import type { IntegrationLocale } from '../types'
import { SHARED_ICONS } from '../design/sharedTokens'

export function SharedEmptyState({
  locale,
  message,
}: {
  locale: IntegrationLocale
  message?: string
}) {
  return (
    <div className="rahhal-if-state" data-testid="if-empty-state">
      <span aria-hidden>{SHARED_ICONS.empty}</span>
      <p>
        {message ??
          (locale === 'en' ? 'Nothing to show yet.' : 'لا يوجد محتوى بعد.')}
      </p>
    </div>
  )
}

export function SharedLoadingState({
  locale,
}: {
  locale: IntegrationLocale
}) {
  return (
    <div className="rahhal-if-state" data-testid="if-loading-state">
      <span aria-hidden className="rahhal-if-pulse">
        {SHARED_ICONS.loading}
      </span>
      <p>{locale === 'en' ? 'Loading…' : 'جارٍ التحميل…'}</p>
    </div>
  )
}

export function SharedErrorState({
  locale,
  message,
}: {
  locale: IntegrationLocale
  message?: string
}) {
  return (
    <div className="rahhal-if-state is-error" data-testid="if-error-state">
      <span aria-hidden>{SHARED_ICONS.error}</span>
      <p>
        {message ??
          (locale === 'en'
            ? 'Something went wrong (UI only).'
            : 'حدث خطأ (واجهة فقط).')}
      </p>
    </div>
  )
}
