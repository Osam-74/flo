import React from 'react';
import { TrendingUp, TrendingDown, Hash } from 'lucide-react';
import type { Transaction, Person } from '../types';
import { pColor, pInit, fmtAmt, pStats, fmtDate } from '../utils';
import { TxItem } from './TxItem';

interface Props {
  txs: Transaction[];
  people: Person[];
  currency: string;
  businessName?: string;
  onPersonFilter: (pid: string) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string, desc: string) => void;
}

export function Dashboard({ txs, people, currency, businessName, onPersonFilter, onEdit, onDelete }: Props) {
  let totalIn = 0, totalOut = 0, ownerIn = 0, ownerOut = 0;
  for (const t of txs) {
    if (t.type === 'income')  totalIn  += t.amount;
    else if (t.type === 'expense' || t.type === 'salary') totalOut += t.amount;
    else if (t.type === 'owner-fund')  { totalIn  += t.amount; ownerIn  += t.amount; }
    else if (t.type === 'fund-return') { totalOut += t.amount; ownerOut += t.amount; }
    else if (t.type === 'credit') totalIn += (t.creditPaid || 0);
    else if (t.type === 'transfer') {
      // Only count transfer to biz as business-in if it came from the owner (fund injection context).
      // A transfer from a regular user (non-owner) to biz is just internal remittance — do NOT add to totalIn.
      // A transfer FROM biz to someone is still an outflow.
      if (t.transferTo === 'biz') {
        const sender = people.find(p => p.id === t.transferFrom);
        const senderIsOwner = sender?.role?.toLowerCase().includes('owner');
        if (senderIsOwner) {
          totalIn += t.amount;
        }
        // Non-owner → biz: money is just moving internally, no net change to main balance
      }
      if (t.transferFrom === 'biz') totalOut += t.amount;
    }
  }
  const bal = totalIn - totalOut;
  const netOwner = ownerIn - ownerOut;

  // Biz account balance: all money in/out of the 'biz' account
  let bizBalance = 0;
  for (const t of txs) {
    // Transfers: biz receives or sends
    if (t.type === 'transfer') {
      if (t.transferTo   === 'biz') bizBalance += t.amount;
      if (t.transferFrom === 'biz') bizBalance -= t.amount;
    }
    // Income / Sales: money received BY biz
    if (t.type === 'income' && t.receiver === 'biz') bizBalance += t.amount;
    // Salary: paid FROM biz account
    if (t.type === 'salary' && t.salaryPaidBy === 'biz') bizBalance -= t.amount;
    // Expense: paid by biz (person === 'biz')
    if (t.type === 'expense' && t.person === 'biz') bizBalance -= t.amount;
    // Owner fund injection received by biz
    if (t.type === 'owner-fund' && t.ownerReceiver === 'biz') bizBalance += t.amount;
    // Fund return sent from biz
    if (t.type === 'fund-return' && t.frSender === 'biz') bizBalance -= t.amount;
    // Credit sale: all payments (initial + subsequent) received by biz
    // payments[] array is the single source of truth — always use it to avoid double-counting
    if (t.type === 'credit') {
      if (Array.isArray(t.payments) && t.payments.length > 0) {
        // Sum all payment entries where biz was the receiver
        for (const p of t.payments) {
          if (p.receiver === 'biz') bizBalance += p.amount;
        }
      } else if (t.creditReceiver === 'biz' && (t.creditPaid || 0) > 0) {
        // Fallback: old records that have no payments array yet
        bizBalance += (t.creditPaid || 0);
      }
    }
  }

  // Members: exclude owner and biz account
  const members = people.filter(p => {
    const r = (p.role || '').toLowerCase();
    return !r.includes('owner') && p.id !== 'biz';
  });

  const recent = [...txs].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);

  const byBuyer: Record<string, { total: number; paid: number }> = {};
  for (const t of txs.filter(t => t.type === 'credit')) {
    const b = t.creditBuyer || 'Unknown';
    if (!byBuyer[b]) byBuyer[b] = { total: 0, paid: 0 };
    byBuyer[b].total += t.creditTotal || 0;
    byBuyer[b].paid  += t.creditPaid  || 0;
  }
  const owing = Object.entries(byBuyer)
    .map(([n, d]) => ({ n, o: d.total - d.paid }))
    .filter(x => x.o > 0.005);

  // Upcoming egg pickups: credit txs with a future date and isPickup flag
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingPickups = txs
    .filter(t => t.type === 'credit' && t.isPickup && t.date > todayStr)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1A2FA8 0%, #3D6BDF 55%, #5580F0 100%)',
        borderRadius: 22, padding: '22px 20px 20px',
        marginBottom: 16,
        boxShadow: '0 10px 40px rgba(61,107,223,0.38)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        {businessName && (
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.75)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.75rem' }}>🏢</span> {businessName}
          </div>
        )}
        <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
          Total Cash Available
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: bal < 0 ? '2rem' : '2.6rem',
          fontWeight: 500, color: bal < 0 ? '#FFB3C0' : '#fff',
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 20, position: 'relative', zIndex: 1,
        }}>
          {fmtAmt(bal, currency)}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, position: 'relative', zIndex: 1 }}>
          {[
            { lbl: 'Total In',  val: fmtAmt(totalIn, ''),  col: '#A8C4FF', icon: <TrendingUp size={12} /> },
            { lbl: 'Total Out', val: fmtAmt(totalOut, ''), col: '#FFB3C0', icon: <TrendingDown size={12} /> },
            { lbl: 'Entries',   val: String(txs.length),   col: '#B3D4FF', icon: <Hash size={12} /> },
          ].map(s => (
            <div key={s.lbl} style={{
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              borderRadius: 12, padding: '10px 10px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, color: 'rgba(255,255,255,0.5)' }}>
                {s.icon}
                <span style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.lbl}</span>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', fontWeight: 500, color: s.col }}>
                {s.val}
              </div>
            </div>
          ))}
        </div>

        {/* Owner injection */}
        {netOwner > 0.005 && (
          <div style={{
            marginTop: 10, position: 'relative', zIndex: 1,
            background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              🟠 Fund Injection (net)
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.78rem', fontWeight: 500, color: '#FFD080' }}>
              {fmtAmt(netOwner, currency)}
            </span>
          </div>
        )}
      </div>

      {/* Biz Account standalone strip */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #DBEAFE 100%)',
        borderRadius: 14, padding: '12px 16px',
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(61,107,223,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: '1px solid rgba(61,107,223,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(61,107,223,0.12)', border: '1.5px solid rgba(61,107,223,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.78rem', fontWeight: 800, color: '#3D6BDF',
          }}>
            BIZ
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1A2FA8', letterSpacing: '0.06em' }}>Biz Account</div>
            <div style={{ fontSize: '0.55rem', color: '#7A8FC4', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Internal funds held</div>
          </div>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '1rem', fontWeight: 600, color: bizBalance >= 0 ? '#1A2FA8' : '#E83E5C' }}>
          {fmtAmt(bizBalance, currency)}
        </div>
      </div>

      {/* Upcoming Egg Pickups */}
      {upcomingPickups.length > 0 && (
        <div style={{
          background: 'rgba(61,107,223,0.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 16,
          border: '1px solid rgba(61,107,223,0.18)',
        }}>
          <div style={{ ...sh, color: '#1A2FA8' }}>📦 Awaiting Pickup</div>
          {upcomingPickups.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid rgba(61,107,223,0.08)' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2FA8' }}>{t.creditBuyer || '—'}</div>
                <div style={{ fontSize: '0.65rem', color: '#7A8FC4', marginTop: 1 }}>{fmtDate(t.date)}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.85rem', fontWeight: 600, color: '#1A2FA8' }}>
                {fmtAmt(t.creditTotal || 0, currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Owing list */}
      {owing.length > 0 && (
        <div style={{
          background: 'rgba(232,62,92,0.07)', borderRadius: 14, padding: '12px 14px', marginBottom: 16,
          border: '1px solid rgba(232,62,92,0.15)',
        }}>
          <div style={sh}>Outstanding Credit</div>
          {owing.map(x => (
            <div key={x.n} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.8rem', color: '#5A5F7A' }}>{x.n}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.8rem', fontWeight: 700, color: '#E83E5C' }}>
                {fmtAmt(x.o, currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* People Grid — members only (no biz, no owner) */}
      <div style={sh}>Balances by Person</div>
      {members.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: '#9A9FB8', marginBottom: 16 }}>No staff added yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {members.map(p => {
            const { pIn, pOut, pBal } = pStats(p.id, txs);
            const c = pColor(p);
            return (
              <div
                key={p.id}
                onClick={() => onPersonFilter(p.id)}
                style={{
                  background: '#fff', borderRadius: 16, padding: '16px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
                  cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s',
                  border: '1.5px solid transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#3D6BDF'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: c.bg, color: c.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 800, marginBottom: 10,
                }}>
                  {pInit(p)}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A1D2E', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: '0.58rem', color: '#9A9FB8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{p.role}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '1rem', fontWeight: 600, color: pBal >= 0 ? '#1A2FA8' : '#E83E5C' }}>
                  {fmtAmt(pBal, currency)}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(61,107,223,0.12)', color: '#3D6BDF' }}>
                    ↑ {fmtAmt(pIn, currency)}
                  </span>
                  <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(232,62,92,0.12)', color: '#E83E5C' }}>
                    ↓ {fmtAmt(pOut, currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent */}
      <div style={sh}>Recent Transactions</div>
      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', fontSize: '0.78rem', color: '#9A9FB8' }}>
          No transactions yet.
        </div>
      ) : (
        recent.map(t => (
          <TxItem
            key={t.id}
            tx={t}
            people={people}
            currency={currency}
            showActions={false}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}

const sh: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 10, marginTop: 4,
};
