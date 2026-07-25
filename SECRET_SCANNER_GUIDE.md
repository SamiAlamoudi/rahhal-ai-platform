# Secret Scanner Guide

## Commands

```bash
npm run security:scan        # probable secret patterns
npm run security:env-check   # provider direct env + secret-like reads
npm run security:validate    # unit tests (registry, sanitizer, authz, …)
npm run security:gate        # all of the above (CI)
```

Existing hygiene (unchanged):

```bash
bash scripts/secret-hygiene-scan.sh
```

## Detects

- Hardcoded API keys (`sk-…`)
- Bearer tokens
- Private keys (`BEGIN … PRIVATE KEY`)
- AWS-style access keys
- JWT-like credentials
- Password / client_secret assignments

## Allowlist

Safe placeholders matching:

`example`, `placeholder`, `changeme`, `your_`, `xxx`, `dummy`, `fake`, `test_key`, `not_a_secret`, and known test fixtures.

## CI

`.github/workflows/ci.yml` runs `npm run security:gate` before typecheck. Probable real secrets **fail the build**.

## Scope

Scans source, tests, configuration, documentation, and generated report markdown under the repo root (skips `node_modules`, `dist`, coverage, Playwright artifacts).
