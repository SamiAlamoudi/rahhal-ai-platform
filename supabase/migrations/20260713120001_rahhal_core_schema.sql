/*
# Rahhal Core Schema — Multi-User Foundation

Creates the complete database foundation for the Rahhal AI travel planning platform.
All tables are owner-scoped (user_id) with full RLS policies ensuring each user
only accesses their own data.

## 1. New Tables

- `sessions` — Stores travel planning conversation sessions (decision sessions).
  Each row holds the full TravelSession state as JSON plus metadata.
  Columns: id, user_id, destination, departure_city, session_data (jsonb),
  completion_percentage, decision_confirmed, created_at, updated_at.

- `search_history` — Records every executed search with its results summary.
  Columns: id, user_id, session_id (FK), destination, search_request (jsonb),
  result_count, ranked_top_option (text), created_at.

- `saved_trips` — Bookmarked/saved trip plans the user wants to revisit.
  Columns: id, user_id, session_id (FK), title, destination, trip_data (jsonb),
  created_at, updated_at.

- `favorites` — Favorite destinations the user has starred.
  Columns: id, user_id, destination, notes, created_at.

- `preferences` — User-level preferences (single row per user, keyed by user_id).
  Columns: id, user_id, preferred_currency, preferred_language, theme,
  notification_enabled, created_at, updated_at.

- `notifications` — In-app notifications for the user.
  Columns: id, user_id, type, title, body, is_read, is_archived, created_at, read_at.

- `audit_logs` — Audit trail of user actions for security and diagnostics.
  Columns: id, user_id, action, entity_type, entity_id, metadata (jsonb), created_at.

## 2. Indexes

- sessions: user_id, created_at DESC
- search_history: user_id, created_at DESC
- saved_trips: user_id, created_at DESC
- favorites: user_id, (user_id, destination) UNIQUE
- preferences: user_id UNIQUE
- notifications: user_id, is_read, created_at DESC
- audit_logs: user_id, created_at DESC

## 3. Foreign Keys

- search_history.session_id → sessions.id ON DELETE SET NULL
- saved_trips.session_id → sessions.id ON DELETE SET NULL
- All user_id columns → auth.users(id) ON DELETE CASCADE

## 4. Security (RLS)

- RLS enabled on ALL tables.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE), all scoped TO authenticated.
- All ownership checks use auth.uid() = user_id.
- user_id columns default to auth.uid() so client inserts succeed without passing user_id.
*/

-- ── sessions table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  destination text NOT NULL DEFAULT '',
  departure_city text NOT NULL DEFAULT '',
  session_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_percentage int NOT NULL DEFAULT 0,
  decision_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON sessions;
CREATE POLICY "select_own_sessions" ON sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON sessions;
CREATE POLICY "insert_own_sessions" ON sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON sessions;
CREATE POLICY "update_own_sessions" ON sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON sessions;
CREATE POLICY "delete_own_sessions" ON sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(user_id, created_at DESC);

-- ── search_history table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  destination text NOT NULL DEFAULT '',
  search_request jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count int NOT NULL DEFAULT 0,
  ranked_top_option text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_search_history" ON search_history;
CREATE POLICY "select_own_search_history" ON search_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_search_history" ON search_history;
CREATE POLICY "insert_own_search_history" ON search_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_search_history" ON search_history;
CREATE POLICY "update_own_search_history" ON search_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_search_history" ON search_history;
CREATE POLICY "delete_own_search_history" ON search_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(user_id, created_at DESC);

-- ── saved_trips table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  trip_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_trips" ON saved_trips;
CREATE POLICY "select_own_saved_trips" ON saved_trips FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_trips" ON saved_trips;
CREATE POLICY "insert_own_saved_trips" ON saved_trips FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_trips" ON saved_trips;
CREATE POLICY "update_own_saved_trips" ON saved_trips FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_trips" ON saved_trips;
CREATE POLICY "delete_own_saved_trips" ON saved_trips FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_trips_user_id ON saved_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_trips_created_at ON saved_trips(user_id, created_at DESC);

-- ── favorites table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  destination text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, destination)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_favorites" ON favorites;
CREATE POLICY "select_own_favorites" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_favorites" ON favorites;
CREATE POLICY "insert_own_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_favorites" ON favorites;
CREATE POLICY "update_own_favorites" ON favorites FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON favorites;
CREATE POLICY "delete_own_favorites" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_destination ON favorites(user_id, destination);

-- ── preferences table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_currency text NOT NULL DEFAULT 'SAR',
  preferred_language text NOT NULL DEFAULT 'ar',
  theme text NOT NULL DEFAULT 'light',
  notification_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_preferences" ON preferences;
CREATE POLICY "select_own_preferences" ON preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_preferences" ON preferences;
CREATE POLICY "insert_own_preferences" ON preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_preferences" ON preferences;
CREATE POLICY "update_own_preferences" ON preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_preferences" ON preferences;
CREATE POLICY "delete_own_preferences" ON preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);

-- ── notifications table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at DESC);

-- ── audit_logs table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audit_logs" ON audit_logs;
CREATE POLICY "insert_own_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_audit_logs" ON audit_logs;
CREATE POLICY "update_own_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_audit_logs" ON audit_logs;
CREATE POLICY "delete_own_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(user_id, created_at DESC);

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON sessions;
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_saved_trips_updated_at ON saved_trips;
CREATE TRIGGER trg_saved_trips_updated_at BEFORE UPDATE ON saved_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_preferences_updated_at ON preferences;
CREATE TRIGGER trg_preferences_updated_at BEFORE UPDATE ON preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
