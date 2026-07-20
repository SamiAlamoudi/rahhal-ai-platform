export type FinanceEventName =
  | "finance.revenue.recognized"
  | "finance.wallet.updated"
  | "finance.settlement.created"
  | "finance.settlement.paid"
  | "finance.invoice.issued"
  | "finance.refund_loss.recorded"
  | "finance.report.generated";

export interface FinanceEvent {
  name: FinanceEventName;
  at: string;
  payload: Record<string, unknown>;
}

export type FinanceEventHandler = (event: FinanceEvent) => void;

export class FinanceEvents {
  private readonly handlers = new Map<FinanceEventName | "*", Set<FinanceEventHandler>>();
  private readonly history: FinanceEvent[] = [];

  on(name: FinanceEventName | "*", handler: FinanceEventHandler): () => void {
    const set = this.handlers.get(name) ?? new Set();
    set.add(handler);
    this.handlers.set(name, set);
    return () => set.delete(handler);
  }

  emit(name: FinanceEventName, payload: Record<string, unknown> = {}): FinanceEvent {
    const event: FinanceEvent = { name, at: new Date().toISOString(), payload };
    this.history.push(event);
    for (const h of this.handlers.get(name) ?? []) h(event);
    for (const h of this.handlers.get("*") ?? []) h(event);
    return event;
  }

  list(): FinanceEvent[] {
    return [...this.history];
  }

  clear(): void {
    this.history.length = 0;
  }
}
