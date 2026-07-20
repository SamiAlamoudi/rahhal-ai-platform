# Sprint 58 — Payments & Ticketing Platform

Agent-scoped payments layer (mock adapters only — no real gateways).

## Flow

Booking Execution → Payment authorize/capture → Ticketing → Document Center

## Feature flags

| Flag | Default |
| --- | --- |
| `ai.payments` | ON |
| `ai.ticketing` | ON |
| `ai.refunds` | ON |

## Methods

card, apple_pay, google_pay, mada, stc_pay, tabby, tamara, bank_transfer

## Module

`src/lib/agent/paymentsPlatform/`
