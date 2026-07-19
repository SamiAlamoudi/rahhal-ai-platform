# Sprint 41 — Universal Revenue, Finance & Settlement Platform

Post-booking financial backbone for Rahhal: revenue recognition, wallets, settlements, double-entry accounting, invoices, tax/FX, and reports.

## Non-goals

- This is **not** a payment gateway (Sprint 34 payments remain authoritative for checkout)
- Does not replace supplier marketplace contracts or booking execution
- Sandbox FX/tax adapters only — no live banking rails in this sprint

## Architecture

```
Conversation / ops tools
  → FinancePlatform
       ├─ RevenueEngine (+ Commission / Markup / Promo / Corporate / Affiliate)
       ├─ WalletEngine
       ├─ SettlementEngine (+ CurrencyEngine)
       ├─ LedgerEngine + AccountingEngine
       ├─ InvoiceService + TaxEngine
       ├─ FinancialReports + RevenueAnalytics
       └─ Audit / Events / Metrics
```

## Capabilities

| Area | Support |
|------|---------|
| Revenue | Supplier/agency/affiliate commission, Rahhal markup, corporate/coupon/promo discounts, cashback, points, wallet, partial pay, taxes, fees |
| Pricing channels | B2C, B2B, corporate, VIP, membership, country & dynamic/promo pricing |
| Wallets | Customer, corporate, supplier, refund, travel credit, reward — deposit/withdraw/freeze/release/transfer/rollback/expiration |
| Settlement | Daily/weekly/monthly/manual/automatic/partial + multi-currency FX |
| Accounting | Double-entry ledger, payables/receivables, revenue, expenses, refund losses, tax, commission |
| Documents | Invoice, receipt, credit/debit notes, settlement report, supplier/customer/corporate statements |
| Tax | VAT, GST, sales tax, country adapters, custom providers |
| Reports | Revenue, profit, margin, commission, refunds, wallets, outstanding, sales by country/provider/destination/service, tops, VAT |

## Conversation examples

- "How much revenue did Rahhal generate this month?"
- "What was our profit from Paris?"
- "Which supplier produced the highest margin?"
- "Show unpaid settlements."
- "Show refund losses."
- "How much VAT should be reported?"

## Feature flag

| ID | Default | Depends on |
|----|---------|------------|
| `brain.finance_platform` | **OFF** | `brain.supplier_marketplace` |

## Modules

`src/lib/finance/`

## Tests

`src/lib/__tests__/financePlatform.sprint41.test.ts`
