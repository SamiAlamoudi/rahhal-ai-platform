# Command Palette — Architecture Notes

```mermaid
flowchart TB
  Registry[commandPaletteRegistry<br/>ui.command_palette]
  Root[CommandPalette]
  Registry -->|gate| Root
  Root --> Input[Global search input]
  Root --> Filters[PaletteFilters]
  Root --> Layouts[Result layouts]
  Root --> Results[PaletteResults]
  Root --> Empty[PaletteEmpty]
  State[commandPaletteState] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| Backend / APIs / indexing | None |
| AI / realtime search | None |
| Chat / Voice / Knowledge embeds | None (command labels only) |
| Light/dark + RTL | Yes |
| Reduced motion | Respected |
