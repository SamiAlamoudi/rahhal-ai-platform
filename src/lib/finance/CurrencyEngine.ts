/**
 * Sprint 41 — Multi-currency FX conversion & historical rates.
 */

export class CurrencyEngine {
  private readonly rates: Record<string, number> = {
    SAR: 1,
    USD: 3.75,
    EUR: 4.05,
    GBP: 4.75,
    AED: 1.02,
  }
  private readonly history: Array<{ at: string; pair: string; rate: number }> = []

  setRate(currency: string, sarPerUnit: number): void {
    this.rates[currency.toUpperCase()] = sarPerUnit
    this.history.push({
      at: new Date().toISOString(),
      pair: `${currency.toUpperCase()}/SAR`,
      rate: sarPerUnit,
    })
  }

  convert(amount: number, from: string, to: string): number {
    const src = from.toUpperCase()
    const dst = to.toUpperCase()
    if (src === dst) return round2(amount)
    const inSar = amount * (this.rates[src] ?? 1)
    const out = inSar / (this.rates[dst] ?? 1)
    return round2(out)
  }

  rate(from: string, to: string): number {
    if (from.toUpperCase() === to.toUpperCase()) return 1
    return round4(this.convert(1, from, to))
  }

  historical(pair?: string) {
    return this.history
      .filter((h) => (pair ? h.pair === pair.toUpperCase() : true))
      .map((h) => ({ ...h }))
  }

  supported(): string[] {
    return Object.keys(this.rates)
  }
}

export function createCurrencyEngine(): CurrencyEngine {
  return new CurrencyEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
