import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Transaction, Person } from '../types';
import { pColor, pInit, fmtDate, TX_COLORS, TX_BG } from '../utils';

interface Props {
  tx: Transaction;
  people: Person[];
  currency: string;
  showActions: boolean;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string, desc: string) => void;
}

// All circle icons — different fill levels as visual distinction
const TX_CIRCLE: Record<string, React.ReactNode> = {
  income:        <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="1"/></svg>,
  expense:       <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2.5"/><circle cx="10" cy="10" r="4" fill="currentColor"/></svg>,
  salary:        <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.9"/><circle cx="10" cy="10" r="4" fill="white" opacity="0.5"/></svg>,
  transfer:      <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.7"/><circle cx="10" cy="10" r="5.5" fill="none" stroke="white" strokeWidth="1.5"/></svg>,
  credit:        <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="10" cy="10" r="6.5" fill="currentColor" opacity="0.6"/></svg>,
  'owner-fund':  <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.5"/><circle cx="10" cy="10" r="5" fill="currentColor"/></svg>,
  'fund-return': <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>,
};

export function TxItem({ tx, people, currency, showActions, onEdit, onDelete }: Props) {
  const person = people.find(p => p.id === tx.person);
  const c = person ? pColor(person) : { bg: 'rgba(61,107,223,0.12)', text: '#3D6BDF' };

  const isIn = tx.type === 'income' || tx.type === 'owner-fund';
  const iconColor = TX_COLORS[tx.type] || '#3D6BDF';
  const iconBg    = TX_BG[tx.type]    || 'rgba(61,107,223,0.12)';

  let amountEl: React.ReactNode;
  if (tx.type === 'credit') {
    const paid  = tx.creditPaid  || 0;
    const total = tx.creditTotal || 0;
    const todayStrAmt = new Date().toISOString().split('T')[0];
    // isPickup is the only authority — never auto-settle based on date
    const isAwaitingPickup = !!tx.isPickup;
    const isDelayedPickup  = isAwaitingPickup && (tx.date || '') < todayStrAmt;
    amountEl = isAwaitingPickup ? (
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1.1rem', textAlign: 'center' }}>{isDelayedPickup ? '⏰' : '🥚'}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: isDelayedPickup ? '#E8903E' : '#1A4FA8', fontWeight: 700 }}>
          {isDelayedPickup ? 'Delayed' : 'Awaiting'}
        </div>
      </div>
    ) : (
      <div className="text-right flex-shrink-0">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.88rem', fontWeight: 600, color: '#3D6BDF' }}>
          +{currency} {paid.toFixed(2)}
        </div>
        <div style={{ fontSize: '0.62rem', color: '#9A9FB8' }}>of {currency} {total.toFixed(2)}</div>
      </div>
    );
  } else if (tx.type === 'transfer') {
    const amt = Number(tx.amount) || 0;
    amountEl = (
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.88rem', fontWeight: 600, color: '#5A84FF', flexShrink: 0 }}>
        ⇄ {currency} {amt.toFixed(2)}
      </div>
    );
  } else {
    const amt  = Number(tx.amount) || 0;
    const sign = isIn ? '+' : '−';
    const col  = isIn ? '#1A2FA8' : '#E83E5C';
    amountEl = (
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.88rem', fontWeight: 600, color: col, flexShrink: 0 }}>
        {sign}{currency} {amt.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      </div>
    );
  }

  const extraMeta: React.ReactNode[] = [];
  if (tx.buyer) extraMeta.push(<span key="buyer" style={metaCss}>{tx.buyer}</span>);
  if (tx.type === 'transfer') {
    const fp = people.find(p => p.id === tx.transferFrom);
    const tp = people.find(p => p.id === tx.transferTo);
    extraMeta.push(
      <span key="tf" style={metaCss}>{fp?.name || '?'} → {tp?.name || '?'}</span>
    );
    if (tx.transferRef) extraMeta.push(<span key="ref" style={metaCss}>{tx.transferRef}</span>);
  }
  if (tx.type === 'credit') {
    const outstanding = (tx.creditTotal || 0) - (tx.creditPaid || 0);
    const todayStrMeta = new Date().toISOString().split('T')[0];
    const isAwaitingPickupMeta = !!tx.isPickup;
    const isDelayedPickupMeta  = isAwaitingPickupMeta && (tx.date || '') < todayStrMeta;
    if (tx.creditBuyer) extraMeta.push(<span key="crb" style={metaCss}>Buyer: {tx.creditBuyer}</span>);
    if (isAwaitingPickupMeta) {
      extraMeta.push(
        <span key="pickup-badge" style={{
          fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 6,
          background: isDelayedPickupMeta ? 'rgba(232,144,62,0.12)' : 'rgba(26,79,168,0.10)',
          color: isDelayedPickupMeta ? '#E8903E' : '#1A4FA8',
        }}>
          {isDelayedPickupMeta ? '⏰ Pickup delayed' : '🥚 Pickup scheduled'}
        </span>
      );
    } else if (outstanding > 0.005) {
      extraMeta.push(
        <span key="owe" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: 'rgba(232,62,92,0.12)', color: '#E83E5C' }}>
          Owes {currency} {outstanding.toFixed(2)}
        </span>
      );
    } else if ((tx.creditTotal || 0) > 0) {
      extraMeta.push(
        <span key="settled" style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: 'rgba(61,107,223,0.12)', color: '#3D6BDF' }}>
          Settled ✓
        </span>
      );
    }
  }
  if (tx.type === 'owner-fund') {
    const sn = people.find(p => p.id === tx.ownerSender);
    const rn = people.find(p => p.id === tx.ownerReceiver);
    if (sn) extraMeta.push(<span key="of-s" style={metaCss}>From: {sn.name}</span>);
    if (rn) extraMeta.push(<span key="of-r" style={metaCss}>To: {rn.name}</span>);
  }
  if (tx.type === 'fund-return') {
    const sn = people.find(p => p.id === tx.frSender);
    const rn = people.find(p => p.id === tx.frReceiver);
    if (sn) extraMeta.push(<span key="fr-s" style={metaCss}>From: {sn.name}</span>);
    if (rn) extraMeta.push(<span key="fr-r" style={metaCss}>To: {rn.name}</span>);
  }
  if (tx.type === 'salary') {
    if (tx.employeeName) extraMeta.push(<span key="emp" style={metaCss}>Employee: {tx.employeeName}</span>);
    const pb = people.find(p => p.id === tx.salaryPaidBy);
    if (pb) extraMeta.push(<span key="pb" style={metaCss}>Paid by: {pb.name}</span>);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '13px 14px', borderRadius: 14, background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)',
      marginBottom: 8, border: '1px solid rgba(0,0,0,0.05)',
    }}>
      {/* Circle icon */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {TX_CIRCLE[tx.type] || <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9" fill="currentColor"/></svg>}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#1A1D2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tx.desc}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {person && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {pInit(person)}
            </span>
          )}
          {tx.cat && <span style={metaCss}>{tx.cat}</span>}
          <span style={metaCss}>{fmtDate(tx.date)}</span>
          {extraMeta}
        </div>
        {tx.note && (
          <div style={{ fontSize: '0.66rem', color: '#9A9FB8', marginTop: 3, lineHeight: 1.4 }}>
            📌 {tx.note}
          </div>
        )}
      </div>

      {/* Amount */}
      {amountEl}

      {/* Actions */}
      {showActions && (onEdit || onDelete) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          {onEdit && (
            <button
              onClick={() => onEdit(tx)}
              style={actionBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.color = '#3D6BDF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9A9FB8')}
            >
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(tx.id, tx.desc)}
              style={actionBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.color = '#E83E5C')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9A9FB8')}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const metaCss: React.CSSProperties = {
  fontSize: '0.6rem', color: '#9A9FB8',
};

const actionBtnStyle: React.CSSProperties = {
  background: '#F5F7FF', border: 'none', borderRadius: 8,
  color: '#9A9FB8', width: 28, height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'color 0.15s',
};

