#!/usr/bin/env node
/**
 * Detect Amadeus credentials + print setup status.
 * Exit 0 when connected; 1 when creds present but unhealthy; 2 when missing.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv(resolve(process.cwd(), '.env.local'))
loadDotEnv(resolve(process.cwd(), '.env'))

const AMADEUS_DEFAULT_HOST = 'https://test.api.amadeus.com'

function normalizeHost(raw) {
  return (raw || AMADEUS_DEFAULT_HOST).replace(/\/+$/, '').replace(/\/v1$/i, '')
}

function readCredentials(env = process.env) {
  const clientId = (env.AMADEUS_CLIENT_ID || '').trim() || null
  const clientSecret = (env.AMADEUS_CLIENT_SECRET || '').trim() || null
  const host = normalizeHost(env.AMADEUS_BASE_URL)
  return {
    clientId,
    clientSecret,
    host,
    hasCredentials: Boolean(clientId && clientSecret),
  }
}

async function probe(env = process.env) {
  const creds = readCredentials(env)
  const checkedAt = new Date().toISOString()
  if (!creds.hasCredentials) {
    return {
      amadeus: 'missing_credentials',
      fallback: true,
      checkedAt,
      detail: 'AMADEUS_CLIENT_ID and/or AMADEUS_CLIENT_SECRET are not set on the server',
    }
  }

  try {
    const response = await fetch(`${creds.host}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    })
    if (response.status === 401) {
      return { amadeus: 'invalid_credentials', fallback: true, host: creds.host, checkedAt }
    }
    if (!response.ok) {
      return {
        amadeus: 'error',
        fallback: true,
        host: creds.host,
        checkedAt,
        detail: `HTTP ${response.status}`,
      }
    }
    const data = await response.json()
    if (!data.access_token) {
      return {
        amadeus: 'error',
        fallback: true,
        host: creds.host,
        checkedAt,
        detail: 'Token response missing access_token',
      }
    }
    return { amadeus: 'connected', fallback: false, host: creds.host, checkedAt }
  } catch (err) {
    return {
      amadeus: 'unreachable',
      fallback: true,
      host: creds.host,
      checkedAt,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

const spaFlags = {
  VITE_FLIGHT_PROVIDER: process.env.VITE_FLIGHT_PROVIDER || '(unset)',
  VITE_AMADEUS_ENABLED: process.env.VITE_AMADEUS_ENABLED || '(unset)',
  VITE_AMADEUS_USE_VERCEL_PROXY: process.env.VITE_AMADEUS_USE_VERCEL_PROXY || '(default true)',
}

const creds = readCredentials(process.env)
console.log('=== Amadeus credential detection ===')
console.log(`AMADEUS_CLIENT_ID:     ${creds.clientId ? 'SET' : 'MISSING'}`)
console.log(`AMADEUS_CLIENT_SECRET: ${creds.clientSecret ? 'SET' : 'MISSING'}`)
console.log(`AMADEUS_BASE_URL:      ${creds.host}`)
console.log('SPA flags:', spaFlags)

if (!creds.hasCredentials) {
  console.log('\n❌ Amadeus credentials are MISSING.')
  console.log('Complete setup guide: docs/AMADEUS_SETUP.md')
  console.log('\nQuick fix (Vercel):')
  console.log('  vercel env add AMADEUS_CLIENT_ID')
  console.log('  vercel env add AMADEUS_CLIENT_SECRET')
  console.log('  vercel env add VITE_FLIGHT_PROVIDER   # amadeus')
  console.log('  vercel env add VITE_AMADEUS_ENABLED   # true')
  process.exit(2)
}

console.log('\nProbing Amadeus OAuth…')
const health = await probe(process.env)
console.log(JSON.stringify(health, null, 2))

if (health.amadeus === 'connected') {
  console.log('\n✓ Amadeus Connected')
  process.exit(0)
}

console.log('\n⚠ Credentials present but provider not connected:', health.amadeus)
console.log('See docs/AMADEUS_SETUP.md')
process.exit(1)
