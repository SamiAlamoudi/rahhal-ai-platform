# Conversation Center — Design Documentation

**Phase 4 Stage 2** · UI architecture only · Flag `ui.conversation_center` OFF

## Visual direction

- Deep teal / slate atmospheric gradient behind the shell (not flat white, not purple-indigo AI cliché).  
- IBM Plex Sans Arabic–forward type stack for RTL-first presence.  
- Large calm thread column; sidebar as dark glass panel; composer as floating dock.  
- Brand signal: Rahhal copy in empty state + composer placeholder — hero of the empty first viewport is the product name + one prompt.

## Layout principles

1. **One composition** — sidebar + thread + dock read as a single ChatGPT/Claude-quality workspace.  
2. **No cards in the hero empty state** — empty state is typography + short supporting line only.  
3. **Cards only for interactive message content** (travel / expandable placeholders).  
4. **Smart spacing** — constrained thread/composer max width (`48rem`), generous message gap.  
5. **Responsive** — sidebar stacks above thread under `900px`.

## Tokens

See `CONVERSATION_TOKENS` / `conversationTokenCssVariables()`:

- Sidebar width, composer/thread max width, bubble radius  
- Animation: message appear `220ms`, typing pulse `900ms`, card expand `280ms`  
- Role colors mapped to shell-compatible CSS variables with local fallbacks  

## Motion (intentional)

1. Message appear (`rahhal-cc-appear`)  
2. Streaming / typing pulse (`rahhal-cc-typing`)  
3. Card expand body fade-in  
4. Smooth thread scroll + jump-to-latest control  

## Accessibility

- `role="log"` + `aria-live` on message list  
- Search label (sr-only)  
- `aria-expanded` on expandable cards  
- `dir` from locale (`ar` → RTL)

## Out of scope (by design)

Booking CTAs · live maps · payment UI · speech recognition · knowledge readers · real streaming AI.
