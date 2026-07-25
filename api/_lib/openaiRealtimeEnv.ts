/**
 * Server-only OpenAI Realtime credentials.
 * Never read VITE_* keys here — those must not hold production secrets.
 */

export type OpenAiRealtimeServerEnv = {
  apiKey: string | null
  model: string
  voice: string
  hasCredentials: boolean
}

const DEFAULT_MODEL = 'gpt-4o-realtime-preview'
const DEFAULT_VOICE = 'alloy'

export function readOpenAiRealtimeCredentials(
  env: Record<string, string | undefined> = process.env,
): OpenAiRealtimeServerEnv {
  const apiKey = (
    env.OPENAI_API_KEY
    ?? env.OPENAI_REALTIME_API_KEY
    ?? ''
  ).trim() || null

  const model = (env.OPENAI_REALTIME_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const voice = (env.OPENAI_REALTIME_VOICE ?? DEFAULT_VOICE).trim() || DEFAULT_VOICE

  return {
    apiKey,
    model,
    voice,
    hasCredentials: Boolean(apiKey),
  }
}

/** Keep in sync with src/lib/realtimeVoice/travelConsultantPrompt.ts (Edge-safe copy). */
export function buildTravelConsultantInstructions(locale: 'ar' | 'en' = 'ar'): string {
  if (locale === 'en') {
    return [
      'You are Rahhal (رحّال), an experienced travel consultant.',
      'Speak naturally; avoid interview-style questioning.',
      'Ask only necessary follow-ups. Prefer confirming what you heard.',
      'Understand Saudi, Gulf, Yemeni, Egyptian, Levant, Moroccan Arabic and mixed Arabic-English travel phrases.',
      'Help with destination ideas, flights, hotels, visas, weather, and trip planning.',
      'Tool results are mocked in this environment — narrate helpful consultant guidance from tool outputs.',
      'Keep replies concise and warm.',
    ].join(' ')
  }
  return [
    'أنت رحّال، مستشار سفر خبير وودود.',
    'تكلّم بطريقة طبيعية كمستشار، وتجنّب أسلوب المقابلة المتتالية.',
    'اسأل فقط عن المعلومات الضرورية، وفضّل تأكيد ما فهمته.',
    'افهم اللهجة السعودية والخليجية واليمنية والمصرية والشامية والمغربية والعبارات المختلطة عربي-إنجليزي.',
    'ساعد في الوجهات والطيران والفنادق والتأشيرات والطقس وتخطيط الرحلات.',
    'نتائج الأدوات في هذه البيئة تجريبية (mock) — استخدمها لتقديم نصيحة مستشار مفيدة.',
    'أبقِ الردود مختصرة ودافئة.',
  ].join(' ')
}

export function missingOpenAiRealtimeCredentialsResponse() {
  return {
    configured: false,
    code: 'OPENAI_REALTIME_SERVER_NOT_CONFIGURED' as const,
  }
}
