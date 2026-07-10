import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Drawer } from 'vaul';

interface Props {
  open: boolean;
  /** Date string YYYY-MM-DD being logged */
  targetDate: string;
  /** How many days were missed before today (0 = just today) */
  missedDays: number;
  /** Called when user saves — passes bags used and the target date */
  onSave: (bags: number, date: string) => void;
  /** Called when user dismisses — does NOT mark the day as done */
  onDismiss: () => void;
}

const inp: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid rgba(180,83,9,0.25)',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: '1.1rem',
  fontFamily: "'DM Mono', monospace",
  fontWeight: 700,
  color: '#92400E',
  background: 'rgba(180,83,9,0.04)',
  outline: 'none',
  boxSizing: 'border-box',
};

const today = () => new Date().toISOString().split('T')[0];

export function FeedUsageModal({ open, targetDate, missedDays, onSave, onDismiss }: Props) {
  const [bags, setBags] = useState('');
  const [dateInput, setDateInput] = useState(targetDate);

  // Sync dateInput when targetDate prop changes
  React.useEffect(() => {
    setDateInput(targetDate);
    setBags('');
  }, [targetDate, open]);

  const handleSave = () => {
    const n = parseInt(bags, 10);
    if (!n || n <= 0) return;
    onSave(n, dateInput || targetDate);
    setBags('');
  };

  const isMissedFlow = missedDays > 0;

  const dateLabel = dateInput
    ? new Date(dateInput + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })
    : targetDate;

  return (
    <Drawer.Root open={open} onOpenChange={v => { if (!v) onDismiss(); }}>
      <Drawer.Portal>
        <Drawer.Overlay style={{
          position: 'fixed', inset: 0,
          background: 'rgba(3,4,94,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
        }} />
        <Drawer.Content style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
          background: '#ffffff',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 32px',
          outline: 'none',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {/* Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 44, height: 5, borderRadius: 99, background: '#FDE68A' }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>🌾</span>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#92400E' }}>
                {isMissedFlow ? 'Missed Feed Entry' : 'Daily Feed Usage'}
              </h2>
            </div>
            <button
              onClick={onDismiss}
              style={{ background: 'rgba(180,83,9,0.08)', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={16} color="#B45309" />
            </button>
          </div>

          <div style={{ padding: '12px 16px 0' }}>
            {/* Missed days notice */}
            {isMissedFlow && (
              <div style={{
                background: 'rgba(220,38,38,0.07)',
                border: '1.5px solid rgba(220,38,38,0.20)',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 14,
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DC2626', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                  ⚠️ Missed {missedDays} day{missedDays !== 1 ? 's' : ''} of feed entry
                </div>
                <div style={{ fontSize: '0.7rem', color: '#7F1D1D', lineHeight: 1.5 }}>
                  You missed logging feed usage for {missedDays} day{missedDays !== 1 ? 's' : ''}. Log the most recent missed day below — you can repeat for each missed day.
                </div>
              </div>
            )}

            {/* Date field (editable so user can log a past missed day) */}
            {isMissedFlow && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400E', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Date *
                </label>
                <input
                  style={{ ...inp, fontSize: '0.9rem' }}
                  type="date"
                  value={dateInput}
                  max={today()}
                  onChange={e => setDateInput(e.target.value)}
                />
              </div>
            )}

            {!isMissedFlow && (
              <div style={{
                background: 'rgba(180,83,9,0.06)',
                border: '1px solid rgba(180,83,9,0.14)',
                borderRadius: 10,
                padding: '8px 12px',
                marginBottom: 14,
                fontSize: '0.72rem',
                color: '#92400E',
                fontWeight: 600,
              }}>
                📅 Logging for today — {dateLabel}
              </div>
            )}

            {/* Bags input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400E', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Bags of Feed Used *
              </label>
              <input
                style={{ ...inp, fontSize: '1.5rem' }}
                type="number"
                placeholder="0"
                min="1"
                step="1"
                value={bags}
                onChange={e => setBags(e.target.value)}
                autoFocus
              />
              {bags && parseInt(bags, 10) > 0 && (
                <div style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 600, marginTop: 5 }}>
                  🌾 {parseInt(bags, 10)} bag{parseInt(bags, 10) !== 1 ? 's' : ''} will be deducted from feed stock
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onDismiss}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: '1.5px solid rgba(180,83,9,0.20)',
                  background: 'transparent',
                  color: '#B45309', fontSize: '0.85rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Remind Later
              </button>
              <button
                onClick={handleSave}
                disabled={!bags || parseInt(bags, 10) <= 0}
                style={{
                  flex: 2, padding: '13px 0', borderRadius: 14,
                  border: 'none',
                  background: parseInt(bags, 10) > 0 ? 'linear-gradient(135deg,#B45309 0%,#D97706 100%)' : 'rgba(180,83,9,0.15)',
                  color: parseInt(bags, 10) > 0 ? '#fff' : '#B45309',
                  fontSize: '0.88rem', fontWeight: 800,
                  cursor: parseInt(bags, 10) > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                Save Feed Usage
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
