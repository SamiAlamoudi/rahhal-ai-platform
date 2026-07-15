import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home.tsx'
import TravelConversation from './pages/TravelConversation.tsx'
import SearchWorkspace from './pages/SearchWorkspace.tsx'
import Login from './pages/Login.tsx'
import SignUp from './pages/SignUp.tsx'
import ForgotPassword from './pages/ForgotPassword.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'
import Notifications from './pages/Notifications.tsx'
import ResultsPage from './pages/ResultsPage.tsx'
import IntegrationDiagnostics from './pages/IntegrationDiagnostics.tsx'
import BookingReview from './pages/BookingReview.tsx'
import BookingReturn from './pages/BookingReturn.tsx'
import MyTrips from './pages/MyTrips.tsx'
import CheckoutPage from './pages/CheckoutPage.tsx'
import CheckoutReviewPage from './pages/CheckoutReviewPage.tsx'
import CheckoutPaymentPage from './pages/CheckoutPaymentPage.tsx'
import CheckoutReturnPage from './pages/CheckoutReturnPage.tsx'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage.tsx'
import CheckoutFailurePage from './pages/CheckoutFailurePage.tsx'
import CheckoutAdminDashboard from './pages/CheckoutAdminDashboard.tsx'
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
  } | null
  if (!state?.rankedOptions) {
    return <Navigate to="/search" replace />
  }
  return <ResultsPage {...state} />
}
import { AuthProvider } from './lib/auth/AuthContext.tsx'
import { ProtectedRoute, PublicOnlyRoute } from './lib/auth/ProtectedRoute.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
          <Route path="/booking/return" element={
            <ProtectedRoute>
              <BookingReturn />
            </ProtectedRoute>
          } />
          <Route path="/my-trips" element={
            <ProtectedRoute>
              <MyTrips />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/checkout" element={
            <ProtectedRoute>
              <CheckoutAdminDashboard />
            </ProtectedRoute>
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
  </StrictMode>,
)
