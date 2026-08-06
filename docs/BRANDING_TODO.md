# Branding — Bilamo (complete for user-facing surfaces)

Product brand is **Bilamo / بيلامو**. User-facing UI, voice prompts, payment copy, and Playwright expectations use Bilamo.

## Technical identifiers intentionally kept as `rahhal` / `Rahhal*`

Do **not** rename these without a dedicated migration (would break storage, feature flags, CORS, and APIs):

- Feature flag ids such as `ai.rahhal_brain` and related TypeScript APIs (`RahhalBrain`, `RahhalOrder`, …)
- localStorage / session keys prefixed `rahhal.`
- CSS compatibility aliases `--rahhal-*`
- Webhook / response headers (`x-rahhal-webhook-secret`, `X-Rahhal-*`)
- Deployed origin allow-list entries (`rahhal-ai-platform.vercel.app`)
- Vite plugin internal names, migration filenames, and historical sprint docs

## Remaining product polish (optional)

1. Domain / social handles if still on legacy names
2. Package-lock historical `rahhal-app` name sync (package.json is `bilamo-app`)
3. Curious / external boards metadata
