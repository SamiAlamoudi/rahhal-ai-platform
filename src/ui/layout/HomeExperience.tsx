/**
 * Sprint 119 — Home experience architecture (presentation slots only).
 * No mock data generation. Parents supply content via children/slots.
 */

import type { ReactNode } from 'react'
import { UiStack, UiSurface, UiText } from '../common'
import { spacing } from '../tokens'

export const HOME_EXPERIENCE_SECTIONS = [
  'greeting',
  'recent_trips',
  'suggested_destinations',
  'continue_conversation',
  'upcoming_trips',
  'quick_actions',
] as const

export type HomeExperienceSectionId = (typeof HOME_EXPERIENCE_SECTIONS)[number]

export interface HomeSectionProps {
  children?: ReactNode
  title?: string
  className?: string
}

function SectionShell({
  children,
  title,
  className,
  sectionId,
}: HomeSectionProps & { sectionId: HomeExperienceSectionId }) {
  return (
    <section
      className={className}
      data-ui-home-section={sectionId}
      style={{ marginBlockEnd: spacing.xl }}
    >
      {title ? (
        <UiText as="h2" size="lg" weight="semibold" style={{ marginBottom: spacing.md }}>
          {title}
        </UiText>
      ) : null}
      {children}
    </section>
  )
}

export function HomeGreeting(props: HomeSectionProps) {
  return <SectionShell sectionId="greeting" {...props} />
}

export function RecentTripsSection(props: HomeSectionProps) {
  return <SectionShell sectionId="recent_trips" {...props} />
}

export function SuggestedDestinationsSection(props: HomeSectionProps) {
  return <SectionShell sectionId="suggested_destinations" {...props} />
}

export function ContinueConversationSection(props: HomeSectionProps) {
  return <SectionShell sectionId="continue_conversation" {...props} />
}

export function UpcomingTripsSection(props: HomeSectionProps) {
  return <SectionShell sectionId="upcoming_trips" {...props} />
}

export function QuickActionsSection(props: HomeSectionProps) {
  return <SectionShell sectionId="quick_actions" {...props} />
}

export interface HomeExperienceProps {
  greeting?: ReactNode
  recentTrips?: ReactNode
  suggestedDestinations?: ReactNode
  continueConversation?: ReactNode
  upcomingTrips?: ReactNode
  quickActions?: ReactNode
  className?: string
}

/**
 * Premium travel-assistant home shell — architecture only.
 * Compose section content from the outside; this module does not invent data.
 */
export function HomeExperience({
  greeting,
  recentTrips,
  suggestedDestinations,
  continueConversation,
  upcomingTrips,
  quickActions,
  className,
}: HomeExperienceProps) {
  return (
    <UiSurface
      className={className}
      elevated
      data-testid="home-experience"
      style={{ padding: spacing['2xl'] }}
    >
      <UiStack gap="xl">
        <HomeGreeting>{greeting}</HomeGreeting>
        <RecentTripsSection title="Recent trips">{recentTrips}</RecentTripsSection>
        <SuggestedDestinationsSection title="Suggested destinations">
          {suggestedDestinations}
        </SuggestedDestinationsSection>
        <ContinueConversationSection title="Continue conversation">
          {continueConversation}
        </ContinueConversationSection>
        <UpcomingTripsSection title="Upcoming trips">{upcomingTrips}</UpcomingTripsSection>
        <QuickActionsSection title="Quick actions">{quickActions}</QuickActionsSection>
      </UiStack>
    </UiSurface>
  )
}
