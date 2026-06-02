import React, { useState, useEffect, useRef } from 'react';
import { Drawer } from 'vaul';
import { X, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { Transaction, Person, TxType } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  people: Person[];
  currency: string;
  onSave: (tx: Omit<Transaction, 'id' | 'ts'> & { id: string; ts: number }) => void;
  initialType?: TxType;
}

const nonOwners = (people: Person[]) => people.filter(p => !p.role?.toLowerCase().includes('owner'));
const owners    = (people: Person[]) => people.filter(p =>  p.role?.toLowerCase().includes('owner'));
const humans    = (people: Person[]) => people.filter(p => {
  const r = (p.role || '').toLowerCase();
  return !r.includes('owner') && !r.includes('biz');
});

const today = () => new Date().toISOString().split('T')[0];

const TYPE_OPTS: { id: TxType; emoji: string; label: string; color: string }[] = [
  { id: 'income',      emoji: '💚', label: 'Sales',       color: '#00B87A' },
  { id: 'expense',     emoji: '🔴', label: 'Expense',     color: '#E83E5C' },
  { id: 'salary',      emoji: '💙', label: 'Salary',      color: '#3D6BDF' },
  { id: 'transfer',    emoji: '🟡', label: 'Transfer',    color: '#E8A020' },
  { id: 'credit',      emoji: '🟣', label: 'Credit Sale', color: '#8B5CF6' },
  { id: 'owner-fund',  emoji: '🟠', label: 'Fund Injection',  color: '#F07030' },
  { id: 'fund-return', emoji: '🔵', label: 'Fund Return', color: '#00A8A0' },
];

const CATS = ['', 'Feed & Supplies', 'Transport', 'Utilities', 'Equipment', 'Medical / Vet', 'Labour', 'Sales Revenue', 'Loan / Advance', 'Salary', 'Other'];

export function AddEntrySheet({ open, onClose, people, currency, onSave, initialType = 'income' }: Props) {
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount]     = useState('');
  const [person, setPerson]     = useState('');
  const [date, setDate]         = useState(today());
  const [cat, setCat]           = useState('');
  const [source, setSource]     = useState('shop');
  const [note, setNote]         = useState('');
  const [buyer, setBuyer]       = useState('');
  const [receiver, setReceiver] = useState('');
  // Transfer
  const [tfAmt, setTfAmt]       = useState('');
  const [tfFrom, setTfFrom]     = useState('');
  const [tfTo, setTfTo]         = useState('');
  const [tfDate, setTfDate]     = useState(today());
  const [tfRef, setTfRef]       = useState('');
  // Credit
  const [crBuyer, setCrBuyer]   = useState('');
  const [crDate, setCrDate]     = useState(today());
  const [crTotal, setCrTotal]   = useState('');
  const [crPaid, setCrPaid]     = useState('');
  const [crSeller, setCrSeller] = useState('');
  const [crReceiver, setCrReceiver] = useState('');
  const [crCat, setCrCat]       = useState('Sales Revenue');
  const [crSource, setCrSource] = useState('farm');
  const [crNote, setCrNote]     = useState('');
  // Owner Fund
  const [ofAmt, setOfAmt]       = useState('');
  const [ofDate, setOfDate]     = useState(today());
  const [ofNote, setOfNote]     = useState('');
  const [ofSender, setOfSender] = useState('');
  const [ofReceiver, setOfReceiver] = useState('');
  // Fund Return
  const [frAmt, setFrAmt]       = useState('');
  const [frDate, setFrDate]     = useState(today());
  const [frNote, setFrNote]     = useState('');
  const [frSender, setFrSender] = useState('');
  const [frReceiver, setFrReceiver] = useState('');
  // Salary
  const [salPaidBy, setSalPaidBy] = useState('');

  // Keyboard / viewport fix: track visualViewport to avoid form disappearing when keyboard closes
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (scrollRef.current) {
        scrollRef.current.style.maxHeight = `${vv.height - 80}px`;
      }
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [open]);

  useEffect(() => { setType(initialType); }, [initialType]);

  useEffect(() => {
    const t = today();
    setDate(t); setTfDate(t); setCrDate(t); setOfDate(t); setFrDate(t);
    const no = nonOwners(people);
    const hu = humans(people);
    if (no.length > 0) {
      if (!receiver)    setReceiver(no[0].id);
      if (!crReceiver)  setCrReceiver(no[0].id);
      if (!ofReceiver)  setOfReceiver(no[0].id);
      if (!salPaidBy)   setSalPaidBy(no[0].id);
    }
    if (hu.length > 0) {
      if (!person)      setPerson(hu[0].id);
      if (!tfFrom)      setTfFrom(hu[0].id);
      if (!tfTo)        setTfTo(hu[0].id);
      if (!crSeller)    setCrSeller(hu[0].id);
      if (!frSender)    setFrSender(hu[0].id);
    }
    const ow = owners(people);
    if (ow.length > 0) {
      if (!ofSender)    setOfSender(ow[0].id);
      if (!frReceiver)  setFrReceiver(ow[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, people]);

  const changeType = (t: TxType) => {
    setType(t);
    if (t === 'salary') setCat('Salary');
    else if (t === 'income') setCat('Sales Revenue');
    else setCat('');
  };

  const handleSave = () => {
    const id = 'tx_' + Date.now();
    const ts = Date.now();

    if (type === 'income' || type === 'expense') {
      const amt = parseFloat(amount) || 0;
      if (!date)    { toast.error('Select a date'); return; }
      if (amt <= 0) { toast.error('Enter a valid amount'); return; }
      if (type === 'income') {
        if (!person) { toast.error('Select who made the sale'); return; }
        if (!receiver) { toast.error('Select who received the money'); return; }
        const sellerName = people.find(p => p.id === person)?.name || '';
        const desc = `Sale${buyer ? ' — to ' + buyer : ''}${sellerName ? ' by ' + sellerName : ''}${cat ? ' — ' + cat : ''}`;
        onSave({ id, ts, type, amount: amt, person: receiver, seller: person, sellerName, date, cat, note, source, buyer: buyer || undefined, receiver: receiver || undefined, desc });
      } else {
        if (!person)  { toast.error('Select a person'); return; }
        const pn = people.find(p => p.id === person)?.name || '';
        const desc = `Expense${pn ? ' by ' + pn : ''}`;
        onSave({ id, ts, type, amount: amt, person, date, cat, note, source, buyer: buyer || undefined, receiver: receiver || undefined, desc });
      }
    }
    if (type === 'salary') {
      const amt = parseFloat(amount) || 0;
      if (!person || !date || amt <= 0) { toast.error('Fill all required fields'); return; }
      const emp = people.find(p => p.id === person)?.name || '?';
      const pb  = people.find(p => p.id === salPaidBy)?.name || '';
      onSave({ id, ts, type, amount: amt, person: salPaidBy, employee: person, employeeName: emp, salaryPaidBy: salPaidBy, date, cat: 'Salary', note, desc: `Salary — ${emp}${pb ? ' (paid by ' + pb + ')' : ''}` });
    }
    if (type === 'transfer') {
      const amt = parseFloat(tfAmt) || 0;
      if (!tfFrom || !tfTo) { toast.error('Select sender and receiver'); return; }
      if (tfFrom === tfTo)  { toast.error('Sender and receiver must differ'); return; }
      if (!tfDate)          { toast.error('Select a date'); return; }
      if (amt <= 0)         { toast.error('Enter transfer amount'); return; }
      const fn = people.find(p => p.id === tfFrom)?.name || '?';
      const tn = people.find(p => p.id === tfTo)?.name || '?';
      onSave({ id, ts, type, amount: amt, date: tfDate, transferFrom: tfFrom, transferTo: tfTo, transferRef: tfRef, person: tfFrom, cat: 'Transfer', note: tfRef, desc: `MoMo Transfer: ${fn} → ${tn}` });
    }
    if (type === 'credit') {
      const total = parseFloat(crTotal) || 0;
      const paid  = parseFloat(crPaid)  || 0;
      if (!crBuyer) { toast.error('Enter buyer name'); return; }
      if (!crDate)  { toast.error('Select a date'); return; }
      if (total <= 0) { toast.error('Enter total expected amount'); return; }
      if (paid > total) { toast.error('Amount paid cannot exceed total'); return; }
      onSave({ id, ts, type, amount: paid, creditTotal: total, creditPaid: paid, creditBuyer: crBuyer, creditSeller: crSeller, creditReceiver: crReceiver, person: crSeller, date: crDate, cat: crCat, note: crNote, source: crSource, desc: `Credit sale — ${crBuyer}`, payments: paid > 0 ? [{ amount: paid, receiver: crReceiver, date: crDate, note: 'Initial payment' }] : [] });
    }
    if (type === 'owner-fund') {
      const amt = parseFloat(ofAmt) || 0;
      if (!ofSender)   { toast.error('Select owner'); return; }
      if (!ofReceiver) { toast.error('Select receiver'); return; }
      if (!ofDate)     { toast.error('Select a date'); return; }
      if (amt <= 0)    { toast.error('Enter amount'); return; }
      const sn = people.find(p => p.id === ofSender)?.name || 'Owner';
      const rn = people.find(p => p.id === ofReceiver)?.name || '?';
      onSave({ id, ts, type, amount: amt, date: ofDate, ownerSender: ofSender, ownerReceiver: ofReceiver, person: ofReceiver, ownerName: sn, cat: 'Fund Injection', note: ofNote, desc: `Fund injection: ${sn} → ${rn}` });
    }
    if (type === 'fund-return') {
      const amt = parseFloat(frAmt) || 0;
      if (!frSender)   { toast.error('Select who is returning funds'); return; }
      if (!frReceiver) { toast.error('Select owner receiving funds'); return; }
      if (!frDate)     { toast.error('Select a date'); return; }
      if (amt <= 0)    { toast.error('Enter amount'); return; }
      const sn = people.find(p => p.id === frSender)?.name || '?';
      const rn = people.find(p => p.id === frReceiver)?.name || 'Owner';
      onSave({ id, ts, type, amount: amt, date: frDate, frSender, frReceiver, person: frSender, cat: 'Fund Return', note: frNote, desc: `Fund return: ${sn} → ${rn}` });
    }

    // Reset
    setAmount(''); setNote(''); setBuyer(''); setTfRef(''); setCrBuyer(''); setCrTotal(''); setCrPaid(''); setCrNote(''); setOfNote(''); setFrNote('');
    const td = today();
    setDate(td); setTfDate(td); setCrDate(td); setOfDate(td); setFrDate(td);
    onClose();
  };

  const no = nonOwners(people);
  const ow = owners(people);
  const isStandard = ['income', 'expense', 'salary'].includes(type);
  const crPaidAmt  = parseFloat(crPaid) || 0;
  const crTotalAmt = parseFloat(crTotal) || 0;
  const crOutstanding = crTotalAmt - crPaidAmt;

  return (
    <Drawer.Root open={open} onOpenChange={v => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,32,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
        <Drawer.Content
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: '#F0F2F7', borderRadius: '24px 24px 0 0',
            maxHeight: '94vh', display: 'flex', flexDirection: 'column',
            outline: 'none',
          }}
        >
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 44, height: 5, borderRadius: 99, background: '#C4C8D8' }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 12px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1A1D2E' }}>New Transaction</h2>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} color="#5A5F7A" />
            </button>
          </div>

          {/* Scrollable body */}
          <div
            ref={scrollRef}
            style={{ overflowY: 'auto', flex: 1, padding: '0 16px 32px', WebkitOverflowScrolling: 'touch' }}
          >
            {/* Type switcher */}
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingTop: 10, paddingBottom: 12, scrollbarWidth: 'none' as any }}>
              {TYPE_OPTS.map(opt => {
                const active = type === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => changeType(opt.id)}
                    style={{
                      flexShrink: 0, padding: '8px 14px', borderRadius: 12,
                      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
                      border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                      ...(active
                        ? { background: opt.color + '20', color: opt.color, boxShadow: `0 0 0 1.5px ${opt.color}` }
                        : { background: '#fff', color: '#9A9FB8', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                      ),
                    }}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                );
              })}
            </div>

            {/* ── STANDARD (income / expense / salary) ── */}
            {isStandard && (
              <div style={card}>
                <div style={{ marginBottom: 14 }}>
                  <Field label={`Amount (${currency}) *`}>
                    <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                      type="number" placeholder="0.00" min="0" step="0.01"
                      value={amount} onChange={e => setAmount(e.target.value)} />
                  </Field>
                </div>

                {type === 'income' && (
                  <Row>
                    <Field label="Buyer Name">
                      <input style={inp} type="text" placeholder="Buyer's name (optional)"
                        value={buyer} onChange={e => setBuyer(e.target.value)} />
                    </Field>
                    <Field label="Money Received By">
                      <Select value={receiver} onChange={setReceiver}>
                        {nonOwners(people).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </Field>
                  </Row>
                )}

                <Row>
                  <Field label={type === 'income' ? 'Sale Made By *' : type === 'salary' ? 'Employee *' : 'Paid By *'}>
                    <Select value={person} onChange={setPerson}>
                      {(type === 'income' || type === 'salary')
                        ? humans(people).map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                        : no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Date *">
                    <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </Field>
                </Row>

                <Row>
                  <Field label="Category">
                    <Select value={cat} onChange={setCat}>
                      {CATS.map(c => <option key={c} value={c}>{c || '— Select —'}</option>)}
                    </Select>
                  </Field>
                  {type === 'income' && (
                    <Field label="Source">
                      <Select value={source} onChange={setSource}>
                        <option value="shop">Shop</option>
                        <option value="farm">Farm</option>
                      </Select>
                    </Field>
                  )}
                  <Field label="Note">
                    <input style={inp} type="text" placeholder="e.g. Receipt #007"
                      value={note} onChange={e => setNote(e.target.value)} />
                  </Field>
                </Row>

                {type === 'salary' && (
                  <Field label="Paid By (Deducted from) *">
                    <Select value={salPaidBy} onChange={setSalPaidBy}>
                      {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
            )}

            {/* ── TRANSFER ── */}
            {type === 'transfer' && (
              <div style={card}>
                <InfoBox>💡 Record a mobile money or bank transfer made on behalf of the business.</InfoBox>
                <Field label={`Amount (${currency}) *`}>
                  <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                    type="number" placeholder="0.00" min="0" step="0.01"
                    value={tfAmt} onChange={e => setTfAmt(e.target.value)} />
                </Field>
                <Row>
                  <Field label="Sent By *">
                    <Select value={tfFrom} onChange={setTfFrom}>
                      {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Received By *">
                    <Select value={tfTo} onChange={setTfTo}>
                      {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                </Row>
                <Row>
                  <Field label="Date *">
                    <input style={inp} type="date" value={tfDate} onChange={e => setTfDate(e.target.value)} />
                  </Field>
                  <Field label="MoMo / Bank Reference">
                    <input style={inp} type="text" placeholder="e.g. MTN ref 123456"
                      value={tfRef} onChange={e => setTfRef(e.target.value)} />
                  </Field>
                </Row>
              </div>
            )}

            {/* ── CREDIT ── */}
            {type === 'credit' && (
              <div style={card}>
                <InfoBox>🥚 Egg sale on credit — track buyer, total expected, amount paid now.</InfoBox>
                <Row>
                  <Field label="Buyer Name *">
                    <input style={inp} type="text" placeholder="Buyer's full name"
                      value={crBuyer} onChange={e => setCrBuyer(e.target.value)} />
                  </Field>
                  <Field label="Date *">
                    <input style={inp} type="date" value={crDate} onChange={e => setCrDate(e.target.value)} />
                  </Field>
                </Row>
                <Row>
                  <Field label={`Total Expected (${currency}) *`}>
                    <input style={inp} type="number" placeholder="0.00" min="0" step="0.01"
                      value={crTotal} onChange={e => setCrTotal(e.target.value)} />
                  </Field>
                  <Field label="Amount Paid Now">
                    <input style={inp} type="number" placeholder="0.00" min="0" step="0.01"
                      value={crPaid} onChange={e => setCrPaid(e.target.value)} />
                  </Field>
                </Row>
                {crTotalAmt > 0 && (
                  <div style={{ ...infoBox, color: crOutstanding > 0 ? '#E83E5C' : '#00B87A', marginBottom: 10 }}>
                    Total: {currency} {crTotalAmt.toFixed(2)} · Paid: {currency} {crPaidAmt.toFixed(2)} · Outstanding: {currency} {crOutstanding.toFixed(2)}
                  </div>
                )}
                <Row>
                  <Field label="Sale Made By *">
                    <Select value={crSeller} onChange={setCrSeller}>
                      {humans(people).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Money Received By">
                    <Select value={crReceiver} onChange={setCrReceiver}>
                      {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                </Row>
                <Row>
                  <Field label="Category">
                    <Select value={crCat} onChange={setCrCat}>
                      <option value="Sales Revenue">Sales Revenue</option>
                      <option value="Other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Source">
                    <Select value={crSource} onChange={setCrSource}>
                      <option value="farm">Farm</option>
                      <option value="shop">Shop</option>
                    </Select>
                  </Field>
                  <Field label="Note">
                    <input style={inp} type="text" placeholder="Optional note"
                      value={crNote} onChange={e => setCrNote(e.target.value)} />
                  </Field>
                </Row>
              </div>
            )}

            {/* ── OWNER FUND ── */}
            {type === 'owner-fund' && (
              <div style={card}>
                <InfoBox>🟠 Fund Injection — record money sent by an owner into the business.</InfoBox>
                <Field label={`Amount (${currency}) *`}>
                  <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                    type="number" placeholder="0.00" min="0" step="0.01"
                    value={ofAmt} onChange={e => setOfAmt(e.target.value)} />
                </Field>
                <Row>
                  <Field label="Date *">
                    <input style={inp} type="date" value={ofDate} onChange={e => setOfDate(e.target.value)} />
                  </Field>
                  <Field label="Note">
                    <input style={inp} type="text" placeholder="Optional reference"
                      value={ofNote} onChange={e => setOfNote(e.target.value)} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Sent By (Owner) *">
                    <Select value={ofSender} onChange={setOfSender}>
                      {ow.length ? ow.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">— No owners —</option>}
                    </Select>
                  </Field>
                  <Field label="Received By *">
                    <Select value={ofReceiver} onChange={setOfReceiver}>
                      {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                </Row>
              </div>
            )}

            {/* ── FUND RETURN ── */}
            {type === 'fund-return' && (
              <div style={card}>
                <InfoBox>🔵 Record unused money returned from the business back to an owner.</InfoBox>
                <Field label={`Amount (${currency}) *`}>
                  <input style={{ ...inp, fontSize: '1.5rem', fontFamily: "'DM Mono',monospace" }}
                    type="number" placeholder="0.00" min="0" step="0.01"
                    value={frAmt} onChange={e => setFrAmt(e.target.value)} />
                </Field>
                <Row>
                  <Field label="Date *">
                    <input style={inp} type="date" value={frDate} onChange={e => setFrDate(e.target.value)} />
                  </Field>
                  <Field label="Note">
                    <input style={inp} type="text" placeholder="Optional reference"
                      value={frNote} onChange={e => setFrNote(e.target.value)} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Returned By *">
                    <Select value={frSender} onChange={setFrSender}>
                      {no.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Received By (Owner) *">
                    <Select value={frReceiver} onChange={setFrReceiver}>
                      {ow.length ? ow.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">— No owners —</option>}
                    </Select>
                  </Field>
                </Row>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              style={{
                width: '100%', padding: '15px', borderRadius: 14,
                background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                boxShadow: '0 6px 20px rgba(61,107,223,0.4)',
                marginTop: 8,
              }}
            >
              Save Transaction
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/* Tiny sub-components for form layout */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8' }}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>{children}</div>;
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      style={{ ...inp, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a9fb8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', appearance: 'none' as any }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={infoBox}>{children}</div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
  padding: '16px', marginBottom: 12,
  border: '1px solid rgba(0,0,0,0.05)',
};

const inp: React.CSSProperties = {
  background: '#F5F7FF', border: '1.5px solid rgba(0,0,0,0.08)',
  borderRadius: 10, padding: '10px 13px',
  fontSize: '0.88rem', color: '#1A1D2E',
  width: '100%', fontFamily: "'DM Mono',monospace",
  outline: 'none', transition: 'border-color 0.18s',
};

const infoBox: React.CSSProperties = {
  background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 10, padding: '10px 13px',
  fontSize: '0.72rem', color: '#5A5F7A', lineHeight: 1.6,
  marginBottom: 10,
};
