-- ── booking_sessions table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  fees numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  selected_booking_mode text NOT NULL DEFAULT 'redirect',
  provider_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  redirected_at timestamptz,
  confirmed_at timestamptz
);

ALTER TABLE booking_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_booking_sessions" ON booking_sessions;
CREATE POLICY "select_own_booking_sessions" ON booking_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_booking_sessions" ON booking_sessions;
CREATE POLICY "insert_own_booking_sessions" ON booking_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_booking_sessions" ON booking_sessions;
CREATE POLICY "update_own_booking_sessions" ON booking_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_booking_sessions" ON booking_sessions;
CREATE POLICY "delete_own_booking_sessions" ON booking_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_booking_sessions_user_id ON booking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_sessions_created_at ON booking_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_sessions_status ON booking_sessions(user_id, status);

DROP TRIGGER IF EXISTS trg_booking_sessions_updated_at ON booking_sessions;
CREATE TRIGGER trg_booking_sessions_updated_at BEFORE UPDATE ON booking_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── booking_items table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_session_id uuid NOT NULL REFERENCES booking_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider_id text NOT NULL,
  provider_name text NOT NULL DEFAULT '',
  provider_offer_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  booking_url text NOT NULL DEFAULT '',
  booking_mode text NOT NULL DEFAULT 'redirect',
  expires_at timestamptz,
  traveler_summary text NOT NULL DEFAULT '',
  selected_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_booking_items" ON booking_items;
CREATE POLICY "select_own_booking_items" ON booking_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_booking_items" ON booking_items;
CREATE POLICY "insert_own_booking_items" ON booking_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_booking_items" ON booking_items;
CREATE POLICY "update_own_booking_items" ON booking_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_booking_items" ON booking_items;
CREATE POLICY "delete_own_booking_items" ON booking_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_booking_items_session_id ON booking_items(booking_session_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_user_id ON booking_items(user_id);

-- ── booking_events table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_session_id uuid NOT NULL REFERENCES booking_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_booking_events" ON booking_events;
CREATE POLICY "select_own_booking_events" ON booking_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_booking_events" ON booking_events;
CREATE POLICY "insert_own_booking_events" ON booking_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_booking_events" ON booking_events;
CREATE POLICY "update_own_booking_events" ON booking_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_booking_events" ON booking_events;
CREATE POLICY "delete_own_booking_events" ON booking_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_booking_events_session_id ON booking_events(booking_session_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_user_id ON booking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON booking_events(user_id, created_at DESC);
