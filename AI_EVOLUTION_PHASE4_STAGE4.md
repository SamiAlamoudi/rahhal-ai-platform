# AI Evolution — Phase 4 Stage 4

## Knowledge Center

| Field | Value |
|-------|-------|
| Flag | `ui.knowledge_center` |
| Default | **OFF** |
| Depends on | `ui.application_shell` |
| Package | `src/ui/knowledgeCenter/` |
| Production wiring | **None** |
| Inside Chat / Voice | **No** |
| Books | Dedicated section only here |
| Runtime Coordinator | **Not wired** |
| Conversation Orchestrator | **Not wired** |
| Voice Center | **Not wired** |
| RAG / embeddings / search APIs | **None** |

### Delivered

- Knowledge Center UI with all main sections  
- Document types + filters/search chrome  
- Dedicated Books shelf (two reserved slots)  
- Reader placeholders (PDF / book / image)  
- Smart panels + organization bar  
- Docs: navigation, components/reader, validation  
- New tests only  

### Explicit non-goals

No merge · no prior-PR edits · no knowledge loading · no embeddings/vector DB/RAG · no search APIs · no cloud storage · no OCR · no AI/backend.

### Validation

```bash
npm run lint
npm run typecheck
npm run arch:circular
npm run test:run
```

See `AI_KNOWLEDGE_CENTER_VALIDATION.md`.
