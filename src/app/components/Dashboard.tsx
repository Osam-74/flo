import React, { useState, useEffect } from 'react';
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

// Brand palette for stacked cards — darker to lighter
const CARD_GRADIENTS = [
  'linear-gradient(145deg, #0D1B6E 0%, #1A2FA8 40%, #2D52E0 80%, #4B7AF5 100%)',  // total — deep navy
  'linear-gradient(145deg, #0A3D62 0%, #0E5FA3 45%, #1B87D6 85%, #4FB3FF 100%)',  // biz — teal-blue
  'linear-gradient(145deg, #1A0050 0%, #3A0CA3 45%, #5E2BFF 80%, #9D6FFF 100%)',  // person 1 — violet
  'linear-gradient(145deg, #003049 0%, #006494 45%, #00A8CC 80%, #48CAE4 100%)',  // person 2 — cyan
  'linear-gradient(145deg, #0B3D2E 0%, #1B6B47 45%, #2DB37D 80%, #5FD9A8 100%)',  // person 3 — emerald
  'linear-gradient(145deg, #4A1040 0%, #7B1FA2 45%, #BA68C8 80%, #E1BEE7 100%)',  // person 4 — plum
  'linear-gradient(145deg, #1A2800 0%, #3D5A00 45%, #6B9E00 80%, #A0CC33 100%)',  // person 5 — olive
];

export function Dashboard({ txs, people, currency, businessName, onPersonFilter, onEdit, onDelete, balanceHidden, onToggleHidden }: Props) {
  const hidden = balanceHidden;
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [activeCard, setActiveCard] = useState(0);
  const [trayVisible, setTrayVisible] = useState(true); // fades after 4s unless reorder

  let totalIn = 0, totalOut = 0, ownerIn = 0, ownerOut = 0;
  for (const t of txs) {
    if (t.type === 'income')  totalIn  += t.amount;
    else if (t.type === 'expense' || t.type === 'salary') totalOut += t.amount;
    else if (t.type === 'owner-fund')  { totalIn  += t.amount; ownerIn  += t.amount; }
    else if (t.type === 'fund-return') { totalOut += t.amount; ownerOut += t.amount; }
    else if (t.type === 'credit') totalIn += (t.creditPaid || 0);
  }
  const netOwner = ownerIn - ownerOut;

  // Biz account balance
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

  const totalCashAvailable = (() => {
    let sum = Math.max(0, bizBalance);
    for (const p of members) {
      const { pBal } = pStats(p.id, txs);
      if (pBal > 0) sum += pBal;
    }
    return sum;
  })();

  // ── Tray inventory ────────────────────────────────────────────────────────
  const trayInventory = (() => {
    let trayStockTotal = 0;
    let totalEggPieces = 0;
    let hasTrayData    = false;
    for (const t of txs) {
      if (t.type === 'expense' && t.cat === 'Tray Stock' && t.trayPacks) {
        trayStockTotal += (t.trayPacks || 0) * (t.trayPiecesPerPack || 100);
        hasTrayData = true;
      } else if (t.type === 'egg-collection' && t.eggPieces) {
        totalEggPieces += (t.eggPieces || 0);
        hasTrayData = true;
      }
    }
    const traysConsumed = Math.floor(totalEggPieces / 30);
    const remaining     = Math.max(0, trayStockTotal - traysConsumed);
    const packs         = Math.floor(remaining / 100);
    const pieces        = remaining % 100;
    const reorder       = remaining < 120;
    return { packs, pieces, totalTrays: remaining, reorder, hasTrayData };
  })();

  // Fade-out tray notice after 4s — unless stock is low (reorder stays)
  useEffect(() => {
    if (!trayInventory.hasTrayData || trayInventory.reorder) {
      setTrayVisible(true);
      return;
    }
    setTrayVisible(true);
    const timer = setTimeout(() => setTrayVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [trayInventory.hasTrayData, trayInventory.reorder]);

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

  const mask = (v: string) => hidden ? '••••••' : v;

  // Build stacked card data: [total, biz, ...members]
  const cardData = [
    {
      label: 'Total Cash',
      sub: 'Available balance',
      balance: totalCashAvailable,
      gradient: CARD_GRADIENTS[0],
      extra: (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              { lbl: 'Total In',  val: hidden ? '••••' : fmtAmt(totalIn, ''),  col: '#A8C4FF', icon: <TrendingUp size={11} /> },
              { lbl: 'Total Out', val: hidden ? '••••' : fmtAmt(totalOut, ''), col: '#FFB3C0', icon: <TrendingDown size={11} /> },
              { lbl: 'Entries',   val: String(txs.length),                     col: '#B3D4FF', icon: <Hash size={11} /> },
            ].map(s => (
              <div key={s.lbl} style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '10px 9px', border: '1px solid rgba(255,255,255,0.14)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: 'rgba(255,255,255,0.5)' }}>
                  {s.icon}
                  <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.lbl}</span>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.74rem', fontWeight: 600, color: s.col }}>{s.val}</div>
              </div>
            ))}
          </div>
          {netOwner > 0.005 && (
            <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>🟠 Fund Injection (net)</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.74rem', fontWeight: 500, color: '#FFD080' }}>{hidden ? '••••' : fmtAmt(netOwner, currency)}</span>
            </div>
          )}
        </>
      ),
    },
    {
      label: 'Biz Saving',
      sub: 'Internal funds held',
      balance: bizBalance,
      gradient: CARD_GRADIENTS[1],
      extra: null,
    },
    ...members.map((p, i) => {
      const { pIn, pOut, pBal } = pStats(p.id, txs);
      return {
        label: p.name,
        sub: p.role || 'Team member',
        balance: pBal,
        gradient: CARD_GRADIENTS[2 + (i % (CARD_GRADIENTS.length - 2))],
        extra: !hidden ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>↑ {fmtAmt(pIn, currency)}</span>
            <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>↓ {fmtAmt(pOut, currency)}</span>
          </div>
        ) : null,
      };
    }),
  ];

  const PEEK_HEIGHT = 38; // px of peeking card showing name only
  const CARD_HEIGHT = 210; // active card height px (approximate)

  return (
    <div style={{ padding: '16px 16px 120px' }}>

      {/* ── Tray Inventory Notice ── */}
      {trayInventory.hasTrayData && (
        <div style={{
          marginBottom: 12,
          transition: 'opacity 0.8s ease, max-height 0.8s ease',
          opacity: trayVisible ? 1 : 0,
          maxHeight: trayVisible ? 120 : 0,
          overflow: 'hidden',
          pointerEvents: trayVisible ? 'auto' : 'none',
        }}>
          {trayInventory.reorder ? (
            <>
              <div style={{
                background: 'rgba(220,38,38,0.10)', border: '1.5px solid #DC2626',
                borderRadius: 12, padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                animation: 'reorder-blink 1.2s ease-in-out infinite',
              }}>
                <span style={{ fontSize: '0.95rem' }}>📦</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#DC2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>REORDER TRAY</span>
                <span style={{ fontSize: '0.66rem', color: '#991B1B', marginLeft: 'auto' }}>
                  {trayInventory.packs > 0 ? `${trayInventory.packs} pack${trayInventory.packs !== 1 ? 's' : ''} + ` : ''}{trayInventory.pieces} pcs left
                </span>
              </div>
              <style>{`@keyframes reorder-blink { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
            </>
          ) : (
            <div style={{
              background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 12, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '0.85rem' }}>🥚</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5B21B6', letterSpacing: '0.04em' }}>Tray Stock:</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.74rem', fontWeight: 700, color: '#3730A3' }}>
                {trayInventory.packs > 0 ? `${trayInventory.packs} pack${trayInventory.packs !== 1 ? 's' : ''}` : ''}
                {trayInventory.packs > 0 && trayInventory.pieces > 0 ? ' + ' : ''}
                {trayInventory.pieces > 0 || trayInventory.packs === 0 ? `${trayInventory.pieces} pcs` : ''}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#7C3AED', marginLeft: 'auto' }}>({trayInventory.totalTrays} total)</span>
            </div>
          )}
        </div>
      )}

      {/* ── Stacked Balance Cards ── */}
      <div
        style={{
          position: 'relative',
          marginBottom: 20,
          // total height = active card + peeks of cards behind
          height: CARD_HEIGHT + (cardData.length - 1) * PEEK_HEIGHT,
        }}
      >
        {cardData.map((card, idx) => {
          const isActive    = idx === activeCard;
          const isBehind    = idx > activeCard;
          const isInFront   = idx < activeCard; // already "used", not visible
          // Cards stack: active on top; behind cards peek below
          const zIndex      = isActive ? cardData.length : cardData.length - idx;
          const topOffset   = isActive
            ? 0
            : isBehind
            ? CARD_HEIGHT + (idx - activeCard - 1) * PEEK_HEIGHT
            : -(CARD_HEIGHT); // in-front (dismissed) cards hidden above

          const balStr = fmtAmt(Math.abs(card.balance), currency);
          const balFontSize = balStr.length > 16 ? '1.4rem' : balStr.length > 12 ? '1.8rem' : '2.2rem';

          return (
            <div
              key={card.label + idx}
              onClick={() => { if (!isActive) setActiveCard(idx); }}
              style={{
                position: 'absolute', left: 0, right: 0,
                top: topOffset,
                zIndex,
                borderRadius: 22,
                background: card.gradient,
                overflow: 'hidden',
                cursor: isActive ? 'default' : 'pointer',
                transition: 'top 0.4s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.3s ease',
                boxShadow: isActive
                  ? '0 14px 48px rgba(13,27,110,0.45), 0 2px 8px rgba(0,0,0,0.2)'
                  : '0 4px 16px rgba(0,0,0,0.18)',
                userSelect: 'none',
              }}
            >
              {/* Decorative bubbles */}
              <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -30, left: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: '1px solid rgba(255,255,255,0.11)', pointerEvents: 'none' }} />

              {/* Peek strip (always shown as label) */}
              <div style={{
                padding: isActive ? '20px 20px 18px' : '0 20px',
                display: 'flex', flexDirection: 'column',
                height: isActive ? 'auto' : PEEK_HEIGHT,
                justifyContent: isActive ? 'flex-start' : 'center',
              }}>
                {/* Card name row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    {businessName && isActive && idx === 0 && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 2, letterSpacing: '0.04em' }}>
                        🏢 {businessName}
                      </div>
                    )}
                    <div style={{ fontSize: isActive ? '0.58rem' : '0.6rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                      {card.label}
                    </div>
                    {isActive && (
                      <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.45)', marginTop: 1, letterSpacing: '0.05em' }}>{card.sub}</div>
                    )}
                  </div>
                  {isActive && idx === 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); onToggleHidden(); }}
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.75)' }}
                      title={hidden ? 'Show balances' : 'Hide balances'}
                    >
                      {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                  {/* Inactive cards: show balance hint on right */}
                  {!isActive && (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                      {hidden ? '••••' : fmtAmt(card.balance, currency)}
                    </span>
                  )}
                </div>

                {/* Active card body */}
                {isActive && (
                  <>
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: balFontSize,
                      fontWeight: 600,
                      color: card.balance < 0 ? '#FFB3C0' : '#fff',
                      letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 10,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    }}>
                      {hidden ? '••••••••' : (card.balance < 0 ? '-' : '') + fmtAmt(Math.abs(card.balance), currency)}
                    </div>
                    {card.extra}
                    {/* Dot indicators */}
                    <div style={{ display: 'flex', gap: 5, marginTop: 14, justifyContent: 'center' }}>
                      {cardData.map((_, di) => (
                        <div
                          key={di}
                          onClick={e => { e.stopPropagation(); setActiveCard(di); }}
                          style={{
                            width: di === activeCard ? 16 : 6, height: 6, borderRadius: 3,
                            background: di === activeCard ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                            cursor: 'pointer', transition: 'width 0.3s ease, background 0.3s ease',
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming Pickups */}
      {upcomingPickups.length > 0 && (
        <div style={{ background: 'rgba(61,107,223,0.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(61,107,223,0.18)' }}>
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

      {/* Outstanding Credit */}
      {owing.length > 0 && (
        <div style={{ background: 'rgba(232,62,92,0.07)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(232,62,92,0.15)' }}>
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

      {/* Recent Transactions */}
      <div style={sh}>Recent Transactions</div>
      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9A9FB8', fontSize: '0.8rem' }}>
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
