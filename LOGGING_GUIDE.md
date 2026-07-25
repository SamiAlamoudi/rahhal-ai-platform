# Logging Guide

## Levels

`TRACE` · `DEBUG` · `INFO` · `WARN` · `ERROR` · `FATAL`

## Required fields

Every structured record includes:

- `timestamp`
- `requestId`
- `conversationId`
- `provider`
- `module`
- `durationMs`
- `status`

## Redaction

Logs pass through `sanitizeForLogs` (Sprint 14 SecretSanitizer). Forbidden field names (`password`, `token`, `api_key`, payment/PII keys) are forced to `[REDACTED]`.

Never log:

- Secrets / API keys
- Passwords
- Tokens
- PII
- Payment data

## Usage

```ts
import { createLogger } from '@/lib/observability'

const log = createLogger({ enabled: true, module: 'demo' })
log.info('turn completed', { durationMs: 42, status: 'ok' })
```

Platform flag `observability.platform` must be ON (or `enabled: true` override) for emission.
