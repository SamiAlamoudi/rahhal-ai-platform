/**
 * Sprint 41 — Multi-wallet engine (customer/corporate/supplier/refund/credit/reward).
 */

import type { WalletAccount, WalletKind, WalletOp, WalletTxn } from './types'

export class WalletEngine {
  private readonly wallets = new Map<string, WalletAccount>()
  private readonly txns: WalletTxn[] = []

  open(ownerId: string, kind: WalletKind, currency = 'SAR', expiresAt?: string | null): WalletAccount {
    const existing = [...this.wallets.values()].find(
      (w) => w.ownerId === ownerId && w.kind === kind && w.currency === currency,
    )
    if (existing) return clone(existing)
    const wallet: WalletAccount = {
      walletId: `wal_${Math.random().toString(36).slice(2, 10)}`,
      ownerId,
      kind,
      balance: 0,
      frozen: 0,
      currency,
      expiresAt: expiresAt ?? null,
    }
    this.wallets.set(wallet.walletId, wallet)
    return clone(wallet)
  }

  get(walletId: string): WalletAccount | null {
    const w = this.wallets.get(walletId)
    return w ? clone(w) : null
  }

  list(ownerId?: string): WalletAccount[] {
    return [...this.wallets.values()]
      .filter((w) => (ownerId ? w.ownerId === ownerId : true))
      .map(clone)
  }

  deposit(walletId: string, amount: number, note = 'deposit'): WalletTxn | { ok: false; message: string } {
    return this.apply(walletId, 'deposit', Math.abs(amount), note)
  }

  withdraw(walletId: string, amount: number, note = 'withdraw'): WalletTxn | { ok: false; message: string } {
    return this.apply(walletId, 'withdraw', -Math.abs(amount), note)
  }

  freeze(walletId: string, amount: number, note = 'freeze'): WalletTxn | { ok: false; message: string } {
    const w = this.wallets.get(walletId)
    if (!w) return { ok: false, message: 'Wallet not found' }
    const value = Math.abs(amount)
    if (w.balance < value) return { ok: false, message: 'Insufficient funds to freeze' }
    w.balance = round2(w.balance - value)
    w.frozen = round2(w.frozen + value)
    return this.record(w, 'freeze', value, note)
  }

  release(walletId: string, amount: number, note = 'release'): WalletTxn | { ok: false; message: string } {
    const w = this.wallets.get(walletId)
    if (!w) return { ok: false, message: 'Wallet not found' }
    const value = Math.abs(amount)
    if (w.frozen < value) return { ok: false, message: 'Insufficient frozen funds' }
    w.frozen = round2(w.frozen - value)
    w.balance = round2(w.balance + value)
    return this.record(w, 'release', value, note)
  }

  transfer(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    note = 'transfer',
  ): WalletTxn | { ok: false; message: string } {
    const out = this.withdraw(fromWalletId, amount, note)
    if ('ok' in out) return out
    const inn = this.deposit(toWalletId, amount, note)
    if ('ok' in inn) {
      this.deposit(fromWalletId, amount, 'transfer rollback')
      return inn
    }
    return out
  }

  rollback(txnId: string, note = 'rollback'): WalletTxn | { ok: false; message: string } {
    const original = this.txns.find((t) => t.txnId === txnId)
    if (!original) return { ok: false, message: 'Txn not found' }
    return this.apply(original.walletId, 'rollback', -original.amount, note, txnId)
  }

  expire(walletId: string, note = 'expiration'): WalletTxn | { ok: false; message: string } {
    const w = this.wallets.get(walletId)
    if (!w) return { ok: false, message: 'Wallet not found' }
    if (w.expiresAt && new Date(w.expiresAt).getTime() > Date.now()) {
      return { ok: false, message: 'Wallet not expired yet' }
    }
    const amount = w.balance
    w.balance = 0
    return this.record(w, 'expiration', -amount, note)
  }

  totalsByKind(): Record<WalletKind, number> {
    const out: Record<WalletKind, number> = {
      customer: 0,
      corporate: 0,
      supplier: 0,
      refund: 0,
      travel_credit: 0,
      reward: 0,
    }
    for (const w of this.wallets.values()) out[w.kind] = round2(out[w.kind] + w.balance)
    return out
  }

  history(walletId: string): WalletTxn[] {
    return this.txns.filter((t) => t.walletId === walletId).map((t) => ({ ...t }))
  }

  private apply(
    walletId: string,
    op: WalletOp,
    signedAmount: number,
    note: string,
    relatedTxnId?: string,
  ): WalletTxn | { ok: false; message: string } {
    const w = this.wallets.get(walletId)
    if (!w) return { ok: false, message: 'Wallet not found' }
    const next = round2(w.balance + signedAmount)
    if (next < 0) return { ok: false, message: 'Insufficient funds' }
    w.balance = next
    return this.record(w, op, signedAmount, note, relatedTxnId)
  }

  private record(
    w: WalletAccount,
    op: WalletOp,
    amount: number,
    note: string,
    relatedTxnId?: string,
  ): WalletTxn {
    const txn: WalletTxn = {
      txnId: `wtx_${Math.random().toString(36).slice(2, 10)}`,
      walletId: w.walletId,
      op,
      amount,
      balanceAfter: w.balance,
      note,
      at: new Date().toISOString(),
      relatedTxnId: relatedTxnId ?? null,
    }
    this.txns.push(txn)
    return { ...txn }
  }
}

export function createWalletEngine(): WalletEngine {
  return new WalletEngine()
}

function clone(w: WalletAccount): WalletAccount {
  return { ...w }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
