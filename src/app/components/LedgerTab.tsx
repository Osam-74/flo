import React, { useState } from 'react';
import type { Transaction, Person, TxType } from '../types';
import { fmtDate, pColor } from '../utils';
import { TxItem } from './TxItem';

interface Props {
  txs: Transaction[];
  people: Person[];
  currency: string;
  initialPersonFilter?: string;
  isReadOnly: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string, desc: string) => void;
}

type FilterType = TxType | 'all';

const TYPE_FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'income',      label: '💚 Sales' },
  { id: 'expense',     label: '🔴 Expense' },
  { id: 'salary',      label: '💙 Salary' },
  { id: 'transfer',    label: '🟡 Transfer' },
  { id: 'credit',      label: '🟣 Credit' },
  { id: 'owner-fund',  label: '🟠 Fund Injection' },
  { id: 'fund-return', label: '🔵 Fund Return' },
];

export function LedgerTab({ txs, people, currency, initialPersonFilter = 'all', isReadOnly, onEdit, onDelete }: Props) {
  const [typeFilter, setTypeFilter]     = useState<FilterType>('all');
  const [personFilter, setPersonFilter] = useState(initialPersonFilter);

  let filtered = [...txs];
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  if (personFilter !== 'all') filtered = filtered.filter(t =>
    t.person === personFilter ||
    t.transferFrom === personFilter || t.transferTo === personFilter ||
    t.creditReceiver === personFilter || t.creditSeller === personFilter ||
    t.ownerSender === personFilter || t.ownerReceiver === personFilter ||
    t.frSender === personFilter || t.frReceiver === personFilter
  );

  filtered.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.ts || 0) - (a.ts || 0);
  });

  const groups: Record<string, Transaction[]> = {};
  for (const t of filtered) {
    const d = t.date || '';
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  }
  const dates = Object.keys(groups).sort((a, b) => a < b ? 1 : -1);

  return (
    <div style={{ padding: '12px 16px 100px' }}>
      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' as any, marginBottom: 8 }}>
        {TYPE_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 20,
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              ...(typeFilter === f.id
                ? { background: 'linear-gradient(135deg,#3D6BDF,#5A84FF)', color: '#fff', boxShadow: '0 4px 12px rgba(61,107,223,0.3)' }
                : { background: '#fff', color: '#5A5F7A', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
              ),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Person filter chips */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' as any }}>
        <button
          onClick={() => setPersonFilter('all')}
          style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 20,
            fontSize: '0.62rem', fontWeight: 700, border: 'none', cursor: 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
            ...(personFilter === 'all'
              ? { background: '#1A1D2E', color: '#fff' }
              : { background: '#fff', color: '#5A5F7A', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
            ),
          }}
        >
          All People
        </button>
        {people.map(p => {
          const c = pColor(p);
          const active = personFilter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPersonFilter(p.id)}
              style={{
                flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                fontSize: '0.62rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
                ...(active
                  ? { background: c.bg, color: c.text, boxShadow: 'none' }
                  : { background: '#fff', color: '#5A5F7A', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                ),
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', fontSize: '0.78rem', color: '#9A9FB8', lineHeight: 1.8 }}>
          No transactions match this filter.
        </div>
      ) : (
        dates.map(date => (
          <div key={date}>
            <div style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#9A9FB8',
              padding: '10px 2px 6px',
              borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 4,
            }}>
              {fmtDate(date)}
            </div>
            {groups[date].map(t => (
              <TxItem
                key={t.id}
                tx={t}
                people={people}
                currency={currency}
                showActions={!isReadOnly}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
