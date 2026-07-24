/**
 * Phase 5 Stage 6 — Booking Hub root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './bookingHub.css'
import { bookingHubTokenCssVariables } from '../design/bookingHubTokens'
import { isBookingHubEnabled } from '../bookingHubRegistry'
import { createDemoBookingHubState } from '../state/bookingHubState'
import type {
  BookingFilterId,
  BookingHubLocale,
  BookingHubTheme,
  BookingHubUiState,
} from '../types'
import { BookingOverview } from './BookingOverview'
import { BookingToolbar } from './BookingToolbar'
import { DocumentsFinance } from './DocumentsFinance'
import { ServicesPanel } from './ServicesPanel'
import { TimelineProviders } from './TimelineProviders'

export interface BookingHubProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: BookingHubLocale
  theme?: BookingHubTheme
  initialState?: Partial<BookingHubUiState>
}

export function BookingHub({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: BookingHubProps) {
  const on = isBookingHubEnabled({ enabled })
  const [state, setState] = useState<BookingHubUiState>(() => {
    const demo = createDemoBookingHubState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      activeFilter: initialState?.activeFilter,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => bookingHubTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-bh"
      data-testid="booking-hub"
      data-bh="booking-hub"
      data-theme={state.theme}
      data-locale={state.locale}
      data-filter={state.activeFilter}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-bh-header" data-testid="bh-header">
        <div>
          <p className="rahhal-bh-brand">رحّال</p>
          <h1>
            {state.locale === 'en' ? 'Booking Hub' : 'مركز الحجوزات'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="bh-theme-toggle"
          onClick={() =>
            setState((prev) => ({
              ...prev,
              theme: prev.theme === 'light' ? 'dark' : 'light',
            }))
          }
        >
          {state.theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </header>

      <BookingToolbar
        activeFilter={state.activeFilter}
        searchQuery={state.searchQuery}
        locale={state.locale}
        onFilterChange={(activeFilter: BookingFilterId) =>
          setState((prev) => ({ ...prev, activeFilter }))
        }
        onSearchChange={(searchQuery: string) =>
          setState((prev) => ({ ...prev, searchQuery }))
        }
      />

      <BookingOverview
        overview={state.overview}
        stats={state.stats}
        upcomingTrips={state.upcomingTrips}
        pastTrips={state.pastTrips}
        locale={state.locale}
      />

      <ServicesPanel
        flights={state.flights}
        hotels={state.hotels}
        transportation={state.transportation}
        cruises={state.cruises}
        trains={state.trains}
        activities={state.activities}
        restaurants={state.restaurants}
        events={state.events}
        insurance={state.insurance}
        locale={state.locale}
      />

      <DocumentsFinance
        visaStatus={state.visaStatus}
        documents={state.documents}
        tickets={state.tickets}
        invoices={state.invoices}
        refunds={state.refunds}
        paymentSummaryLabel={state.paymentSummaryLabel}
        travelerAssignments={state.travelerAssignments}
        priceBreakdown={state.priceBreakdown}
        locale={state.locale}
      />

      <TimelineProviders
        bookingTimeline={state.bookingTimeline}
        providers={state.providers}
        calendarDays={state.calendarDays}
        mapPlaceholder={state.mapPlaceholder}
        favorites={state.favorites}
        bookmarks={state.bookmarks}
        locale={state.locale}
      />
    </div>
  )
}

export function tryRenderBookingHub(
  props: BookingHubProps = {},
): ReactElement | null {
  if (!isBookingHubEnabled({ enabled: props.enabled })) return null
  return <BookingHub {...props} />
}
