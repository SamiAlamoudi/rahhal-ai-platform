-- Seed default marketing coupons used by couponValidator demo codes.
-- Idempotent: skips codes that already exist.

INSERT INTO public.coupons (
  code, type, value, currency, min_order_amount, max_discount, expires_at, active, description
)
VALUES
  ('WELCOME10', 'percentage', 10, NULL, 500, 500, NULL, true, '10% off on orders above 500'),
  ('RAHHAL50', 'fixed', 50, 'SAR', 1000, NULL, NULL, true, '50 SAR off on orders above 1000')
ON CONFLICT (code) DO NOTHING;
