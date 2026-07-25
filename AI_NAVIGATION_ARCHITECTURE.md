# Navigation Architecture — Phase 6 Stage 1

**Package:** `src/ui/integrationFoundation/`

## Registries

| Registry | Role |
|----------|------|
| `NavigationRegistry` | Developer + demo nav items |
| `RouteRegistry` | Virtual `/dev/integration/*` routes (not production Router) |
| `LayoutManager` | Sidebar + preview frame + page transition class |

## Developer screens

- Developer navigation
- Demo navigation
- Module preview pages
- Feature flag toggle (local overrides)
- Module status
- Dependency graph
- Architecture overview

## Isolation

Virtual routes live under `/dev/integration/*` in the registry metadata only.  
**Not mounted** in production `main.tsx` / React Router.
