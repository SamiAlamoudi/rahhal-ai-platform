/**
 * Local `npm run ci` must include the same secret-hygiene gate as GitHub Actions.
 *
 * Proven gap (v1.0.2): `.github/workflows/ci.yml` runs
 * `bash scripts/secret-hygiene-scan.sh` before typecheck, but `package.json`
 * `"ci"` omitted it while `docs/RELEASE_CHECKLIST.md` treats `npm run ci` as
 * the local equivalent of waiting for GitHub Actions.
 */

import { describe, expect, it } from 'vitest'
import pkgRaw from '../../../package.json?raw'
import workflowRaw from '../../../.github/workflows/ci.yml?raw'

describe('local CI parity with GitHub Actions', () => {
  it('npm run ci includes the secret hygiene scan used by GitHub CI', () => {
    const pkg = JSON.parse(pkgRaw) as { scripts: Record<string, string> }
    const ci = pkg.scripts.ci ?? ''
    const hygieneScript = pkg.scripts['hygiene:secrets'] ?? ''

    expect(workflowRaw).toMatch(/secret-hygiene-scan\.sh/)
    expect(hygieneScript).toMatch(/secret-hygiene-scan\.sh/)
    expect(ci).toMatch(/hygiene:secrets/)

    const hygieneIdx = ci.indexOf('hygiene:secrets')
    const typecheckIdx = ci.indexOf('typecheck')
    expect(hygieneIdx).toBeGreaterThanOrEqual(0)
    expect(typecheckIdx).toBeGreaterThan(hygieneIdx)
  })
})
