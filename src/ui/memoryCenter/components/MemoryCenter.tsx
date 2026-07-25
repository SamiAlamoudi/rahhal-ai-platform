/**
 * Phase 5 Stage 5 — AI Memory & Knowledge Center root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './memoryCenter.css'
import { memoryCenterTokenCssVariables } from '../design/memoryCenterTokens'
import { isMemoryCenterEnabled } from '../memoryCenterRegistry'
import { createDemoMemoryCenterState } from '../state/memoryCenterState'
import type {
  MemoryCenterLocale,
  MemoryCenterTheme,
  MemoryCenterUiState,
  MemoryFilterId,
} from '../types'
import { MemoryOverview } from './MemoryOverview'
import { MemoryTimelinePanel } from './MemoryTimelinePanel'
import { MemoryToolbar } from './MemoryToolbar'
import { PeopleAndDocuments } from './PeopleAndDocuments'
import { PlacesAndPreferences } from './PlacesAndPreferences'
import { RulesAndKnowledge } from './RulesAndKnowledge'

export interface MemoryCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: MemoryCenterLocale
  theme?: MemoryCenterTheme
  initialState?: Partial<MemoryCenterUiState>
}

export function MemoryCenter({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: MemoryCenterProps) {
  const on = isMemoryCenterEnabled({ enabled })
  const [state, setState] = useState<MemoryCenterUiState>(() => {
    const demo = createDemoMemoryCenterState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
      activeFilter: initialState?.activeFilter,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => memoryCenterTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-mc"
      data-testid="memory-center"
      data-mc="memory-center"
      data-theme={state.theme}
      data-locale={state.locale}
      data-filter={state.activeFilter}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-mc-header" data-testid="mc-header">
        <div>
          <p className="rahhal-mc-brand">رحّال</p>
          <h1>
            {state.locale === 'en'
              ? 'Memory & Knowledge'
              : 'مركز الذاكرة والمعرفة'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="mc-theme-toggle"
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

      <MemoryToolbar
        activeFilter={state.activeFilter}
        searchQuery={state.searchQuery}
        locale={state.locale}
        onFilterChange={(activeFilter: MemoryFilterId) =>
          setState((prev) => ({ ...prev, activeFilter }))
        }
        onSearchChange={(searchQuery: string) =>
          setState((prev) => ({ ...prev, searchQuery }))
        }
      />

      <MemoryOverview
        overview={state.overview}
        stats={state.stats}
        confidenceAverage={state.confidenceAverage}
        memoryGraph={state.memoryGraph}
        locale={state.locale}
      />

      <MemoryTimelinePanel
        timeline={state.timeline}
        locale={state.locale}
      />

      <PlacesAndPreferences
        knownDestinations={state.knownDestinations}
        favoriteCountries={state.favoriteCountries}
        favoriteCities={state.favoriteCities}
        favoriteHotels={state.favoriteHotels}
        favoriteAirlines={state.favoriteAirlines}
        travelPreferences={state.travelPreferences}
        seatPreferences={state.seatPreferences}
        mealPreferences={state.mealPreferences}
        budgetHistory={state.budgetHistory}
        locale={state.locale}
      />

      <PeopleAndDocuments
        familyMembers={state.familyMembers}
        emergencyContacts={state.emergencyContacts}
        passports={state.passports}
        visaHistory={state.visaHistory}
        savedPlaces={state.savedPlaces}
        savedTrips={state.savedTrips}
        locale={state.locale}
      />

      <RulesAndKnowledge
        conversationMemories={state.conversationMemories}
        customRules={state.customRules}
        alwaysDo={state.alwaysDo}
        neverDo={state.neverDo}
        knowledgeSources={state.knowledgeSources}
        memoryCategories={state.memoryCategories}
        bookmarks={state.bookmarks}
        editPlaceholder={state.editPlaceholder}
        deletePlaceholder={state.deletePlaceholder}
        locale={state.locale}
      />
    </div>
  )
}

export function tryRenderMemoryCenter(
  props: MemoryCenterProps = {},
): ReactElement | null {
  if (!isMemoryCenterEnabled({ enabled: props.enabled })) return null
  return <MemoryCenter {...props} />
}
