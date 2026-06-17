import React, { useEffect } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import type { Transaction, Person } from '../types';
import { fmtAmt, fmtDate, TX_COLORS, TX_BG, pInit, pColor } from '../utils';

const TX_LABEL: Record<string, string> = {
  income:        'Sales / Income',
  expense:       'Expense',
  salary:        'Salary',
  transfer:      'Transfer',
  credit:        'Credit Sale',
  'owner-fund':  'Fund Injection',
  'fund-return': 'Fund Return',
};

interface Props {
  tx: Transaction | null;
  people: Person[];
  currency: string;
  onClose: () => void;
  // Optional — pass these to show Edit/Delete in the modal
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string, desc: string) => void;
}

export function TxDetailModal({ tx, people, currency, onClose, onEdit, onDelete }: Props) {
  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tx, onClose]);

  if (!tx) return null;

  const iconColor = TX_COLORS[tx.type] || '#3D6BDF';
  const iconBg    = TX_BG[tx.type]    || 'rgba(61,107,223,0.12)';
  const person    = people.find(p => p.id === tx.person);
  const pc        = person ? pColor(person) : null;

  const rows: { label: string; value: React.ReactNode }[] = [];

  const isIn = tx.type === 'income' || tx.type === 'owner-fund';
  if (tx.type === 'credit') {
    rows.push({ label: 'Total Credit', value: <Mono>{fmtAmt(tx.creditTotal || 0, currency)}</Mono> });
    rows.push({ label: 'Amount Paid',  value: <Mono col="#1A2FA8">+{fmtAmt(tx.creditPaid || 0, currency)}</Mono> });
    const out = (tx.creditTotal || 0) - (tx.creditPaid || 0);
    if (out > 0.005) rows.push({ label: 'Outstanding', value: <Mono col="#E83E5C">−{fmtAmt(out, currency)}</Mono> });
  } else if (tx.type === 'transfer') {
    rows.push({ label: 'Amount', value: <Mono>⇄ {fmtAmt(tx.amount, currency)}</Mono> });
  } else {
    rows.push({ label: 'Amount', value: <Mono col={isIn ? '#1A2FA8' : '#E83E5C'}>{isIn ? '+' : '−'}{fmtAmt(tx.amount, currency)}</Mono> });
  }

  rows.push({ label: 'Date', value: fmtDate(tx.date) });
  rows.push({ label: 'Type', value: TX_LABEL[tx.type] || tx.type });

  if (tx.cat)  rows.push({ label: 'Category', value: tx.cat });
  if (tx.note) rows.push({ label: 'Note', value: tx.note });

  if (tx.type === 'transfer') {
    const fp = people.find(p => p.id === tx.transferFrom);
    const tp = people.find(p => p.id === tx.transferTo);
    rows.push({ label: 'From', value: fp?.name || tx.transferFrom || '—' });
    rows.push({ label: 'To',   value: tp?.name || tx.transferTo   || '—' });
    if (tx.transferRef) rows.push({ label: 'Reference', value: tx.transferRef });
  }

  if (tx.type === 'credit') {
    if (tx.creditBuyer)  rows.push({ label: 'Buyer', value: tx.creditBuyer });
    if (tx.creditSeller) {
      const s = people.find(p => p.id === tx.creditSeller);
      rows.push({ label: 'Seller', value: s?.name || tx.creditSeller });
    }
    if (tx.creditReceiver) {
      const r = people.find(p => p.id === tx.creditReceiver);
      rows.push({ label: 'Receiver', value: r?.name || tx.creditReceiver });
    }
    if (tx.isPickup) rows.push({ label: 'Pickup', value: '🥚 Awaiting pickup' });
  }

  if (tx.type === 'income') {
    if (tx.seller) {
      const s = people.find(p => p.id === tx.seller);
      rows.push({ label: 'Seller', value: s?.name || tx.seller });
    }
    if (tx.buyer)  rows.push({ label: 'Buyer',  value: tx.buyer });
    if (tx.source) rows.push({ label: 'Source', value: tx.source });
    if ((tx as any).receiver) {
      const r = people.find(p => p.id === (tx as any).receiver);
      rows.push({ label: 'Received by', value: r?.name || (tx as any).receiver });
    }
  }

  if (tx.type === 'salary') {
    if (tx.employeeName) rows.push({ label: 'Employee', value: tx.employeeName });
    if (tx.salaryPaidBy) {
      const pb = people.find(p => p.id === tx.salaryPaidBy);
      rows.push({ label: 'Paid by', value: pb?.name || tx.salaryPaidBy });
    }
  }

  if (tx.type === 'owner-fund') {
    const sn = people.find(p => p.id === tx.ownerSender);
    const rn = people.find(p => p.id === tx.ownerReceiver);
    if (sn) rows.push({ label: 'From', value: sn.name });
    if (rn) rows.push({ label: 'To',   value: rn.name });
  }
  if (tx.type === 'fund-return') {
    const sn = people.find(p => p.id === tx.frSender);
    const rn = people.find(p => p.id === tx.frReceiver);
    if (sn) rows.push({ label: 'From', value: sn.name });
    if (rn) rows.push({ label: 'To',   value: rn.name });
  }

  const hasActions = !!(onEdit || onDelete);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(3,4,94,0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'txFadeIn 0.2s ease',
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 401,
          background: '#fff',
          borderRadius: 22,
          padding: 0,
          width: 'min(92vw, 380px)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(26,47,168,0.22), 0 4px 16px rgba(0,0,0,0.12)',
          animation: 'txPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header band */}
        <div style={{
          background: `${iconBg}`,
          padding: '18px 18px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: iconBg, color: iconColor, border: `2px solid ${iconColor}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <TxCircle type={tx.type} />
            </div>
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: iconColor, marginBottom: 2 }}>
                {TX_LABEL[tx.type] || tx.type}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1A1D2E', lineHeight: 1.3, maxWidth: 210 }}>
                {tx.desc}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.07)', border: 'none', borderRadius: 9,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#5A5F7A', flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,62,92,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.07)'}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Person chip */}
          {person && pc && (
            <div style={{ padding: '12px 18px 0' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: pc.bg, color: pc.text,
                borderRadius: 8, padding: '4px 10px',
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: pc.text, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.52rem', fontWeight: 900,
                }}>{pInit(person)}</span>
                {person.name}
              </span>
            </div>
          )}

          {/* Detail rows */}
          <div style={{ padding: person && pc ? '10px 18px 18px' : '14px 18px 18px' }}>
            {rows.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '8px 0',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                gap: 12,
              }}>
                <span style={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9A9FB8', flexShrink: 0, paddingTop: 1 }}>
                  {r.label}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1D2E', textAlign: 'right', lineHeight: 1.4 }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Edit / Delete action footer — only when handlers provided */}
        {hasActions && (
          <div style={{
            display: 'flex', gap: 10,
            padding: '12px 18px 16px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            flexShrink: 0,
            background: '#fafbff',
          }}>
            {onEdit && (
              <button
                onClick={() => { onClose(); onEdit(tx); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: 'rgba(61,107,223,0.08)',
                  border: '1.5px solid rgba(61,107,223,0.22)',
                  borderRadius: 12, padding: '11px',
                  color: '#1A2FA8', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,107,223,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(61,107,223,0.08)'}
              >
                <Pencil size={14} strokeWidth={2.2} /> Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { onClose(); onDelete(tx.id, tx.desc); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: 'rgba(232,62,92,0.08)',
                  border: '1.5px solid rgba(232,62,92,0.22)',
                  borderRadius: 12, padding: '11px',
                  color: '#E83E5C', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,62,92,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,62,92,0.08)'}
              >
                <Trash2 size={14} strokeWidth={2.2} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes txFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes txPopIn  { from { opacity: 0; transform: translate(-50%,-50%) scale(0.88) } to { opacity: 1; transform: translate(-50%,-50%) scale(1) } }
      `}</style>
    </>
  );
}

function Mono({ children, col }: { children: React.ReactNode; col?: string }) {
  return (
    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.9rem', fontWeight: 600, color: col || '#1A1D2E' }}>
      {children}
    </span>
  );
}

function TxCircle({ type }: { type: string }) {
  const color = TX_COLORS[type] || '#3D6BDF';
  const circles: Record<string, React.ReactNode> = {
    income:        <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill={color}/></svg>,
    expense:       <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke={color} strokeWidth="2.5"/><circle cx="10" cy="10" r="4" fill={color}/></svg>,
    salary:        <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill={color} opacity="0.9"/><circle cx="10" cy="10" r="4" fill="white" opacity="0.5"/></svg>,
    transfer:      <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill={color} opacity="0.7"/><circle cx="10" cy="10" r="5.5" fill="none" stroke="white" strokeWidth="1.5"/></svg>,
    credit:        <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke={color} strokeWidth="2"/><circle cx="10" cy="10" r="6.5" fill={color} opacity="0.6"/></svg>,
    'owner-fund':  <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill={color} opacity="0.5"/><circle cx="10" cy="10" r="5" fill={color}/></svg>,
    'fund-return': <svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke={color} strokeWidth="2.5"/></svg>,
  };
  return <>{circles[type] || circles['income']}</>;
}
