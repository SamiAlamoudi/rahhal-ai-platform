/**
 * RC-3 — lightweight import / barrel audit (documentation helper).
 * Scans src/lib/agent for barrel re-export density and deep static imports of heavy layers.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('src/lib/agent')
const heavy = [
  'conversationIntelligence',
  'llmBrain',
  'agentRuntime',
  'travelPlanner',
  'reasoning',
  'realtimeVoice',
]

const findings = {
  barrelFiles: [],
  eagerHeavyImports: [],
  deferredLoaderPresent: fs.existsSync('src/lib/agent/deferredLoaders.ts'),
  facadePresent: fs.existsSync('src/lib/agent/travelAgentService.ts'),
  implPresent: fs.existsSync('src/lib/agent/travelAgentService.impl.ts'),
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name.endsWith('.test.ts')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) scan(full)
  }
}

function scan(file) {
  const text = fs.readFileSync(file, 'utf8')
  const rel = path.relative(process.cwd(), file)
  if (/(?:export \* from|export \{[^}]+\} from)/.test(text) && path.basename(file) === 'index.ts') {
    const exportCount = (text.match(/^export /gm) || []).length
    if (exportCount >= 20) findings.barrelFiles.push({ file: rel, exportCount })
  }
  if (rel.includes('travelAgentService.impl.ts') || rel.includes('deferredLoaders.ts')) return
  if (rel.includes('travelAgentService.ts')) return
  for (const mod of heavy) {
    const re = new RegExp(`from ['"](\\.\\.?/)*${mod}['"]`)
    if (re.test(text) && !text.includes(`/${mod}/feature`)) {
      // ignore type-only
      const lines = text.split('\n').filter((l) => re.test(l) && !l.includes('import type'))
      if (lines.length) {
        findings.eagerHeavyImports.push({ file: rel, module: mod, lines: lines.length })
      }
    }
  }
}

walk(root)
const out = 'RC3_IMPORT_AUDIT.json'
fs.writeFileSync(out, JSON.stringify(findings, null, 2))
console.log(JSON.stringify(findings, null, 2))
console.log('wrote', out)
