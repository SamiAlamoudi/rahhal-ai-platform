import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import './index.css'
import { AppErrorBoundary } from './components/ops/AppErrorBoundary'
import { runStartup } from './lib/ops'
import { AuthProvider } from './lib/auth/AuthContext.tsx'
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from './lib/auth/ProtectedRoute.tsx'
import { ThemeProvider, ToastProvider } from './design-system'
import type { NormalizedTravelOption } from './utils/searchOrchestrator'
import type { ReasoningResult } from './utils/reasoningEngine'
import type { TravelSearchRequest } from './utils/travelSearchRequest'
import { resolveBookingEntryPath } from './lib/alphaIntegration'

const Home = lazy(() => import('./pages/Home.tsx'))
// TravelConversation page quarantined (Recovery Phase 1) — route redirects to /chat.
const SearchWorkspace = lazy(() => import('./pages/SearchWorkspace.tsx'))
const Login = lazy(() => import('./pages/Login.tsx'))
const SignUp = lazy(() => import('./pages/SignUp.tsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.tsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.tsx'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.tsx'))
const AdminTripsPage = lazy(() => import('./pages/AdminTripsPage.tsx'))
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage.tsx'))
const AdminPaymentsPage = lazy(() => import('./pages/AdminPaymentsPage.tsx'))
const Notifications = lazy(() => import('./pages/Notifications.tsx'))
const ResultsPage = lazy(() => import('./pages/ResultsPage.tsx'))
const FlightDetailsPage = lazy(() => import('./pages/FlightDetailsPage.tsx'))
const IntegrationDiagnostics = lazy(() => import('./pages/IntegrationDiagnostics.tsx'))
const BookingReview = lazy(() => import('./pages/BookingReview.tsx'))
const BookingAssistantReviewPage = lazy(() => import('./pages/BookingAssistantReviewPage.tsx'))
const BookingAssistantConfirmationPage = lazy(() => import('./pages/BookingAssistantConfirmationPage.tsx'))
const PassengerBookingPage = lazy(() => import('./pages/PassengerBookingPage.tsx'))
const BookingReturn = lazy(() => import('./pages/BookingReturn.tsx'))
const MyTrips = lazy(() => import('./pages/MyTrips.tsx'))
const BookingDetailsPage = lazy(() => import('./pages/BookingDetailsPage.tsx'))
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage.tsx'))
const SmartItineraryPage = lazy(() => import('./pages/SmartItineraryPage.tsx'))
const SavedTrips = lazy(() => import('./pages/SavedTrips.tsx'))
const Settings = lazy(() => import('./pages/Settings.tsx'))
const ChatPage = lazy(() => import('./pages/BilamoChat.tsx'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.tsx'))
const CheckoutReviewPage = lazy(() => import('./pages/CheckoutReviewPage.tsx'))
const OrderCheckoutReviewPage = lazy(() => import('./pages/OrderCheckoutReviewPage.tsx'))
const CheckoutPaymentPage = lazy(() => import('./pages/CheckoutPaymentPage.tsx'))
const CheckoutReturnPage = lazy(() => import('./pages/CheckoutReturnPage.tsx'))
const CheckoutSuccessPage = lazy(() => import('./pages/CheckoutSuccessPage.tsx'))
const CheckoutFailurePage = lazy(() => import('./pages/CheckoutFailurePage.tsx'))

function RouteFallback() {
  return (
    <div
      className="bilamo-root relative flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="bilamo-atmosphere" aria-hidden />
      <div
        className="relative h-10 w-10 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 42%), linear-gradient(145deg, #7c3aed, #22d3ee)',
          boxShadow: '0 0 40px rgba(124,58,237,0.35)',
          animation: 'bilamo-breath 2.8s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes bilamo-breath{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.06);opacity:1}}`}</style>
    </div>
  )
}

function ResultsRoute() {
  const location = useLocation()
  const state = location.state as {
    rankedOptions: NormalizedTravelOption[]
    reasoningResults: Map<string, ReasoningResult>
    searchRequest: TravelSearchRequest
    travelSessionId?: string | null
  } | null
  if (!state?.rankedOptions) {
    return <Navigate to="/search" replace />
  }
  return (
    <ResultsPage
      rankedOptions={state.rankedOptions}
      reasoningResults={state.reasoningResults}
      searchRequest={state.searchRequest}
      travelSessionId={state.travelSessionId ?? null}
    />
  )
}

/** Sprint 103 — /booking entry resolves to assistant or legacy review. */
function BookingEntryRedirect() {
  return <Navigate to={resolveBookingEntryPath()} replace />
}

/** Recovery Phase 1 — legacy intake → sole chat UI, preserving seed state. */
function TravelConversationRedirect() {
  const location = useLocation()
  const prior = (location.state as { tripText?: string; initialPrompt?: string } | null) ?? null
  const seed = prior?.initialPrompt ?? prior?.tripText
  return (
    <Navigate
      to="/chat"
      replace
      state={seed ? { initialPrompt: seed, tripText: seed } : prior}
    />
  )
}

// Phase X — startup validation + global error handlers (non-UI).
runStartup({
  failFast: false,
  installHandlers: true,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          {/* Recovery Phase 1 — ONE Chat UI: legacy intake redirects to /chat. */}
          <Route path="/travel-conversation" element={
            <ProtectedRoute>
              <TravelConversationRedirect />
            </ProtectedRoute>
          } />
          <Route path="/search" element={
            <ProtectedRoute>
              <SearchWorkspace />
            </ProtectedRoute>
          } />
          <Route path="/results" element={
            <ProtectedRoute>
              <ResultsRoute />
            </ProtectedRoute>
          } />
          <Route path="/flights/:offerId" element={
            <ProtectedRoute>
              <FlightDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/diagnostics" element={
            <ProtectedRoute>
              <IntegrationDiagnostics />
            </ProtectedRoute>
          } />
          <Route path="/booking/review" element={
            <ProtectedRoute>
              <BookingReview />
            </ProtectedRoute>
          } />
          <Route path="/booking-assistant/review" element={
            <ProtectedRoute>
              <BookingAssistantReviewPage />
            </ProtectedRoute>
          } />
          <Route path="/booking-assistant/confirmation/:bookingId" element={
            <ProtectedRoute>
              <BookingAssistantConfirmationPage />
            </ProtectedRoute>
          } />
          <Route path="/booking/passengers" element={
            <ProtectedRoute>
              <PassengerBookingPage />
            </ProtectedRoute>
          } />
          <Route path="/booking/return" element={
            <ProtectedRoute>
              <BookingReturn />
            </ProtectedRoute>
          } />
          <Route path="/booking/confirmation/:sessionId" element={
            <ProtectedRoute>
              <BookingConfirmationPage />
            </ProtectedRoute>
          } />
          <Route path="/booking/confirmation" element={
            <ProtectedRoute>
              <BookingConfirmationPage />
            </ProtectedRoute>
          } />
          <Route path="/itinerary/:sessionId" element={
            <ProtectedRoute>
              <SmartItineraryPage />
            </ProtectedRoute>
          } />
          <Route path="/my-trips" element={
            <ProtectedRoute>
              <MyTrips />
            </ProtectedRoute>
          } />
          <Route path="/my-trips/:sessionId" element={
            <ProtectedRoute>
              <BookingDetailsPage />
            </ProtectedRoute>
          } />
          <Route path="/saved-trips" element={
            <ProtectedRoute>
              <SavedTrips />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/new-chat" element={
            <ProtectedRoute>
              <Navigate to="/chat" replace />
            </ProtectedRoute>
          } />
          <Route path="/booking" element={
            <ProtectedRoute>
              <BookingEntryRedirect />
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
          <Route path="/admin/users" element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          } />
          <Route path="/admin/trips" element={
            <AdminRoute>
              <AdminTripsPage />
            </AdminRoute>
          } />
          <Route path="/admin/bookings" element={
            <AdminRoute>
              <AdminBookingsPage />
            </AdminRoute>
          } />
          <Route path="/admin/payments" element={
            <AdminRoute>
              <AdminPaymentsPage />
            </AdminRoute>
          } />
          <Route path="/admin/checkout" element={
            <AdminRoute>
              <Navigate to="/admin/payments" replace />
            </AdminRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout/review" element={
            <ProtectedRoute>
              <CheckoutReviewPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout/order/:orderId" element={
            <ProtectedRoute>
              <OrderCheckoutReviewPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout/payment" element={
            <ProtectedRoute>
              <CheckoutPaymentPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout/return" element={
            <ProtectedRoute>
              <CheckoutReturnPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout/success" element={
            <ProtectedRoute>
              <CheckoutSuccessPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout/failure" element={
            <ProtectedRoute>
              <CheckoutFailurePage />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          } />
          <Route path="/login" element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          } />
          <Route path="/signup" element={
            <PublicOnlyRoute>
              <SignUp />
            </PublicOnlyRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicOnlyRoute>
              <ForgotPassword />
            </PublicOnlyRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
