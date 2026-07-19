import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AppErrorBoundary } from './components/ops/AppErrorBoundary'
import { runStartup } from './lib/ops'
import Home from './pages/Home.tsx'
import TravelConversation from './pages/TravelConversation.tsx'
import SearchWorkspace from './pages/SearchWorkspace.tsx'
import Login from './pages/Login.tsx'
import SignUp from './pages/SignUp.tsx'
import ForgotPassword from './pages/ForgotPassword.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'
import AdminUsersPage from './pages/AdminUsersPage.tsx'
import AdminTripsPage from './pages/AdminTripsPage.tsx'
import AdminBookingsPage from './pages/AdminBookingsPage.tsx'
import AdminPaymentsPage from './pages/AdminPaymentsPage.tsx'
import Notifications from './pages/Notifications.tsx'
import ResultsPage from './pages/ResultsPage.tsx'
import FlightDetailsPage from './pages/FlightDetailsPage.tsx'
import IntegrationDiagnostics from './pages/IntegrationDiagnostics.tsx'
import BookingReview from './pages/BookingReview.tsx'
import PassengerBookingPage from './pages/PassengerBookingPage.tsx'
import BookingReturn from './pages/BookingReturn.tsx'
import MyTrips from './pages/MyTrips.tsx'
import BookingDetailsPage from './pages/BookingDetailsPage.tsx'
import BookingConfirmationPage from './pages/BookingConfirmationPage.tsx'
import SavedTrips from './pages/SavedTrips.tsx'
import Settings from './pages/Settings.tsx'
import ChatPage from './pages/ChatPage.tsx'
import CheckoutPage from './pages/CheckoutPage.tsx'
import CheckoutReviewPage from './pages/CheckoutReviewPage.tsx'
import CheckoutPaymentPage from './pages/CheckoutPaymentPage.tsx'
import CheckoutReturnPage from './pages/CheckoutReturnPage.tsx'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage.tsx'
import CheckoutFailurePage from './pages/CheckoutFailurePage.tsx'
import type { NormalizedTravelOption } from './utils/searchOrchestrator'
import type { ReasoningResult } from './utils/reasoningEngine'
import type { TravelSearchRequest } from './utils/travelSearchRequest'
import { useLocation, Navigate } from 'react-router-dom'

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
import { AuthProvider } from './lib/auth/AuthContext.tsx'
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from './lib/auth/ProtectedRoute.tsx'

// Phase X — startup validation + global error handlers (non-UI).
runStartup({
  failFast: false,
  installHandlers: true,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/travel-conversation" element={
            <ProtectedRoute>
              <TravelConversation />
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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
