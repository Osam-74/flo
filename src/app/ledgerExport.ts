// ─────────────────────────────────────────────────────────────────────────────
// Ledger export (PDF + Excel)
//
// Both formats are built from the same flattened rows so they can never
// disagree. The PDF reuses the Report tab's renderer (same letterhead, fonts
// and page furniture) by emitting a ReportDocument.
// ─────────────────────────────────────────────────────────────────────────────
import type { Transaction, Person } from './types';
import type { ReportDocument, PdfRow } from './pdf/reportModel';
import { fmtDate, fmtN } from './utils';
import { downloadReportPdf, safeCurrency } from './pdf/renderReportPdf';
import type { SheetData } from 'write-excel-file/browser';

export const TYPE_LABEL: Record<string, string> = {
  income: 'Sale', expense: 'Expense', salary: 'Salary', transfer: 'Transfer',
  credit: 'Credit sale', 'owner-fund': 'Fund injection', 'fund-return': 'Fund return',
  'egg-collection': 'Egg collection', 'feed-usage': 'Feed usage',
};

export interface LedgerRow {
  id: string;          // transaction id, so a row can be traced back to its entry
  sortKey: string;     // transaction type key (for styling)
  date: string;        // YYYY-MM-DD
  type: string;        // human label
  description: string;
  people: string;      // who / between whom
  moneyIn: number;     // 0 when not applicable
  moneyOut: number;
  note: string;
}

export interface LedgerExportInput {
  /** Keep `txs` in the order given (the on-screen sort) instead of oldest-first. */
  keepOrder?: boolean;
  /** Human description of the date range, e.g. "01 Oct 26 - 31 Oct 26". */
  rangeText?: string;
  txs: Transaction[];          // already filtered the way the Ledger shows them
  people: Person[];
  businessName: string;
  currency: string;
  filterLabel: string;         // e.g. "Expense · All people"
}

const nameOf = (people: Person[], id?: string) =>
  (id && people.find(p => p.id === id)?.name) || '';

/** Strips the "Expense by X — " prefix the same way the Report tab does. */
function cleanDesc(desc: string): string {
  return (desc || '')
    .replace(/^Expense\s+by\s+[^—\-]+\s*—\s*/i, '')
    .replace(/^Expense\s+by\s+[^—\-]+\s*-\s*/i, '')
    .replace(/^Expense\s+by\s+/i, '')
    .trim();
}

export function buildLedgerRows(txs: Transaction[], people: Person[], keepOrder = false): LedgerRow[] {
  // Oldest first reads like a ledger / bank statement, unless the caller
  // wants the on-screen order preserved.
  const sorted = keepOrder ? [...txs] : [...txs].sort((a, b) => {
    if (a.date !== b.date) return (a.date || '') < (b.date || '') ? -1 : 1;
    return (a.ts || 0) - (b.ts || 0);
  });

  return sorted.map((t): LedgerRow => {
    let moneyIn = 0, moneyOut = 0;
    let who = nameOf(people, t.person);
    let description = cleanDesc(t.desc);

    switch (t.type) {
      case 'income':
        moneyIn = t.amount || 0;
        break;
      case 'credit': {
        moneyIn = t.creditPaid || 0;
        const owe = Math.max(0, (t.creditTotal || 0) - (t.creditPaid || 0));
        if (owe > 0.005) description += ` (outstanding: ${fmtN(owe)})`;
        who = t.creditBuyer || nameOf(people, t.creditSeller) || who;
        break;
      }
      case 'expense':
        moneyOut = t.amount || 0;
        break;
      case 'salary':
        moneyOut = t.amount || 0;
        who = t.employeeName || nameOf(people, t.employee) || who;
        break;
      case 'transfer':
        who = `${nameOf(people, t.transferFrom) || '?'} → ${nameOf(people, t.transferTo) || '?'}`;
        // Moves money between accounts: neither in nor out for the business, so
        // the amount is shown in the description rather than in a money column.
        description = `Transfer of ${fmtN(t.amount || 0)}${t.transferRef ? ` (ref ${t.transferRef})` : ''}`;
        break;
      case 'owner-fund':
        moneyIn = t.amount || 0;
        who = `${nameOf(people, t.ownerSender) || '?'} → ${nameOf(people, t.ownerReceiver) || '?'}`;
        break;
      case 'fund-return':
        moneyOut = t.amount || 0;
        who = `${nameOf(people, t.frSender) || '?'} → ${nameOf(people, t.frReceiver) || '?'}`;
        break;
      case 'egg-collection':
        description = `${t.eggPieces || 0} eggs collected${t.brokenEggs ? `, ${t.brokenEggs} broken` : ''}`;
        break;
      case 'feed-usage':
        description = `${Math.abs(t.feedBags || 0)} bag${Math.abs(t.feedBags || 0) !== 1 ? 's' : ''} of feed used`;
        break;
    }

    return {
      id: t.id,
      sortKey: t.type,
      date: t.date,
      type: TYPE_LABEL[t.type] || t.type,
      description,
      people: who,
      moneyIn,
      moneyOut,
      note: t.note && t.note !== 'Daily feed usage log' ? t.note : '',
    };
  });
}

export function totals(rows: LedgerRow[]) {
  const moneyIn = rows.reduce((s, r) => s + r.moneyIn, 0);
  const moneyOut = rows.reduce((s, r) => s + r.moneyOut, 0);
  return { moneyIn, moneyOut, net: moneyIn - moneyOut };
}

function rangeLabel(rows: LedgerRow[]): string {
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  if (!dates.length) return 'No entries';
  return dates[0] === dates[dates.length - 1]
    ? fmtDate(dates[0])
    : `${fmtDate(dates[0])} - ${fmtDate(dates[dates.length - 1])}`;
}

const fileStamp = () => new Date().toISOString().split('T')[0].replace(/-/g, '');
const safeName = (s: string) => (s || 'ledger').replace(/[^a-z0-9]/gi, '_').toLowerCase();

// ── PDF ──────────────────────────────────────────────────────────────────────

export async function exportLedgerPdf(input: LedgerExportInput): Promise<void> {
  const rows = buildLedgerRows(input.txs, input.people, !!input.keepOrder);
  const CUR = safeCurrency(input.currency);
  const { moneyIn, moneyOut, net } = totals(rows);
  const period = input.rangeText || rangeLabel(rows);
  const now = new Date();

  const body: PdfRow[] = rows.map((r): PdfRow => ({
    cells: [
      { text: fmtDate(r.date) },
      { text: r.type },
      { text: r.description, note: [r.people, r.note].filter(Boolean).join(' · ') || undefined },
      { text: r.moneyIn > 0 ? fmtN(r.moneyIn) : '' },
      { text: r.moneyOut > 0 ? fmtN(r.moneyOut) : '' },
    ],
  }));

  const model: ReportDocument = {
    businessName: input.businessName || 'Ledger',
    documentTitle: 'Ledger Transactions',
    periodLabel: period,
    currency: CUR,
    generatedAt: now,
    meta: [
      { label: 'Period', value: period },
      { label: 'Currency', value: CUR },
      { label: 'Filter', value: input.filterLabel },
      { label: 'Entries', value: String(rows.length) },
    ],
    sections: rows.length === 0
      ? [{ kind: 'note', text: 'No transactions match the current filter.' }]
      : [{
          kind: 'table',
          title: 'Transactions',
          subtitle: period,
          columns: [
            { header: 'Date', width: 0.14 },
            { header: 'Type', width: 0.14 },
            { header: 'Description', width: 0.32 },
            { header: `In (${CUR})`, width: 0.20, align: 'right', numeric: true },
            { header: `Out (${CUR})`, width: 0.20, align: 'right', numeric: true },
          ],
          rows: body,
          footer: [
            { cells: [{ text: '' }, { text: '' }, { text: 'Total money in' }, { text: fmtN(moneyIn) }, { text: '' }] },
            { cells: [{ text: '' }, { text: '' }, { text: 'Total money out' }, { text: '' }, { text: fmtN(moneyOut) }] },
            {
              variant: 'total',
              cells: [{ text: '' }, { text: '' }, { text: net >= 0 ? 'NET CASH MOVEMENT' : 'NET CASH MOVEMENT (DEFICIT)' },
                { text: net >= 0 ? fmtN(net) : '' }, { text: net < 0 ? fmtN(net) : '' }],
            },
          ],
        }],
  };

  await downloadReportPdf(model, `${safeName(input.businessName)}_ledger_${fileStamp()}.pdf`);
}

// ── Excel ────────────────────────────────────────────────────────────────────

export async function exportLedgerExcel(input: LedgerExportInput): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const rows = buildLedgerRows(input.txs, input.people, !!input.keepOrder);
  const { moneyIn, moneyOut, net } = totals(rows);
  const CUR = safeCurrency(input.currency);

  const head = (value: string, align: 'left' | 'right' = 'left') => ({
    value, fontWeight: 'bold' as const, textColor: '#FFFFFF', backgroundColor: '#1A2FA8', align,
  });
  const money = (n: number) => (n > 0 ? { value: n, type: Number, format: '#,##0.00' } : { value: '' as any });
  const bold = (value: any, extra: any = {}) => ({ value, fontWeight: 'bold' as const, ...extra });

  const data: SheetData = [
    [head('Date'), head('Type'), head('Description'), head('Person / Parties'),
     head(`Money In (${CUR})`, 'right'), head(`Money Out (${CUR})`, 'right'), head('Note')],
    ...rows.map(r => [
      r.date ? { value: new Date(r.date + 'T00:00:00'), type: Date, format: 'dd mmm yyyy' } : { value: '' as any },
      { value: r.type },
      { value: r.description },
      { value: r.people },
      money(r.moneyIn),
      money(r.moneyOut),
      { value: r.note },
    ]),
    [bold(''), bold(''), bold('TOTAL'), bold(''),
      { value: moneyIn, type: Number, format: '#,##0.00', fontWeight: 'bold' as const },
      { value: moneyOut, type: Number, format: '#,##0.00', fontWeight: 'bold' as const },
      bold('')],
    [bold(''), bold(''), bold('NET CASH MOVEMENT (IN - OUT)'), bold(''),
      { value: net, type: Number, format: '#,##0.00;-#,##0.00', fontWeight: 'bold' as const }, bold(''), bold('')],
  ];

  await writeXlsxFile(data, {
    columns: [{ width: 13 }, { width: 16 }, { width: 46 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 28 }],
    sheet: 'Ledger',
    stickyRowsCount: 1,
  }).toFile(`${safeName(input.businessName)}_ledger_${fileStamp()}.xlsx`);
}
