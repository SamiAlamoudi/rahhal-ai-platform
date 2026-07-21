# Launch Automation V1

Orchestrates Sprint 65 hardening + Sprint 66 E2E validation + Sprint 68 deployment gates.

```ts
import {
  runProductionDeploymentPreflight,
  generateDeploymentLaunchReport,
  isProductionDeploymentReady,
} from './ops'

const report = await runProductionDeploymentPreflight({ skipE2E: false })
if (!isProductionDeploymentReady(report)) {
  throw new Error(report.summary)
}
```

## Go Live Checklist (library)

`buildGoLiveChecklist()` / `report.checklist`

## Rollback

`triggerRollback()` enables safe mode and returns ordered steps for deployment / config / provider / feature recovery.
