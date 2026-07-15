import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_PAYMENT_PROVIDER: 'mock',
      VITE_CHAT_PROVIDER: 'mock',
      VITE_AGENT_LLM_PROVIDER: 'local',
      VITE_VOICE_STT_PROVIDER: 'mock',
      VITE_VOICE_TTS_PROVIDER: 'mock',
    },
  },
})
