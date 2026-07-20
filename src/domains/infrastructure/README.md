# infrastructure

## Responsibilities

External integrations, operational tooling, repositories, and the Supabase client.

## Public API

- `src/integrations`
- `src/lib/ops`
- `src/lib/repositories`
- `supabase` from `src/lib/supabaseClient`

## Dependencies

Leaf-ish platform layer. Feature domains and `core` may depend on this. Must not import UI or feature domains.

## Rules

- Compatibility shim only.
- Do not invent new clients here until implementations move.
