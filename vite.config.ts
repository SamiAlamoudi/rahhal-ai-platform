import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    ...(development ? ['ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
  ].join(' ')

  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // microphone=(self) required for Home / Chat Web Speech on Safari & Chrome.
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
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
  plugins: [react(), tailwindcss(), securityHeadersPlugin()],
  build: {
    // Documented performance budget signal (Phase X) — warn above ~900kB uncompressed chunk.
    chunkSizeWarningLimit: 900,
  },
})
