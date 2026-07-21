# Release Notes — historical v1.0.1 patch (pointer)

**Canonical V1 release notes:** [`docs/RELEASE_NOTES_V1.md`](docs/RELEASE_NOTES_V1.md)

This file originally documented the **v1.0.1** tooling patch (`providers:check` CI gate). That content remains historically accurate for the patch itself, but is **not** the current main-branch release narrative.

| Field | Value |
| --- | --- |
| Current product | Rahhal **1.0.0** GA (+ Sprints 71–73.5 on main) |
| Package | `1.1.0-rc.1` |
| Payments | `VITE_PAYMENT_PROVIDER=mock` (unchanged) |
| Live travel providers | OFF by default (unchanged) |

### Original v1.0.1 patch summary

- Restored `npm run providers:check` and CI quality gate
- No application feature changes in that patch
- Live providers remained disabled by default; payments mock-only

For GA + Provider Runtime + Flight/Hotel Search + cleanup, use `docs/RELEASE_NOTES_V1.md`.
