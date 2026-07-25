/**
 * Phase 4 Stage 5 — Premium Travel Workspace root.
 * Operational journey UI — presentation only.
 * Not mounted in production routes. No booking/AI/APIs.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './travelWorkspace.css'
import { ActivityCards } from '../activityCards'
import { Attachments } from '../attachments'
import { Checklists } from '../checklists'
import { Dashboard } from '../dashboard'
import { DocumentsPanel } from '../documentsPanel'
import { workspaceTokenCssVariables } from '../design/workspaceTokens'
import { FlightCards } from '../flightCards'
import { HotelCards } from '../hotelCards'
import { MapPreview } from '../mapPreview'
import { MeetingCards } from '../meetingCards'
import { QrCards } from '../qrCards'
import { QuickActions } from '../quickActions'
import { SharedItems } from '../sharedItems'
import { createDemoTravelWorkspaceState } from '../state/travelWorkspaceState'
import { TicketCards } from '../ticketCards'
import { TransportCards } from '../transportCards'
import { TravelerList } from '../travelerList'
import { isTravelWorkspaceEnabled } from '../travelWorkspaceRegistry'
import { TripNotes } from '../tripNotes'
import { TripOverview } from '../tripOverview'
import { TripProgress } from '../tripProgress'
import { TripStatistics } from '../tripStatistics'
import { TripStatus } from '../tripStatus'
import { TripTimeline } from '../tripTimeline'
import type {
  QuickActionId,
  TravelWorkspaceLocale,
  TravelWorkspaceTheme,
  TravelWorkspaceUiState,
} from '../types'

export interface TravelWorkspaceProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: TravelWorkspaceLocale
  theme?: TravelWorkspaceTheme
  initialState?: Partial<TravelWorkspaceUiState>
  onQuickAction?: (id: QuickActionId) => void
}

export function TravelWorkspace({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
  onQuickAction,
}: TravelWorkspaceProps) {
  const workspaceOn = isTravelWorkspaceEnabled({ enabled })
  const [state, setState] = useState<TravelWorkspaceUiState>(() => {
    const demo = createDemoTravelWorkspaceState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => workspaceTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!workspaceOn) return null

  return (
    <div
      className="rahhal-tw"
      data-testid="travel-workspace"
      data-tw="travel-workspace"
      data-theme={state.theme}
      data-locale={state.locale}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <div className="rahhal-tw-toolbar">
        <TripStatus status={state.trip.status} locale={state.locale} />
        <button
          type="button"
          data-testid="tw-theme-toggle"
          onClick={() =>
            setState((prev) => ({
              ...prev,
              theme: prev.theme === 'light' ? 'dark' : 'light',
            }))
          }
        >
          {state.theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>

      <TripOverview trip={state.trip} locale={state.locale} />
      <QuickActions locale={state.locale} onAction={onQuickAction} />

      <Dashboard
        locale={state.locale}
        cards={state.cards}
        agenda={state.timeline}
        alerts={state.alerts}
        budget={state.budget}
        progressPhase={state.progressPhase}
        progressPercent={state.trip.progressPercent}
      />

      <div className="rahhal-tw-columns">
        <TripTimeline items={state.timeline} locale={state.locale} />
        <div className="rahhal-tw-columns__stack">
          <TripProgress
            phase={state.progressPhase}
            percent={state.trip.progressPercent}
            locale={state.locale}
          />
          <TravelerList travelers={state.travelers} locale={state.locale} />
          <DocumentsPanel documents={state.documents} locale={state.locale} />
          <TripStatistics stats={state.statistics} locale={state.locale} />
        </div>
      </div>

      <FlightCards cards={state.cards} locale={state.locale} />
      <HotelCards cards={state.cards} locale={state.locale} />
      <TransportCards cards={state.cards} locale={state.locale} />
      <MeetingCards cards={state.cards} locale={state.locale} />
      <ActivityCards cards={state.cards} locale={state.locale} />
      <TicketCards cards={state.cards} locale={state.locale} />
      <QrCards cards={state.cards} locale={state.locale} />

      <div className="rahhal-tw-columns">
        <MapPreview locale={state.locale} />
        <div className="rahhal-tw-columns__stack">
          <TripNotes notes={state.notes} locale={state.locale} />
          <Attachments attachments={state.attachments} locale={state.locale} />
          <Checklists
            items={state.checklist}
            locale={state.locale}
            onToggle={(id) =>
              setState((prev) => ({
                ...prev,
                checklist: prev.checklist.map((c) =>
                  c.id === id ? { ...c, done: !c.done } : c,
                ),
              }))
            }
          />
          <SharedItems items={state.sharedItems} locale={state.locale} />
        </div>
      </div>
    </div>
  )
}

/** Safe render helper for tests — returns null when flag OFF. */
export function tryRenderTravelWorkspace(
  props: TravelWorkspaceProps = {},
): ReactElement | null {
  if (!isTravelWorkspaceEnabled({ enabled: props.enabled })) return null
  return <TravelWorkspace {...props} />
}
