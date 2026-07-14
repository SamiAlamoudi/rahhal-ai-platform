/*
# Rahhal Unified Checkout & Payment Foundation Schema

## Purpose
Creates the database tables for Phase 33: the unified checkout and payment layer.
This allows customers to book and pay directly inside Rahhal instead of being
redirected to external providers.

## New Tables

1. **orders** - Rahhal orders with order number, booking number, customer reference
2. **payment_sessions** - Payment sessions per order with provider info
3. **payment_events** - Append-only event log for payment status transitions
4. **booking_locks** - Prevents duplicate payments and duplicate bookings
5. **coupons** - Discount coupons (percentage or fixed)

## Security
- RLS enabled on all tables
- All tables use `TO authenticated` with `auth.uid() = user_id` ownership
- Owner columns default to `auth.uid()` so inserts without explicit user_id succeed
- coupons are readable by all authenticated users (shared catalog)
*/

-- ── orders ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_session_id uuid,
  order_number text NOT NULL,
  booking_number text NOT NULL,
  customer_reference text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  cart jsonb NOT NULL DEFAULT '{}'::jsonb,
  travelers jsonb NOT NULL DEFAULT '[]'::jsonb,
  coupon_code text,
  discount_amount numeric NOT NULL DEFAULT 0,
  payment_session_id text,
  payment_provider text,
  paid_at timestamptz,
  confirmed_at timestamptz,
  invoice_number text,
  itinerary_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── payment_sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  provider_id text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  amount numeric NOT NULL,
  currency text NOT NULL,
  payment_method text,
  provider_reference text,
  authorization_code text,
  transaction_id text,
  description text NOT NULL DEFAULT '',
  customer_email text,
  customer_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_user_id ON payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_order_id ON payment_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);

ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payment_sessions" ON payment_sessions;
CREATE POLICY "select_own_payment_sessions" ON payment_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payment_sessions" ON payment_sessions;
CREATE POLICY "insert_own_payment_sessions" ON payment_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payment_sessions" ON payment_sessions;
CREATE POLICY "update_own_payment_sessions" ON payment_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payment_sessions" ON payment_sessions;
CREATE POLICY "delete_own_payment_sessions" ON payment_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── payment_events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_session_id text NOT NULL REFERENCES payment_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_session_id ON payment_events(payment_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payment_events" ON payment_events;
CREATE POLICY "select_own_payment_events" ON payment_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payment_events" ON payment_events;
CREATE POLICY "insert_own_payment_events" ON payment_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payment_events" ON payment_events;
CREATE POLICY "update_own_payment_events" ON payment_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_payment_events" ON payment_events;
CREATE POLICY "delete_own_payment_events" ON payment_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── booking_locks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_locks (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  lock_token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_locks_order_id ON booking_locks(order_id);
CREATE INDEX IF NOT EXISTS idx_booking_locks_user_id ON booking_locks(user_id);

ALTER TABLE booking_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_booking_locks" ON booking_locks;
CREATE POLICY "select_own_booking_locks" ON booking_locks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_booking_locks" ON booking_locks;
CREATE POLICY "insert_own_booking_locks" ON booking_locks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_booking_locks" ON booking_locks;
CREATE POLICY "update_own_booking_locks" ON booking_locks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_booking_locks" ON booking_locks;
CREATE POLICY "delete_own_booking_locks" ON booking_locks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── coupons ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'percentage',
  value numeric NOT NULL DEFAULT 0,
  currency text,
  min_order_amount numeric,
  max_discount numeric,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coupons" ON coupons;
CREATE POLICY "select_coupons" ON coupons FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_coupons" ON coupons;
CREATE POLICY "insert_coupons" ON coupons FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_coupons" ON coupons;
CREATE POLICY "update_coupons" ON coupons FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_coupons" ON coupons;
CREATE POLICY "delete_coupons" ON coupons FOR DELETE
  TO authenticated USING (true);
