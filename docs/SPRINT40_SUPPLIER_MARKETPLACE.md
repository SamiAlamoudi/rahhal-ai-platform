# Sprint 40 — Universal Supplier Marketplace & Contract Platform

B2B supplier onboarding, contracts, inventory, performance scoring, AI ranking, and dashboard analytics for every travel supplier type.

## Non-goals

- Do not replace existing provider adapters, booking execution, payments, or search stacks
- Marketplace is an additive commercial/ops layer with sandbox demos
- No live supplier portal UI in this sprint — APIs + conversation preferences

## Architecture

```
Conversation / ops tools
  → SupplierMarketplace
       ├─ SupplierOnboarding (KYC + approval workflow)
       ├─ ContractManagement
       ├─ InventoryEngine
       ├─ SupplierPerformanceEngine
       ├─ SupplierRankingEngine
       ├─ SupplierDashboard
       └─ Explainer + Events + Metrics
```

## Supplier types

Airlines · Hotels · Car rental · Activities · Cruises · Insurance · Visa providers · Airport transfers · Rail · Bus · Future

## Conversation examples

- "Book only trusted suppliers."
- "Use premium hotel providers."
- "Avoid suppliers with poor refund history."
- "Choose suppliers with fastest confirmation."

## Feature flag

| ID | Default | Depends on |
|----|---------|------------|
| `brain.supplier_marketplace` | **OFF** | `brain.travel_documents` |

## Modules

`src/lib/suppliers/`

## Tests

`src/lib/__tests__/supplierMarketplace.sprint40.test.ts`
