import React, { useState, useEffect, useCallback } from 'react';
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

// ── Haptic feedback (works on iOS/Android with Vibration API) ────────────────
function haptic(style: 'light' | 'medium' = 'light') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(style === 'light' ? 8 : 18);
    }
  } catch (_) { /* silent */ }
}

// ── Card colour palette ───────────────────────────────────────────────────────
// Each card has a solid deep colour used for the active card bg,
// and an rgba variant for the glass peek cards behind it.
const PALETTE = [
  { solid: 'linear-gradient(148deg,#0D1B6E 0%,#1A2FA8 45%,#2D52E0 80%,#4A76F5 100%)', glow: 'rgba(26,47,168,0.55)'  },
  { solid: 'linear-gradient(148deg,#0A3D62 0%,#0E5FA3 45%,#1B87D6 80%,#4FB3FF 100%)', glow: 'rgba(14,95,163,0.55)'  },
  { solid: 'linear-gradient(148deg,#1A0050 0%,#3A0CA3 45%,#5E2BFF 80%,#9D6FFF 100%)', glow: 'rgba(58,12,163,0.55)'  },
  { solid: 'linear-gradient(148deg,#003049 0%,#006494 45%,#00A8CC 80%,#48CAE4 100%)', glow: 'rgba(0,100,148,0.55)'  },
  { solid: 'linear-gradient(148deg,#0B3D2E 0%,#1B6B47 45%,#2DB37D 80%,#5FD9A8 100%)', glow: 'rgba(27,107,71,0.55)'  },
  { solid: 'linear-gradient(148deg,#4A1040 0%,#7B1FA2 45%,#BA68C8 80%,#E1BEE7 100%)', glow: 'rgba(123,31,162,0.55)' },
];

// ── CSS injected once ─────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes reorder-blink { 0%,100%{opacity:1} 50%{opacity:0.38} }
  @keyframes card-in       { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
`;

export function Dashboard({
  txs, people, currency, businessName,
  onPersonFilter, onEdit, onDelete,
  balanceHidden, onToggleHidden,
}: Props) {
  const hidden = balanceHidden;
  const [detailTx,    setDetailTx]    = useState<Transaction | null>(null);
  const [activeCard,  setActiveCard]  = useState(0);
  const [trayVisible, setTrayVisible] = useState(true);
  const [animating,   setAnimating]   = useState(false);

  // ── Totals ───────────────────────────────────────────────────────────────
  let totalIn = 0, totalOut = 0, ownerIn = 0, ownerOut = 0;
  for (const t of txs) {
    if      (t.type === 'income')                            { totalIn  += t.amount; }
    else if (t.type === 'expense' || t.type === 'salary')    { totalOut += t.amount; }
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

  // ── People ────────────────────────────────────────────────────────────────
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
    let stock = 0, eggs = 0, hasTrayData = false;
    for (const t of txs) {
      if (t.type === 'expense' && t.cat === 'Tray Stock' && t.trayPacks) {
        stock += (t.trayPacks || 0) * (t.trayPiecesPerPack || 100);
        hasTrayData = true;
      } else if (t.type === 'egg-collection' && t.eggPieces) {
        eggs += (t.eggPieces || 0);
        hasTrayData = true;
      }
    }
    const consumed  = Math.floor(eggs / 30);
    const remaining = Math.max(0, stock - consumed);
    return {
      packs: Math.floor(remaining / 100),
      pieces: remaining % 100,
      totalTrays: remaining,
      reorder: remaining < 120,
      hasTrayData,
    };
  })();

  // Tray notice auto-fade
  useEffect(() => {
    if (!trayInventory.hasTrayData || trayInventory.reorder) { setTrayVisible(true); return; }
    setTrayVisible(true);
    const t = setTimeout(() => setTrayVisible(false), 4000);
    return () => clearTimeout(t);
  }, [trayInventory.hasTrayData, trayInventory.reorder]);

  // ── Card switch with spring + haptic ─────────────────────────────────────
  const switchCard = useCallback((idx: number) => {
    if (idx === activeCard || animating) return;
    haptic('medium');
    setAnimating(true);
    setActiveCard(idx);
    setTimeout(() => setAnimating(false), 500);
  }, [activeCard, animating]);

  // ── Card data ─────────────────────────────────────────────────────────────
  const cardData = [
    {
      label:    'Total Cash',
      sub:      'Available balance',
      balance:  totalCashAvailable,
      palette:  PALETTE[0],
      body: () => (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
            {[
              { lbl: 'Total In',  val: hidden ? '••••' : fmtAmt(totalIn,  ''), col: '#A8C8FF' },
              { lbl: 'Total Out', val: hidden ? '••••' : fmtAmt(totalOut, ''), col: '#FFB3C0' },
              { lbl: 'Entries',   val: String(txs.length),                     col: '#CBD5E1' },
            ].map(s => (
              <div key={s.lbl} style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 12,
                padding: '10px 8px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <div style={{ fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>{s.lbl}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 700, color: s.col }}>{s.val}</div>
              </div>
            ))}
          </div>
          {netOwner > 0.005 && (
            <div style={{ marginTop: 9, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Fund Injection</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 600, color: '#FFD080' }}>{hidden ? '••••' : fmtAmt(netOwner, currency)}</span>
            </div>
          )}
        </>
      ),
    },
    {
      label:   'Biz Saving',
      sub:     'Internal funds held',
      balance: bizBalance,
      palette: PALETTE[1],
      body: () => null,
    },
    ...members.map((p, i) => {
      const { pIn, pOut, pBal } = pStats(p.id, txs);
      return {
        label:   p.name,
        sub:     p.role || 'Team member',
        balance: pBal,
        palette: PALETTE[2 + (i % (PALETTE.length - 2))],
        body: () => !hidden ? (
          <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '8px 12px', flex: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.46rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Total In</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 700, color: '#A8C8FF' }}>{fmtAmt(pIn, currency)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '8px 12px', flex: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.46rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Total Out</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', fontWeight: 700, color: '#FFB3C0' }}>{fmtAmt(pOut, currency)}</div>
            </div>
          </div>
        ) : null,
      };
    }),
  ];

  const TOTAL   = cardData.length;
  const CARD_H  = 220;   // active card rendered height (px)
  const PEEK_H  = 34;    // how many px of each background card peeks below
  const OFFSET  = 8;     // horizontal inset per depth level (px)
  const SCALE   = 0.034; // scale reduction per depth level

  // Credit / debit entries in view
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 16px 120px' }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Tray notice ── */}
      {trayInventory.hasTrayData && (
        <div style={{
          marginBottom: 12,
          transition: 'opacity 0.9s ease, max-height 0.9s ease',
          opacity: trayVisible ? 1 : 0,
          maxHeight: trayVisible ? 100 : 0,
          overflow: 'hidden',
          pointerEvents: trayVisible ? 'auto' : 'none',
        }}>
          {trayInventory.reorder ? (
            <div style={{
              background: 'rgba(220,38,38,0.10)', border: '1.5px solid #DC2626',
              borderRadius: 12, padding: '9px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'reorder-blink 1.2s ease-in-out infinite',
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#DC2626', letterSpacing: '0.07em', textTransform: 'uppercase' }}>REORDER TRAY</span>
              <span style={{ fontSize: '0.65rem', color: '#991B1B', marginLeft: 'auto' }}>
                {trayInventory.packs > 0 ? `${trayInventory.packs} pack${trayInventory.packs !== 1 ? 's' : ''} + ` : ''}{trayInventory.pieces} pcs left
              </span>
            </div>
          ) : (
            <div style={{
              background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)',
              borderRadius: 12, padding: '9px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5B21B6', letterSpacing: '0.04em' }}>Tray Stock</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.74rem', fontWeight: 700, color: '#3730A3' }}>
                {trayInventory.packs > 0 ? `${trayInventory.packs}pk` : ''}
                {trayInventory.packs > 0 && trayInventory.pieces > 0 ? ' + ' : ''}
                {trayInventory.pieces > 0 || trayInventory.packs === 0 ? `${trayInventory.pieces}pcs` : ''}
              </span>
              <span style={{ fontSize: '0.58rem', color: '#7C3AED', marginLeft: 'auto' }}>{trayInventory.totalTrays} total</span>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STACKED CARD DECK
          Layout: active card sits on top at y=0.
          Behind cards are layered BELOW the active card, each showing
          a PEEK_H strip, inset slightly on each side, and scaled down.
          When a background card is tapped → spring transition to front.
      ══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'relative',
          marginBottom: 24,
          // container height = active card height + sum of peek strips for background cards
          height: CARD_H + Math.max(0, TOTAL - 1) * PEEK_H,
        }}
      >
        {cardData.map((card, idx) => {
          // depth = how far behind the active card this card is (0 = active)
          const depth     = (idx - activeCard + TOTAL) % TOTAL;
          const isActive  = depth === 0;

          // Active card: sits at top, full opacity, prominent shadow
          // Background cards: stack below, each pushed further down by PEEK_H,
          // inset by OFFSET * depth, scaled down slightly, with glass opacity
          const topY      = isActive ? 0 : CARD_H + (depth - 1) * PEEK_H;
          const insetPx   = isActive ? 0 : Math.min(depth * OFFSET, 32);
          const scale     = isActive ? 1 : Math.max(1 - depth * SCALE, 0.88);
          const opacity   = isActive ? 1 : Math.max(1 - depth * 0.18, 0.52);
          const zIdx      = TOTAL - depth;

          const balStr      = fmtAmt(Math.abs(card.balance), currency);
          const balFontSize = balStr.length > 16 ? '1.35rem' : balStr.length > 11 ? '1.75rem' : '2.1rem';

          return (
            <div
              key={card.label + idx}
              onClick={() => { if (!isActive) switchCard(idx); }}
              style={{
                position:   'absolute',
                left:       insetPx,
                right:      insetPx,
                top:        topY,
                zIndex:     zIdx,
                borderRadius: 24,
                overflow:   'hidden',
                cursor:     isActive ? 'default' : 'pointer',
                userSelect: 'none',
                // Spring transition — cubic-bezier mimics spring overshoot
                transition: animating
                  ? 'top 0.46s cubic-bezier(0.34,1.28,0.64,1), left 0.46s cubic-bezier(0.34,1.28,0.64,1), right 0.46s cubic-bezier(0.34,1.28,0.64,1), opacity 0.35s ease, box-shadow 0.35s ease'
                  : 'top 0.46s cubic-bezier(0.34,1.28,0.64,1), left 0.46s ease, right 0.46s ease, opacity 0.35s ease, box-shadow 0.35s ease',
                opacity,
                // Active: rich shadow + glow; background: subtle layered shadow
                boxShadow: isActive
                  ? `0 18px 56px ${card.palette.glow}, 0 4px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.14)`
                  : `0 ${depth * 3}px ${depth * 10}px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08)`,
                // background cards get glassmorphism: blur + semi-transparent solid
                background: isActive
                  ? card.palette.solid
                  : card.palette.solid,
                backdropFilter: isActive ? 'none' : `blur(${Math.min(depth * 4, 12)}px)`,
                WebkitBackdropFilter: isActive ? 'none' : `blur(${Math.min(depth * 4, 12)}px)`,
              }}
            >
              {/* Decorative orbs — only on active card */}
              {isActive && (
                <>
                  <div style={{ position: 'absolute', top: -55, right: -55, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: -35, left: -25, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: '1px solid rgba(255,255,255,0.13)', pointerEvents: 'none' }} />
                </>
              )}

              {/* Card inner content */}
              <div style={{ padding: isActive ? '22px 20px 20px' : '0 20px', position: 'relative', zIndex: 1 }}>

                {/* ── Header row (always visible) ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  height: isActive ? 'auto' : PEEK_H,
                  paddingTop: isActive ? 0 : 0,
                }}>
                  <div>
                    {businessName && isActive && idx === 0 && (
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                        {businessName}
                      </div>
                    )}
                    <div style={{
                      fontSize: '0.56rem', fontWeight: 800,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: isActive ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.55)',
                    }}>
                      {card.label}
                    </div>
                    {isActive && (
                      <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.38)', marginTop: 2, letterSpacing: '0.04em' }}>
                        {card.sub}
                      </div>
                    )}
                  </div>

                  {/* Eye toggle on active card (card 0 only) */}
                  {isActive && idx === 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); haptic(); onToggleHidden(); }}
                      style={{
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)',
                        borderRadius: 9, width: 30, height: 30,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(6px)',
                        transition: 'background 0.15s',
                        flexShrink: 0,
                      }}
                      title={hidden ? 'Show balances' : 'Hide balances'}
                    >
                      {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}

                  {/* Background card: show masked balance on right */}
                  {!isActive && (
                    <span style={{
                      fontFamily: "'DM Mono',monospace", fontSize: '0.68rem',
                      fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                      letterSpacing: '-0.01em',
                    }}>
                      {hidden ? '•••' : fmtAmt(card.balance, currency)}
                    </span>
                  )}
                </div>

                {/* ── Active card body ── */}
                {isActive && (
                  <>
                    {/* Main balance */}
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: balFontSize,
                      fontWeight: 700,
                      color: card.balance < 0 ? '#FCA5A5' : '#FFFFFF',
                      letterSpacing: '-0.025em',
                      lineHeight: 1.05,
                      marginTop: 10,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textShadow: '0 2px 16px rgba(0,0,0,0.18)',
                      transition: 'font-size 0.2s ease',
                    }}>
                      {hidden ? '••••••••' : (card.balance < 0 ? '−' : '') + fmtAmt(Math.abs(card.balance), currency)}
                    </div>

                    {/* Card-specific body */}
                    {card.body()}

                    {/* Dot indicators — tap to navigate */}
                    <div style={{ display: 'flex', gap: 5, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
                      {cardData.map((_, di) => {
                        const dotDepth = (di - activeCard + TOTAL) % TOTAL;
                        const isActiveDot = dotDepth === 0;
                        return (
                          <div
                            key={di}
                            onClick={e => { e.stopPropagation(); switchCard(di); }}
                            style={{
                              width:  isActiveDot ? 18 : 6,
                              height: 5,
                              borderRadius: 3,
                              background: isActiveDot ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.28)',
                              cursor: 'pointer',
                              transition: 'width 0.3s cubic-bezier(0.34,1.2,0.64,1), background 0.3s ease',
                            }}
                          />
                        );
                      })}
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
        <div style={{ textAlign: 'center', padding: '28px 0', color: '#9A9FB8', fontSize: '0.8rem' }}>
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
  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#5A5F7A', marginBottom: 10, marginTop: 4,
};
