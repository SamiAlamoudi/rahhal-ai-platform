# AI Evolution — Phase 4 Stage 2

## Premium AI Conversation Center

| Field | Value |
|-------|-------|
| Flag | `ui.conversation_center` |
| Default | **OFF** |
| Depends on | `ui.application_shell` |
| Package | `src/ui/conversationCenter/` |
| Production wiring | **None** |
| Runtime Coordinator | **Not wired** |
| Conversation Orchestrator | **Not wired** |
| AI / APIs / networking | **None** |

### Delivered

- Professional conversation layout (sidebar + large thread + floating composer)  
- Full message-kind + travel-card placeholder catalog  
- Thread history features (search, pin, archive, rename, delete, favorite, unread, export/share placeholders)  
- Message features (copy/like/dislike/regenerate/expand/collapse/references placeholder/confidence/timestamp/streaming placeholder)  
- Composer auto-grow + quick actions + external nav placeholders  
- Empty states + motion tokens  
- Isolation: Voice / Knowledge / Books **outside** Chat  
- Docs + component diagram + design notes + validation report  
- New tests only  

### Explicit non-goals

No merge · no prior-PR edits · no AI · no backend · no speech runtime · no knowledge loading · no booking/payments/maps.

### Validation commands

```bash
npm run lint
npm run typecheck
npm run arch:circular
npm run test:run
```

See `AI_CONVERSATION_CENTER_VALIDATION.md` for the run report.
