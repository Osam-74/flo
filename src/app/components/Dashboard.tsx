import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Transaction, Person } from '../types';
import { fmtAmt, pStats, fmtDate } from '../utils';
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

function haptic() {
  try { if (navigator?.vibrate) navigator.vibrate(12); } catch (_) {}
}

const PALETTE = [
  { grad: 'linear-gradient(148deg,#0D1B6E 0%,#1A2FA8 50%,#3D6BDF 100%)', glow: 'rgba(26,47,168,0.55)' },
  { grad: 'linear-gradient(148deg,#0A3D62 0%,#0E5FA3 50%,#1B87D6 100%)', glow: 'rgba(14,95,163,0.5)'  },
  { grad: 'linear-gradient(148deg,#2D0080 0%,#5E2BFF 50%,#9D6FFF 100%)', glow: 'rgba(94,43,255,0.5)'  },
  { grad: 'linear-gradient(148deg,#003049 0%,#006494 50%,#00A8CC 100%)', glow: 'rgba(0,100,148,0.5)'  },
  { grad: 'linear-gradient(148deg,#0B3D2E 0%,#1B6B47 50%,#2DB37D 100%)', glow: 'rgba(27,107,71,0.5)'  },
  { grad: 'linear-gradient(148deg,#4A1040 0%,#7B1FA2 50%,#BA68C8 100%)', glow: 'rgba(123,31,162,0.5)' },
];

const CSS = `
  @keyframes reorder-blink { 0%,100%{opacity:1}50%{opacity:0.35} }
  .card-wrap { will-change: transform, opacity; }
`;

// PEEK_H: how many px of each background card shows above the front card
const PEEK_H    = 36;   // height of the peeking name tab
const PEEK_STEP = 30;   // vertical gap between each peeking tab
const CARD_H    = 200;  // height of the fully visible front card body

export function Dashboard({
  txs, people, currency, businessName,
  onPersonFilter, onEdit, onDelete,
  balanceHidden, onToggleHidden,
}: Props) {
  const hidden = balanceHidden;
  const [detailTx,    setDetailTx]    = useState<Transaction | null>(null);
  const [order,       setOrder]       = useState<number[]>([]); // order[0] = front card index
  const [animating,   setAnimating]   = useState(false);
  const [trayVisible, setTrayVisible] = useState(true);
  const initialized = useRef(false);

  // ── Totals ───────────────────────────────────────────────────────────────
  let totalIn = 0, totalOut = 0, ownerIn = 0, ownerOut = 0;
  for (const t of txs) {
    if      (t.type === 'income')                          { totalIn  += t.amount; }
    else if (t.type === 'expense' || t.type === 'salary')  { totalOut += t.amount; }
    else if (t.type === 'owner-fund')  { totalIn  += t.amount; ownerIn  += t.amount; }
    else if (t.type === 'fund-return') { totalOut += t.amount; ownerOut += t.amount; }
    else if (t.type === 'credit')      { totalIn  += (t.creditPaid || 0); }
  }
  const netOwner = ownerIn - ownerOut;

  // ── Biz balance ──────────────────────────────────────────────────────────
  let bizBalance = 0;
  for (const t of txs) {
    if (t.type === 'transfer') {
      if (t.transferTo   === 'biz') bizBalance += t.amount;
      if (t.transferFrom === 'biz') bizBalance -= t.amount;
    }
    if (t.type === 'income'      && (t as any).receiver === 'biz') bizBalance += t.amount;
    if (t.type === 'salary'      && t.salaryPaidBy      === 'biz') bizBalance -= t.amount;
    if (t.type === 'expense'     && t.person            === 'biz') bizBalance -= t.amount;
    if (t.type === 'owner-fund'  && t.ownerReceiver     === 'biz') bizBalance += t.amount;
    if (t.type === 'fund-return' && t.frSender          === 'biz') bizBalance -= t.amount;
    if (t.type === 'credit') {
      if (Array.isArray(t.payments) && t.payments.length > 0) {
        for (const p of t.payments) if (p.receiver === 'biz') bizBalance += p.amount;
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
    for (const p of members) { const { pBal } = pStats(p.id, txs); if (pBal > 0) sum += pBal; }
    return sum;
  })();

  // ── Tray inventory ────────────────────────────────────────────────────────
  const trayInventory = (() => {
    let stock = 0, eggs = 0, hasTrayData = false;
    for (const t of txs) {
      if (t.type === 'expense' && t.cat === 'Tray Stock' && t.trayPacks) {
        stock += (t.trayPacks || 0) * (t.trayPiecesPerPack || 100); hasTrayData = true;
      } else if (t.type === 'egg-collection' && t.eggPieces) {
        eggs += (t.eggPieces || 0); hasTrayData = true;
      }
    }
    const remaining = Math.max(0, stock - Math.floor(eggs / 30));
    return { packs: Math.floor(remaining / 100), pieces: remaining % 100, totalTrays: remaining, reorder: remaining < 120, hasTrayData };
  })();

  useEffect(() => {
    if (!trayInventory.hasTrayData || trayInventory.reorder) { setTrayVisible(true); return; }
    setTrayVisible(true);
    const t = setTimeout(() => setTrayVisible(false), 4000);
    return () => clearTimeout(t);
  }, [trayInventory.hasTrayData, trayInventory.reorder]);

  // ── Card definitions ──────────────────────────────────────────────────────
  const cards = [
    {
      label:   'Total Cash',
      sub:     businessName || 'Available balance',
      balance: totalCashAvailable,
      pal:     PALETTE[0],
      body: () => (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 18 }}>
            {[
              { lbl: 'Total In',  val: hidden ? '••••' : fmtAmt(totalIn,  ''), col: '#A8C8FF' },
              { lbl: 'Total Out', val: hidden ? '••••' : fmtAmt(totalOut, ''), col: '#FFB3C0' },
              { lbl: 'Entries',   val: String(txs.length),                     col: '#CBD5E1' },
            ].map(s => (
              <div key={s.lbl} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '9px 8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.46rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{s.lbl}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', fontWeight: 700, color: s.col }}>{s.val}</div>
              </div>
            ))}
          </div>
          {netOwner > 0.005 && (
            <div style={{ marginTop: 9, background: 'rgba(255,255,255,0.07)', borderRadius: 9, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>Fund Injection</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', fontWeight: 600, color: '#FFD080' }}>{hidden ? '••••' : fmtAmt(netOwner, currency)}</span>
            </div>
          )}
        </>
      ),
    },
    { label: 'Biz Saving', sub: 'Internal funds', balance: bizBalance, pal: PALETTE[1], body: () => null },
    ...members.map((p, i) => {
      const { pIn, pOut, pBal } = pStats(p.id, txs);
      return {
        label: p.name,
        sub:   p.role || 'Team member',
        balance: pBal,
        pal:   PALETTE[2 + (i % (PALETTE.length - 2))],
        body: () => !hidden ? (
          <div style={{ display: 'flex', gap: 7, marginTop: 16 }}>
            {[{ l: 'Total In', v: fmtAmt(pIn, currency), c: '#A8C8FF' }, { l: 'Total Out', v: fmtAmt(pOut, currency), c: '#FFB3C0' }].map(s => (
              <div key={s.l} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '9px 12px', flex: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.46rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', fontWeight: 700, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        ) : null,
      };
    }),
  ];

  // Initialise order on first render / card count change
  useEffect(() => {
    if (!initialized.current || order.length !== cards.length) {
      setOrder(cards.map((_, i) => i));
      initialized.current = true;
    }
  }, [cards.length]);

  if (order.length !== cards.length) return null; // not ready yet

  // order[0] = front card, order[1] = first card behind, etc.
  const N = cards.length;

  function bringToFront(cardIdx: number) {
    if (animating) return;
    if (order[0] === cardIdx) return;
    haptic();
    setAnimating(true);
    // rotate order so cardIdx is first
    const pos = order.indexOf(cardIdx);
    const newOrder = [...order.slice(pos), ...order.slice(0, pos)];
    setOrder(newOrder);
    setTimeout(() => setAnimating(false), 480);
  }

  // Each card in the stack:
  //   - position: absolute, all cards anchored at the same top
  //   - front (order[0]): full card visible, z-index = N, no offset
  //   - behind cards: offset upward and slightly right so name peeks
  //     above the front card's top edge; z-index descends
  //   - Container height = PEEK_H * (N-1) peeks + CARD_H front card

  const containerH = PEEK_H + (N - 1) * PEEK_STEP + CARD_H;
  // Front card top = total peek area above it
  const frontTop = (N - 1) * PEEK_STEP;

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
  const owing = Object.entries(byBuyer).map(([n, d]) => ({ n, o: d.total - d.paid })).filter(x => x.o > 0.005);
  const upcomingPickups = txs.filter(t => t.type === 'credit' && t.isPickup && t.date > todayStr).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div style={{ padding: '16px 16px 120px' }}>
      <style>{CSS}</style>

      {/* ── Tray notice ── */}
      {trayInventory.hasTrayData && (
        <div style={{ marginBottom: 14, transition: 'opacity 0.9s ease, max-height 0.9s ease', opacity: trayVisible ? 1 : 0, maxHeight: trayVisible ? 80 : 0, overflow: 'hidden', pointerEvents: trayVisible ? 'auto' : 'none' }}>
          {trayInventory.reorder ? (
            <div style={{ background: 'rgba(220,38,38,0.10)', border: '1.5px solid #DC2626', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, animation: 'reorder-blink 1.2s ease-in-out infinite' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#DC2626', letterSpacing: '0.07em', textTransform: 'uppercase' }}>REORDER TRAY</span>
              <span style={{ fontSize: '0.65rem', color: '#991B1B', marginLeft: 'auto' }}>{trayInventory.packs > 0 ? `${trayInventory.packs}pk + ` : ''}{trayInventory.pieces}pcs left</span>
            </div>
          ) : (
            <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5B21B6' }}>Tray Stock</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 700, color: '#3730A3' }}>
                {trayInventory.packs > 0 ? `${trayInventory.packs}pk` : ''}{trayInventory.packs > 0 && trayInventory.pieces > 0 ? ' + ' : ''}{(trayInventory.pieces > 0 || trayInventory.packs === 0) ? `${trayInventory.pieces}pcs` : ''}
              </span>
              <span style={{ fontSize: '0.58rem', color: '#7C3AED', marginLeft: 'auto' }}>{trayInventory.totalTrays} total</span>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TRUE STACKED DECK
          All cards sit inside one relative container.
          They are all absolutely positioned at the same
          left/right edges. The front card sits lower (at
          frontTop px from top). Background cards sit higher
          in the container, peeking out above the front card.
          Each background card is offset slightly to the right
          and shows only its name tab at the top.
      ══════════════════════════════════════════ */}
      <div style={{ position: 'relative', height: containerH, marginBottom: 24 }}>
        {order.map((cardIdx, stackPos) => {
          const card    = cards[cardIdx];
          const isFront = stackPos === 0;
          // stackPos 0 = front, 1 = first behind, 2 = second behind …
          const depth   = stackPos; // 0 = front

          // Background cards peek above the front card
          // stackPos 1 is closest behind → sits just above front top
          // stackPos 2 is further behind → peeking above stackPos 1, etc.
          // We invert: deepest card at top of peek stack (smallest top value)
          const peekFromTop = isFront
            ? frontTop                          // front card anchored at frontTop
            : (N - 1 - stackPos) * PEEK_STEP;   // background cards peek above

          // Horizontal offset: background cards shift right so peek tabs are visible
          const leftOff  = isFront ? 0 : (N - 1 - stackPos) * 10;
          const rightOff = 0;

          // Scale & opacity for depth
          const scale   = isFront ? 1 : 1 - depth * 0.025;
          const opacity = isFront ? 1 : 1 - depth * 0.15;

          // z-index: front on top, deeper cards further back
          const zIdx = N - depth;

          const balStr      = fmtAmt(Math.abs(card.balance), currency);
          const balFontSize = balStr.length > 16 ? '1.3rem' : balStr.length > 11 ? '1.7rem' : '2rem';

          return (
            <div
              key={cardIdx}
              className="card-wrap"
              style={{
                position:   'absolute',
                top:        peekFromTop,
                left:       leftOff,
                right:      rightOff,
                zIndex:     zIdx,
                borderRadius: 22,
                overflow:   'hidden',
                cursor:     isFront ? 'default' : 'pointer',
                userSelect: 'none',
                background: card.pal.grad,
                opacity,
                transform:  `scale(${scale})`,
                transformOrigin: 'top center',
                backdropFilter:       isFront ? 'none' : 'blur(6px)',
                WebkitBackdropFilter: isFront ? 'none' : 'blur(6px)',
                boxShadow: isFront
                  ? `0 20px 60px ${card.pal.glow}, 0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)`
                  : `0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)`,
                transition: 'top 0.46s cubic-bezier(0.34,1.26,0.64,1), left 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease, transform 0.4s ease',
              }}
              onClick={() => { if (!isFront) bringToFront(cardIdx); }}
            >
              {/* Orb decorations — front only */}
              {isFront && (
                <>
                  <div style={{ position: 'absolute', top: -55, right: -55, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: -35, left: -25, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: '1px solid rgba(255,255,255,0.13)', pointerEvents: 'none' }} />
                </>
              )}

              <div style={{ padding: '16px 18px 18px', position: 'relative', zIndex: 1, minHeight: isFront ? CARD_H : PEEK_H }}>
                {/* ── Name row (always visible) ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    {isFront && businessName && cardIdx === 0 && (
                      <div style={{ fontSize: '0.56rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', marginBottom: 3 }}>{businessName}</div>
                    )}
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: isFront ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.6)' }}>
                      {card.label}
                    </div>
                    {isFront && (
                      <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.38)', marginTop: 2, letterSpacing: '0.04em' }}>{card.sub}</div>
                    )}
                  </div>

                  {/* Eye toggle — front card only, card 0 only */}
                  {isFront && cardIdx === 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); haptic(); onToggleHidden(); }}
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 9, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', flexShrink: 0 }}
                    >
                      {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}

                  {/* Background card: dim balance hint */}
                  {!isFront && (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.66rem', fontWeight: 700, color: 'rgba(255,255,255,0.38)', letterSpacing: '-0.01em' }}>
                      {hidden ? '•••' : fmtAmt(card.balance, currency)}
                    </span>
                  )}
                </div>

                {/* ── Front card body ── */}
                {isFront && (
                  <>
                    <div style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: balFontSize,
                      fontWeight: 700,
                      color: card.balance < 0 ? '#FCA5A5' : '#FFFFFF',
                      letterSpacing: '-0.025em',
                      lineHeight: 1.05,
                      marginTop: 10,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textShadow: '0 2px 18px rgba(0,0,0,0.2)',
                    }}>
                      {hidden ? '••••••••' : (card.balance < 0 ? '−' : '') + fmtAmt(Math.abs(card.balance), currency)}
                    </div>

                    {card.body()}

                    {/* Dot pips */}
                    <div style={{ display: 'flex', gap: 5, marginTop: 14, alignItems: 'center', justifyContent: 'center' }}>
                      {order.map((ci, sp) => (
                        <div
                          key={ci}
                          onClick={e => { e.stopPropagation(); bringToFront(ci); }}
                          style={{
                            width:  sp === 0 ? 18 : 6,
                            height: 5,
                            borderRadius: 3,
                            background: sp === 0 ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)',
                            cursor: 'pointer',
                            transition: 'width 0.3s cubic-bezier(0.34,1.2,0.64,1)',
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

      {/* ── Upcoming Pickups ── */}
      {upcomingPickups.length > 0 && (
        <div style={{ background: 'rgba(61,107,223,0.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(61,107,223,0.18)' }}>
          <div style={sh}>Awaiting Pickup</div>
          {upcomingPickups.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid rgba(61,107,223,0.08)' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A2FA8' }}>{t.creditBuyer || '—'}</div>
                <div style={{ fontSize: '0.64rem', color: '#7A8FC4', marginTop: 1 }}>{fmtDate(t.date)}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.82rem', fontWeight: 600, color: '#1A2FA8' }}>
                {hidden ? '••••' : fmtAmt(t.creditTotal || 0, currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Outstanding Credit ── */}
      {owing.length > 0 && (
        <div style={{ background: 'rgba(232,62,92,0.07)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(232,62,92,0.15)' }}>
          <div style={sh}>Outstanding Credit</div>
          {owing.map(x => (
            <div key={x.n} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: '0.8rem', color: '#5A5F7A' }}>{x.n}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.8rem', fontWeight: 700, color: '#E83E5C' }}>
                {hidden ? '••••' : fmtAmt(x.o, currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Transactions ── */}
      <div style={sh}>Recent Transactions</div>
      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: '#9A9FB8', fontSize: '0.8rem' }}>No transactions yet.</div>
      ) : (
        recent.map(t => (
          <TxItem key={t.id} tx={t} people={people} currency={currency} showActions={false} onEdit={onEdit} onDelete={onDelete} onClick={() => setDetailTx(t)} />
        ))
      )}

      <TxDetailModal tx={detailTx} people={people} currency={currency} onClose={() => setDetailTx(null)} />
    </div>
  );
}

const sh: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#5A5F7A', marginBottom: 10, marginTop: 4,
};
