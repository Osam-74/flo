import type { Person, Transaction, ColorDef } from './types';

export const COLORS: Record<string, ColorDef> = {
  green:  { bg: 'rgba(0,184,122,0.14)',   text: '#00B87A' },
  blue:   { bg: 'rgba(61,107,223,0.14)',  text: '#3D6BDF' },
  gold:   { bg: 'rgba(232,160,32,0.14)',  text: '#E8A020' },
  red:    { bg: 'rgba(232,62,92,0.14)',   text: '#E83E5C' },
  purple: { bg: 'rgba(139,92,246,0.14)',  text: '#8B5CF6' },
};

export const TX_COLORS: Record<string, string> = {
  income:       '#00B87A',
  expense:      '#E83E5C',
  salary:       '#3D6BDF',
  transfer:     '#E8A020',
  credit:       '#8B5CF6',
  'owner-fund': '#F07030',
  'fund-return':'#00A8A0',
};

export const TX_BG: Record<string, string> = {
  income:       'rgba(0,184,122,0.12)',
  expense:      'rgba(232,62,92,0.12)',
  salary:       'rgba(61,107,223,0.12)',
  transfer:     'rgba(232,160,32,0.12)',
  credit:       'rgba(139,92,246,0.12)',
  'owner-fund': 'rgba(240,112,48,0.12)',
  'fund-return':'rgba(0,168,160,0.12)',
};

export const TX_EMOJI: Record<string, string> = {
  income:       '💚',
  expense:      '🔴',
  salary:       '💙',
  transfer:     '🟡',
  credit:       '🟣',
  'owner-fund': '🟠',
  'fund-return':'🔵',
};

export function pColor(p?: Pick<Person, 'color'>): ColorDef {
  return COLORS[p?.color || 'green'] || COLORS.green;
}

export function pInit(p: Pick<Person, 'name'>): string {
  return p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function fmtDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtAmt(n: number, currency: string): string {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + currency + ' ' + abs;
}

export function fmtN(n: number): string {
  return Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function isOwner(p: Pick<Person, 'role'>): boolean {
  return !!(p?.role?.toLowerCase().includes('owner'));
}

export function pStats(pid: string, txs: Transaction[]) {
  let pIn = 0, pOut = 0;
  for (const t of txs) {
    if (t.person === pid) {
      if (t.type === 'income') pIn += t.amount;
      else if (t.type === 'expense' || t.type === 'salary') pOut += t.amount;
    }
    if (t.type === 'transfer') {
      if (t.transferFrom === pid) pOut += t.amount;
      if (t.transferTo === pid)   pIn  += t.amount;
    }
    if (t.type === 'credit') {
      if (t.payments?.length) {
        for (const pmt of t.payments) {
          if (pmt.receiver === pid) pIn += pmt.amount || 0;
        }
      } else if (t.creditReceiver === pid) {
        pIn += t.creditPaid || 0;
      }
    }
    if (t.type === 'owner-fund') {
      if (t.ownerSender   === pid) pOut += t.amount;
      if (t.ownerReceiver === pid) pIn  += t.amount;
    }
    if (t.type === 'fund-return') {
      if (t.frSender   === pid) pOut += t.amount;
      if (t.frReceiver === pid) pIn  += t.amount;
    }
  }
  return { pIn, pOut, pBal: pIn - pOut };
}

export const gs = <T>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
};

export const ss = <T>(k: string, v: T): void => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('LS write failed', e); }
};

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
