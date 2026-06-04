import type { Person, Transaction, ColorDef } from './types';

// All person colors now use blue shades
export const COLORS: Record<string, ColorDef> = {
  green:  { bg: 'rgba(61,107,223,0.14)',  text: '#3D6BDF' },  // blue (was green)
  blue:   { bg: 'rgba(26,47,168,0.14)',   text: '#1A2FA8' },  // deep blue
  gold:   { bg: 'rgba(107,143,255,0.18)', text: '#4A6FD4' },  // mid blue (was gold)
  red:    { bg: 'rgba(232,62,92,0.14)',   text: '#E83E5C' },  // keep red for negative context
  purple: { bg: 'rgba(90,132,255,0.16)',  text: '#2A50B8' },  // blue-purple shade
};

// TX icon colors — all blue shades, red only for expense/fund-return (outflows)
export const TX_COLORS: Record<string, string> = {
  income:        '#3D6BDF',   // blue
  expense:       '#E83E5C',   // red (outflow warning)
  salary:        '#1A2FA8',   // deep blue
  transfer:      '#5A84FF',   // light blue
  credit:        '#2A50B8',   // mid blue
  'owner-fund':  '#6B8FFF',   // soft blue
  'fund-return': '#C0392B',   // dark red (outflow)
};

export const TX_BG: Record<string, string> = {
  income:        'rgba(61,107,223,0.13)',
  expense:       'rgba(232,62,92,0.12)',
  salary:        'rgba(26,47,168,0.13)',
  transfer:      'rgba(90,132,255,0.13)',
  credit:        'rgba(42,80,184,0.13)',
  'owner-fund':  'rgba(107,143,255,0.13)',
  'fund-return': 'rgba(192,57,43,0.12)',
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

export function fmtAmt(n: number | undefined | null, currency: string): string {
  const safe = Number(n) || 0;
  const abs = Math.abs(safe).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (safe < 0 ? '-' : '') + currency + ' ' + abs;
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
      if (t.transferTo   === pid) pIn  += t.amount;
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
