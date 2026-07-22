/**
 * Sprint 121 — Continue last conversation section.
 */

import { UiButton, UiStack, UiText } from '../common'
import { spacing } from '../tokens'
import { EmptyState } from '../loading'
import { HomeSection } from './HomeSection'
import { homeColors } from './homeTheme'

export interface ContinueConversationProps {
  conversation: { id: string; title: string } | null
  onContinue: (id: string) => void
  onStartNew: () => void
  index?: number
}

export function ContinueConversation({
  conversation,
  onContinue,
  onStartNew,
  index,
}: ContinueConversationProps) {
  return (
    <HomeSection
      sectionId="continue_conversation"
      title="متابعة المحادثة"
      description="عد إلى آخر تخطيط بدأته دون فقدان السياق."
      index={index}
    >
      {conversation ? (
        <UiStack gap="md">
          <UiText weight="semibold" size="md">
            {conversation.title}
          </UiText>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
            <UiButton
              onClick={() => onContinue(conversation.id)}
              aria-label={`متابعة ${conversation.title}`}
              style={{ background: homeColors.brand, color: '#fff' }}
            >
              متابعة
            </UiButton>
            <UiButton
              onClick={onStartNew}
              aria-label="محادثة جديدة"
              style={{
                background: 'transparent',
                color: homeColors.fg,
                border: `1px solid ${homeColors.border}`,
              }}
            >
              محادثة جديدة
            </UiButton>
          </div>
        </UiStack>
      ) : (
        <EmptyState
          title="لا توجد محادثة سابقة"
          description="ابدأ محادثة جديدة لتخطيط رحلتك القادمة."
          action={
            <UiButton onClick={onStartNew} aria-label="ابدأ محادثة جديدة">
              ابدأ الآن
            </UiButton>
          }
        />
      )}
    </HomeSection>
  )
}
