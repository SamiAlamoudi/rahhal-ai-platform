/**
 * Phase 5 Stage 4 — Traveler Profile Center root.
 * Presentation only. Not mounted in production routes.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './travelerProfile.css'
import { travelerProfileTokenCssVariables } from '../design/travelerProfileTokens'
import { isTravelerProfileEnabled } from '../travelerProfileRegistry'
import { createDemoTravelerProfileState } from '../state/travelerProfileState'
import type {
  TravelerProfileLocale,
  TravelerProfileTheme,
  TravelerProfileUiState,
} from '../types'
import { DocumentsPanel } from './DocumentsPanel'
import { LoyaltyAndTravelers } from './LoyaltyAndTravelers'
import { PersonalInfoPanel } from './PersonalInfoPanel'
import { PreferencesPanel } from './PreferencesPanel'
import { ProfileOverview } from './ProfileOverview'
import { SettingsAndSecurity } from './SettingsAndSecurity'

export interface TravelerProfileCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: TravelerProfileLocale
  theme?: TravelerProfileTheme
  initialState?: Partial<TravelerProfileUiState>
}

export function TravelerProfileCenter({
  enabled,
  locale = 'ar',
  theme = 'light',
  initialState,
}: TravelerProfileCenterProps) {
  const on = isTravelerProfileEnabled({ enabled })
  const [state, setState] = useState<TravelerProfileUiState>(() => {
    const demo = createDemoTravelerProfileState({
      locale: initialState?.locale ?? locale,
      theme: initialState?.theme ?? theme,
      enabled,
    })
    return { ...demo, ...initialState, featureEnabled: demo.featureEnabled }
  })

  const cssVars = useMemo(
    () => travelerProfileTokenCssVariables(state.theme) as CSSProperties,
    [state.theme],
  )

  if (!on) return null

  return (
    <div
      className="rahhal-tp"
      data-testid="traveler-profile-center"
      data-tp="traveler-profile"
      data-theme={state.theme}
      data-locale={state.locale}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <header className="rahhal-tp-header" data-testid="tp-header">
        <div>
          <p className="rahhal-tp-brand">رحّال</p>
          <h1>
            {state.locale === 'en'
              ? 'Traveler Profile'
              : 'مركز ملف المسافر'}
          </h1>
        </div>
        <button
          type="button"
          data-testid="tp-theme-toggle"
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

      <ProfileOverview
        displayName={state.displayName}
        headline={state.headline}
        overview={state.overview}
        profileCompletionPercent={state.profileCompletionPercent}
        completionTimeline={state.completionTimeline}
        locale={state.locale}
      />

      <PersonalInfoPanel
        personalInfo={state.personalInfo}
        languages={state.languages}
        currencies={state.currencies}
        timeZone={state.timeZone}
        locale={state.locale}
      />

      <PreferencesPanel
        travelPreferences={state.travelPreferences}
        preferredAirlines={state.preferredAirlines}
        preferredHotels={state.preferredHotels}
        preferredSeat={state.preferredSeat}
        mealPreferences={state.mealPreferences}
        locale={state.locale}
      />

      <DocumentsPanel
        travelDocuments={state.travelDocuments}
        passports={state.passports}
        visaPlaceholder={state.visaPlaceholder}
        boardingPassPlaceholder={state.boardingPassPlaceholder}
        locale={state.locale}
      />

      <LoyaltyAndTravelers
        emergencyContacts={state.emergencyContacts}
        familyMembers={state.familyMembers}
        frequentFlyerPrograms={state.frequentFlyerPrograms}
        hotelLoyaltyPrograms={state.hotelLoyaltyPrograms}
        savedTravelers={state.savedTravelers}
        paymentMethodsPlaceholder={state.paymentMethodsPlaceholder}
        locale={state.locale}
      />

      <SettingsAndSecurity
        privacySettings={state.privacySettings}
        notificationSettings={state.notificationSettings}
        securityStatus={state.securityStatus}
        securityItems={state.securityItems}
        locale={state.locale}
      />
    </div>
  )
}

export function tryRenderTravelerProfileCenter(
  props: TravelerProfileCenterProps = {},
): ReactElement | null {
  if (!isTravelerProfileEnabled({ enabled: props.enabled })) return null
  return <TravelerProfileCenter {...props} />
}
