# Release Checklist

## Feature-flag matrix (safe defaults)

| Flag / adapter | Staging default | Production default | Notes |
|----------------|-----------------|--------------------|-------|
| `VITE_PAYMENT_PROVIDER` | `mock` | `mock` | Freeze until payment TODO done |
| `VITE_LIVE_PROVIDERS_ENABLED` | `false` | `false` | Master kill switch |
| Amadeus live | off | off | Needs Edge token + secrets |
| Booking.com live | off | off | Prefer server RapidAPI key |
| Google Maps live | off | off | Proxy + `GOOGLE_MAPS_API_KEY` |
| OpenWeather live | off | off | Proxy + `OPENWEATHER_API_KEY` |
| Mock fallback | on | on | Always keep for degradation |

## Build & ship

1. [ ] `npm run ci` locally (or wait for GitHub Actions)
2. [ ] Tag/annotate commit SHA
3. [ ] Deploy Edge Functions + SPA to staging first (`STAGING_CHECKLIST.md`)
4. [ ] Migration preflight: review pending `supabase/migrations` on a staging DB clone; no destructive surprises
5. [ ] Production deploy only after staging smoke sign-off
6. [ ] Verify `ops-health` ready + payment mock
7. [ ] Monitor structured logs / ops metrics for 30–60 minutes

## Rollback

1. [ ] Redeploy previous known-good SPA artifact
2. [ ] Set `VITE_LIVE_PROVIDERS_ENABLED=false` if provider-related
3. [ ] Keep payments on `mock`
4. [ ] Edge function rollback via prior deploy / `supabase functions deploy` of last tag
5. [ ] Confirm readiness probe green
6. [ ] Post in incident channel with SHA before/after

## Backup & restore

- [ ] Supabase automatic backups enabled on staging/prod projects
- [ ] Document point-in-time restore owner + steps (Supabase dashboard)
- [ ] After restore: re-run readiness + auth smoke + mock checkout path
- [ ] Never restore production data into shared staging without scrubbing PII

## Migration preflight

- [ ] `supabase db lint` / review SQL manually for DROP/TRUNCATE
- [ ] Apply to staging first
- [ ] Verify RLS still denies cross-user reads
- [ ] Record migration versions in release notes
