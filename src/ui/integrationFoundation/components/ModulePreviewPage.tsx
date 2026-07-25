import type { ReactElement } from 'react'
import type { IntegrationLocale, IntegrationModuleId } from '../types'
import { getIntegrationModule } from '../registry/moduleRegistry'
import { loadIntegrationModule } from '../registry/moduleLoader'
import { SharedEmptyState } from './sharedStates'

export function ModulePreviewPage({
  locale,
  theme,
  moduleId,
  moduleIds,
  onSelect,
}: {
  locale: IntegrationLocale
  theme: 'light' | 'dark'
  moduleId: IntegrationModuleId | null
  moduleIds: readonly IntegrationModuleId[]
  onSelect: (id: IntegrationModuleId) => void
}): ReactElement {
  const def = moduleId ? getIntegrationModule(moduleId) : undefined
  const preview = moduleId
    ? loadIntegrationModule(moduleId, {
        forceEnabled: true,
        locale,
        theme,
      })
    : null

  return (
    <section className="rahhal-if-panel" data-testid="if-module-preview">
      <h2>{locale === 'en' ? 'Module preview pages' : 'صفحات معاينة الوحدات'}</h2>
      <div className="rahhal-if-chips" data-testid="if-module-chips">
        {moduleIds.map((id) => (
          <button
            key={id}
            type="button"
            className={id === moduleId ? 'is-active' : undefined}
            data-module={id}
            onClick={() => onSelect(id)}
          >
            {id}
          </button>
        ))}
      </div>
      {def ? (
        <p className="rahhal-if-muted">
          {locale === 'en' ? def.nameEn : def.nameAr} · {def.featureId} ·{' '}
          {def.packagePath}
        </p>
      ) : (
        <SharedEmptyState
          locale={locale}
          message={
            locale === 'en'
              ? 'Select a module to preview.'
              : 'اختر وحدة للمعاينة.'
          }
        />
      )}
      <div className="rahhal-if-preview" data-testid="if-preview-frame">
        {preview}
      </div>
    </section>
  )
}
