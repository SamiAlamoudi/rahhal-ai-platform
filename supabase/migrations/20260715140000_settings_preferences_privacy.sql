-- Extend preferences for notification + privacy settings used by Settings page.
-- Also provides a self-service account deletion RPC (cascades via auth.users FK).

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_trip_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_analytics boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_personalization boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS privacy_share_activity boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
