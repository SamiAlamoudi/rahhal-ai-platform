# Branding status — Bilamo

Product brand is **Bilamo / بيلامو**. Active UI, voice, payment copy, and Playwright expectations use Bilamo.

## Program documents

| Doc | Purpose |
|-----|---------|
| [`DOMAIN_NAMING_POLICY.md`](./DOMAIN_NAMING_POLICY.md) | Brand vs domain-driven naming boundaries |
| [`BRAND_SEPARATION_MIGRATION_ROADMAP.md`](./BRAND_SEPARATION_MIGRATION_ROADMAP.md) | Staged P0–P8 compatibility migration plan |
| `scripts/branding-inventory.mjs` | CI guardrail + inventory classifier |
| `scripts/branding-allowlist.json` | Reviewed allowlist for legacy technical tokens |

## Do not rename without a migration PR

- Feature flag ids such as `ai.rahhal_brain` and related TypeScript APIs (`RahhalBrain`, `RahhalOrder`, …)
- localStorage / session keys prefixed `rahhal.` / `rahhal_`
- CSS compatibility aliases `--rahhal-*`
- Webhook / response headers (`x-rahhal-webhook-secret`, `X-Rahhal-*`)
- Deployed origin allow-list entries (`rahhal-ai-platform.vercel.app`)
- Applied SQL migration filenames and historical sprint docs
