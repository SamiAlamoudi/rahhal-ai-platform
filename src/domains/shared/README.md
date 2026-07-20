# shared

## Responsibilities

Leaf-safe shared contracts (provider/model registries) and shared DB row / app types.

## Public API

- `src/utils/contracts`
- `src/lib/types` (type-only re-export)

## Dependencies

Should remain a leaf: avoid depending on feature domains. May use minimal infrastructure types only if unavoidable.

## Rules

- Keep this domain free of feature-domain imports.
- Compatibility shim only.
