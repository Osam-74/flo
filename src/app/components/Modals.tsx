import React, { useState, useCallback, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, AlertTriangle, Delete } from 'lucide-react';
import { toast } from 'sonner';
import type { Transaction, Person } from '../types';
import { sha256 } from '../utils';

const H_MASTER = '84b2a5d834daee2fff7eb5e31f44ba68eb860d86d2cf8e37606a26fa775cf23b';

/* ── Delete Modal ────────────────────────────────── */
interface DeleteModalProps {
  open: boolean;
  desc: string;
  onClose: () => void;
  onConfirm: () => void;
}

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

/* ── Edit Modal ──────────────────────────────────── */
const CATS = ['', 'Feed & Supplies', 'Transport', 'Utilities', 'Equipment', 'Medical / Vet', 'Labour', 'Sales Revenue', 'Loan / Advance', 'Salary', 'Other'];

interface EditModalProps {
  open: boolean;
  tx: Transaction | null;
  people: Person[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<Transaction>) => void;
}

export function EditModal({ open, tx, people, onClose, onSave }: EditModalProps) {
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState('');
  const [desc,   setDesc]   = useState('');
  const [note,   setNote]   = useState('');
  const [person, setPerson] = useState('');
  const [cat,    setCat]    = useState('');

  useEffect(() => {
    if (!tx) return;
    // For credit: show creditTotal (the sale value), not creditPaid
    setAmount(String(tx.type === 'credit' ? (tx.creditTotal || 0) : (tx.amount || 0)));
    setDate(tx.date || '');
    setDesc(tx.desc || '');
    setNote(tx.note || '');
    setPerson(tx.person || '');
    setCat(tx.cat || '');
  }, [tx]);

  const save = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) { toast.error('Enter a valid amount'); return; }
    if (amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!tx) return;
    const updates: Partial<Transaction> = { date, desc: desc || tx.desc, note, person, cat };
    if (tx.type === 'credit') {
      // For credit: amount entered is the new creditTotal.
      // Never allow creditTotal to go below what's already been paid — that would break settlement status.
      const alreadyPaid = tx.creditPaid || 0;
      if (amt < alreadyPaid) {
        toast.error(\`Total cannot be less than amount already paid (\${alreadyPaid.toFixed(2)})\`);
        return;
      }
      Object.assign(updates, { creditTotal: amt, amount: tx.amount });
    } else {
      Object.assign(updates, { amount: amt });
    }
    onSave(tx.id, updates);
    onClose();
  };

  const isCreditSettled = tx?.type === 'credit' && (tx.creditPaid || 0) >= (tx.creditTotal || 0) && (tx.creditTotal || 0) > 0;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 style={title}>Edit Transaction</h2>
      {isCreditSettled && (
        <div style={{ background: 'rgba(0,184,122,0.1)', border: '1px solid rgba(0,184,122,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.74rem', color: '#00804A', fontWeight: 600 }}>
          ✓ This credit sale is fully settled. You can only edit date, note, and description.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Field label={tx?.type === 'credit' ? 'Total Sale Amount' : 'Amount'}>
          <input
            style={{ ...inp, background: isCreditSettled ? '#f5f5f5' : '#fff', color: isCreditSettled ? '#aaa' : '#1A1D2E' }}
            type="number" min="0" step="0.01" value={amount}
            readOnly={isCreditSettled}
            onChange={e => !isCreditSettled && setAmount(e.target.value)}
          />
        </Field>
        <Field label="Date"><input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      {tx?.type === 'credit' && (
        <div style={{ background: 'rgba(61,107,223,0.07)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.74rem', color: '#3D6BDF', fontWeight: 600 }}>
          Paid so far: {(tx.creditPaid || 0).toFixed(2)} · Outstanding: {Math.max(0, (tx.creditTotal || 0) - (tx.creditPaid || 0)).toFixed(2)}
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <Field label="Description"><input style={inp} type="text" value={desc} onChange={e => setDesc(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Field label="Category">
          <select style={{ ...inp, appearance: 'none' as any }} value={cat} onChange={e => setCat(e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{c || '— Select —'}</option>)}
          </select>
        </Field>
        <Field label="Person">
          <select style={{ ...inp, appearance: 'none' as any }} value={person} onChange={e => setPerson(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Note"><input style={inp} type="text" placeholder="Reference / note" value={note} onChange={e => setNote(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={save} style={actionBtn}>Save Changes</button>
      </div>
    </BottomSheet>
  );
}

/* ── Payment Modal ───────────────────────────────── */
interface PaymentModalProps {
  open: boolean;
  buyer: string | null;
  outstanding: number;
  people: Person[];
  currency: string;
  onClose: () => void;
  onApply: (amount: number, date: string, receiver: string) => void;
}

export function PaymentModal({ open, buyer, outstanding, people, currency, onClose, onApply }: PaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState('');
  const [receiver, setReceiver] = useState('');

  useEffect(() => {
    setAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
    setDate(new Date().toISOString().split('T')[0]);
    const nonOwners = people.filter(p => !p.role?.toLowerCase().includes('owner'));
    if (nonOwners.length > 0) setReceiver(nonOwners[0].id);
  }, [open, outstanding, people]);

  const nonOwners = people.filter(p => !p.role?.toLowerCase().includes('owner'));

  const apply = () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!receiver) { toast.error('Select who received the money'); return; }
    onApply(amt, date, receiver);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 style={title}>Record Payment</h2>
      <p style={sub}>{buyer} — Outstanding: {currency} {outstanding.toFixed(2)}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Field label="Amount Received"><input style={inp} type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="Date"><input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Field label="Received By *">
          <select style={{ ...inp, appearance: 'none' as any }} value={receiver} onChange={e => setReceiver(e.target.value)}>
            {nonOwners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button onClick={onClose} style={cancelBtn}>Cancel</button>
        <button onClick={apply} style={actionBtn}>Apply Payment</button>
      </div>
    </BottomSheet>
  );
}

/* ── Clear All Modal (with PIN) ──────────────────── */
interface ClearModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearModal({ open, onClose, onConfirm }: ClearModalProps) {
  const [entry, setEntry] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [lastPress, setLastPress] = useState(0);

  useEffect(() => { setEntry(''); setErrMsg(''); }, [open]);

  const check = useCallback(async (pin: string) => {
    const h = await sha256(pin);
    if (h === H_MASTER) {
      onConfirm();
      onClose();
    } else {
      setErrMsg('Incorrect PIN');
      setTimeout(() => { setEntry(''); setErrMsg(''); }, 900);
    }
  }, [onConfirm, onClose]);

  const press = useCallback((d: string) => {
    const now = Date.now();
    if (now - lastPress < 40) return;
    setLastPress(now);
    setEntry(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) setTimeout(() => check(next), 120);
      return next;
    });
  }, [lastPress, check]);

  const del = () => setEntry(prev => prev.slice(0, -1));

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <AlertTriangle size={20} color="#E83E5C" />
        <h2 style={title}>Confirm Delete All Data</h2>
      </div>
      <p style={sub}>This will permanently delete ALL transactions and people from the cloud and all devices. Enter master PIN to confirm.</p>

      {/* Dots */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', margin: '20px 0 16px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 13, height: 13, borderRadius: '50%',
            background: i < entry.length ? '#E83E5C' : '#D4D8E8',
            transition: 'background 0.18s',
          }} />
        ))}
      </div>

      {/* Pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: 240, margin: '0 auto 8px' }}>
        {KEYS.map((k, i) => {
          if (!k) return <div key={i} />;
          if (k === 'del') return (
            <button key="del" onClick={del} style={smallKey}>
              <Delete size={18} />
            </button>
          );
          return (
            <button key={k} onClick={() => press(k)} style={smallKey}>
              {k}
            </button>
          );
        })}
      </div>
      {errMsg && <div style={{ textAlign: 'center', color: '#E83E5C', fontSize: '0.74rem', fontWeight: 700, marginTop: 6 }}>{errMsg}</div>}
      <button onClick={onClose} style={{ ...cancelBtn, width: '100%', marginTop: 14 }}>Cancel</button>
    </BottomSheet>
  );
}

/* ── Shared BottomSheet wrapper ─────────────────── */
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={v => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,32,0.5)', backdropFilter: 'blur(3px)', zIndex: 300 }} />
        <Drawer.Content
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
            background: '#F0F2F7', borderRadius: '24px 24px 0 0',
            outline: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 44, height: 5, borderRadius: 99, background: '#C4C8D8' }} />
          </div>
          <div style={{ padding: '8px 20px 36px' }}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/* ── Tiny helpers ───────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8' }}>{label}</label>
      {children}
    </div>
  );
}

const title: React.CSSProperties = { fontSize: '1rem', fontWeight: 800, color: '#1A1D2E', margin: 0 };
const sub:   React.CSSProperties = { fontSize: '0.8rem', color: '#5A5F7A', lineHeight: 1.5, marginBottom: 4 };

const inp: React.CSSProperties = {
  background: '#fff', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10,
  padding: '10px 13px', fontSize: '0.88rem', color: '#1A1D2E',
  width: '100%', fontFamily: "'DM Mono',monospace", outline: 'none',
};

const cancelBtn: React.CSSProperties = {
  padding: '13px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  background: '#E8EAF0', color: '#5A5F7A', border: 'none', cursor: 'pointer',
};

const actionBtn: React.CSSProperties = {
  padding: '13px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)', color: '#fff',
  border: 'none', cursor: 'pointer',
};

const smallKey: React.CSSProperties = {
  height: 54, borderRadius: 12, background: '#fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '1.3rem', fontWeight: 700, color: '#1A1D2E', cursor: 'pointer',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
};
