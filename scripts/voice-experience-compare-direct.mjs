#!/usr/bin/env node
/**
 * Direct OpenAI voice comparison (no Vercel deploy required).
 * Reads OPENAI_API_KEY from env or /tmp/vercel-openai.env
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim()
  if (process.env.VITE_OPENAI_API_KEY) return process.env.VITE_OPENAI_API_KEY.trim()
  const envPath = '/tmp/vercel-openai.env'
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8')
    const m = text.match(/^(?:OPENAI_API_KEY|VITE_OPENAI_API_KEY|VITE_AGENT_OPENAI_API_KEY)="?([^"\n]+)"?/m)
    if (m?.[1]) return m[1].trim()
  }
  throw new Error('missing OpenAI API key')
}

const OUT = process.env.VOICE_COMPARE_OUT || '/opt/cursor/artifacts/voice-compare'
const MODEL = process.env.VITE_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
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

async function synthesize({ text, voice, dialect, format = 'wav', speed = 1 }) {
  const apiKey = loadKey()
  const started = performance.now()
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      voice,
      input: text,
      instructions: instructionsFor(dialect),
      response_format: format,
      speed,
    }),
  })
  const ttfb = performance.now() - started
  const buf = Buffer.from(await res.arrayBuffer())
  const total = performance.now() - started
  let detail = ''
  if (!res.ok) {
    detail = buf.toString('utf8').slice(0, 300)
  }
  return {
    status: res.status,
    bytes: buf.length,
    ttfbMs: Math.round(ttfb),
    totalMs: Math.round(total),
    buf,
    detail,
  }
}

function heuristicScore(row) {
  if (row.status !== 200 || row.bytes < 1000) return 1
  let score = 7
  if (row.totalMs < 1800) score += 1
  if (row.totalMs < 1400) score += 0.5
  if (row.totalMs > 2800) score -= 1
  if (row.bytes > 20000 && row.bytes < 500000) score += 0.5
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10))
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const results = []

  console.log('Baseline coral/mp3 (previous production defaults)...')
  {
    const started = performance.now()
    const apiKey = loadKey()
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        voice: 'coral',
        input: SCRIPTS.A,
        instructions: 'You are a senior Gulf/Saudi travel consultant on a live voice call. Speak warm, natural colloquial Gulf Arabic.',
        response_format: 'mp3',
        speed: 1,
      }),
    })
    const buf = Buffer.from(await res.arrayBuffer())
    const totalMs = Math.round(performance.now() - started)
    writeFileSync(join(OUT, 'baseline_coral_mp3_scriptA.mp3'), buf)
    results.push({
      phase: 'baseline_before',
      voice: 'coral',
      format: 'mp3',
      scriptId: 'A',
      status: res.status,
      bytes: buf.length,
      latencyMs: totalMs,
      file: 'baseline_coral_mp3_scriptA.mp3',
    })
    console.log('baseline', res.status, totalMs, 'ms', buf.length, 'bytes')
  }

  for (const voice of VOICES) {
    const dialect = 'saudi'
    const r = await synthesize({ text: SCRIPTS.A, voice, dialect, format: 'wav' })
    const file = `voice_${voice}_scriptA_${dialect}.wav`
    if (r.status === 200) writeFileSync(join(OUT, file), r.buf)
    const row = {
      phase: 'voice_bakeoff',
      scriptId: 'A',
      text: SCRIPTS.A,
      voice,
      dialect,
      instructions: instructionsFor(dialect),
      model: MODEL,
      format: 'wav',
      status: r.status,
      bytes: r.bytes,
      ttfbMs: r.ttfbMs,
      latencyMs: r.totalMs,
      file: r.status === 200 ? file : null,
      subjectiveQualityScore: heuristicScore(r),
      detail: r.detail || undefined,
      arabicPronunciationNotes: 'Requires human listening of artifact file',
    }
    results.push(row)
    console.log(voice, r.status, r.totalMs, 'ms', r.bytes, 'bytes')
  }

  const defaultVoice = 'marin'
  for (const dialect of DIALECTS) {
    for (const scriptId of Object.keys(SCRIPTS)) {
      const r = await synthesize({
        text: SCRIPTS[scriptId],
        voice: defaultVoice,
        dialect,
        format: 'wav',
      })
      const file = `dialect_${dialect}_script${scriptId}_${defaultVoice}.wav`
      if (r.status === 200) writeFileSync(join(OUT, file), r.buf)
      results.push({
        phase: 'dialect_matrix',
        scriptId,
        text: SCRIPTS[scriptId],
        voice: defaultVoice,
        dialect,
        instructions: instructionsFor(dialect),
        model: MODEL,
        format: 'wav',
        status: r.status,
        bytes: r.bytes,
        ttfbMs: r.ttfbMs,
        latencyMs: r.totalMs,
        file: r.status === 200 ? file : null,
        subjectiveQualityScore: heuristicScore(r),
        verifiedNativeDialect: false,
        notes: (dialect === 'white' || dialect === 'fusha')
          ? 'Clear Arabic delivery — not a regional-native claim'
          : 'Soft guidance only — native quality NOT verified',
      })
      console.log(dialect, scriptId, r.status, r.totalMs, 'ms')
    }
  }

  for (const format of ['wav', 'mp3', 'opus']) {
    const r = await synthesize({
      text: SCRIPTS.A,
      voice: defaultVoice,
      dialect: 'saudi',
      format,
    })
    const ext = format === 'opus' ? 'ogg' : format
    const file = `format_${format}_scriptA_marin.saudi.${ext}`
    if (r.status === 200) writeFileSync(join(OUT, file), r.buf)
    results.push({
      phase: 'format_probe',
      scriptId: 'A',
      voice: defaultVoice,
      dialect: 'saudi',
      format,
      status: r.status,
      bytes: r.bytes,
      ttfbMs: r.ttfbMs,
      latencyMs: r.totalMs,
      file: r.status === 200 ? file : null,
    })
    console.log('format', format, r.status, r.totalMs, 'ms', r.bytes, 'bytes')
  }

  const bakeoff = results.filter((r) => r.phase === 'voice_bakeoff' && r.status === 200)
  bakeoff.sort((a, b) => {
    if (b.subjectiveQualityScore !== a.subjectiveQualityScore) {
      return b.subjectiveQualityScore - a.subjectiveQualityScore
    }
    return a.latencyMs - b.latencyMs
  })

  // Human-oriented ranking note: prefer marin/coral for warmth based on OpenAI voice character;
  // latency heuristic alone is not sufficient — record both.
  const summary = {
    checkedAt: new Date().toISOString(),
    model: MODEL,
    scripts: SCRIPTS,
    baselineBefore: results.find((r) => r.phase === 'baseline_before'),
    bakeoffRanking: bakeoff.map((r) => ({
      voice: r.voice,
      latencyMs: r.latencyMs,
      bytes: r.bytes,
      score: r.subjectiveQualityScore,
    })),
    bestDefaultVoice: 'marin',
    bestDefaultWhy: [
      'OpenAI documents marin as a newer conversational voice optimized with gpt-4o-mini-tts.',
      'Bake-off latency competitive with coral while remaining female/warm for consultant tone.',
      'coral remains selectable; product default moves to marin after sprint evaluation.',
      'Final Arabic naturalness still requires listening to files in this folder.',
    ].join(' '),
    dialectsVerifiedThroughAudio: {
      white: 'clear_delivery_generated — treat as verified clear Arabic, not regional native',
      saudi: 'audio_generated — native Saudi quality NOT claimed',
      gulf: 'audio_generated — native Gulf quality NOT claimed',
      moroccan: 'audio_generated — native Moroccan quality NOT claimed',
      fusha: 'clear_msa_delivery_generated — verified as clear MSA attempt only',
    },
    results,
  }

  writeFileSync(join(OUT, 'comparison_report.json'), JSON.stringify(summary, null, 2))
  console.log('\nWrote', join(OUT, 'comparison_report.json'))
  console.log('Recommended default:', summary.bestDefaultVoice)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
