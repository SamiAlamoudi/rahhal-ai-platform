/**
 * Sprint 121 — Quick navigation actions (routes unchanged).
 */

import { UiButton, UiStack, UiText } from '../common'
import { spacing } from '../tokens'
import { HomeSection } from './HomeSection'
import { homeColors } from './homeTheme'

export interface QuickActionItem {
  id: string
  label: string
  onClick: () => void
  primary?: boolean
}

export interface QuickActionsProps {
  actions: QuickActionItem[]
  recentConversations?: Array<{ id: string; title: string; updatedAt: string }>
  onOpenConversation?: (id: string) => void
  index?: number
}

export function QuickActions({
  actions,
  recentConversations = [],
  onOpenConversation,
  index,
}: QuickActionsProps) {
  return (
    <HomeSection
      sectionId="quick_actions"
      title="اختصارات سريعة"
      description="انتقل مباشرة إلى أهم مساراتك."
      index={index}
    >
      <UiStack gap="md">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}
        >
          {actions.map((action) => (
            <UiButton
              key={action.id}
              onClick={action.onClick}
              aria-label={action.label}
              style={{
                background: action.primary ? homeColors.brand : homeColors.surface,
                color: action.primary ? '#ffffff' : homeColors.fg,
                border: action.primary ? 'none' : `1px solid ${homeColors.border}`,
              }}
            >
              {action.label}
            </UiButton>
          ))}
        </div>
        {recentConversations.length && onOpenConversation ? (
          <UiStack gap="sm" role="list" aria-label="محادثات حديثة">
            <UiText size="sm" weight="semibold">
              محادثات حديثة
            </UiText>
            {recentConversations.slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                role="listitem"
                onClick={() => onOpenConversation(c.id)}
                aria-label={`فتح محادثة ${c.title}`}
                style={{
                  textAlign: 'start',
                  border: `1px solid ${homeColors.border}`,
                  borderRadius: 10,
                  background: homeColors.surface,
                  padding: spacing.md,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: homeColors.fg,
                }}
              >
                <UiText as="span" size="sm" weight="semibold">
                  {c.title}
                </UiText>
              </button>
            ))}
          </UiStack>
        ) : null}
      </UiStack>
    </HomeSection>
  )
}
