import type {
  IntegrationLocale,
  IntegrationModuleId,
  IntegrationNavItem,
  IntegrationModuleStatus,
  IntegrationRouteDefinition,
} from '../types'
import { INTEGRATION_MODULES } from '../registry/moduleRegistry'
import { SHARED_ICONS } from '../design/sharedTokens'
import {
  SharedEmptyState,
  SharedErrorState,
  SharedLoadingState,
} from './sharedStates'

export function DeveloperNavigationScreen({
  locale,
  items,
  activeId,
  onNavigate,
}: {
  locale: IntegrationLocale
  items: readonly IntegrationNavItem[]
  activeId: string
  onNavigate: (item: IntegrationNavItem) => void
}) {
  return (
    <section className="rahhal-if-panel" data-testid="if-developer-nav">
      <h2>{locale === 'en' ? 'Developer navigation' : 'تنقل المطوّر'}</h2>
      <p className="rahhal-if-muted">
        {locale === 'en'
          ? 'Local development graph only — not production routes.'
          : 'مخطط تطوير محلي فقط — ليس مسارات الإنتاج.'}
      </p>
      <ul className="rahhal-if-list" style={{ marginTop: '0.65rem' }}>
        {items.map((item) => (
          <li key={item.id}>
            <span>
              {SHARED_ICONS.module}{' '}
              {locale === 'en' ? item.labelEn : item.labelAr}
            </span>
            <button
              type="button"
              className={item.id === activeId ? 'is-active' : undefined}
              onClick={() => onNavigate(item)}
            >
              {locale === 'en' ? 'Open' : 'فتح'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DemoNavigationScreen({
  locale,
  items,
  onOpenModule,
}: {
  locale: IntegrationLocale
  items: readonly IntegrationNavItem[]
  onOpenModule: (moduleId: IntegrationModuleId) => void
}) {
  return (
    <section className="rahhal-if-panel" data-testid="if-demo-nav">
      <h2>{locale === 'en' ? 'Demo navigation' : 'تنقل العرض'}</h2>
      <p className="rahhal-if-muted">
        {locale === 'en'
          ? 'Force-preview modules with presentation data.'
          : 'معاينة قسرية للوحدات ببيانات العرض.'}
      </p>
      <div className="rahhal-if-grid" style={{ marginTop: '0.65rem' }}>
        {items.map((item) => (
          <article key={item.id} className="rahhal-if-card">
            <strong>{locale === 'en' ? item.labelEn : item.labelAr}</strong>
            <em>{item.moduleId}</em>
            <button
              type="button"
              onClick={() => item.moduleId && onOpenModule(item.moduleId)}
            >
              {SHARED_ICONS.preview}{' '}
              {locale === 'en' ? 'Preview' : 'معاينة'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ModuleStatusScreen({
  locale,
  statuses,
}: {
  locale: IntegrationLocale
  statuses: IntegrationModuleStatus[]
}) {
  return (
    <section className="rahhal-if-panel" data-testid="if-module-status">
      <h2>{locale === 'en' ? 'Module status' : 'حالة الوحدات'}</h2>
      <ul className="rahhal-if-list">
        {statuses.map((s) => (
          <li key={s.id}>
            <span>
              {SHARED_ICONS.status} {s.id}
            </span>
            <span
              className={`rahhal-if-badge ${s.flagEnabled ? 'is-on' : ''}`}
              data-testid="if-status-badge"
            >
              {s.flagEnabled ? 'ON' : 'OFF'} ·{' '}
              {s.registered
                ? locale === 'en'
                  ? 'registered'
                  : 'مسجّل'
                : locale === 'en'
                  ? 'missing'
                  : 'مفقود'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FeatureFlagToggleScreen({
  locale,
  statuses,
  onToggle,
}: {
  locale: IntegrationLocale
  statuses: IntegrationModuleStatus[]
  onToggle: (featureId: string, enabled: boolean) => void
}) {
  return (
    <section className="rahhal-if-panel" data-testid="if-feature-flags">
      <h2>
        {locale === 'en'
          ? 'Feature flag toggle (local UI)'
          : 'تبديل أعلام الميزات (واجهة محلية)'}
      </h2>
      <p className="rahhal-if-muted">
        {locale === 'en'
          ? 'Overrides are local presentation state only — not persisted.'
          : 'التجاوزات حالة عرض محلية فقط — لا تُحفظ.'}
      </p>
      <ul className="rahhal-if-list" style={{ marginTop: '0.65rem' }}>
        {statuses.map((s) => (
          <li key={s.featureId}>
            <span>
              {SHARED_ICONS.flag} {s.featureId}
            </span>
            <button
              type="button"
              data-testid="if-flag-toggle"
              onClick={() => onToggle(s.featureId, !s.flagEnabled)}
            >
              {s.flagEnabled ? 'OFF' : 'ON'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DependencyGraphScreen({
  locale,
}: {
  locale: IntegrationLocale
}) {
  return (
    <section className="rahhal-if-panel" data-testid="if-dependency-graph">
      <h2>
        {locale === 'en' ? 'Dependency graph' : 'مخطط الاعتماد'}
      </h2>
      <div className="rahhal-if-graph">
        <div className="rahhal-if-graph__node">
          {SHARED_ICONS.graph} ui.application_shell
        </div>
        {INTEGRATION_MODULES.filter((m) => m.id !== 'application_shell').map(
          (m) => (
            <div key={m.id}>
              <div className="rahhal-if-graph__edge">↓ dependsOn</div>
              <div className="rahhal-if-graph__node">
                {m.featureId} · {locale === 'en' ? m.nameEn : m.nameAr}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

export function ArchitectureOverviewScreen({
  locale,
  routes,
}: {
  locale: IntegrationLocale
  routes: readonly IntegrationRouteDefinition[]
}) {
  return (
    <section
      className="rahhal-if-panel"
      data-testid="if-architecture-overview"
    >
      <h2>
        {locale === 'en'
          ? 'Architecture overview'
          : 'نظرة معمارية'}
      </h2>
      <p className="rahhal-if-muted">
        {locale === 'en'
          ? 'Presentation architecture only — registries, loaders, and shared chrome. No service/API/business layers.'
          : 'معمارية عرض فقط — سجلات ومحمّلات وواجهة مشتركة. بلا طبقات خدمة أو API أو منطق أعمال.'}
      </p>
      <div className="rahhal-if-grid" style={{ marginTop: '0.65rem' }}>
        <article className="rahhal-if-card">
          <strong>{SHARED_ICONS.architecture} Registries</strong>
          <span>Module · Navigation · Route · Flags</span>
        </article>
        <article className="rahhal-if-card">
          <strong>{SHARED_ICONS.module} Loader</strong>
          <span>tryRender* force preview</span>
        </article>
        <article className="rahhal-if-card">
          <strong>{SHARED_ICONS.status} Shared states</strong>
          <span>Empty · Loading · Error</span>
        </article>
      </div>
      <h3 style={{ marginTop: '0.85rem', fontSize: '0.95rem' }}>
        {locale === 'en' ? 'Virtual routes' : 'مسارات افتراضية'}
      </h3>
      <ul className="rahhal-if-list">
        {routes.map((r) => (
          <li key={r.id}>
            <span>{r.path}</span>
            <em style={{ color: 'var(--rahhal-if-accent)', fontStyle: 'normal' }}>
              {r.id}
            </em>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.55rem' }}>
        <SharedEmptyState locale={locale} />
        <SharedLoadingState locale={locale} />
        <SharedErrorState locale={locale} />
      </div>
    </section>
  )
}
