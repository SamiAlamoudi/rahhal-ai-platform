-- Harden coupons RLS: authenticated users may read the shared catalog only.
-- Insert/update/delete require service_role (bypasses RLS) — never client JWT.

DROP POLICY IF EXISTS "insert_coupons" ON coupons;
DROP POLICY IF EXISTS "update_coupons" ON coupons;
DROP POLICY IF EXISTS "delete_coupons" ON coupons;

-- Keep SELECT for authenticated (catalog lookup / apply coupon by code).
DROP POLICY IF EXISTS "select_coupons" ON coupons;
CREATE POLICY "select_coupons" ON coupons FOR SELECT
  TO authenticated USING (true);
