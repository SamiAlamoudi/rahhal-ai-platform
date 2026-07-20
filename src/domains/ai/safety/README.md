# ai/safety

## Responsibilities

Input sanitization, ownership checks, env validation, media URL safety, and security headers/policy helpers.

## Public API

- `src/lib/security` (package index)
- Concrete files under `src/lib/ops/security/*` (no package index)

## Dependencies

`infrastructure` / ops. No UI.

## Rules

- `lib/ops/security` has no `index.ts`; files are re-exported explicitly.
- Compatibility shim only.
