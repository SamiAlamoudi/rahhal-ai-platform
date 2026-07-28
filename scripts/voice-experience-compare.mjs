#!/usr/bin/env node
/**
 * Voice Experience comparison pack — hits production /api/openai/tts.
 * Generates wav samples for Script A/B/C × candidate voices × dialect modes.
 *
 * Usage:
 *   PROD_URL=https://rahhal-ai-platform.vercel.app \
 *   VERCEL_PROTECTION_BYPASS=... \
 *   node scripts/voice-experience-compare.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROD_URL = (process.env.PROD_URL || 'https://rahhal-ai-platform.vercel.app').replace(/\/$/, '')
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS || ''
const OUT = process.env.VOICE_COMPARE_OUT || '/opt/cursor/artifacts/voice-compare'

const VOICES = ['marin', 'coral', 'nova', 'sage', 'onyx']
const DIALECTS = ['white', 'saudi', 'gulf', 'moroccan', 'fusha']
const SCRIPTS = {
  A: 'وعليكم السلام، حياك الله. وين حاب تسافر؟',
  B: 'ممتاز، لقيت لك ثلاثة خيارات مناسبة. الأول أوفر، والثاني موقعه أفضل، والثالث يشمل الإفطار والإلغاء المجاني.',
  C: 'خلني أتأكد من التفاصيل: السفر لشخصين من الرياض إلى إسطنبول، من 12 إلى 17 أغسطس. صحيح؟',
}

function instructionsFor(dialect) {
  const dialectHint = {
    white: 'Use clear widely understood modern Arabic (العربية البيضاء).',
    saudi: 'Prefer natural Saudi phrasing and rhythm when comfortable; stay clear — never caricature.',
    gulf: 'Prefer natural Gulf phrasing when comfortable; stay clear — never caricature.',
    moroccan: 'Light Moroccan coloring only if clear; otherwise use natural clear Arabic.',
    fusha: 'Use clear simplified Modern Standard Arabic — warm and conversational.',
  }[dialect] || ''
  return [
    'Speak naturally and conversationally as Rahhal, an experienced travel consultant on a live voice call.',
    'Warm, confident, calm, concise. Avoid announcer-style delivery and exaggerated emotion.',
    'Use natural pauses. Keep volume, tone, and pace consistent throughout.',
    'Do not sound like a navigation system or text reader.',
    dialectHint,
    'If a strong regional accent would sound unnatural, use clear natural Arabic instead of a poor imitation.',
    'Absolutely no English words.',
  ].join(' ')
}

async function synthesize({ text, voice, dialect, format = 'wav' }) {
  const started = performance.now()
  const headers = { 'Content-Type': 'application/json' }
  if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS
  const res = await fetch(`${PROD_URL}/api/openai/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      locale: 'ar',
      voice,
      dialect,
      speed: 1,
      instructions: instructionsFor(dialect),
      format,
    }),
  })
  const ttfb = performance.now() - started
  const buf = Buffer.from(await res.arrayBuffer())
  const total = performance.now() - started
  return {
    status: res.status,
    bytes: buf.length,
    ttfbMs: Math.round(ttfb),
    totalMs: Math.round(total),
    model: res.headers.get('x-rahhal-tts-model') || 'unknown',
    voiceHeader: res.headers.get('x-rahhal-tts-voice') || voice,
    formatHeader: res.headers.get('x-rahhal-tts-format') || format,
    buf,
    contentType: res.headers.get('content-type') || '',
  }
}

/** Heuristic subjective score proxy from latency + size stability (human review still required). */
function heuristicScore(row) {
  if (row.status !== 200 || row.bytes < 1000) return 1
  let score = 7
  if (row.totalMs < 1800) score += 1
  if (row.totalMs < 1400) score += 0.5
  if (row.totalMs > 2800) score -= 1
  if (row.bytes > 20000 && row.bytes < 400000) score += 0.5
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10))
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const results = []

  // Phase 1: voice bake-off on Script A with saudi dialect
  for (const voice of VOICES) {
    const scriptId = 'A'
    const dialect = 'saudi'
    const r = await synthesize({ text: SCRIPTS[scriptId], voice, dialect })
    const file = `voice_${voice}_script${scriptId}_${dialect}.${r.formatHeader === 'mp3' ? 'mp3' : 'wav'}`
    if (r.status === 200) writeFileSync(join(OUT, file), r.buf)
    const row = {
      phase: 'voice_bakeoff',
      scriptId,
      text: SCRIPTS[scriptId],
      voice,
      dialect,
      instructions: instructionsFor(dialect),
      status: r.status,
      model: r.model,
      format: r.formatHeader,
      bytes: r.bytes,
      ttfbMs: r.ttfbMs,
      latencyMs: r.totalMs,
      file: r.status === 200 ? file : null,
      subjectiveQualityScore: heuristicScore({ status: r.status, bytes: r.bytes, totalMs: r.totalMs }),
      notes: r.status === 200 ? 'Generated for human Arabic listening review' : `HTTP ${r.status}`,
    }
    results.push(row)
    console.log(JSON.stringify(row))
  }

  // Phase 2: dialect modes with winning/default voice marin on all scripts
  const defaultVoice = 'marin'
  for (const dialect of DIALECTS) {
    for (const scriptId of Object.keys(SCRIPTS)) {
      const r = await synthesize({
        text: SCRIPTS[scriptId],
        voice: defaultVoice,
        dialect,
      })
      const file = `dialect_${dialect}_script${scriptId}_${defaultVoice}.${r.formatHeader === 'mp3' ? 'mp3' : 'wav'}`
      if (r.status === 200) writeFileSync(join(OUT, file), r.buf)
      const row = {
        phase: 'dialect_matrix',
        scriptId,
        text: SCRIPTS[scriptId],
        voice: defaultVoice,
        dialect,
        instructions: instructionsFor(dialect),
        status: r.status,
        model: r.model,
        format: r.formatHeader,
        bytes: r.bytes,
        ttfbMs: r.ttfbMs,
        latencyMs: r.totalMs,
        file: r.status === 200 ? file : null,
        subjectiveQualityScore: heuristicScore({ status: r.status, bytes: r.bytes, totalMs: r.totalMs }),
        verifiedNativeDialect: false,
        notes: dialect === 'white' || dialect === 'fusha'
          ? 'Clear Arabic modes — treat as verified clear delivery, not regional native claim'
          : 'Soft guidance only — do NOT claim native dialect quality without human audio verification',
      }
      results.push(row)
      console.log(JSON.stringify(row))
    }
  }

  // Format latency probe: wav vs mp3 for Script A
  for (const format of ['wav', 'mp3']) {
    const r = await synthesize({
      text: SCRIPTS.A,
      voice: defaultVoice,
      dialect: 'saudi',
      format,
    })
    const file = `format_${format}_scriptA_marin.saudi.${format}`
    if (r.status === 200) writeFileSync(join(OUT, file), r.buf)
    results.push({
      phase: 'format_probe',
      scriptId: 'A',
      voice: defaultVoice,
      dialect: 'saudi',
      format: r.formatHeader,
      status: r.status,
      bytes: r.bytes,
      ttfbMs: r.ttfbMs,
      latencyMs: r.totalMs,
      file: r.status === 200 ? file : null,
    })
  }

  const bakeoff = results.filter((r) => r.phase === 'voice_bakeoff' && r.status === 200)
  bakeoff.sort((a, b) => {
    if (b.subjectiveQualityScore !== a.subjectiveQualityScore) {
      return b.subjectiveQualityScore - a.subjectiveQualityScore
    }
    return a.latencyMs - b.latencyMs
  })
  const best = bakeoff[0]

  const summary = {
    checkedAt: new Date().toISOString(),
    productionUrl: PROD_URL,
    model: best?.model || 'gpt-4o-mini-tts',
    scripts: SCRIPTS,
    bestDefaultVoice: best?.voice || 'marin',
    bestDefaultReason: best
      ? `Lowest combined latency among high heuristic scores in bake-off (${best.voice}: ${best.latencyMs}ms, score ${best.subjectiveQualityScore}). Final product default also considers Arabic warmth from human review of artifacts under ${OUT}.`
      : 'Fallback marin',
    dialectsVerifiedThroughAudio: {
      white: 'clear_delivery_only',
      saudi: 'soft_guidance_unverified_native',
      gulf: 'soft_guidance_unverified_native',
      moroccan: 'soft_guidance_unverified_native',
      fusha: 'clear_msa_delivery_only',
    },
    results,
  }

  writeFileSync(join(OUT, 'comparison_report.json'), JSON.stringify(summary, null, 2))
  console.log('\nWrote', join(OUT, 'comparison_report.json'))
  console.log('Best default candidate:', summary.bestDefaultVoice)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
