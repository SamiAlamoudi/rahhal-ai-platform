#!/usr/bin/env node
/**
 * Fail when circular import dependencies exist under src/.
 *
 * Zero third-party deps (compatible with TypeScript 6 / strict npm ci).
 * Skips `import type` / `export type … from` (type-only edges), matching the
 * prior madge detectiveOptions.skipTypeImports policy.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const srcRoot = resolve(root, 'src')

const SOURCE_EXTS = new Set(['.ts', '.tsx'])
const RESOLVE_EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

/** @param {string} dir */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (SOURCE_EXTS.has(extname(name))) out.push(full)
  }
  return out
}

/** @param {string} fromFile @param {string} spec */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null // ignore packages / absolute aliases
  const base = resolve(dirname(fromFile), spec.replace(/\.js$/i, ''))
  for (const suffix of ['', ...RESOLVE_EXTS]) {
    const candidate = suffix.startsWith('/')
      ? base + suffix
      : suffix
        ? base + suffix
        : base
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      /* try next */
    }
  }
  return null
}

/**
 * Extract runtime import/export module specifiers.
 * @param {string} code
 * @returns {string[]}
 */
function extractSpecifiers(code) {
  const specs = []
  // Strip block comments and line comments (naive but adequate for import lines)
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  const patterns = [
    // import … from 'x'  (not import type)
    /(?:^|[^\w])import\s+(?!type\b)[\s\S]*?from\s+['"]([^'"]+)['"]/g,
    // export … from 'x'  (not export type)
    /(?:^|[^\w])export\s+(?!type\b)[\s\S]*?from\s+['"]([^'"]+)['"]/g,
    // side-effect import 'x'
    /(?:^|[^\w])import\s+['"]([^'"]+)['"]/g,
    // dynamic import('x') — counts as runtime edge
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // require('x') if any CJS remains
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const re of patterns) {
    let m
    while ((m = re.exec(stripped)) !== null) {
      specs.push(m[1])
    }
  }
  return specs
}

const files = walk(srcRoot)
/** @type {Map<string, string[]>} */
const graph = new Map()

for (const file of files) {
  const code = readFileSync(file, 'utf8')
  const deps = []
  for (const spec of extractSpecifiers(code)) {
    const resolved = resolveImport(file, spec)
    if (resolved && SOURCE_EXTS.has(extname(resolved))) {
      deps.push(resolved)
    }
  }
  graph.set(file, [...new Set(deps)])
}

/** @type {string[][]} */
const cycles = []
const WHITE = 0
const GRAY = 1
const BLACK = 2
/** @type {Map<string, number>} */
const color = new Map(files.map((f) => [f, WHITE]))
/** @type {string[]} */
const stack = []

/** @param {string} node */
function dfs(node) {
  color.set(node, GRAY)
  stack.push(node)
  for (const next of graph.get(node) ?? []) {
    const c = color.get(next) ?? WHITE
    if (c === GRAY) {
      const idx = stack.indexOf(next)
      if (idx >= 0) cycles.push(stack.slice(idx).concat(next))
    } else if (c === WHITE) {
      dfs(next)
    }
  }
  stack.pop()
  color.set(node, BLACK)
}

for (const file of files) {
  if (color.get(file) === WHITE) dfs(file)
}

/** Deduplicate cycles that are rotations of each other */
function normalize(cycle) {
  const body = cycle.slice(0, -1)
  const keys = body.map((f) => relative(root, f).split(sep).join('/'))
  const rotations = keys.map((_, i) => [...keys.slice(i), ...keys.slice(0, i)].join(' -> '))
  return rotations.sort()[0]
}

const unique = [...new Map(cycles.map((c) => [normalize(c), c])).values()]

if (unique.length > 0) {
  console.error(`Found ${unique.length} circular dependency cycle(s):\n`)
  for (const cycle of unique) {
    const label = cycle
      .map((f) => relative(root, f).split(sep).join('/'))
      .join(' -> ')
    console.error(`  ${label}`)
  }
  process.exit(1)
}

console.log('No circular dependencies found under src/.')
process.exit(0)
