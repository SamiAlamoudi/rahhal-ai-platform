#!/usr/bin/env node
/**
 * Fail CI/local checks when madge detects circular dependencies under src/.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

let madge
try {
  madge = require('madge')
} catch {
  console.error('madge is not installed. Run: npm install -D madge')
  process.exit(1)
}

const target = path.join(root, 'src')

const tree = await madge(target, {
  fileExtensions: ['ts', 'tsx'],
  tsConfig: path.join(root, 'tsconfig.app.json'),
  detectiveOptions: {
    ts: { skipTypeImports: true },
    tsx: { skipTypeImports: true },
  },
})

const circular = tree.circular()

if (circular.length > 0) {
  console.error(`Found ${circular.length} circular dependency cycle(s):\n`)
  for (const cycle of circular) {
    console.error(`  ${cycle.join(' -> ')}`)
  }
  process.exit(1)
}

console.log('No circular dependencies found under src/.')
process.exit(0)
