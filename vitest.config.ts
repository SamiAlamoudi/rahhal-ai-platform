import { defineConfig } from 'vitest/config'

/**
 * Isolate unit tests from developer `.env.local` (live adapter flags, demo auth, etc.).
 * Provider suites assert mock defaults / auto-enable behavior and must not inherit a
 * machine-local SPA profile.
 */
export default defineConfig({
  envDir: false,
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
      VITE_LIVE_PROVIDERS_ENABLED: 'false',
      VITE_PROVIDER_MOCK_FALLBACK: 'true',
      VITE_DEMO_AUTH: 'false',
      // Clear adapter selection so registry auto-enable tests own the flags.
      VITE_FLIGHT_ADAPTER: '',
      VITE_FLIGHT_PROVIDER: '',
      VITE_AMADEUS_ENABLED: '',
      VITE_HOTEL_ADAPTER: '',
      VITE_BOOKING_PROVIDER: '',
      VITE_RAPIDAPI_KEY: '',
      VITE_WEATHER_ADAPTER: '',
      VITE_WEATHER_PROVIDER: '',
      VITE_MAPS_PROVIDER: '',
      // Multi-provider is production-default; unit suites exercise the legacy
      // single-adapter path unless a test opts in explicitly.
      VITE_MULTI_PROVIDER_ENABLED: 'false',
      VITE_FLIGHT_PROVIDER_CHAIN: '',
    },
  },
})
