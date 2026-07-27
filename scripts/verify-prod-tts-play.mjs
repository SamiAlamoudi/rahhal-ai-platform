import { chromium } from '@playwright/test'
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.goto('https://rahhal-ai-platform.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 60000 })
const result = await page.evaluate(async () => {
  const text = 'ميزانيتكم ممتازة لرحلة أسبوع إلى المغرب. إذا كنتم تبحثون عن الاسترخاء فأرشح أكادير، أما للثقافة فمراكش خيار رائع.'
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, locale: 'ar' }),
  })
  if (!res.ok) return { ok: false, stage: 'fetch', status: res.status, body: await res.text() }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  const playing = await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, stage: 'timeout', currentTime: audio.currentTime, paused: audio.paused, blobSize: blob.size }), 15000)
    audio.onplaying = () => {
      setTimeout(() => {
        clearTimeout(t)
        resolve({
          ok: !audio.paused && audio.currentTime > 0,
          stage: 'playing',
          currentTime: audio.currentTime,
          duration: audio.duration,
          paused: audio.paused,
          blobSize: blob.size,
          provider: res.headers.get('x-rahhal-tts-provider'),
        })
      }, 1200)
    }
    audio.onerror = () => { clearTimeout(t); resolve({ ok: false, stage: 'error', blobSize: blob.size }) }
    audio.play().catch((err) => { clearTimeout(t); resolve({ ok: false, stage: 'play_reject', err: String(err), blobSize: blob.size }) })
  })
  try { audio.pause() } catch {}
  return playing
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
if (!result.ok) process.exit(1)
