/**
 * Sprint 121 — Conversation entry card (interactive container).
 */

import { UiButton, UiStack, UiText } from '../common'
import { spacing } from '../tokens'
import { HomeSection } from './HomeSection'
import { homeColors } from './homeTheme'

export interface ConversationEntryProps {
  onStart: () => void
  title?: string
  description?: string
  ctaLabel?: string
  index?: number
}

export function ConversationEntry({
  onStart,
  title = 'ابدأ التخطيط مع رحّال',
  description = 'صف رحلتك بكلماتك — الوجهة، الميزانية، والتواريخ — وسيتولى رحّال الباقي.',
  ctaLabel = 'ابدأ محادثة جديدة',
  index,
}: ConversationEntryProps) {
  return (
    <HomeSection
      sectionId="conversation_entry"
      title={title}
      description={description}
      index={index}
    >
      <UiStack gap="md">
        <UiText size="sm" style={{ color: homeColors.fgMuted }}>
          تجربة محادثة كاملة وليست روبوت دردشة عام.
        </UiText>
        <UiButton
          onClick={onStart}
          aria-label={ctaLabel}
          style={{
            alignSelf: 'flex-start',
            background: homeColors.brand,
            color: '#ffffff',
            paddingInline: spacing.xl,
          }}
        >
          {ctaLabel}
        </UiButton>
      </UiStack>
    </HomeSection>
  )
}
