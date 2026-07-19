export interface FinanceMetricsSnapshot {
  revenueRecognitions: number;
  walletOperations: number;
  settlementsCreated: number;
  settlementsPaid: number;
  invoicesIssued: number;
  refundLosses: number;
  reportsGenerated: number;
  conversationQueries: number;
  lastUpdatedAt: string | null;
}

export class FinanceMetrics {
  private snap: FinanceMetricsSnapshot = {
    revenueRecognitions: 0,
    walletOperations: 0,
    settlementsCreated: 0,
    settlementsPaid: 0,
    invoicesIssued: 0,
    refundLosses: 0,
    reportsGenerated: 0,
    conversationQueries: 0,
    lastUpdatedAt: null,
  };

  private touch(): void {
    this.snap.lastUpdatedAt = new Date().toISOString();
  }

  recordRevenue(): void {
    this.snap.revenueRecognitions += 1;
    this.touch();
  }

  recordWalletOp(): void {
    this.snap.walletOperations += 1;
    this.touch();
  }

  recordSettlementCreated(): void {
    this.snap.settlementsCreated += 1;
    this.touch();
  }

  recordSettlementPaid(): void {
    this.snap.settlementsPaid += 1;
    this.touch();
  }

  recordInvoice(): void {
    this.snap.invoicesIssued += 1;
    this.touch();
  }

  recordRefundLoss(): void {
    this.snap.refundLosses += 1;
    this.touch();
  }

  recordReport(): void {
    this.snap.reportsGenerated += 1;
    this.touch();
  }

  recordConversationQuery(): void {
    this.snap.conversationQueries += 1;
    this.touch();
  }

  snapshot(): FinanceMetricsSnapshot {
    return { ...this.snap };
  }

  reset(): void {
    this.snap = {
      revenueRecognitions: 0,
      walletOperations: 0,
      settlementsCreated: 0,
      settlementsPaid: 0,
      invoicesIssued: 0,
      refundLosses: 0,
      reportsGenerated: 0,
      conversationQueries: 0,
      lastUpdatedAt: null,
    };
  }
}
