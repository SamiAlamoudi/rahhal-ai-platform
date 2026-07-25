import type { TravelerProfileLocale, TravelerSettingsItem } from '../types'

export interface SettingsAndSecurityProps {
  privacySettings: TravelerSettingsItem[]
  notificationSettings: TravelerSettingsItem[]
  securityStatus: string
  securityItems: TravelerSettingsItem[]
  locale: TravelerProfileLocale
}

function SettingsList({
  items,
  testId,
}: {
  items: TravelerSettingsItem[]
  testId: string
}) {
  return (
    <ul className="rahhal-tp-fields" data-testid={testId}>
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.label}</span>
          <strong>{item.valueLabel}</strong>
        </li>
      ))}
    </ul>
  )
}

export function SettingsAndSecurity({
  privacySettings,
  notificationSettings,
  securityStatus,
  securityItems,
  locale,
}: SettingsAndSecurityProps) {
  return (
    <div className="rahhal-tp-layout">
      <section className="rahhal-tp-panel" data-testid="tp-privacy-settings">
        <h2>{locale === 'en' ? 'Privacy settings' : 'إعدادات الخصوصية'}</h2>
        <SettingsList items={privacySettings} testId="tp-privacy-list" />
      </section>

      <section
        className="rahhal-tp-panel"
        data-testid="tp-notification-settings"
      >
        <h2>
          {locale === 'en' ? 'Notification settings' : 'إعدادات الإشعارات'}
        </h2>
        <SettingsList
          items={notificationSettings}
          testId="tp-notification-list"
        />
      </section>

      <section
        className="rahhal-tp-panel"
        data-testid="tp-security-center"
        style={{ gridColumn: '1 / -1' }}
      >
        <h2>{locale === 'en' ? 'Security center' : 'مركز الأمان'}</h2>
        <div className="rahhal-tp-security" data-testid="tp-security-status">
          <span className="rahhal-tp-security__dot" aria-hidden />
          <span>{securityStatus}</span>
        </div>
        <SettingsList items={securityItems} testId="tp-security-list" />
      </section>
    </div>
  )
}
