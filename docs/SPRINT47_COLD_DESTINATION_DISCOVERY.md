# Sprint 47 — Cold Destination Discovery Expansion

Expand the travel reasoning catalog so open-ended *“somewhere cold”* asks surface the destinations travelers actually expect — with explanations.

## Mission alignment

> User: “I want somewhere cold.”  
> AI recommends Japan / Switzerland / Austria / Norway / Canada / New Zealand — and explains why.

## Added destinations

| ID | Name | Why it matters |
|----|------|----------------|
| `switzerland` | Switzerland | Alpine cold winters |
| `austria` | Austria | Central European winter |
| `norway` | Norway | Nordic cold most of year |
| `canada` | Canada | Strong winter climate |
| `new-zealand` | New Zealand | **Southern winter** (Jun–Aug cold) |
| `sapporo` | Sapporo | Cold Japan (Hokkaido) |
| `iceland` | Iceland | Year-round cool/cold |

Alias resolution: Japan→Tokyo, Queenstown→New Zealand, Zurich→Switzerland, etc.

Extraction aliases added so locking a recommended country works in AR/EN chat.

## Seasonal intelligence

- Northern winter (Dec–Feb): Switzerland, Norway, Austria, Iceland, Sapporo, Canada rank up.
- Southern winter (Jun–Aug): New Zealand ranks for “cold” while Gulf summer spots stay down.

## Tests

`src/lib/__tests__/coldDestinationDiscovery.sprint47.test.ts`
