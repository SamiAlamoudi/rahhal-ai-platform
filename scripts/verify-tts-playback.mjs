import { chromium } from '@playwright/test'
import fs from 'fs'

const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 })
const result = await page.evaluate(async () => {
  const text = 'ميزانيتكم ممتازة لرحلة أسبوع إلى المغرب. إذا كنتم تبحثون عن الاسترخاء فأرشح أكادير.'
  let blob
  let path = 'api'
  try {
    const mod = await import('/@fs/workspace/node_modules/edge-tts-universal/dist/browser.js')
    const EdgeTTSBrowser = mod.EdgeTTSBrowser
    const tts = new EdgeTTSBrowser(text, 'ar-SA-ZariyahNeural', { rate: '-5%' })
    const synthesized = await tts.synthesize()
    blob = synthesized.audio instanceof Blob ? synthesized.audio : new Blob([await synthesized.audio.arrayBuffer()], { type: 'audio/mpeg' })
    path = 'edge-browser'
  } catch (e) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale: 'ar' }),
    })
    if (!res.ok) return { ok: false, stage: 'fetch', status: res.status, err: String(e), body: await res.text() }
    blob = await res.blob()
  }
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  const playing = await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, stage: 'timeout', path, currentTime: audio.currentTime, paused: audio.paused, blobSize: blob.size }), 12000)
    audio.onplaying = () => {
      setTimeout(() => {
        clearTimeout(t)
        resolve({
          ok: !audio.paused && audio.currentTime > 0,
          stage: 'playing',
          path,
          currentTime: audio.currentTime,
          duration: audio.duration,
          paused: audio.paused,
          blobSize: blob.size,
        })
      }, 900)
    }
    audio.onerror = () => { clearTimeout(t); resolve({ ok: false, stage: 'error', path, blobSize: blob.size }) }
    audio.play().catch((err) => { clearTimeout(t); resolve({ ok: false, stage: 'play_reject', path, err: String(err), blobSize: blob.size }) })
  })
  try { audio.pause() } catch {}
  return playing
})
console.log(JSON.stringify(result, null, 2))
fs.writeFileSync('/tmp/tts_play_result.json', JSON.stringify(result, null, 2))
await browser.close()
if (!result.ok) process.exit(1)
