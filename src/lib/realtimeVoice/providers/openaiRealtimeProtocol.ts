/**
 * OpenAI Realtime protocol helpers + mock travel tool definitions.
 * Additive — no live supplier APIs; tools execute via Agent Runtime mocks.
 */

import type { ToolDecisionKind } from '../../agent/llmBrain'
import { buildTravelConsultantInstructions } from '../travelConsultantPrompt'

export type OpenAiRealtimeSessionCredentials = {
  client_secret: string
  expires_at: number | null
  model: string
  voice: string
  locale: 'ar' | 'en'
  ws_url: string
}

export const MOCK_TRAVEL_TOOLS = [
  {
    type: 'function' as const,
    name: 'search_flights',
    description: 'Search flights (mock results only in this sprint).',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
        date: { type: 'string' },
      },
      required: ['destination'],
    },
  },
  {
    type: 'function' as const,
    name: 'search_hotels',
    description: 'Search hotels (mock results only in this sprint).',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        check_in: { type: 'string' },
        nights: { type: 'number' },
      },
      required: ['destination'],
    },
  },
  {
    type: 'function' as const,
    name: 'visa_info',
    description: 'Visa guidance for a destination (mock).',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        nationality: { type: 'string' },
      },
      required: ['destination'],
    },
  },
  {
    type: 'function' as const,
    name: 'weather',
    description: 'Weather snapshot for a destination (mock).',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        month: { type: 'string' },
      },
      required: ['destination'],
    },
  },
  {
    type: 'function' as const,
    name: 'plan_trip',
    description: 'Build a high-level trip plan outline (mock).',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        days: { type: 'number' },
        budget: { type: 'string' },
      },
      required: ['destination'],
    },
  },
]

export function mapToolNameToDecision(name: string): ToolDecisionKind {
  switch (name) {
    case 'search_flights':
      return 'search_flights'
    case 'search_hotels':
      return 'search_hotels'
    case 'visa_info':
      return 'need_visa'
    case 'weather':
      return 'need_weather'
    case 'plan_trip':
      return 'need_itinerary'
    default:
      return 'none'
  }
}

export function buildSessionUpdateEvent(locale: 'ar' | 'en'): Record<string, unknown> {
  return {
    type: 'session.update',
    session: {
      instructions: buildTravelConsultantInstructions(locale),
      modalities: ['text', 'audio'],
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
        create_response: true,
        interrupt_response: true,
      },
      tools: MOCK_TRAVEL_TOOLS,
      tool_choice: 'auto',
    },
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  if (typeof btoa === 'function') return btoa(binary)
  return Buffer.from(bytes).toString('base64')
}

export function parseRealtimeEvent(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export type MockWsMessageHandler = (data: string) => void

/** Minimal WebSocket-like surface for tests / browser. */
export interface RealtimeSocket {
  readyState: number
  send: (data: string) => void
  close: () => void
  addEventListener: (type: string, listener: (ev: { data?: string }) => void) => void
  removeEventListener?: (type: string, listener: (ev: { data?: string }) => void) => void
}

export const WS_OPEN = 1
