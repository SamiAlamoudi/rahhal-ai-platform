# Executive Dashboard — Component Diagram

```mermaid
flowchart TB
  Registry[executiveDashboardRegistry]
  Root[ExecutiveDashboard]
  Registry -->|gate| Root

  Root --> Search[ExecutiveSearch]
  Root --> Filters[DashboardFilters]
  Root --> Metrics[ExecutiveMetrics]
  Root --> Actions[ActionCards]
  Root --> Main[Main]
  Root --> NC[NotificationCenter]

  Main --> Panels[ExecutiveDashboardPanels]
  Main --> Widgets[ExecutiveWidgets]
  Main --> Cal[CalendarPlaceholder]

  State[executiveDashboardState] -.-> Root
  Tokens[executiveTokens] -.-> Root
```

## Architecture notes

- Package: `src/ui/executiveDashboard/`  
- Feature: `ui.executive_dashboard` (OFF)  
- Light/dark + RTL via `data-theme` / `dir`  
- Motion respects `prefers-reduced-motion`  
- Action cards and calendar are placeholders — no production navigation wiring  
