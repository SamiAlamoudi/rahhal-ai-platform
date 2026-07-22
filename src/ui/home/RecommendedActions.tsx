/**
 * Sprint 121 — Personalized recommended actions (memory preferences).
 */

import { RecommendationCard } from '../cards'
import { UiStack } from '../common'
import { EmptyState } from '../loading'
import { HomeSection } from './HomeSection'

export interface RecommendedActionsProps {
  recommendations: string[]
  onSelect?: (recommendation: string) => void
  index?: number
}

export function RecommendedActions({
  recommendations,
  onSelect,
  index,
}: RecommendedActionsProps) {
  return (
    <HomeSection
      sectionId="recommended_actions"
      title="توصيات مخصصة"
      description="إجراءات مقترحة بناءً على تفضيلاتك."
      index={index}
    >
      {!recommendations.length ? (
        <EmptyState
          title="لا توجد توصيات بعد"
          description="ستظهر هنا اقتراحات مخصصة بعد استخدام الذاكرة."
        />
      ) : (
        <UiStack gap="sm" role="list">
          {recommendations.map((item) => (
            <div key={item} role="listitem">
              <RecommendationCard
                title={item}
                reason="من الذاكرة"
                footer={
                  onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-label={`استخدم التوصية ${item}`}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        font: 'inherit',
                        textDecoration: 'underline',
                      }}
                    >
                      استخدم في المحادثة
                    </button>
                  ) : null
                }
              />
            </div>
          ))}
        </UiStack>
      )}
    </HomeSection>
  )
}
