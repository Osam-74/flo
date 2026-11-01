import React, { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { CalendarDays } from 'lucide-react';

/**
 * Date picker that highlights days with no log.
 *  - amber  = no log yet (needs filling in)
 *  - green  = already logged
 *  - future days are disabled
 *
 * "Missing" window: from the earliest of (the dashboard refresh date, the
 * first day this log type was ever recorded) up to today. Days before the
 * first-ever log are not flagged, so a brand-new business isn't buried in amber.
 */
interface Props {
  value: string;               // YYYY-MM-DD
  onChange: (d: string) => void;
  loggedDates: string[];       // dates that already have a log of this kind
  accent?: string;             // theme colour for the selected day
  label?: string;              // e.g. "egg collection"
}

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const parse = (s: string) => new Date(s + 'T00:00:00');

const CSS = `
.mdp .rdp { --rdp-cell-size: 40px; margin: 0; }
.mdp .rdp-day { border-radius: 10px; font-weight: 600; font-size: 0.82rem; }
.mdp .rdp-day_missing:not(.rdp-day_selected) { background: rgba(245,158,11,0.22); color: #92400E; font-weight: 800; box-shadow: inset 0 0 0 1.5px #F59E0B; }
.mdp .rdp-day_logged:not(.rdp-day_selected) { background: rgba(34,197,94,0.14); color: #166534; }
.mdp .rdp-day_selected { color: #fff !important; font-weight: 800; }
.mdp .rdp-day_today:not(.rdp-day_selected) { text-decoration: underline; }
.mdp .rdp-day_disabled { opacity: 0.3; }
.mdp .rdp-caption_label { font-weight: 800; font-size: 0.9rem; }
`;

export function MissingDayPicker({ value, onChange, loggedDates, accent = '#D97706', label = 'log' }: Props) {
  const [open, setOpen] = useState(false);
  const todayStr = iso(new Date());

  const { missing, logged, missingList } = useMemo(() => {
    const set = new Set(loggedDates);
    let refresh = todayStr;
    try {
      const stored = localStorage.getItem('cb_refresh_date');
      if (stored && stored <= todayStr) refresh = stored;
    } catch { /* ignore */ }
    const first = loggedDates.length ? [...loggedDates].sort()[0] : refresh;
    const start = first < refresh ? first : refresh;

    const missing: Date[] = [];
    const missingList: string[] = [];
    const d = parse(start);
    const end = parse(todayStr);
    while (d <= end) {
      const ds = iso(d);
      if (!set.has(ds)) { missing.push(new Date(d)); missingList.push(ds); }
      d.setDate(d.getDate() + 1);
    }
    return { missing, logged: [...set].filter(x => x <= todayStr).map(parse), missingList };
  }, [loggedDates, todayStr]);

  const pretty = (s: string) => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const valueMissing = missingList.includes(value);
  const valueLogged  = !!value && loggedDates.includes(value);

  return (
    <div className="mdp">
      <style>{CSS}</style>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: '#F5F7FF', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10,
          padding: '10px 13px', fontSize: '0.92rem', color: '#1A1D2E',
          fontFamily: "'DM Mono',monospace", cursor: 'pointer', textAlign: 'left',
        }}
      >
        <CalendarDays size={16} color={accent} />
        <span style={{ flex: 1 }}>{value ? pretty(value) : 'Select a date'}</span>
        {valueMissing && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#92400E', background: 'rgba(245,158,11,0.22)', padding: '2px 7px', borderRadius: 99 }}>MISSING</span>}
        {valueLogged && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#166534', background: 'rgba(34,197,94,0.16)', padding: '2px 7px', borderRadius: 99 }}>LOGGED</span>}
      </button>

      {open && (
        <div style={{ marginTop: 8, background: '#fff', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DayPicker
              mode="single"
              selected={value ? parse(value) : undefined}
              defaultMonth={value ? parse(value) : new Date()}
              onSelect={(d) => { if (d) { onChange(iso(d)); setOpen(false); } }}
              disabled={{ after: new Date() }}
              toDate={new Date()}
              modifiers={{ missing, logged }}
              modifiersClassNames={{ missing: 'rdp-day_missing', logged: 'rdp-day_logged' }}
              modifiersStyles={{ selected: { background: accent } }}
              styles={{ day: {} }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', fontSize: '0.64rem', fontWeight: 700, color: '#6B7280', paddingTop: 6 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'rgba(245,158,11,0.4)', boxShadow: 'inset 0 0 0 1.5px #F59E0B', marginRight: 5 }} />No {label} ({missingList.length})</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'rgba(34,197,94,0.3)', marginRight: 5 }} />Logged</span>
          </div>
          {missingList.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange(missingList[0]); setOpen(false); }}
              style={{ width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 10, border: '1.5px solid #F59E0B', background: 'rgba(245,158,11,0.10)', color: '#92400E', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Jump to oldest missing day ({pretty(missingList[0]).replace(/^\w+, /, '')})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
