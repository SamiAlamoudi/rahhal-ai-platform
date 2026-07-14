/*
# Rahhal Booking Schema — Booking Orchestration Foundation

Creates the database foundation for the Rahhal Booking Orchestrator V1.
All tables are owner-scoped (user_id) with full RLS policies ensuring each
authenticated user only accesses their own booking records.

## 1. New Tables

- `booking_sessions` — The top-level booking session per trip selection.
  Columns: id, user_id, travel_session_id (FK nullable), status, items (jsonb),
  subtotal, fees, total, currency, selected_booking_mode,
  provider_references (jsonb), created_at, updated_at, expires_at,
  redirected_at, confirmed_at.

- `booking_items` — Individual items within a booking session (flight, hotel,
  rental car, etc.).
  Columns: id, booking_session_id (FK), user_id, type, provider_id,
  provider_name, provider_offer_id, title, price, currency, booking_url,
  booking_mode, expires_at, traveler_summary, selected_at, metadata (jsonb).

- `booking_events` — Append-only event log tracking status transitions.
  Columns: id, booking_session_id (FK), user_id, event_type, from_status,
  to_status, details (jsonb), created_at.

## 2. Indexes

- booking_sessions: user_id, created_at DESC, status
- booking_items: booking_session_id, user_id
- booking_events: booking_session_id, user_id, created_at DESC

## 3. Foreign Keys

- booking_sessions.travel_session_id → sessions.id ON DELETE SET NULL
- booking_items.booking_session_id → booking_sessions.id ON DELETE CASCADE
- booking_events.booking_session_id → booking_sessions.id ON DELETE CASCADE
- All user_id columns → auth.users(id) ON DELETE CASCADE

## 4. Security (RLS)

- RLS enabled on ALL three tables.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE), all scoped TO authenticated.
- All ownership checks use auth.uid() = user_id.
- user_id columns default to auth.uid() so client inserts succeed without passing user_id.
- booking_items and booking_events additionally verify session ownership via
  EXISTS subquery against booking_sessions.

## 5. Important Notes

- No payment card information is stored.
- No provider client secrets are stored.
- booking_url stores only public redirect URLs (http/https).
- provider_references stores provider booking reference numbers entered by the
  traveler (pending_provider_confirmation status — never auto-confirmed).
- The updated_at trigger reuses the existing update_updated_at() function.
*/
