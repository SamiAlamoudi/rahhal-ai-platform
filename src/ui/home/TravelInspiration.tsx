/**
 * Sprint 121 — Travel inspiration from memory insights / history notes.
 */

import { UiStack, UiText } from '../common'
import { EmptyState } from '../loading'
import { HomeSection } from './HomeSection'
import { homeCardStyle, homeColors } from './homeTheme'

export interface TravelInspirationProps {
  insights: string[]
  historyNotes?: string[]
  index?: number
}

export function TravelInspiration({
  insights,
  historyNotes = [],
  index,
}: TravelInspirationProps) {
  const items = [...insights, ...historyNotes].filter(Boolean).slice(0, 6)

  return (
    <HomeSection
      sectionId="travel_inspiration"
      title="إلهام لرحلتك"
      description="لمحات من ذاكرتك وتفضيلاتك لتبدأ منها."
      index={index}
    >
      {!items.length ? (
        <EmptyState
          title="لا يوجد إلهام بعد"
          description="كلما خططت أكثر، أصبحت الاقتراحات أدق."
        />
      ) : (
        <UiStack gap="sm" role="list">
          {items.map((item) => (
            <div
              key={item}
              role="listitem"
              style={{
                ...homeCardStyle(),
                boxShadow: 'none',
                background: homeColors.surface,
              }}
            >
              <UiText size="sm" style={{ color: homeColors.fg }}>
                {item}
              </UiText>
            </div>
          ))}
        </UiStack>
      )}
    </HomeSection>
  )
}
