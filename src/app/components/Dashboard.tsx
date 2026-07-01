import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Hash, Eye, EyeOff } from 'lucide-react';
import type { Transaction, Person } from '../types';
import { pColor, pInit, fmtAmt, pStats, fmtDate } from '../utils';
import { TxItem } from './TxItem';
import { TxDetailModal } from './TxDetailModal';

interface Props {
  txs: Transaction[];
  people: Person[];
  currency: string;
  businessName?: string;
  onPersonFilter: (pid: string) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string, desc: string) => void;
  balanceHidden: boolean;
  onToggleHidden: () => void;
}

export function Dashboard({ txs, people, currency, businessName, onPersonFilter, onEdit, onDelete, balanceHidden, onToggleHidden }: Props) {
  const hidden = balanceHidden;
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  let totalIn = 0, totalOut = 0, ownerIn = 0, ownerOut = 0;
  for (const t of txs) {
    if (t.type === 'income')  totalIn  += t.amount;
    else if (t.type === 'expense' || t.type === 'salary') totalOut += t.amount;
    else if (t.type === 'owner-fund')  { totalIn  += t.amount; ownerIn  += t.amount; }
    else if (t.type === 'fund-return') { totalOut += t.amount; ownerOut += t.amount; }
    else if (t.type === 'credit') totalIn += (t.creditPaid || 0);
    else if (t.type === 'transfer') {
      // BIZ → Person: internal disbursement — NOT a business outflow from total cash
      // (money stays within the system, just moves from biz pocket to person pocket)
      // Person → BIZ: internal remittance — NOT a business inflow to total cash
      // Only owner-fund / fund-return track real capital injection/withdrawal
      // So transfers are PURELY internal and should NOT affect totalIn / totalOut.
      // (Leave totalIn/totalOut untouched for transfers)
      void t; // satisfy linter
    }
  }
  const bal = totalIn - totalOut;
  const netOwner = ownerIn - ownerOut;

  // Biz account balance: tracks what sits in the biz pocket
  let bizBalance = 0;
  for (const t of txs) {
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

  const members = people.filter(p => {
    const r = (p.role || '').toLowerCase();
    return !r.includes('owner') && p.id !== 'biz';
  });

  // Total Cash Available = sum of ONLY positive balances.
  // Negative balances (debts) are excluded — they represent money owed, not cash in hand.
  // This prevents a person who was advanced money (negative balance) from reducing the total.
  const totalCashAvailable = (() => {
    let sum = Math.max(0, bizBalance); // biz pocket — only if positive
    for (const p of members) {
      const { pBal } = pStats(p.id, txs);
      if (pBal > 0) sum += pBal;       // only count positive balances
    }
    return sum;
  })();

  // ── Tray inventory ──────────────────────────────────────────────────────
  // Restocks:  expense cat === 'Tray Stock'    → adds trayPacks × trayPiecesPerPack
  // Deductions: expense cat === 'Egg Collection' → subtracts eggTraysUsed
  const trayInventory = (() => {
    let totalTrayPieces = 0;
    let hasTrayData = false;
    for (const t of txs) {
      if (t.type === 'expense' && t.cat === 'Tray Stock' && t.trayPacks) {
        totalTrayPieces += (t.trayPacks || 0) * (t.trayPiecesPerPack || 100);
        hasTrayData = true;
      } else if (t.type === 'expense' && t.cat === 'Egg Collection' && t.eggTraysUsed) {
        totalTrayPieces -= (t.eggTraysUsed || 0);
        hasTrayData = true;
      }
    }
    totalTrayPieces = Math.max(0, totalTrayPieces);
    const piecesPerPack = 100;
    const packs   = Math.floor(totalTrayPieces / piecesPerPack);
    const pieces  = totalTrayPieces % piecesPerPack;
    const reorder = totalTrayPieces < 120; // below 1 pack (100) + 20 loose → reorder
    return { packs, pieces, totalTrayPieces, reorder, hasTrayData };
  })();

  const recent = [...txs].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);

  const todayStr = new Date().toISOString().split('T')[0];
  const byBuyer: Record<string, { total: number; paid: number }> = {};
  for (const t of txs.filter(t => t.type === 'credit')) {
    if (t.isPickup && t.date > todayStr) continue;
    const b = t.creditBuyer || 'Unknown';
    if (!byBuyer[b]) byBuyer[b] = { total: 0, paid: 0 };
    byBuyer[b].total += t.creditTotal || 0;
    byBuyer[b].paid  += t.creditPaid  || 0;
  }
  const owing = Object.entries(byBuyer)
    .map(([n, d]) => ({ n, o: d.total - d.paid }))
    .filter(x => x.o > 0.005);

  const upcomingPickups = txs
    .filter(t => t.type === 'credit' && t.isPickup && t.date > todayStr)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Mask helper
  const mask = (v: string) => hidden ? '••••••' : v;

  // Auto-fit font size for balance
  const balStr = fmtAmt(totalCashAvailable, currency);
  const balFontSize = balStr.length > 16 ? '1.55rem' : balStr.length > 12 ? '2rem' : '2.5rem';

  return (
    <div style={{ padding: '16px 16px 120px' }}>
      {/* ── Tray Inventory Notice ── */}
      {trayInventory.hasTrayData ? (
        <div style={{ marginBottom: 10 }}>
          {trayInventory.reorder && (
            <div style={{
              background: 'rgba(220,38,38,0.10)',
              border: '1.5px solid #DC2626',
              borderRadius: 12, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 6,
              animation: 'reorder-blink 1.1s ease-in-out infinite',
            }}>
              <span style={{ fontSize: '1rem' }}>📦</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DC2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                REORDER TRAY
              </span>
              <span style={{ fontSize: '0.68rem', color: '#991B1B', marginLeft: 'auto' }}>
                Only {trayInventory.packs > 0 ? `${trayInventory.packs} pack${trayInventory.packs !== 1 ? 's' : ''} + ` : ''}{trayInventory.pieces} piece{trayInventory.pieces !== 1 ? 's' : ''} left
              </span>
            </div>
          )}
          <div style={{
            background: trayInventory.reorder ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.08)',
            border: `1.5px solid ${trayInventory.reorder ? 'rgba(220,38,38,0.3)' : 'rgba(124,58,237,0.25)'}`,
            borderRadius: 12, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: '0.95rem' }}>🥚</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5B21B6', letterSpacing: '0.04em' }}>Tray Stock:</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.76rem', fontWeight: 700, color: trayInventory.reorder ? '#DC2626' : '#3730A3' }}>
              {trayInventory.packs > 0 ? `${trayInventory.packs} pack${trayInventory.packs !== 1 ? 's' : ''} ` : ''}
              {(trayInventory.packs > 0 && trayInventory.pieces > 0) ? '+ ' : ''}
              {trayInventory.pieces > 0 || trayInventory.packs === 0 ? `${trayInventory.pieces} piece${trayInventory.pieces !== 1 ? 's' : ''}` : ''}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#7C3AED', marginLeft: 'auto' }}>({trayInventory.totalTrayPieces} total)</span>
          </div>
          <style>{`@keyframes reorder-blink { 0%,100% { opacity:1; } 50% { opacity:0.45; } }`}</style>
        </div>
      ) : null}

      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(145deg, #0D1B6E 0%, #1A2FA8 35%, #2D52E0 70%, #4B7AF5 100%)',
        borderRadius: 24, padding: '24px 22px 22px',
        marginBottom: 16,
        boxShadow: '0 12px 48px rgba(13,27,110,0.45), 0 2px 8px rgba(26,47,168,0.25)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, border: '1px solid rgba(255,255,255,0.12)', pointerEvents: 'none' }} />

        {businessName && (
          <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.75)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.75rem' }}>🏢</span> {businessName}
          </div>
        )}

        {/* Label + eye toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
            Total Cash Available
          </div>
          <button
            onClick={onToggleHidden}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8, width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(6px)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            title={hidden ? 'Show balances' : 'Hide balances'}
          >
            {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Balance amount — auto-fits, stays one line */}
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: balFontSize,
          fontWeight: 600,
          color: totalCashAvailable < 0 ? '#FFB3C0' : '#fff',
          letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 22,
          position: 'relative', zIndex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'font-size 0.2s ease',
          textShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}>
          {hidden ? '••••••••' : balStr}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, position: 'relative', zIndex: 1 }}>
          {[
            { lbl: 'Total In',  val: hidden ? '••••' : fmtAmt(totalIn, ''),  col: '#A8C4FF', icon: <TrendingUp size={12} /> },
            { lbl: 'Total Out', val: hidden ? '••••' : fmtAmt(totalOut, ''), col: '#FFB3C0', icon: <TrendingDown size={12} /> },
            { lbl: 'Entries',   val: String(txs.length),                     col: '#B3D4FF', icon: <Hash size={12} /> },
          ].map(s => (
            <div key={s.lbl} style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(10px)',
              borderRadius: 14, padding: '12px 11px',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, color: 'rgba(255,255,255,0.5)' }}>
                {s.icon}
                <span style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.lbl}</span>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.78rem', fontWeight: 600, color: s.col }}>
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
              {hidden ? '••••' : fmtAmt(netOwner, currency)}
            </span>
          </div>
        )}
      </div>

      {/* Biz Account strip */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #DBE5FF 100%)',
        borderRadius: 16, padding: '14px 18px',
        marginBottom: 16,
        boxShadow: '0 3px 12px rgba(26,47,168,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: '1px solid rgba(26,47,168,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(61,107,223,0.12)', border: '1.5px solid rgba(61,107,223,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.78rem', fontWeight: 800, color: '#3D6BDF',
          }}>BIZ</div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1A2FA8', letterSpacing: '0.06em' }}>Biz Account</div>
            <div style={{ fontSize: '0.55rem', color: '#7A8FC4', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Internal funds held</div>
          </div>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '1rem', fontWeight: 600, color: bizBalance >= 0 ? '#1A2FA8' : '#E83E5C' }}>
          {hidden ? '••••••' : fmtAmt(bizBalance, currency)}
        </div>
      </div>

      {/* Upcoming Pickups */}
      {upcomingPickups.length > 0 && (
        <div style={{
          background: 'rgba(61,107,223,0.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 16,
          border: '1px solid rgba(61,107,223,0.18)',
        }}>
          <div style={{ ...sh, color: '#1A2FA8' }}>🥚 Awaiting Pickup</div>
          {upcomingPickups.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid rgba(61,107,223,0.08)' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2FA8' }}>{t.creditBuyer || '—'}</div>
                <div style={{ fontSize: '0.65rem', color: '#7A8FC4', marginTop: 1 }}>{fmtDate(t.date)}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.85rem', fontWeight: 600, color: '#1A2FA8' }}>
                {hidden ? '••••' : fmtAmt(t.creditTotal || 0, currency)}
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
                {hidden ? '••••' : fmtAmt(x.o, currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* People Grid */}
      <div style={sh}>Balances by Person</div>
      {members.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: '#9A9FB8', marginBottom: 16 }}>No team members added yet.</p>
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
                  background: '#fff', borderRadius: 18, padding: '18px 15px',
                  boxShadow: '0 2px 6px rgba(26,47,168,0.06), 0 6px 20px rgba(26,47,168,0.05)',
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
                  {hidden ? '••••' : fmtAmt(pBal, currency)}
                </div>
                {!hidden && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(61,107,223,0.12)', color: '#3D6BDF' }}>
                      ↑ {fmtAmt(pIn, currency)}
                    </span>
                    <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(232,62,92,0.12)', color: '#E83E5C' }}>
                      ↓ {fmtAmt(pOut, currency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Transactions */}
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
            onClick={() => setDetailTx(t)}
          />
        ))
      )}

      {/* Transaction detail modal */}
      <TxDetailModal
        tx={detailTx}
        people={people}
        currency={currency}
        onClose={() => setDetailTx(null)}
      />
    </div>
  );
}

const sh: React.CSSProperties = {
  fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#5A5F7A', marginBottom: 12, marginTop: 6,
};
