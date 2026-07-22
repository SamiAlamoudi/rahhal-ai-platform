/**
 * Sprint 121 — Smart search entry (navigates to existing /search).
 */

import { UiButton, UiStack, UiText } from '../common'
import { HomeSection } from './HomeSection'
import { homeColors } from './homeTheme'

export interface SmartSearchEntryProps {
  onSearch: () => void
  index?: number
}

export function SmartSearchEntry({ onSearch, index }: SmartSearchEntryProps) {
  return (
    <HomeSection
      sectionId="smart_search"
      title="بحث ذكي"
      description="ابحث عن رحلات وخيارات سفر عبر مساحة البحث الحالية."
      index={index}
    >
      <UiStack gap="md">
        <UiText size="sm" style={{ color: homeColors.fgMuted }}>
          نفس مسار البحث في التطبيق — بدون واجهات وهمية أو بيانات مزيفة.
        </UiText>
        <UiButton
          onClick={onSearch}
          aria-label="افتح البحث"
          style={{
            alignSelf: 'flex-start',
            background: homeColors.brandDeep,
            color: '#ffffff',
          }}
        >
          افتح البحث
        </UiButton>
      </UiStack>
    </HomeSection>
  )
}
