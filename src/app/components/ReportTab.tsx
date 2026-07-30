import React, { useState } from 'react';
import { FileText, Download, Sparkles, Sun, Copy } from 'lucide-react';
import { showToast } from './Modals';
import type { Transaction, Person } from '../types';
import { fmtDate, fmtN, pStats } from '../utils';

interface Props {
  businessName: string;
  txs: Transaction[];
  people: Person[];
  currency: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function esc(s: any): string {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function fmtMonth(dateStr: string): string {
  if (!dateStr) return '';
  const dt = new Date(dateStr + 'T00:00:00');
  return isNaN(dt.getTime()) ? dateStr : dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function dayOf(dateStr: string): string {
  if (!dateStr) return '';
  const dt = new Date(dateStr + 'T00:00:00');
  return isNaN(dt.getTime()) ? dateStr : String(dt.getDate());
}

// ── report styles ─────────────────────────────────────────────────────────────

const printStyles = `
.pdf-section { margin-bottom: 28px; }
.pdf-header { font-size: 1.6rem; font-weight: 800; color: #1a2fa8; margin-bottom: 20px; letter-spacing: -0.01em; }
.pdf-section-title { font-size: 1rem; font-weight: 800; color: #1a1a2e; margin-bottom: 2px; letter-spacing: -0.01em; }
.pdf-section-sub { font-size: 0.7rem; color: #9a9fb8; margin-bottom: 10px; font-weight: 500; }
.pdf-divider { border: none; border-top: 2px solid #1a1a2e; margin: 28px 0; }
.pdf-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.pdf-table th { background: #1a1a2e; color: #fff; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 8px; text-align: left; }
.pdf-table th:last-child { text-align: right; }
.pdf-table td { padding: 7px 8px; border: 0.5px solid #ccc; vertical-align: middle; color: #1a1a2e; }
.pdf-table td:last-child { text-align: right; font-family: 'DM Mono', monospace; font-size: 0.78rem; }
.pdf-table tr:nth-child(even) td { background: #f5f5f5; }
.pdf-table tr:nth-child(odd) td { background: #fff; }
.pdf-table tr.pdf-total td { background: #e8f4e8 !important; font-weight: 700; border-top: 1.5px solid #1a1a2e; }
.pdf-table tr.pdf-outstanding td { background: #fff8f0 !important; color: #cc5500; }
.pdf-table tr.pdf-negative td { background: #fff0f0 !important; color: #cc2222; }
.pdf-summary-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.pdf-summary-table th { background: #1a1a2e; color: #fff; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 8px; text-align: left; }
.pdf-summary-table th:last-child { text-align: right; }
.pdf-summary-table td { padding: 7px 8px; border: 0.5px solid #ccc; color: #1a1a2e; }
.pdf-summary-table td:last-child { text-align: right; font-family: 'DM Mono', monospace; }
.pdf-summary-table tr:nth-child(even) td { background: #f5f5f5; }
.pdf-summary-table tr:nth-child(odd) td { background: #fff; }
.pdf-summary-table tr.pdf-total td { background: #e8f4e8 !important; font-weight: 700; border-top: 1.5px solid #1a1a2e; }
.pdf-summary-table tr.pdf-negative td { color: #cc2222 !important; }
`;

// ── ReportTab component ───────────────────────────────────────────────────────

export function ReportTab({ businessName, txs, people, currency }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [from, setFrom]       = useState(today.slice(0, 7) + '-01');
  const [to, setTo]           = useState(today);
  const [pId, setPId]         = useState('all');
  const [rType, setRType]     = useState('all');
  const [reportHtml, setReportHtml] = useState('');
  const [generated, setGenerated]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // Stores computed numbers for the summary narrative (set during generate())
  const [reportStats, setReportStats] = useState<{
    fromDate: string; toDate: string;
    totalSales: number; totalOutstanding: number;
    totalExpenses: number; hasSalary: boolean;
    totalSalary: number; totalOtherExpenses: number;
    profit: number; totalCrates: number;
    totalEggs: number; totalBrokenEggs: number;
    balanceBroughtForward: number;
    periodStartDate: string;
    periodLabel: 'month' | 'week';
    teamDebts: { name: string; amount: number }[];
    totalCashAvail: number;
    memberBalances: { name: string; balance: number }[];
  } | null>(null);

  function generate() {
    let f = [...txs];
    if (from)          f = f.filter(t => t.date >= from);
    if (to)            f = f.filter(t => t.date <= to);
    if (pId !== 'all') f = f.filter(t => t.person === pId);

    // Compute egg collection totals BEFORE excluding them from the table
    const eggCollectionTxs = f.filter(t => t.type === 'egg-collection');
    const totalEggs        = eggCollectionTxs.reduce((s, t) => s + (t.eggPieces || 0), 0);
    const totalBrokenEggs  = eggCollectionTxs.reduce((s, t) => s + (t.brokenEggs || 0), 0);

    // Now exclude feed-usage and egg-collection logs from the report tables
    f = f.filter(t => !['feed-usage', 'egg-collection'].includes(t.type));
    if (rType !== 'all') f = f.filter(t => t.type === rType);
    f.sort((a, b) => a.date < b.date ? -1 : 1);

    const expenseTxs  = f.filter(t => ['expense', 'salary', 'fund-return'].includes(t.type));
    const salaryTxs   = f.filter(t => t.type === 'salary');
    const salesTxs    = f.filter(t => ['income', 'credit'].includes(t.type));
    const ownerFunds  = f.filter(t => t.type === 'owner-fund');

    const totalExpenses   = expenseTxs.reduce((s, t) => s + (t.amount || 0), 0);
    const totalSalary     = salaryTxs.reduce((s, t) => s + (t.amount || 0), 0);
    const hasSalary       = salaryTxs.length > 0;

    // Shop / Farm split
    let totalShopSales = 0, totalFarmSales = 0;
    salesTxs.forEach(t => {
      const src = t.source || (t.type === 'income' ? 'shop' : 'farm');
      const collected = t.type === 'income' ? (t.amount || 0) : (t.creditPaid || 0);
      if (src === 'shop') totalShopSales += collected;
      else totalFarmSales += collected;
    });
    const totalSales = totalShopSales + totalFarmSales;
    const cashInjection = ownerFunds.reduce((s, t) => s + (t.amount || 0), 0);
    const totalOutstanding = salesTxs.reduce((s, t) => {
      if (t.type === 'credit') return s + Math.max(0, (t.creditTotal || 0) - (t.creditPaid || 0));
      return s;
    }, 0);
    const profit = totalSales - totalExpenses;

    // Total crates across sales + credit sales in the period
    const totalCrates = f
      .filter(t => ['income', 'credit'].includes(t.type))
      .reduce((s, t) => s + (t.crates || 0), 0);

    const dateLabel = (from && to) ? fmtDate(from) + ' – ' + fmtDate(to) : 'All Dates';

    // ── Balance brought forward (into the start date of the report) ──
    // If 'from' is the 1st of a month → "balance brought into the month"
    // Otherwise → "balance brought into the week"
    // The balance is the TOTAL BALANCE AVAILABLE as of the day before the
    // start date — i.e. sum of all positive account/person balances, same
    // logic as the dashboard.
    const periodStartDate = from || today;
    const fromDateObj = new Date(periodStartDate + 'T00:00:00');
    const periodLabel: 'month' | 'week' = fromDateObj.getDate() === 1 ? 'month' : 'week';

    // All transactions BEFORE the period start date
    const prePeriodTxs = txs.filter(t => t.date && t.date < periodStartDate);

    // Compute biz balance from pre-period txs
    let preBizBalance = 0;
    for (const t of prePeriodTxs) {
      if (t.type === 'transfer') {
        if (t.transferTo   === 'biz') preBizBalance += t.amount;
        if (t.transferFrom === 'biz') preBizBalance -= t.amount;
      }
      if (t.type === 'income' && (t as any).receiver === 'biz') preBizBalance += t.amount;
      if (t.type === 'salary' && t.salaryPaidBy === 'biz') preBizBalance -= t.amount;
      if (t.type === 'expense' && t.person === 'biz') preBizBalance -= t.amount;
      if (t.type === 'owner-fund' && t.ownerReceiver === 'biz') preBizBalance += t.amount;
      if (t.type === 'fund-return' && t.frSender === 'biz') preBizBalance -= t.amount;
      if (t.type === 'credit') {
        if (Array.isArray(t.payments) && t.payments.length > 0) {
          for (const p of t.payments) {
            if (p.receiver === 'biz') preBizBalance += p.amount;
          }
        } else if (t.creditReceiver === 'biz' && (t.creditPaid || 0) > 0) {
          preBizBalance += (t.creditPaid || 0);
        }
      }
    }

    // Total balance available = max(0, bizBalance) + sum of positive member balances
    let balanceBroughtForward = Math.max(0, preBizBalance);
    for (const p of people) {
      if (p.id === 'biz') continue;
      const role = (p.role || '').toLowerCase();
      if (role.includes('owner')) continue;
      const { pBal } = pStats(p.id, prePeriodTxs);
      if (pBal > 0.005) balanceBroughtForward += pBal;
    }

    // ── Team member debts (negative balance = we owe them) ──
    const teamDebts: { name: string; amount: number }[] = [];
    for (const p of people) {
      if (p.id === 'biz') continue;
      const role = (p.role || '').toLowerCase();
      if (role.includes('owner')) continue;
      const { pBal } = pStats(p.id, txs);
      if (pBal < -0.005) {
        teamDebts.push({ name: p.name, amount: Math.abs(pBal) });
      }
    }

    // ── Build balance breakdown by person ───────────────────────────────
    // Final balances at the END of the selected period: all txs up to 'to' date
    const balanceTxs = to ? txs.filter(t => t.date <= to) : txs;

    // Compute biz balance using txs up to end of period
    let bizBalance = 0;
    for (const t of balanceTxs) {
      if (t.type === 'transfer') {
        if (t.transferTo   === 'biz') bizBalance += t.amount;
        if (t.transferFrom === 'biz') bizBalance -= t.amount;
      }
      if (t.type === 'income' && (t as any).receiver === 'biz') bizBalance += t.amount;
      if (t.type === 'salary' && t.salaryPaidBy === 'biz') bizBalance -= t.amount;
      if (t.type === 'expense' && t.person === 'biz') bizBalance -= t.amount;
      if (t.type === 'owner-fund' && t.ownerReceiver === 'biz') bizBalance += t.amount;
      if (t.type === 'fund-return' && t.frSender === 'biz') bizBalance -= t.amount;
      if (t.type === 'credit') {
        if (Array.isArray(t.payments) && t.payments.length > 0) {
          for (const p of t.payments) {
            if (p.receiver === 'biz') bizBalance += p.amount;
          }
        } else if (t.creditReceiver === 'biz' && (t.creditPaid || 0) > 0) {
          bizBalance += (t.creditPaid || 0);
        }
      }
    }

    // Build balance rows
    interface BalRow { name: string; balance: number; isBiz: boolean; }
    const balRows: BalRow[] = [];

    // Biz account
    balRows.push({ name: 'Biz Saving', balance: bizBalance, isBiz: true });

    // Each person — using txs up to end of period
    for (const p of people) {
      if (p.id === 'biz') continue;
      const { pBal } = pStats(p.id, balanceTxs);
      balRows.push({ name: p.name, balance: pBal, isBiz: false });
    }

    // Remove entries with zero balance (they don't add info)
    const nonZeroBalRows = balRows.filter(r => Math.abs(r.balance) > 0.005);

    // ── Total cash available = sum of all positive balances (neglect negatives) ──
    const totalCashAvail = balRows
      .filter(r => r.balance > 0.005)
      .reduce((s, r) => s + r.balance, 0);

    // All balances for summary (non-zero only, min 1) — including Biz
    const memberBalances: { name: string; balance: number }[] = balRows
      .filter(r => Math.abs(r.balance) >= 1)
      .map(r => ({ name: r.name, balance: r.balance }));

    // ── Balance breakdown HTML table ─────────────────────────────────────
    function makeBalanceTable(): string {
      const rows = nonZeroBalRows.length > 0 ? nonZeroBalRows : balRows;

      return `<div class="pdf-section">
        <div class="pdf-section-title">Balance Breakdown by Account / Person</div>
        <div class="pdf-section-sub">Final balances as of ${esc(fmtDate(to || new Date().toISOString().split('T')[0]))}</div>
        <table class="pdf-table"><thead><tr>
          <th>Account / Person</th>
          <th style="width:22%">Balance (${esc(currency)})</th>
        </tr></thead><tbody>
        ${rows.map(r => `<tr class="${r.balance < 0 ? 'pdf-negative' : ''}">
          <td>${esc(r.name)}${r.isBiz ? ' <span style="font-size:0.68rem;background:#e8f0fe;color:#1a2fa8;border-radius:4px;padding:1px 6px;margin-left:4px;font-weight:700;">BIZ</span>' : ''}</td>
          <td>${r.balance < 0 ? '–' : ''}${fmtN(Math.abs(r.balance))}</td>
        </tr>`).join('')}
        </tbody><tfoot>
          <tr class="pdf-total"><td>TOTAL BALANCE AVAILABLE</td><td>${fmtN(totalCashAvail)}</td></tr>
        </tfoot></table>
      </div>`;
    }

    // ── Section builders (unchanged logic, same as before) ───────────────
    function makeExpenseTable(rows: Transaction[], title: string, subtitle: string) {
      if (!rows.length) return '';
      const total = rows.reduce((s, t) => s + (t.amount || 0), 0);
      return `<div class="pdf-section">
        <div class="pdf-section-title">${esc(title)}</div>
        <div class="pdf-section-sub">${esc(subtitle)}</div>
        <table class="pdf-table"><thead><tr>
          <th style="width:18%">Date</th><th>Description</th><th style="width:22%">Amount (${esc(currency)})</th>
        </tr></thead><tbody>
        ${rows.map(t => {
          // Strip "Expense by X" prefix — show only the category/description
          let displayDesc = t.desc || '';
          displayDesc = displayDesc.replace(/^Expense\s+by\s+[^—\-]+\s*—\s*/i, '').replace(/^Expense\s+by\s+[^—\-]+\s*-\s*/i, '').replace(/^Expense\s+by\s+/i, '');
          return `<tr><td>${esc(fmtDate(t.date))}</td><td>${esc(displayDesc)}${t.note ? '<br><span style="font-size:0.7em;color:#9a9fb8;">' + esc(t.note) + '</span>' : ''}</td><td>${fmtN(t.amount || 0)}</td></tr>`;
        }).join('')}
        </tbody><tfoot><tr class="pdf-total"><td></td><td>TOTAL</td><td>${fmtN(total)}</td></tr></tfoot></table>
      </div>`;
    }

    function makeSalesTable(rows: Transaction[], title: string, subtitle: string, showOutstanding: boolean) {
      if (!rows.length) return '';
      let shopTotal = 0, farmTotal = 0, outstanding = 0, crates = 0;
      rows.forEach(t => {
        const src = t.source || (t.type === 'income' ? 'shop' : 'farm');
        if (t.type === 'income') {
          if (src === 'shop') shopTotal += t.amount || 0; else farmTotal += t.amount || 0;
        } else if (t.type === 'credit') {
          const collected = t.creditPaid || 0;
          const owe = Math.max(0, (t.creditTotal || 0) - (t.creditPaid || 0));
          if (src === 'shop') shopTotal += collected; else farmTotal += collected;
          outstanding += owe;
        }
        crates += (t.crates || 0);
      });
      const grandTotal = shopTotal + farmTotal;
      return `<div class="pdf-section">
        <div class="pdf-section-title">${esc(title)}</div>
        <div class="pdf-section-sub">${esc(subtitle)}</div>
        <table class="pdf-table"><thead><tr>
          <th>Source</th><th style="width:30%">Amount (${esc(currency)})</th>
        </tr></thead><tbody>
        ${shopTotal > 0 ? `<tr><td>Shop Sales</td><td>${fmtN(shopTotal)}</td></tr>` : ''}
        ${farmTotal > 0 ? `<tr><td>Farm Dispatch</td><td>${fmtN(farmTotal)}</td></tr>` : ''}
        ${crates > 0 ? `<tr><td>Total Crates</td><td>${crates} crates</td></tr>` : ''}
        </tbody><tfoot>
          <tr class="pdf-total"><td>TOTAL COLLECTED</td><td>${fmtN(grandTotal)}</td></tr>
          ${showOutstanding && outstanding > 0.005 ? `<tr class="pdf-outstanding"><td>Outstanding – Credit Sales</td><td>${fmtN(outstanding)}</td></tr>` : ''}
        </tfoot></table>
      </div>`;
    }

    function makeSummaryTable(sections: { label: string; amount: number; isTotal?: boolean; prefix?: string; isNeg?: boolean }[]) {
      return `<div class="pdf-section">
        <div class="pdf-section-title">Summary</div>
        <div class="pdf-section-sub">${esc(dateLabel)}</div>
        <table class="pdf-summary-table"><thead><tr><th></th><th style="width:30%">Amount (${esc(currency)})</th></tr></thead>
        <tbody>${sections.map(s => `<tr${s.isTotal ? ' class="pdf-total"' : s.isNeg ? ' class="pdf-negative"' : ''}><td>${esc(s.label)}</td><td>${s.prefix || ''}${fmtN(s.amount)}</td></tr>`).join('')}
        </tbody></table>
      </div>`;
    }

    // ── Assemble HTML ─────────────────────────────────────────────────────
    let html = '';
    if (businessName) html += `<div class="pdf-header">${esc(businessName)}</div>`;
    if (rType === 'all' || rType === 'expense' || rType === 'salary') html += makeExpenseTable(expenseTxs, 'Expenses', dateLabel);
    if (rType === 'all' || rType === 'income'  || rType === 'credit') html += makeSalesTable(salesTxs, 'Sales / Dispatch', dateLabel, true);
    if (rType === 'all' && (expenseTxs.length || salesTxs.length || eggCollectionTxs.length)) {
      html += `<hr class="pdf-divider">`;
      const rows: { label: string; amount: number; isTotal?: boolean; prefix?: string; isNeg?: boolean }[] = [];
      if (totalShopSales > 0) rows.push({ label: 'Shop Sales', amount: totalShopSales });
      if (totalFarmSales > 0) rows.push({ label: 'Farm Dispatch', amount: totalFarmSales });
      if (totalOutstanding > 0) rows.push({ label: 'Outstanding – Credit Sales', amount: totalOutstanding, isNeg: true });
      rows.push({ label: 'Total Sales / Dispatch', amount: totalSales, isTotal: true });
      if (totalExpenses > 0) rows.push({ label: 'Total Expenses', amount: totalExpenses });
      if (cashInjection > 0) rows.push({ label: 'Cash Injection', amount: cashInjection, prefix: '+ ' });
      if (totalCrates > 0) rows.push({ label: 'Total Crates Sold', amount: totalCrates });
      html += makeSummaryTable(rows);
    }
    if (rType === 'owner-fund' && ownerFunds.length) html += makeExpenseTable(ownerFunds, 'Cash Injections', dateLabel);

    // ── Balance breakdown — appended to all-type reports ─────────────────
    if (rType === 'all') {
      html += `<hr class="pdf-divider">`;
      html += makeBalanceTable();
    }

    if (!html) html = `<div style="text-align:center;padding:40px;font-size:0.82rem;color:#9a9fb8;">No transactions found for the selected filters.</div>`;

    setReportHtml(html);
    setGenerated(true);
    setSummaryText('');
    setShowSummary(false);
    setReportStats({
      fromDate: from,
      toDate: to,
      totalSales,
      totalOutstanding,
      totalExpenses,
      hasSalary,
      totalSalary,
      totalOtherExpenses: totalExpenses - totalSalary,
      profit,
      totalCrates,
      totalEggs,
      totalBrokenEggs,
      balanceBroughtForward,
      periodStartDate,
      periodLabel,
      teamDebts,
      totalCashAvail,
      memberBalances,
    });
    showToast('Report ready', 'success');
    setTimeout(() => document.getElementById('report-preview')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  function generateSummary() {
    if (!reportStats) return;
    const {
      fromDate, toDate,
      totalSales, totalOutstanding,
      totalExpenses, hasSalary, totalSalary, totalOtherExpenses,
      profit, totalCrates,
      totalEggs, totalBrokenEggs,
      balanceBroughtForward, periodStartDate, periodLabel, teamDebts,
      totalCashAvail, memberBalances,
    } = reportStats;

    // ── Date range label ──────────────────────────────────────────────────
    let datePhrase = '';
    if (fromDate && toDate) {
      datePhrase = `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;
    } else {
      datePhrase = 'this period';
    }

    // ── Determine "month" vs "week" label ───────────────────────────────
    const periodWord = periodLabel; // 'month' or 'week'

    // ── Build intro paragraph + bullet list ──────────────────────────────
    const introParts: string[] = [];
    const bullets: string[] = [];

    // Intro: "Here is a report between X and Y."
    introParts.push(`Here is a report for ${esc(businessName || 'the business')} covering the period from ${datePhrase}.`);

    // Balance brought forward line
    if (balanceBroughtForward !== 0 || totalSales > 0 || totalExpenses > 0) {
      const balSign = balanceBroughtForward >= 0 ? '' : '–';
      introParts.push(`A balance of ${currency} ${balSign}${fmtN(Math.abs(balanceBroughtForward))} was brought into the ${periodWord}.`);
    }

    // Bullets for the breakdown
    if (totalSales > 0) {
      let salesBullet = `• Total sales and dispatch: ${currency} ${fmtN(totalSales)}`;
      if (totalOutstanding > 0.005) {
        salesBullet += ` (with ${currency} ${fmtN(totalOutstanding)} in outstanding credit)`;
      }
      bullets.push(salesBullet);
    }

    if (totalExpenses > 0) {
      let expBullet = `• Total expenses: ${currency} ${fmtN(totalExpenses)}`;
      if (hasSalary && totalSalary > 0 && totalOtherExpenses > 0) {
        expBullet += ` (including ${currency} ${fmtN(totalSalary)} in salary payments)`;
      } else if (hasSalary && totalSalary > 0 && totalOtherExpenses <= 0) {
        expBullet += ` (salary payments only)`;
      }
      bullets.push(expBullet);
    }

    if (totalSales > 0 && totalExpenses > 0) {
      const profitWord = profit >= 0 ? 'profit' : 'loss';
      bullets.push(`• Net ${profitWord}: ${currency} ${fmtN(Math.abs(profit))}`);
    } else if (totalSales > 0 && totalExpenses === 0) {
      bullets.push(`• No recorded expenses — full ${currency} ${fmtN(totalSales)} is available income`);
    }

    if (totalCrates > 0) {
      bullets.push(`• Egg crates sold: ${totalCrates} crate${totalCrates !== 1 ? 's' : ''}`);
    }

    if (totalEggs > 0) {
      const netEggs = totalEggs - totalBrokenEggs;
      let eggBullet = `• Eggs collected: ${totalEggs} (${netEggs} good`;
      if (totalBrokenEggs > 0) eggBullet += `, ${totalBrokenEggs} reported broken`;
      eggBullet += ')';
      bullets.push(eggBullet);
    }

    // ── All balances (Biz + team members, non-zero only, min 1) ───────────
    if (memberBalances.length > 0) {
      const positive = memberBalances.filter(m => m.balance > 0);
      const owed = memberBalances.filter(m => m.balance < 0);

      bullets.push('');
      bullets.push(`Available balances:`);
      for (const m of positive) {
        bullets.push(`  → ${m.name}: ${currency} ${fmtN(m.balance)}`);
      }

      if (owed.length > 0) {
        bullets.push('');
        bullets.push(`⚠ Team members owed money:`);
        for (const m of owed) {
          bullets.push(`  → ${m.name}: ${currency} ${fmtN(Math.abs(m.balance))}`);
        }
      }

      bullets.push('');
      bullets.push(`Total balance available: ${currency} ${fmtN(totalCashAvail)}`);
    }

    // ── Assemble final text ───────────────────────────────────────────────
    const introText = introParts.join(' ');
    const bulletsText = bullets.join('\n');

    if (bullets.length === 0 && introParts.length <= 1) {
      setSummaryText('No data to summarise for the selected period.');
    } else {
      setSummaryText(introText + '\n\n' + bulletsText);
    }
    setShowSummary(true);
  }

  async function downloadPDF() {
    const el = document.getElementById('pdf-download-target');
    if (!el) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const PAGE_W_MM = 210, PAGE_H_MM = 297, MARGIN_MM = 14;
      const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const imgW = canvas.width, imgH = canvas.height;
      const pxPerMm = imgW / (CONTENT_W_MM * 2);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let yOffset = 0, pageIndex = 0;
      const pageHpx = (PAGE_H_MM - MARGIN_MM * 2) * pxPerMm * 2;
      while (yOffset < imgH) {
        if (pageIndex > 0) pdf.addPage();
        const sliceH = Math.min(pageHpx, imgH - yOffset);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgW; pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, yOffset, imgW, sliceH, 0, 0, imgW, sliceH);
        const imgData = pageCanvas.toDataURL('image/png');
        const sliceHmm = sliceH / pxPerMm / 2;
        pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_W_MM, sliceHmm);
        yOffset += sliceH; pageIndex++;
      }
      const safeName = (businessName || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safeName}_report.pdf`);
      showToast('PDF downloaded', 'success');
    } catch (err) {
      console.error('PDF generation failed', err);
      showToast('Download failed — try again', 'error');
    } finally {
      setDownloading(false);
    }
  }

  const no = people.filter(p => !p.role?.toLowerCase().includes('owner'));

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <style>{printStyles}</style>

      {/* Controls */}
      <div className="no-print" style={{ background: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="From Date"><input style={inp} type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To Date"><input style={inp} type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Field label="Person">
            <Select value={pId} onChange={setPId}>
              <option value="all">All People</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={rType} onChange={setRType}>
              <option value="all">All Types</option>
              <option value="income">Sales</option>
              <option value="expense">Expenses</option>
              <option value="salary">Salary</option>
              <option value="transfer">Transfers</option>
              <option value="credit">Credit Sales</option>
              <option value="owner-fund">Fund Injection</option>
              <option value="fund-return">Fund Returns</option>
            </Select>
          </Field>
        </div>
        {/* Action buttons — 3 in a row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <button onClick={generate} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FileText size={15} /> Generate
          </button>
          <button
            onClick={downloadPDF}
            disabled={!generated || downloading}
            style={{ ...primaryBtn, background: generated ? 'linear-gradient(135deg, #2a4a9a, #3d6bdf)' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: downloading ? 0.7 : 1, cursor: generated && !downloading ? 'pointer' : 'not-allowed' }}
          >
            <Download size={15} /> {downloading ? 'Saving…' : 'Download PDF'}
          </button>
          <button
            onClick={generateSummary}
            disabled={!generated}
            style={{ ...primaryBtn, background: generated ? 'linear-gradient(135deg, #16803c, #22c55e)' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: generated ? 'pointer' : 'not-allowed' }}
          >
            <Sparkles size={15} /> Summary
          </button>
        </div>
      </div>

      {/* Smart Summary Card */}
      {showSummary && summaryText && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1.5px solid #86efac',
          borderRadius: 16,
          padding: '16px 18px',
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sun size={16} color="#ca8a04" />
            <Sparkles size={16} color="#16a34a" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#16a34a' }}>Report Summary</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(summaryText).then(() => showToast('Summary copied to clipboard', 'success')).catch(() => showToast('Copy failed', 'error')); }}
              style={{ marginLeft: 'auto', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 7, cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', color: '#16a34a' }}
              aria-label="Copy summary"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => setShowSummary(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontSize: '1rem', lineHeight: 1, padding: '4px 2px', display: 'flex', alignItems: 'center' }}
              aria-label="Dismiss"
            >✕</button>
          </div>
          <div style={{ fontSize: '0.88rem', lineHeight: 1.65, color: '#14532d', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'pre-line' }}>
            {summaryText}
          </div>
        </div>
      )}

      {/* Report preview */}
      {generated && (
        <div id="report-preview" className="report-preview">
          <div
            id="pdf-download-target" className="pdf-doc"
            style={{ background: '#fff', borderRadius: 12, padding: '24px 22px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#1a1a2e' }}
            dangerouslySetInnerHTML={{ __html: reportHtml }}
          />
        </div>
      )}
    </div>
  );
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8' }}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{ ...inp, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9fb8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', appearance: 'none' as const }}
    >
      {children}
    </select>
  );
}

const inp: React.CSSProperties = {
  background: '#F5F7FF', border: '1.5px solid rgba(0,0,0,0.08)',
  borderRadius: 10, padding: '10px 13px', fontSize: '0.88rem',
  color: '#1A1D2E', width: '100%', fontFamily: "'DM Mono',monospace",
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)', color: '#fff',
  border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(61,107,223,0.35)',
};
