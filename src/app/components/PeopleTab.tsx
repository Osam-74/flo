import React, { useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { showToast } from './Modals';
import type { Person, Transaction } from '../types';
import { pColor, pInit, fmtAmt, pStats, isOwner } from '../utils';

interface Props {
  people: Person[];
  txs: Transaction[];
  currency: string;
  isReadOnly: boolean;
  onAdd: (name: string, role: string, color: string) => void;
  onDelete: (id: string) => void;
}

const COLOR_OPTS = ['green', 'blue', 'gold', 'purple', 'red'];

export function PeopleTab({ people, txs, currency, isReadOnly, onAdd, onDelete }: Props) {
  const [name, setName]   = useState('');
  const [role, setRole]   = useState('');
  const [color, setColor] = useState('green');

  const handleAdd = () => {
    if (!name.trim()) { showToast('Enter a name', 'error'); return; }
    if (people.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      showToast('Name already exists', 'error'); return;
    }
    onAdd(name.trim(), role.trim(), color);
    setName(''); setRole(''); setColor('green');
  };

  // Exclude biz account from the people list — it has its own display on Dashboard
  const displayPeople = people.filter(p => p.id !== 'biz');

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={sh}>Team Members</div>

      {displayPeople.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: '#9A9FB8', marginBottom: 16 }}>No team members added yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {displayPeople.map(p => {
            const c = pColor(p);
            const { pIn, pOut, pBal } = pStats(p.id, txs);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', borderRadius: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)',
                padding: '12px 14px',
                border: '1px solid rgba(0,0,0,0.05)',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: c.bg, color: c.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.82rem', fontWeight: 800, flexShrink: 0,
                }}>
                  {pInit(p)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1A1D2E', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.name}
                    {isOwner(p) && (
                      <span style={{ fontSize: '0.55rem', background: 'rgba(240,112,48,0.12)', color: '#F07030', padding: '1px 6px', borderRadius: 5, fontWeight: 700 }}>
                        OWNER
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#9A9FB8', marginTop: 2 }}>
                    {p.role || 'No role'} ·{' '}
                    <span style={{ fontFamily: "'DM Mono',monospace", color: pBal >= 0 ? '#00B87A' : '#E83E5C', fontWeight: 600 }}>
                      {fmtAmt(pBal, currency)}
                    </span>
                  </div>
                </div>
                {!isReadOnly && !isOwner(p) && (
                  <button
                    onClick={() => onDelete(p.id)}
                    style={{
                      background: 'transparent', border: 'none', borderRadius: 8,
                      color: '#9A9FB8', padding: '6px 8px', cursor: 'pointer',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#E83E5C')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9A9FB8')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isReadOnly && (
        <>
          <div style={sh}>Add Person</div>
          <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)', padding: 18, border: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label="Full Name *">
                <input style={inp} placeholder="e.g. Abdul Jalil"
                  value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label="Role / Title">
                <input style={inp} placeholder="e.g. Owner, Caretaker"
                  value={role} onChange={e => setRole(e.target.value)} />
              </Field>
            </div>

            <div style={{ background: '#F5F7FF', borderRadius: 10, padding: '10px 13px', fontSize: '0.72rem', color: '#5A5F7A', lineHeight: 1.6, marginBottom: 12 }}>
              💡 Role <strong>"Owner"</strong> → appears only in Fund Injection & Fund Return fields.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9A9FB8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Colour:</span>
              {COLOR_OPTS.map(col => {
                const { text } = pColor({ color: col });
                return (
                  <button
                    key={col}
                    onClick={() => setColor(col)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: text,
                      border: color === col ? `3px solid #1A1D2E` : '3px solid transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  />
                );
              })}
            </div>

            <button
              onClick={handleAdd}
              style={{
                width: '100%', padding: '13px', borderRadius: 12,
                background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                boxShadow: '0 6px 20px rgba(61,107,223,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <UserPlus size={16} /> Add Person
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8' }}>{label}</label>
      {children}
    </div>
  );
}

const sh: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 10,
};

const inp: React.CSSProperties = {
  background: '#F5F7FF', border: '1.5px solid rgba(0,0,0,0.08)',
  borderRadius: 10, padding: '10px 13px',
  fontSize: '0.88rem', color: '#1A1D2E', width: '100%',
  fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none',
};
