import React from 'react';
import type { Transaction, Person } from '../types';
import { fmtAmt } from '../utils';
import { TxItem } from './TxItem';

interface Props {
  txs: Transaction[];
  people: Person[];
  currency: string;
  isReadOnly: boolean;
  onPayment: (buyer: string) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string, desc: string) => void;
}

export function CreditTab({ txs, people, currency, isReadOnly, onPayment, onEdit, onDelete }: Props) {
  const creditTxs = txs.filter(t => t.type === 'credit');

  const byBuyer: Record<string, { total: number; paid: number; count: number; seller: string }> = {};
  for (const t of creditTxs) {
    const b = t.creditBuyer || 'Unknown';
    if (!byBuyer[b]) byBuyer[b] = { total: 0, paid: 0, count: 0, seller: '' };
    byBuyer[b].total  += t.creditTotal || 0;
    byBuyer[b].paid   += t.creditPaid  || 0;
    byBuyer[b].count  += 1;
    byBuyer[b].seller  = t.creditSeller || t.person || '';
  }

  const sorted = [...creditTxs].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={sh}>Credit Sales Overview</div>

      {Object.keys(byBuyer).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', fontSize: '0.78rem', color: '#9A9FB8', lineHeight: 1.8 }}>
          No credit sales yet.<br />Use <strong>+</strong> → Credit Sale.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)', marginBottom: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
          {Object.entries(byBuyer).map(([buyer, data], i, arr) => {
            const outstanding = data.total - data.paid;
            const seller = people.find(p => p.id === data.seller);
            return (
              <div
                key={buyer}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  padding: '14px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1A1D2E' }}>{buyer}</div>
                  <div style={{ fontSize: '0.64rem', color: '#9A9FB8', marginTop: 2 }}>
                    {data.count} sale(s) · {seller?.name || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'right' }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.86rem', fontWeight: 600, color: '#1A1D2E' }}>
                      {fmtAmt(data.total, currency)}
                    </div>
                    {outstanding > 0.005 ? (
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', color: '#E83E5C', marginTop: 2 }}>
                        Owes: {fmtAmt(outstanding, currency)}
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.75rem', color: '#00B87A', marginTop: 2 }}>
                        Settled ✓
                      </div>
                    )}
                  </div>
                  {!isReadOnly && outstanding > 0.005 && (
                    <button
                      onClick={() => onPayment(buyer)}
                      style={{
                        background: 'rgba(0,184,122,0.12)', border: '1px solid #00B87A',
                        color: '#00B87A', borderRadius: 10, padding: '6px 11px',
                        fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      💸 Pay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={sh}>All Credit Transactions</div>
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', fontSize: '0.78rem', color: '#9A9FB8' }}>
          No credit transactions logged.
        </div>
      ) : (
        sorted.map(t => (
          <TxItem
            key={t.id}
            tx={t}
            people={people}
            currency={currency}
            showActions={!isReadOnly}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}

const sh: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 10,
};
