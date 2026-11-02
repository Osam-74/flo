import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Search, RotateCcw, SlidersHorizontal, Scale } from 'lucide-react';
import { TxDetailModal } from './TxDetailModal';
import type { Transaction, Person, TxType } from '../types';
import { fmtDate, fmtN } from '../utils';
import { exportLedgerPdf, exportLedgerExcel, buildLedgerRows, totals, TYPE_LABEL } from '../ledgerExport';
import { showToast } from './Modals';
import { reconcile } from '../reconcile';

interface Props {
  businessName?: string;
  txs: Transaction[];
  people: Person[];
  currency: string;
  initialPersonFilter?: string;
  isReadOnly: boolean;
  viewerId?: string | null;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string, desc: string) => void;
}

type FilterType = TxType | 'all';
type SortKey = 'newest' | 'oldest' | 'amount-high' | 'amount-low';

const TYPE_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'all',            label: 'All types' },
  { id: 'income',         label: 'Sales' },
  { id: 'expense',        label: 'Expenses' },
  { id: 'salary',         label: 'Salary' },
  { id: 'transfer',       label: 'Transfers' },
  { id: 'credit',         label: 'Credit sales' },
  { id: 'egg-collection', label: 'Egg collection' },
  { id: 'feed-usage',     label: 'Feed usage' },
  { id: 'owner-fund',     label: 'Fund injection' },
  { id: 'fund-return',    label: 'Fund return' },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest',      label: 'Newest first' },
  { id: 'oldest',      label: 'Oldest first' },
  { id: 'amount-high', label: 'Amount: high to low' },
  { id: 'amount-low',  label: 'Amount: low to high' },
];

// Accent per transaction type for the small type pill in the table.
const TYPE_PILL: Record<string, { bg: string; fg: string }> = {
  income:           { bg: 'rgba(22,128,60,0.12)',  fg: '#15803D' },
  credit:           { bg: 'rgba(22,128,60,0.12)',  fg: '#15803D' },
  'owner-fund':     { bg: 'rgba(61,107,223,0.12)', fg: '#2A50B8' },
  expense:          { bg: 'rgba(232,62,92,0.12)',  fg: '#C81E43' },
  salary:           { bg: 'rgba(232,62,92,0.12)',  fg: '#C81E43' },
  'fund-return':    { bg: 'rgba(232,62,92,0.12)',  fg: '#C81E43' },
  transfer:         { bg: 'rgba(90,95,122,0.12)',  fg: '#4B5163' },
  'egg-collection': { bg: 'rgba(217,119,6,0.14)',  fg: '#B45309' },
  'feed-usage':     { bg: 'rgba(217,119,6,0.14)',  fg: '#B45309' },
};

const todayStr = () => new Date().toISOString().split('T')[0];

export function LedgerTab({
  businessName = '', txs, people, currency, initialPersonFilter = 'all',
  isReadOnly, viewerId, onEdit, onDelete,
}: Props) {
  const [typeFilter, setTypeFilter]     = useState<FilterType>('all');
  const [personFilter, setPersonFilter] = useState(initialPersonFilter);
  const [sortKey, setSortKey]           = useState<SortKey>('newest');
  const [from, setFrom]                 = useState('');
  const [to, setTo]                     = useState('');
  const [query, setQuery]               = useState('');
  const [detailTx, setDetailTx]         = useState<Transaction | null>(null);
  const [exporting, setExporting]       = useState<'pdf' | 'xlsx' | null>(null);
  const [showRecon, setShowRecon]       = useState(false);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...txs];
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);
    if (personFilter !== 'all') {
      list = list.filter(t =>
        t.person === personFilter ||
        t.transferFrom === personFilter || t.transferTo === personFilter ||
        t.creditReceiver === personFilter || t.creditSeller === personFilter ||
        t.ownerSender === personFilter || t.ownerReceiver === personFilter ||
        t.frSender === personFilter || t.frReceiver === personFilter ||
        t.employee === personFilter,
      );
    }
    if (from) list = list.filter(t => (t.date || '') >= from);
    if (to)   list = list.filter(t => (t.date || '') <= to);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        [t.desc, t.note, t.cat, t.buyer, t.creditBuyer, t.employeeName]
          .some(v => (v || '').toLowerCase().includes(q)),
      );
    }

    // Amount to sort by = the money that actually moved (credit: cash collected).
    const amt = (t: Transaction) => (t.type === 'credit' ? t.creditPaid || 0 : t.amount || 0);
    const byDateDesc = (a: Transaction, b: Transaction) => {
      if (a.date !== b.date) return (a.date || '') < (b.date || '') ? 1 : -1;
      return (b.ts || 0) - (a.ts || 0);
    };
    list.sort((a, b) => {
      switch (sortKey) {
        case 'oldest':      return -byDateDesc(a, b);
        case 'amount-high': return amt(b) - amt(a) || byDateDesc(a, b);
        case 'amount-low':  return amt(a) - amt(b) || byDateDesc(a, b);
        default:            return byDateDesc(a, b);
      }
    });
    return list;
  }, [txs, typeFilter, personFilter, from, to, query, sortKey]);

  const rows = useMemo(() => buildLedgerRows(filtered, people, true), [filtered, people]);
  const sums = useMemo(() => totals(rows), [rows]);
  const recon = useMemo(() => reconcile(filtered, txs, people), [filtered, txs, people]);
  const txById = useMemo(() => new Map(filtered.map(t => [t.id, t])), [filtered]);

  const filtersActive =
    typeFilter !== 'all' || from !== '' || to !== '' || query.trim() !== '' ||
    sortKey !== 'newest' || (!viewerId && personFilter !== initialPersonFilter);

  function reset() {
    setTypeFilter('all'); setFrom(''); setTo(''); setQuery(''); setSortKey('newest');
    setPersonFilter(initialPersonFilter);
  }

  // ── Export (uses exactly what the page shows) ─────────────────────────────
  const typeLabel = TYPE_OPTIONS.find(o => o.id === typeFilter)?.label || 'All types';
  const personLabel = personFilter === 'all' ? 'All people' : (people.find(p => p.id === personFilter)?.name || 'All people');
  const rangeText = from || to
    ? `${from ? fmtDate(from) : 'Start'} - ${to ? fmtDate(to) : fmtDate(todayStr())}`
    : undefined;
  const filterLabel = [typeLabel, personLabel, query.trim() ? `"${query.trim()}"` : '']
    .filter(Boolean).join(' · ');

  async function runExport(kind: 'pdf' | 'xlsx') {
    if (filtered.length === 0) { showToast('Nothing to export for this filter', 'error'); return; }
    setExporting(kind);
    try {
      const input = { txs: filtered, people, businessName, currency, filterLabel, keepOrder: true, rangeText };
      if (kind === 'pdf') await exportLedgerPdf(input); else await exportLedgerExcel(input);
      showToast(kind === 'pdf' ? 'Ledger PDF downloaded' : 'Ledger Excel downloaded', 'success');
    } catch (err) {
      console.error('Ledger export failed', err);
      showToast('Export failed - try again', 'error');
    } finally {
      setExporting(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const netPositive = sums.net >= 0;
  const disabledExport = !!exporting || filtered.length === 0;

  return (
    <div style={{ padding: '12px 14px 100px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Control bar ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <SlidersHorizontal size={14} color="#3D6BDF" />
          <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3D6BDF' }}>
            Ledger Transactions
          </span>
          {filtersActive && (
            <button onClick={reset} className="lg-reset" aria-label="Reset filters">
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        <div className="lg-grid">
          <Field label="From">
            <input className="lg-inp" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="lg-inp" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
          </Field>
          <Field label="Type">
            <Sel value={typeFilter} onChange={v => setTypeFilter(v as FilterType)}>
              {TYPE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Sel>
          </Field>
          {!viewerId ? (
            <Field label="Person">
              <Sel value={personFilter} onChange={setPersonFilter}>
                <option value="all">All people</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
          ) : null}
          <Field label="Sort by">
            <Sel value={sortKey} onChange={v => setSortKey(v as SortKey)}>
              {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Sel>
          </Field>
          <Field label="Search" wide={!!viewerId}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#9A9FB8" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="lg-inp" style={{ paddingLeft: 30 }} type="search" placeholder="Description, note…"
                value={query} onChange={e => setQuery(e.target.value)}
              />
            </div>
          </Field>
        </div>

        {/* Export */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => runExport('pdf')} disabled={disabledExport} className="lg-export lg-export--pdf">
            <FileText size={14} /> {exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}
          </button>
          <button onClick={() => runExport('xlsx')} disabled={disabledExport} className="lg-export lg-export--xlsx">
            <FileSpreadsheet size={14} /> {exporting === 'xlsx' ? 'Preparing…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* ── Totals ── */}
      <div className="lg-totals">
        <Stat label="Entries" value={String(rows.length)} />
        <Stat label="Money in" value={fmtN(sums.moneyIn)} color="#15803D" />
        <Stat label="Money out" value={fmtN(sums.moneyOut)} color="#C81E43" />
        <Stat label={netPositive ? 'Net' : 'Net (deficit)'} value={(netPositive ? '' : '-') + fmtN(sums.net)} color={netPositive ? '#1A2FA8' : '#C81E43'} />
      </div>
      <div style={{ fontSize: '0.6rem', color: '#9A9FB8', margin: '-2px 2px 8px', textAlign: 'right' }}>
        Amounts in {currency}
      </div>

      {/* ── Reconcile with dashboard ── */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setShowRecon(v => !v)} className="lg-recon-btn">
          <Scale size={13} />
          {Math.abs(recon.difference) < 0.01 ? 'Net matches the dashboard cash' : `Net differs from dashboard cash by ${currency} ${fmtN(recon.difference)}`}
          <span style={{ marginLeft: 'auto', fontSize: '0.6rem' }}>{showRecon ? 'Hide' : 'Why?'}</span>
        </button>
        {showRecon && (
          <div style={{ ...card, marginTop: 8, marginBottom: 0 }}>
            <div className="lg-rc-row"><span>Ledger net (as shown)</span><b>{fmtN(recon.ledgerNet)}</b></div>
            <div className="lg-rc-row"><span>Dashboard total cash available</span><b>{fmtN(recon.dashboardCash)}</b></div>
            <div className="lg-rc-row lg-rc-total"><span>Difference</span><b style={{ color: Math.abs(recon.difference) < 0.01 ? '#15803D' : '#C81E43' }}>{recon.difference < 0 ? '-' : ''}{fmtN(recon.difference)}</b></div>

            <div className="lg-rc-h">Where the difference comes from</div>
            {Math.abs(recon.outsideRange) > 0.005 && (
              <div className="lg-rc-item">
                <b>Filters / dates:</b> the dashboard counts every entry ever recorded. Your filters hide entries worth {currency} {fmtN(recon.outsideRange)} of net movement. Clear the filters to compare like for like.
              </div>
            )}
            {recon.negativeTotal > 0.005 && (
              <div className="lg-rc-item">
                <b>Negative balances ({currency} {fmtN(recon.negativeTotal)}):</b> the dashboard counts only positive balances and ignores anyone who is overdrawn, but the ledger net subtracts it. This makes the dashboard higher than the ledger by this amount.
                {recon.negativeBalances.map(n => (
                  <div key={n.name} className="lg-rc-sub">{n.name} is overdrawn by {currency} {fmtN(n.amount)}</div>
                ))}
              </div>
            )}
            {recon.suspects.length > 0 && (
              <div className="lg-rc-item">
                <b>Entries counted differently ({recon.suspects.length}):</b> tap one to open and fix it.
                {recon.suspects.map((x, i) => (
                  <div key={x.tx.id + i} className="lg-rc-sus" onClick={() => setDetailTx(x.tx)}>
                    <div><b>{fmtDate(x.tx.date)}</b> · {x.tx.desc || x.tx.type}</div>
                    <div className="lg-rc-sub">{x.reason}</div>
                    <div className="lg-rc-sub">Pushes ledger {x.effect >= 0 ? 'above' : 'below'} dashboard by {currency} {fmtN(x.effect)}</div>
                  </div>
                ))}
              </div>
            )}
            {Math.abs(recon.unexplained) > 0.005 && (
              <div className="lg-rc-item" style={{ background: 'rgba(232,62,92,0.07)', borderColor: 'rgba(232,62,92,0.25)' }}>
                <b>Still unexplained: {currency} {fmtN(recon.unexplained)}.</b> Some entries are counted differently but don't match a known pattern. Check recent edits to sales, credit payments and transfers.
              </div>
            )}
            {Math.abs(recon.outsideRange) <= 0.005 && recon.negativeTotal <= 0.005 && recon.suspects.length === 0 && Math.abs(recon.unexplained) <= 0.005 && (
              <div className="lg-rc-item">Nothing to explain. The two figures agree.</div>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 20px', fontSize: '0.8rem', color: '#9A9FB8', lineHeight: 1.8 }}>
          No transactions match these filters.
          {filtersActive && (
            <div><button onClick={reset} className="lg-reset" style={{ marginTop: 8, marginLeft: 0 }}><RotateCcw size={12} /> Reset filters</button></div>
          )}
        </div>
      ) : (
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th className="c-date">Date</th>
                <th>Description</th>
                <th className="r c-amt">In</th>
                <th className="r c-amt">Out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pill = TYPE_PILL[r.sortKey] || { bg: 'rgba(90,95,122,0.12)', fg: '#4B5163' };
                const sub = [r.people, r.note].filter(Boolean).join(' · ');
                return (
                  <tr key={r.id + ':' + i} onClick={() => { const t = txById.get(r.id); if (t) setDetailTx(t); }}>
                    <td className="date">{fmtDate(r.date)}</td>
                    <td>
                      <div className="desc">{r.description || '—'}</div>
                      <div className="meta">
                        <span className="pill" style={{ background: pill.bg, color: pill.fg }}>{r.type}</span>
                        {sub && <span className="sub">{sub}</span>}
                      </div>
                    </td>
                    <td className="r in">{r.moneyIn > 0 ? fmtN(r.moneyIn) : ''}</td>
                    <td className="r out">{r.moneyOut > 0 ? fmtN(r.moneyOut) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td className="tl">Total</td>
                <td className="r in">{fmtN(sums.moneyIn)}</td>
                <td className="r out">{fmtN(sums.moneyOut)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <TxDetailModal
        tx={detailTx}
        people={people}
        currency={currency}
        onClose={() => setDetailTx(null)}
        onEdit={!isReadOnly ? (tx) => { setDetailTx(null); onEdit(tx); } : undefined}
        onDelete={!isReadOnly ? (id, desc) => { setDetailTx(null); onDelete(id, desc); } : undefined}
      />
    </div>
  );
}

// ── Small UI helpers ────────────────────────────────────────────────────────

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, gridColumn: wide ? 'span 2' : undefined }}>
      <label style={{ fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8' }}>{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select className="lg-inp lg-sel" value={value} onChange={e => onChange(e.target.value)}>
      {children}
    </select>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="lg-stat">
      <div className="lg-stat-l">{label}</div>
      <div className="lg-stat-v" style={{ color: color || '#1A1D2E' }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid rgba(0,0,0,0.05)',
};

const CSS = `
.lg-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.lg-inp {
  width:100%; box-sizing:border-box; background:#F5F7FF; border:1.5px solid rgba(0,0,0,0.08);
  border-radius:10px; padding:9px 11px; font-size:0.8rem; color:#1A1D2E; outline:none;
  font-family:'DM Mono',monospace; min-height:38px;
}
.lg-inp:focus { border-color:#3D6BDF; background:#fff; }
.lg-sel {
  appearance:none; padding-right:30px; font-family:'Plus Jakarta Sans',sans-serif; font-weight:600;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9fb8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 11px center;
}
.lg-reset {
  margin-left:auto; display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:99px;
  border:1.5px solid rgba(232,62,92,0.3); background:rgba(232,62,92,0.07); color:#C81E43;
  font-size:0.62rem; font-weight:800; letter-spacing:0.04em; cursor:pointer; font-family:inherit;
}
.lg-export {
  flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px 8px;
  border-radius:11px; border:none; color:#fff; font-size:0.68rem; font-weight:700;
  letter-spacing:0.05em; text-transform:uppercase; cursor:pointer; font-family:inherit;
}
.lg-export:disabled { opacity:0.5; cursor:not-allowed; }
.lg-export--pdf  { background:linear-gradient(135deg,#2a4a9a,#3d6bdf); }
.lg-export--xlsx { background:linear-gradient(135deg,#16803c,#22c55e); }

.lg-recon-btn { width:100%; display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:11px; border:1.5px solid rgba(217,119,6,0.35); background:rgba(245,158,11,0.10); color:#92400E; font-size:0.68rem; font-weight:700; cursor:pointer; font-family:inherit; text-align:left; }
.lg-rc-row { display:flex; justify-content:space-between; gap:10px; font-size:0.74rem; padding:5px 0; color:#1A1D2E; }
.lg-rc-row b { font-family:'DM Mono',monospace; }
.lg-rc-total { border-top:1.5px solid rgba(0,0,0,0.1); margin-top:4px; padding-top:8px; font-weight:800; }
.lg-rc-h { font-size:0.58rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#9A9FB8; margin:12px 0 6px; }
.lg-rc-item { font-size:0.7rem; line-height:1.5; color:#3B3F55; background:#F8F9FF; border:1px solid rgba(0,0,0,0.07); border-radius:10px; padding:9px 10px; margin-bottom:7px; }
.lg-rc-sub { font-size:0.64rem; color:#7A7F98; margin-top:2px; }
.lg-rc-sus { margin-top:7px; padding:7px 9px; border-radius:8px; background:#fff; border:1px solid rgba(217,119,6,0.3); cursor:pointer; }
.lg-rc-sus:hover { background:rgba(245,158,11,0.08); }
.lg-totals { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; }
.lg-stat { background:#fff; border-radius:12px; padding:9px 8px; text-align:center; border:1px solid rgba(0,0,0,0.05); box-shadow:0 1px 3px rgba(0,0,0,0.05); min-width:0; }
.lg-stat-l { font-size:0.52rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#9A9FB8; }
.lg-stat-v { font-family:'DM Mono',monospace; font-size:0.74rem; font-weight:700; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.lg-table-wrap { background:#fff; border-radius:16px; overflow:hidden; border:1px solid rgba(0,0,0,0.05); box-shadow:0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04); }
.lg-table { width:100%; border-collapse:collapse; table-layout:auto; }
.lg-table .c-date, .lg-table .c-amt { width:1%; white-space:nowrap; }
.lg-table thead th {
  position:sticky; top:0; background:#1A2FA8; color:#fff; text-align:left; padding:10px 7px;
  font-size:0.58rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase;
}
.lg-table th.r, .lg-table td.r { text-align:right; }
.lg-table tbody tr { cursor:pointer; border-top:1px solid rgba(0,0,0,0.06); transition:background 0.12s; }
.lg-table tbody tr:nth-child(even) { background:#F8F9FF; }
.lg-table tbody tr:hover { background:rgba(61,107,223,0.08); }
.lg-table td { padding:9px 7px; vertical-align:top; font-size:0.74rem; color:#1A1D2E; }
.lg-table td.date { font-family:'DM Mono',monospace; font-size:0.62rem; color:#5A5F7A; white-space:nowrap; }
.lg-table .desc { font-weight:600; line-height:1.35; overflow-wrap:anywhere; }
.lg-table .meta { display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-top:4px; }
.lg-table .pill { font-size:0.54rem; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; padding:2px 7px; border-radius:6px; }
.lg-table .sub { font-size:0.62rem; color:#8A8FA8; overflow-wrap:anywhere; }
.lg-table td.in, .lg-table td.out { font-family:'DM Mono',monospace; font-size:0.68rem; font-weight:600; white-space:nowrap; }
.lg-table td.in { color:#15803D; }
.lg-table td.out { color:#C81E43; }
.lg-table tfoot td { background:#EEF1FF; border-top:2px solid #1A2FA8; font-weight:800; padding:10px 7px; }
.lg-table tfoot td.tl { font-size:0.62rem; letter-spacing:0.1em; text-transform:uppercase; color:#1A2FA8; }
@media (min-width:640px) {
  .lg-grid { grid-template-columns:repeat(3,1fr); }
  .lg-table td, .lg-table thead th { padding-left:14px; padding-right:14px; }
}
`;
