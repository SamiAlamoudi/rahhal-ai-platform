import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { amadeusApiPlugin } from './src/lib/viteAmadeusApiPlugin.js'
import { ttsApiPlugin } from './src/lib/viteTtsApiPlugin.js'

/**
 * Security headers for Vite middleware.
 * Keep production profile aligned with
 * `buildSecurityHeaders()` in src/lib/ops/security/securityPolicy.ts.
 * Dev profile relaxes script-src + connect-src for React Refresh / HMR only.
 */
function securityHeaders(development: boolean): Record<string, string> {
  const scriptSrc = development
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'"
  const connectSrc = [
    "connect-src 'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://test.api.amadeus.com',
    'https://api.amadeus.com',
    // Conversation-First — OpenAI Chat Completions (ChatGPT intelligence engine)
    'https://api.openai.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    // Edge neural TTS (browser WebSocket synthesizer)
    'https://speech.platform.bing.com',
    'wss://speech.platform.bing.com',
    ...(development ? ['ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
  ].join(' ')

  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "media-src 'self' blob: data:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // microphone=(self) for STT; autoplay=(self) for HTMLAudioElement TTS after gesture.
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), autoplay=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'off',
  }
}

function applyHeaders(res: { setHeader: (k: string, v: string) => void }, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
}

/** Attach security headers for vite preview / middleware mode (Phase X). */
function securityHeadersPlugin(): Plugin {
  return {
    name: 'rahhal-security-headers',
    configurePreviewServer(server) {
      const headers = securityHeaders(false)
      server.middlewares.use((_req, res, next) => {
        applyHeaders(res, headers)
        next()
      })
    },
    configureServer(server) {
      const headers = securityHeaders(true)
      server.middlewares.use((_req, res, next) => {
        applyHeaders(res, headers)
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    securityHeadersPlugin(),
    amadeusApiPlugin(),
    ttsApiPlugin(),
  ],
  build: {
    // Documented performance budget signal (Phase X) — warn above ~900kB uncompressed chunk.
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler)([\\/]|$)/,
            },
            {
              name: 'vendor-router',
              test: /node_modules[\\/]react-router/,
            },
            {
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase/,
            },
            {
              // RC-2 — keep motion out of route entry chunks when possible
              name: 'vendor-motion',
              test: /node_modules[\\/](framer-motion|motion)([\\/]|$)/,
            },
            {
              // RC-2 — live provider adapters only when live integration is imported
              name: 'provider-amadeus',
              test: /[\\/]src[\\/](lib[\\/]agent[\\/]aggregation[\\/]providers[\\/]amadeus|integrations[\\/]providers[\\/]amadeus)/,
            },
            {
              name: 'provider-booking',
              test: /[\\/]src[\\/](lib[\\/]agent[\\/]aggregation[\\/]providers[\\/]booking|integrations[\\/]providers[\\/]booking)/,
            },
            {
              name: 'agent-impl',
              test: /[\\/]src[\\/]lib[\\/]agent[\\/]travelAgentService\.impl/,
            },
            // RC-3 — independently loadable agent / brain layers
            {
              name: 'layer-reasoning',
              test: /[\\/]src[\\/]lib[\\/]agent[\\/]reasoning([\\/]|$)/,
            },
            {
              name: 'layer-travel-planner',
              test: /[\\/]src[\\/]lib[\\/]agent[\\/]travelPlanner([\\/]|$)/,
            },
            {
              name: 'layer-brain-core',
              test: /[\\/]src[\\/]lib[\\/]brain[\\/]core([\\/]|$)/,
            },
            {
              name: 'layer-brain-executive',
              test: /[\\/]src[\\/]lib[\\/]brain[\\/]executive([\\/]|$)/,
            },
            {
              name: 'layer-conversation-intelligence',
              test: /[\\/]src[\\/]lib[\\/]agent[\\/]conversationIntelligence([\\/]|$)/,
            },
            {
              name: 'layer-conversation-brain',
              test: /[\\/]src[\\/]lib[\\/]agent[\\/]conversationBrain([\\/]|$)/,
            },
            {
              name: 'layer-agent-llm',
              test: /[\\/]src[\\/]lib[\\/]agent[\\/]llm([\\/]|$)/,
            },
          ],
        },
      },
    },
  },
})
