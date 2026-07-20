-- Production stabilization: grant chat tables to authenticated (and limited anon read).
-- Hosted Supabase often auto-grants; local stacks do not — without GRANTs, RLS policies
-- never get a chance to run and inserts/selects fail with permission denied.

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE messages TO authenticated;

GRANT SELECT ON TABLE conversations TO anon;
GRANT SELECT ON TABLE messages TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
