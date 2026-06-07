import React, { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, AlertTriangle } from 'lucide-react';
import type { Transaction, Person } from '../types';

/* ══════════════════════════════════════════════════════════════════
   CUSTOM BRANDED TOAST
   Top of screen, fade in/out, brand colours, manual close button.
══════════════════════════════════════════════════════════════════ */
interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
  visible: boolean;
}

let _setToasts: React.Dispatch<React.SetStateAction<ToastItem[]>> | null = null;
let _toastCounter = 0;

export function showToast(message: string, variant: 'success' | 'error' | 'info' = 'info') {
  if (!_setToasts) return;
  const id = ++_toastCounter;
  _setToasts(prev => [...prev, { id, message, variant, visible: true }]);
  setTimeout(() => {
    _setToasts!(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => _setToasts!(prev => prev.filter(t => t.id !== id)), 400);
  }, 3500);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  _setToasts = setToasts;

  const dismiss = (id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
  };

  const bgMap: Record<string, string> = {
    success: 'linear-gradient(135deg, #0D2B6E, #1A4FA8)',
    error:   'linear-gradient(135deg, #a01030, #E83E5C)',
    info:    'linear-gradient(135deg, #0D2B6E, #3D6BDF)',
  };
  const iconMap: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 8, padding: '52px 16px 0',   /* 52px pushes it just below the status bar notch */
      pointerEvents: 'none',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'all',
            background: bgMap[t.variant],
            color: '#fff',
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            minWidth: 240, maxWidth: 340,
            boxShadow: '0 8px 32px rgba(13,43,110,0.35)',
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? 'translateY(0)' : 'translateY(-16px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
            fontSize: '0.82rem', fontWeight: 600,
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
          }}>{iconMap[t.variant]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 8, width: 22, height: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', padding: 0, flexShrink: 0,
            }}
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SHARED PRIMITIVES  (mirrors AddEntrySheet exactly)
══════════════════════════════════════════════════════════════════ */
const CATS = ['', 'Feed & Supplies', 'Transport', 'Utilities', 'Equipment', 'Medical / Vet', 'Labour', 'Sales Revenue', 'Loan / Advance', 'Salary', 'Other'];
const today = () => new Date().toISOString().split('T')[0];
const nonOwners = (people: Person[]) => people.filter(p => !p.role?.toLowerCase().includes('owner'));
const owners    = (people: Person[]) => people.filter(p =>  p.role?.toLowerCase().includes('owner'));
const humans    = (people: Person[]) => people.filter(p => {
  const r = (p.role || '').toLowerCase();
  return !r.includes('owner') && !r.includes('biz');
});

const inp: React.CSSProperties = {
  background: '#ffffff',
  border: '1.5px solid rgba(61,107,223,0.18)',
  borderRadius: 10, padding: '10px 13px',
  fontSize: '0.88rem', color: '#03045E',
  width: '100%', fontFamily: "'DM Mono',monospace",
  outline: 'none', boxSizing: 'border-box',
};
const infoBox: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(61,107,223,0.18)',
  borderRadius: 10, padding: '10px 13px',
  fontSize: '0.76rem', color: '#1A2FA8',
  marginBottom: 10,
};
const card: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(61,107,223,0.08)',
  padding: '16px', marginBottom: 12,
  border: '1px solid rgba(61,107,223,0.18)',
};
const title: React.CSSProperties  = { fontSize: '0.98rem', fontWeight: 800, color: '#03045E', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' };
const sub: React.CSSProperties    = { fontSize: '0.78rem', color: '#5A6FA8', margin: '4px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const cancelBtn: React.CSSProperties = {
  padding: '13px', borderRadius: 12, border: '1.5px solid rgba(61,107,223,0.18)',
  background: '#fff', color: '#1A2FA8', fontWeight: 700, cursor: 'pointer',
  fontSize: '0.82rem', fontFamily: 'Plus Jakarta Sans, sans-serif',
};
const actionBtn: React.CSSProperties = {
  padding: '13px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#03045E,#0077B6)', color: '#fff',
  fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#0077B6', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{label}</label>
      {children}
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' as any }}>{children}</div>;
}
function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      style={{ ...inp, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%230077b6' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', appearance: 'none' as any }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >{children}</select>
  );
}
function InfoBox({ children }: { children: React.ReactNode }) {
  return <div style={infoBox}>{children}</div>;
}

/* ── Bottom Sheet wrapper ── */
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={v => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(3,4,94,0.4)', backdropFilter: 'blur(4px)', zIndex: 300 }} />
        <Drawer.Content style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
          background: '#F0F2F7', borderRadius: '24px 24px 0 0',
          maxHeight: '94svh', display: 'flex', flexDirection: 'column', outline: 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
            <div style={{ width: 44, height: 5, borderRadius: 99, background: '#90E0EF' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 16px 40px', WebkitOverflowScrolling: 'touch' as any }}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════════════════════════════════ */
interface DeleteModalProps { open: boolean; desc: string; onClose: () => void; onConfirm: () => void; }

export function DeleteModal({ open, desc, onClose, onConfirm }: DeleteModalProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <AlertTriangle size={20} color="#E83E5C" />
        <h2 style={title}>Delete Transaction?</h2>
      </div>
      <p style={sub}>"{desc}" will be permanently deleted. This cannot be undone.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={onConfirm} style={{ ...actionBtn, background: 'linear-gradient(135deg,#c0203a,#e83e5c)' }}>Delete</button>
      </div>
    </BottomSheet>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CLEAR ALL MODAL
══════════════════════════════════════════════════════════════════ */
interface ClearModalProps { open: boolean; onClose: () => void; onConfirm: () => void; }

export function ClearModal({ open, onClose, onConfirm }: ClearModalProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <AlertTriangle size={20} color="#E83E5C" />
        <h2 style={title}>Clear All Data?</h2>
      </div>
      <p style={sub}>This will permanently delete all transactions for this business. This cannot be undone.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={onConfirm} style={{ ...actionBtn, background: 'linear-gradient(135deg,#c0203a,#e83e5c)' }}>Clear All</button>
      </div>
    </BottomSheet>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EDIT MODAL
   Fields + order EXACTLY mirrors AddEntrySheet for every type.
══════════════════════════════════════════════════════════════════ */
interface EditModalProps {
  open: boolean;
  tx: Transaction | null;
  people: Person[];
  currency: string;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Transaction>) => void;
}

export function EditModal({ open, tx, people, currency, onClose, onSave }: EditModalProps) {
  /* ── state mirroring AddEntrySheet 1-to-1 ── */
  const [amount,   setAmount]   = useState('');
  const [buyer,    setBuyer]    = useState('');
  const [receiver, setReceiver] = useState('');   // money received by (income)
  const [person,   setPerson]   = useState('');   // sale made by / employee / paid by
  const [date,     setDate]     = useState('');
  const [cat,      setCat]      = useState('');
  const [source,   setSource]   = useState('shop');
  const [note,     setNote]     = useState('');
  const [salPaidBy, setSalPaidBy] = useState('');  // salary: paid by

  // Transfer
  const [tfAmt,  setTfAmt]  = useState('');
  const [tfFrom, setTfFrom] = useState('');
  const [tfTo,   setTfTo]   = useState('');
  const [tfRef,  setTfRef]  = useState('');
  const [tfDate, setTfDate] = useState('');

  // Credit
  const [crBuyer,    setCrBuyer]    = useState('');
  const [crDate,     setCrDate]     = useState('');
  const [crTotal,    setCrTotal]    = useState('');
  const [crPaid,     setCrPaid]     = useState('');
  const [crSeller,   setCrSeller]   = useState('');
  const [crReceiver, setCrReceiver] = useState('');
  const [crCat,      setCrCat]      = useState('Sales Revenue');
  const [crSource,   setCrSource]   = useState('farm');
  const [crNote,     setCrNote]     = useState('');

  // Owner fund
  const [ofAmt,      setOfAmt]      = useState('');
  const [ofDate,     setOfDate]     = useState('');
  const [ofNote,     setOfNote]     = useState('');
  const [ofSender,   setOfSender]   = useState('');
  const [ofReceiver, setOfReceiver] = useState('');

  // Fund return
  const [frAmt,      setFrAmt]      = useState('');
  const [frDate,     setFrDate]     = useState('');
  const [frNote,     setFrNote]     = useState('');
  const [frSender,   setFrSender]   = useState('');
  const [frReceiver, setFrReceiver] = useState('');

  useEffect(() => {
    if (!tx) return;
    const t = tx;
    // common
    setAmount(String(t.amount || 0));
    setDate(t.date || today());
    setNote(t.note || '');
    setCat(t.cat || '');
    setSource(t.source || 'shop');
    setBuyer(t.buyer || '');
    setPerson(t.seller || t.employee || t.person || '');
    setReceiver(t.receiver || '');
    setSalPaidBy(t.salaryPaidBy || t.person || '');
    // transfer
    setTfAmt(String(t.amount || 0));
    setTfFrom(t.transferFrom || '');
    setTfTo(t.transferTo || '');
    setTfRef(t.transferRef || t.note || '');
    setTfDate(t.date || today());
    // credit
    setCrBuyer(t.creditBuyer || '');
    setCrDate(t.date || today());
    setCrTotal(String(t.creditTotal || 0));
    setCrPaid(String(t.creditPaid || 0));
    setCrSeller(t.creditSeller || t.person || '');
    setCrReceiver(t.creditReceiver || '');
    setCrCat(t.cat || 'Sales Revenue');
    setCrSource(t.source || 'farm');
    setCrNote(t.note || '');
    // owner-fund
    setOfAmt(String(t.amount || 0));
    setOfDate(t.date || today());
    setOfNote(t.note || '');
    setOfSender(t.ownerSender || '');
    setOfReceiver(t.ownerReceiver || t.person || '');
    // fund-return
    setFrAmt(String(t.amount || 0));
    setFrDate(t.date || today());
    setFrNote(t.note || '');
    setFrSender(t.frSender || t.person || '');
    setFrReceiver(t.frReceiver || '');
  }, [tx]);

  if (!tx) return null;

  const no  = nonOwners(people);
  const ow  = owners(people);
  const hu  = humans(people);
  const isCreditSettled = tx.type === 'credit' && (tx.creditPaid || 0) >= (tx.creditTotal || 0) && (tx.creditTotal || 0) > 0;
  const isPickup = tx.type === 'credit' && !!tx.isPickup;
  const crPaidAmt  = parseFloat(crPaid)  || 0;
  const crTotalAmt = parseFloat(crTotal) || 0;
  const crOutstanding = Math.max(0, crTotalAmt - crPaidAmt);

  const save = () => {
    const type = tx.type;

    if (type === 'income') {
      const amt = parseFloat(amount) || 0;
      if (amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      const sellerName = people.find(p => p.id === person)?.name || '';
      const desc = `Sale${buyer ? ' — to ' + buyer : ''}${sellerName ? ' by ' + sellerName : ''}${cat ? ' — ' + cat : ''}`;
      onSave(tx.id, { amount: amt, date, note, cat, source, buyer: buyer || undefined, seller: person, sellerName, person: receiver, receiver: receiver || undefined, desc });
    }
    else if (type === 'expense') {
      const amt = parseFloat(amount) || 0;
      if (amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      const pn = people.find(p => p.id === person)?.name || '';
      const desc = `Expense${pn ? ' by ' + pn : ''}`;
      onSave(tx.id, { amount: amt, date, note, cat, person, desc });
    }
    else if (type === 'salary') {
      const amt = parseFloat(amount) || 0;
      if (amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      const emp = people.find(p => p.id === person)?.name || '?';
      const pb  = people.find(p => p.id === salPaidBy)?.name || '';
      onSave(tx.id, { amount: amt, date, note, cat: 'Salary', employee: person, employeeName: emp, salaryPaidBy: salPaidBy, person: salPaidBy, desc: `Salary — ${emp}${pb ? ' (paid by ' + pb + ')' : ''}` });
    }
    else if (type === 'transfer') {
      const amt = parseFloat(tfAmt) || 0;
      if (amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      if (tfFrom === tfTo) { showToast('Sender and receiver must differ', 'error'); return; }
      const fn = people.find(p => p.id === tfFrom)?.name || '?';
      const tn = people.find(p => p.id === tfTo)?.name   || '?';
      onSave(tx.id, { amount: amt, date: tfDate, transferFrom: tfFrom, transferTo: tfTo, transferRef: tfRef, person: tfFrom, note: tfRef, desc: `MoMo Transfer: ${fn} → ${tn}` });
    }
    else if (type === 'credit') {
      const total = parseFloat(crTotal) || 0;
      const paid  = parseFloat(crPaid)  || 0;
      if (!crBuyer) { showToast('Enter buyer name', 'error'); return; }
      if (!isPickup && total <= 0 && !isCreditSettled) { showToast('Enter total expected amount', 'error'); return; }
      if (total > 0 && paid > total) { showToast('Amount paid cannot exceed total', 'error'); return; }
      const alreadyPaid = tx.creditPaid || 0;
      if (!isCreditSettled && total < alreadyPaid) { showToast(`Total cannot be less than already paid (${alreadyPaid.toFixed(2)})`, 'error'); return; }
      const desc = isPickup ? `Egg Pickup Scheduled — ${crBuyer} on ${crDate}` : `Credit sale — ${crBuyer}`;
      onSave(tx.id, {
        date: crDate, note: crNote, cat: crCat, source: crSource,
        creditBuyer: crBuyer, creditSeller: crSeller, person: crSeller,
        creditReceiver: paid > 0 ? crReceiver : tx.creditReceiver,
        creditTotal: isCreditSettled ? tx.creditTotal : total,
        desc,
      });
    }
    else if (type === 'owner-fund') {
      const amt = parseFloat(ofAmt) || 0;
      if (amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      const sn = people.find(p => p.id === ofSender)?.name || 'Owner';
      const rn = people.find(p => p.id === ofReceiver)?.name || '?';
      onSave(tx.id, { amount: amt, date: ofDate, note: ofNote, ownerSender: ofSender, ownerReceiver: ofReceiver, person: ofReceiver, ownerName: sn, desc: `Fund injection: ${sn} → ${rn}` });
    }
    else if (type === 'fund-return') {
      const amt = parseFloat(frAmt) || 0;
      if (amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
      const sn = people.find(p => p.id === frSender)?.name || '?';
      const rn = people.find(p => p.id === frReceiver)?.name || 'Owner';
      onSave(tx.id, { amount: amt, date: frDate, note: frNote, frSender, frReceiver, person: frSender, desc: `Fund return: ${sn} → ${rn}` });
    }

    onClose();
  };

  const typeLabel: Record<string, string> = {
    income: 'Sales', expense: 'Expense', salary: 'Salary',
    transfer: 'Transfer', credit: 'Credit Sale', 'owner-fund': 'Fund Injection', 'fund-return': 'Fund Return',
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingTop: 4 }}>
        <div>
          <h2 style={title}>Edit Transaction</h2>
          <div style={{ fontSize: '0.7rem', color: '#3D6BDF', fontWeight: 700, marginTop: 2, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {typeLabel[tx.type] || tx.type}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(0,119,182,0.1)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={16} color="#0077B6" />
        </button>
      </div>

      {isCreditSettled && (
        <div style={{ background: 'rgba(0,184,122,0.1)', border: '1px solid rgba(0,184,122,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: '0.74rem', color: '#00804A', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          ✓ Fully settled — sale amount is locked.
        </div>
      )}

      {/* ════════════════════════════════════════════════
          INCOME (Sales) — mirrors AddEntrySheet exactly:
          1. Amount (big)
          2. Buyer Name | Money Received By  (income only)
          3. Sale Made By | Date
          4. Category | Source | Note
      ════════════════════════════════════════════════ */}
      {tx.type === 'income' && (
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <Field label={`Amount (${currency}) *`}>
              <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                type="number" placeholder="0.00" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </Field>
          </div>
          <Row>
            <Field label="Buyer Name">
              <input style={inp} type="text" placeholder="Buyer's name (optional)" value={buyer} onChange={e => setBuyer(e.target.value)} />
            </Field>
            <Field label="Money Received By">
              <Sel value={receiver} onChange={setReceiver}>
                {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
          </Row>
          <Row>
            <Field label="Sale Made By *">
              <Sel value={person} onChange={setPerson}>
                {hu.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
            <Field label="Date *">
              <input style={inp} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Category">
              <Sel value={cat} onChange={setCat}>
                {CATS.map(c => <option key={c} value={c}>{c || '— Select —'}</option>)}
              </Sel>
            </Field>
            <Field label="Source">
              <Sel value={source} onChange={setSource}>
                <option value="shop">Shop</option>
                <option value="farm">Farm</option>
              </Sel>
            </Field>
            <Field label="Note">
              <input style={inp} type="text" placeholder="e.g. Receipt #007" value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          </Row>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          EXPENSE — mirrors AddEntrySheet exactly:
          1. Amount (big)
          2. Paid By | Date
          3. Category | Note   ← NO source (expense never had source in AddEntrySheet)
      ════════════════════════════════════════════════ */}
      {tx.type === 'expense' && (
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <Field label={`Amount (${currency}) *`}>
              <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                type="number" placeholder="0.00" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </Field>
          </div>
          <Row>
            <Field label="Paid By *">
              <Sel value={person} onChange={setPerson}>
                {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
            <Field label="Date *">
              <input style={inp} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Category">
              <Sel value={cat} onChange={setCat}>
                {CATS.map(c => <option key={c} value={c}>{c || '— Select —'}</option>)}
              </Sel>
            </Field>
            <Field label="Note">
              <input style={inp} type="text" placeholder="e.g. Receipt #007" value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          </Row>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          SALARY — mirrors AddEntrySheet exactly:
          1. Amount (big)
          2. Employee | Date
          3. Category | Note
          4. Paid By (Deducted from)  ← bottom, same as AddEntrySheet
      ════════════════════════════════════════════════ */}
      {tx.type === 'salary' && (
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <Field label={`Amount (${currency}) *`}>
              <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                type="number" placeholder="0.00" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </Field>
          </div>
          <Row>
            <Field label="Employee *">
              <Sel value={person} onChange={setPerson}>
                {hu.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
            <Field label="Date *">
              <input style={inp} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Category">
              <Sel value={cat} onChange={setCat}>
                {CATS.map(c => <option key={c} value={c}>{c || '— Select —'}</option>)}
              </Sel>
            </Field>
            <Field label="Note">
              <input style={inp} type="text" placeholder="e.g. Receipt #007" value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          </Row>
          <Field label="Paid By (Deducted from) *">
            <Sel value={salPaidBy} onChange={setSalPaidBy}>
              {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Sel>
          </Field>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TRANSFER — mirrors AddEntrySheet exactly:
          InfoBox | Amount (big) | Sent By | Received By | Date | Ref/Note
      ════════════════════════════════════════════════ */}
      {tx.type === 'transfer' && (
        <div style={card}>
          <InfoBox>Record a mobile money or bank transfer made on behalf of the business.</InfoBox>
          <Field label={`Amount (${currency}) *`}>
            <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
              type="number" placeholder="0.00" min="0" step="0.01"
              value={tfAmt} onChange={e => setTfAmt(e.target.value)} />
          </Field>
          <Row>
            <Field label="Sent By *">
              <Sel value={tfFrom} onChange={setTfFrom}>
                {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
            <Field label="Received By *">
              <Sel value={tfTo} onChange={setTfTo}>
                {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
          </Row>
          <Row>
            <Field label="Date *">
              <input style={inp} type="date" value={tfDate} max={today()} onChange={e => setTfDate(e.target.value)} />
            </Field>
            <Field label="Reference / Note">
              <input style={inp} type="text" placeholder="Optional" value={tfRef} onChange={e => setTfRef(e.target.value)} />
            </Field>
          </Row>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          CREDIT SALE — mirrors AddEntrySheet exactly:
          InfoBox | Buyer Name | Date | Total | Paid | Summary box
          Sale Made By | Money Received By (if paid>0)
          Category | Source | Note
      ════════════════════════════════════════════════ */}
      {tx.type === 'credit' && (
        <div style={card}>
          <InfoBox>Track buyer, total expected, and amount paid now.</InfoBox>
          {isPickup && (
            <div style={{ background: 'rgba(26,79,168,0.07)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.74rem', color: '#1A4FA8', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              🥚 Awaiting Pickup — update the pickup date or buyer details below.
            </div>
          )}
          <Row>
            <Field label="Buyer Name *">
              <input style={inp} type="text" placeholder="Buyer's name" value={crBuyer} onChange={e => setCrBuyer(e.target.value)} />
            </Field>
            <Field label="Pickup / Sale Date *">
              <input style={inp} type="date" value={crDate} onChange={e => setCrDate(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label={`Total Expected (${currency})${!isPickup ? ' *' : ''}`}>
              <input
                style={{ ...inp, background: isCreditSettled ? '#f5f5f5' : '#fff', color: isCreditSettled ? '#aaa' : '#03045E' }}
                type="number" placeholder={isPickup ? '0.00 (optional)' : '0.00'}
                min="0" step="0.01" readOnly={isCreditSettled}
                value={crTotal} onChange={e => !isCreditSettled && setCrTotal(e.target.value)} />
            </Field>
            <Field label="Amount Paid Upfront">
              <input
                style={{ ...inp, background: isCreditSettled ? '#f5f5f5' : '#fff', color: isCreditSettled ? '#aaa' : '#03045E' }}
                type="number" placeholder="0.00 (optional)"
                min="0" step="0.01" readOnly={isCreditSettled}
                value={crPaid} onChange={e => !isCreditSettled && setCrPaid(e.target.value)} />
            </Field>
          </Row>
          {crTotalAmt > 0 && (
            <div style={{ ...infoBox, color: crOutstanding > 0 ? '#E83E5C' : '#1A2FA8', marginBottom: 10 }}>
              Total: {currency} {crTotalAmt.toFixed(2)} · Paid: {currency} {crPaidAmt.toFixed(2)} · Outstanding: {currency} {crOutstanding.toFixed(2)}
            </div>
          )}
          <Row>
            <Field label="Sale Made By *">
              <Sel value={crSeller} onChange={setCrSeller}>
                {hu.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
            {crPaidAmt > 0 && (
              <Field label="Money Received By">
                <Sel value={crReceiver} onChange={setCrReceiver}>
                  {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Sel>
              </Field>
            )}
          </Row>
          <Row>
            <Field label="Category">
              <Sel value={crCat} onChange={setCrCat}>
                <option value="Sales Revenue">Sales Revenue</option>
                <option value="Other">Other</option>
              </Sel>
            </Field>
            <Field label="Source">
              <Sel value={crSource} onChange={setCrSource}>
                <option value="farm">Farm</option>
                <option value="shop">Shop</option>
              </Sel>
            </Field>
            <Field label="Note">
              <input style={inp} type="text" placeholder="Optional note" value={crNote} onChange={e => setCrNote(e.target.value)} />
            </Field>
          </Row>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          OWNER FUND — mirrors AddEntrySheet exactly:
          InfoBox | Amount | Date | Note | Sent By | Received By
      ════════════════════════════════════════════════ */}
      {tx.type === 'owner-fund' && (
        <div style={card}>
          <InfoBox>Record money sent by an owner into the business.</InfoBox>
          <Field label={`Amount (${currency}) *`}>
            <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
              type="number" placeholder="0.00" min="0" step="0.01"
              value={ofAmt} onChange={e => setOfAmt(e.target.value)} />
          </Field>
          <Row>
            <Field label="Date *">
              <input style={inp} type="date" value={ofDate} max={today()} onChange={e => setOfDate(e.target.value)} />
            </Field>
            <Field label="Note">
              <input style={inp} type="text" placeholder="Optional reference" value={ofNote} onChange={e => setOfNote(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Sent By (Owner) *">
              <Sel value={ofSender} onChange={setOfSender}>
                {ow.length ? ow.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">— No owners —</option>}
              </Sel>
            </Field>
            <Field label="Received By *">
              <Sel value={ofReceiver} onChange={setOfReceiver}>
                {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
          </Row>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          FUND RETURN — mirrors AddEntrySheet exactly:
          InfoBox | Amount | Date | Note | Returned By | Received By (Owner)
      ════════════════════════════════════════════════ */}
      {tx.type === 'fund-return' && (
        <div style={card}>
          <InfoBox>Record unused money returned from the business back to an owner.</InfoBox>
          <Field label={`Amount (${currency}) *`}>
            <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
              type="number" placeholder="0.00" min="0" step="0.01"
              value={frAmt} onChange={e => setFrAmt(e.target.value)} />
          </Field>
          <Row>
            <Field label="Date *">
              <input style={inp} type="date" value={frDate} max={today()} onChange={e => setFrDate(e.target.value)} />
            </Field>
            <Field label="Note">
              <input style={inp} type="text" placeholder="Optional reference" value={frNote} onChange={e => setFrNote(e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="Returned By *">
              <Sel value={frSender} onChange={setFrSender}>
                {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </Field>
            <Field label="Received By (Owner) *">
              <Sel value={frReceiver} onChange={setFrReceiver}>
                {ow.length ? ow.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">— No owners —</option>}
              </Sel>
            </Field>
          </Row>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={save} style={actionBtn}>Save Changes</button>
      </div>
    </BottomSheet>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAYMENT MODAL
══════════════════════════════════════════════════════════════════ */
interface PaymentModalProps {
  open: boolean; buyer: string | null; outstanding: number;
  people: Person[]; currency: string;
  onClose: () => void;
  onApply: (amount: number, date: string, receiver: string) => void;
}

export function PaymentModal({ open, buyer, outstanding, people, currency, onClose, onApply }: PaymentModalProps) {
  const [amount,   setAmount]   = useState('');
  const [date,     setDate]     = useState('');
  const [receiver, setReceiver] = useState('');
  const no = nonOwners(people);

  useEffect(() => {
    setAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
    setDate(today());
    if (no.length > 0) setReceiver(no[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outstanding]);

  const apply = () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0)  { showToast('Enter a valid amount', 'error'); return; }
    if (!receiver) { showToast('Select who received the money', 'error'); return; }
    onApply(amt, date, receiver);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 style={{ ...title, marginBottom: 4 }}>Record Payment</h2>
      <p style={sub}>{buyer} — Outstanding: {currency} {outstanding.toFixed(2)}</p>
      <div style={{ height: 14 }} />
      <Row>
        <Field label="Amount Received"><input style={inp} type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="Date"><input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      </Row>
      <div style={{ marginBottom: 16 }}>
        <Field label="Received By *">
          <Sel value={receiver} onChange={setReceiver}>
            {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Sel>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={apply} style={actionBtn}>Apply Payment</button>
      </div>
    </BottomSheet>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PICKUP MODAL
══════════════════════════════════════════════════════════════════ */
interface PickupModalProps {
  open: boolean; buyer: string | null; pickupDate: string;
  people: Person[]; currency: string;
  onClose: () => void;
  onApply: (totalAmount: number, paidAmount: number, date: string, receiver: string, note: string) => void;
}

export function PickupModal({ open, buyer, pickupDate, people, currency, onClose, onApply }: PickupModalProps) {
  const [total,    setTotal]    = useState('');
  const [paid,     setPaid]     = useState('');
  const [date,     setDate]     = useState('');
  const [receiver, setReceiver] = useState('');
  const [note,     setNote]     = useState('');
  const no = nonOwners(people);

  useEffect(() => {
    setTotal(''); setPaid(''); setNote('');
    setDate(today());
    if (no.length > 0) setReceiver(no[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalAmt = parseFloat(total) || 0;
  const paidAmt  = parseFloat(paid)  || 0;

  const apply = () => {
    if (totalAmt <= 0) { showToast('Enter total sale amount', 'error'); return; }
    if (paidAmt > totalAmt) { showToast('Amount paid cannot exceed total', 'error'); return; }
    if (paidAmt > 0 && !receiver) { showToast('Select who received the payment', 'error'); return; }
    onApply(totalAmt, paidAmt, date, receiver, note);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 style={{ ...title, marginBottom: 2 }}>Log Pickup / Delivery</h2>
      <p style={sub}>{buyer} · Scheduled: {pickupDate}</p>
      <div style={{ height: 14 }} />
      <Row>
        <Field label={`Total Sale Amount (${currency}) *`}>
          <input style={{ ...inp, fontSize: '1.3rem' }} type="number" min="0" step="0.01" placeholder="0.00" value={total} onChange={e => setTotal(e.target.value)} />
        </Field>
        <Field label="Date *">
          <input style={inp} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
        </Field>
      </Row>
      <Row>
        <Field label="Amount Paid Now">
          <input style={inp} type="number" min="0" step="0.01" placeholder="0.00 (optional)" value={paid} onChange={e => setPaid(e.target.value)} />
        </Field>
        {paidAmt > 0 && (
          <Field label="Received By *">
            <Sel value={receiver} onChange={setReceiver}>
              {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Sel>
          </Field>
        )}
      </Row>
      {totalAmt > 0 && (
        <div style={{ ...infoBox, color: paidAmt < totalAmt ? '#E83E5C' : '#00804A', marginBottom: 10 }}>
          Outstanding after this: {currency} {Math.max(0, totalAmt - paidAmt).toFixed(2)}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <Field label="Note">
          <input style={inp} type="text" placeholder="Optional" value={note} onChange={e => setNote(e.target.value)} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={apply} style={actionBtn}>Confirm Pickup</button>
      </div>
    </BottomSheet>
  );
}
