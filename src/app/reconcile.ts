// ─────────────────────────────────────────────────────────────────────────────
// Reconcile the Ledger's "net cash movement" against the Dashboard's
// "total cash available".
//
// They are different measures by design:
//   Ledger net     = everything recorded as money in  - everything recorded as money out
//   Dashboard cash = Biz balance + each member's balance, counting POSITIVE balances only
//
// This module computes the dashboard figure with the exact same rules as
// Dashboard.tsx, then explains any gap by finding the entries behind it.
// ─────────────────────────────────────────────────────────────────────────────
import type { Transaction, Person } from './types';
import { pStats, saleReceiver } from './utils';
import { buildLedgerRows, totals } from './ledgerExport';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Biz Saving balance — identical to Dashboard.tsx. */
export function bizBalanceOf(txs: Transaction[]): number {
  let bal = 0;
  for (const t of txs) {
    if (t.type === 'transfer') {
      if (t.transferTo === 'biz') bal += t.amount;
      if (t.transferFrom === 'biz') bal -= t.amount;
    }
    if (t.type === 'income' && saleReceiver(t as any) === 'biz') bal += t.amount;
    if (t.type === 'salary' && t.salaryPaidBy === 'biz') bal -= t.amount;
    if (t.type === 'expense' && t.person === 'biz') bal -= t.amount;
    if (t.type === 'owner-fund' && t.ownerReceiver === 'biz') bal += t.amount;
    if (t.type === 'fund-return' && t.frSender === 'biz') bal -= t.amount;
    if (t.type === 'credit') {
      if (Array.isArray(t.payments) && t.payments.length > 0) {
        for (const p of t.payments) if (p.receiver === 'biz') bal += p.amount;
      } else if (t.creditReceiver === 'biz' && (t.creditPaid || 0) > 0) {
        bal += t.creditPaid || 0;
      }
    }
  }
  return bal;
}

export interface AccountBalance { id: string; name: string; balance: number; isBiz: boolean }

export function accountBalances(txs: Transaction[], people: Person[]): AccountBalance[] {
  const out: AccountBalance[] = [{ id: 'biz', name: 'Biz Saving', balance: bizBalanceOf(txs), isBiz: true }];
  for (const p of people) {
    if (p.id === 'biz') continue;
    if ((p.role || '').toLowerCase().includes('owner')) continue;
    out.push({ id: p.id, name: p.name, balance: pStats(p.id, txs).pBal, isBiz: false });
  }
  return out;
}

/** Dashboard "total cash available": positive balances only. */
export function dashboardCash(txs: Transaction[], people: Person[]): number {
  return accountBalances(txs, people).reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0);
}

export interface Suspect {
  tx: Transaction;
  reason: string;
  /** How much this entry pushes the ledger ABOVE (+) or BELOW (-) the dashboard. */
  effect: number;
}

export interface Reconciliation {
  ledgerNet: number;            // for the entries passed in
  dashboardCash: number;        // for ALL entries (what the dashboard shows)
  allTimeLedgerNet: number;     // ledger net over ALL entries
  difference: number;           // ledgerNet - dashboardCash
  outsideRange: number;         // part of the difference caused by the date/filter window
  negativeBalances: { name: string; amount: number }[];
  negativeTotal: number;        // dashboard ignores these (raises dashboard vs. a plain sum)
  suspects: Suspect[];          // entries whose in/out disagree between the two views
  unexplained: number;          // what is left after the above
}

/**
 * @param shown  the entries currently in the ledger (after filters)
 * @param all    every entry in the business (what the dashboard uses)
 */
export function reconcile(shown: Transaction[], all: Transaction[], people: Person[]): Reconciliation {
  const ledgerNet = totals(buildLedgerRows(shown, people, true)).net;
  const allTimeLedgerNet = totals(buildLedgerRows(all, people, true)).net;
  const dash = dashboardCash(all, people);
  const balances = accountBalances(all, people);
  const negatives = balances.filter(b => b.balance < -0.005).map(b => ({ name: b.name, amount: -b.balance }));
  const negativeTotal = negatives.reduce((s, n) => s + n.amount, 0);

  const personIds = new Set(people.map(p => p.id));
  const suspects: Suspect[] = [];

  for (const t of all) {
    // Credit sale: ledger counts creditPaid; the dashboard counts the payments actually received.
    if (t.type === 'credit' && Array.isArray(t.payments) && t.payments.length > 0) {
      const received = t.payments.reduce((s, p) => s + (p.amount || 0), 0);
      const diff = r2((t.creditPaid || 0) - received);
      if (Math.abs(diff) > 0.005) {
        suspects.push({
          tx: t, effect: diff,
          reason: `Credit sale says ${fmt(t.creditPaid || 0)} paid, but its payment records add up to ${fmt(received)}`,
        });
      }
    }
    // Credit sale with money paid but nobody recorded as receiving it.
    if (t.type === 'credit' && (t.creditPaid || 0) > 0 && !(t.payments?.length) && !t.creditReceiver) {
      suspects.push({ tx: t, effect: t.creditPaid || 0, reason: 'Credit sale has money paid but no receiver, so no account gets the cash' });
    }
    // Credit paid to an account that no longer exists.
    if (t.type === 'credit' && !t.payments?.length && t.creditReceiver && t.creditReceiver !== 'biz' && !personIds.has(t.creditReceiver)) {
      suspects.push({ tx: t, effect: t.creditPaid || 0, reason: 'Credit sale was paid to someone who no longer exists' });
    }
    // Sale with nobody recorded as the receiver.
    if (t.type === 'income' && !t.person && !(t as any).receiver) {
      suspects.push({ tx: t, effect: t.amount || 0, reason: 'Sale has no receiver, so no account gets the cash' });
    }
    // Sale whose `person` and `receiver` disagree: it was edited after being created. Older
    // versions of the app left `receiver` stale, which made the dashboard drop or double-count it.
    if (t.type === 'income' && t.person && (t as any).receiver && t.person !== (t as any).receiver) {
      suspects.push({ tx: t, effect: 0, reason: 'Sale was edited and its receiver fields disagree (now counted by the person shown). Open and re-save it to tidy it up.' });
    }
    // Sale recorded against a person who no longer exists.
    if (t.type === 'income' && t.person && t.person !== 'biz' && !personIds.has(t.person)) {
      suspects.push({ tx: t, effect: t.amount || 0, reason: 'Sale was received by someone who no longer exists' });
    }
    // Fund injection / return that doesn't touch Biz or a known member.
    if (t.type === 'owner-fund' && t.ownerReceiver && t.ownerReceiver !== 'biz' && !personIds.has(t.ownerReceiver)) {
      suspects.push({ tx: t, effect: t.amount || 0, reason: 'Fund injection went to an account that no longer exists' });
    }
    // Expense / salary whose payer isn't a known account (cash leaves the ledger but no balance drops).
    if (t.type === 'expense' && t.person && t.person !== 'biz' && !personIds.has(t.person)) {
      suspects.push({ tx: t, effect: -(t.amount || 0), reason: 'Expense was paid by someone who no longer exists' });
    }
    if (t.type === 'salary' && t.salaryPaidBy && t.salaryPaidBy !== 'biz' && !personIds.has(t.salaryPaidBy)) {
      suspects.push({ tx: t, effect: -(t.amount || 0), reason: 'Salary was paid by someone who no longer exists' });
    }
    // Fund return received by a non-owner: ledger counts it as money out, but it lands in a member's balance.
    if (t.type === 'fund-return' && t.frReceiver) {
      const rec = people.find(p => p.id === t.frReceiver);
      if (rec && !(rec.role || '').toLowerCase().includes('owner')) {
        suspects.push({ tx: t, effect: -(t.amount || 0), reason: `Fund return was sent to ${rec.name}, who is not an owner (ledger counts it as money out, but it stays in the business)` });
      }
    }
  }

  const explained = r2(suspects.reduce((s, x) => s + x.effect, 0));
  const sumAllBalances = balances.reduce((s, b) => s + b.balance, 0);
  const difference = r2(ledgerNet - dash);
  // The part of the gap caused by the date/filter window cutting entries off.
  const outsideRange = r2(ledgerNet - allTimeLedgerNet);
  // Identity (all entries):  allTimeLedgerNet - dashboard
  //   = (allTimeLedgerNet - sumAllBalances)   <- entries the two views treat differently
  //   - negativeTotal                          <- dashboard ignores negative balances
  // `unexplained` is the first bracket minus what the suspect list accounts for.
  const unexplained = r2((allTimeLedgerNet - sumAllBalances) - explained);

  return {
    ledgerNet: r2(ledgerNet), dashboardCash: r2(dash), allTimeLedgerNet: r2(allTimeLedgerNet),
    difference, outsideRange: r2(outsideRange), negativeBalances: negatives, negativeTotal: r2(negativeTotal),
    suspects, unexplained,
  };
}

function fmt(n: number) { return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
