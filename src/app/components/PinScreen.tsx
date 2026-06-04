import React, { useState, useCallback, useEffect } from 'react';
import { Delete } from 'lucide-react';
import { sha256 } from '../utils';
import { BUSINESSES } from './BusinessSelector';

interface Props {
  onUnlock: (mode: 'master' | 'view') => void;
  businessId: string;
  businessName: string;
}

export function PinScreen({ onUnlock, businessId, businessName }: Props) {
  const biz = BUSINESSES.find(b => b.id === businessId) || BUSINESSES[0];
  const H_MASTER = biz.masterHash;
  const H_VIEW   = biz.viewHash;
  const [entry, setEntry] = useState('');
  const [dotState, setDotState] = useState<'idle' | 'error'>('idle');
  const [shaking, setShaking] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [lastPress, setLastPress] = useState(0);

  const checkPin = useCallback(async (pin: string) => {
    const h = await sha256(pin);
    if (h === H_MASTER) {
      sessionStorage.setItem('cb_s', 'master');
      onUnlock('master');
    } else if (h === H_VIEW) {
      sessionStorage.setItem('cb_s', 'view');
      onUnlock('view');
    } else {
      setDotState('error');
      setShaking(true);
      setErrMsg('Incorrect PIN');
      setTimeout(() => {
        setShaking(false);
        setDotState('idle');
        setEntry('');
        setErrMsg('');
      }, 900);
    }
  }, [onUnlock]);

  const press = useCallback((d: string) => {
    const now = Date.now();
    if (now - lastPress < 40) return;
    setLastPress(now);
    setEntry(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) setTimeout(() => checkPin(next), 120);
      return next;
    });
  }, [lastPress, checkPin]);

  const del = useCallback(() => {
    setEntry(prev => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') del();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [press, del]);

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#F0F2F7',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 28, zIndex: 9999, userSelect: 'none',
    }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%,60%{transform:translateX(-8px)}
          40%,80%{transform:translateX(8px)}
        }
        .pin-shake { animation: shake 0.45s ease; }
      `}</style>

      {/* Logo */}
      <div style={{
        width: 76, height: 76, borderRadius: 24,
        background: 'linear-gradient(145deg, #2A4FCF, #6B8FFF)',
        boxShadow: '0 8px 32px rgba(61,107,223,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2.2rem', marginBottom: 20,
      }}>
        💰
      </div>

      {/* Brand */}
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        Cash<span style={{ color: '#3D6BDF' }}>book</span>
      </div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2FA8', letterSpacing: '0.02em', marginBottom: 2, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        {businessName}
      </div>
      <div style={{ fontSize: '0.62rem', color: '#9A9FB8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 40 }}>
        Enter PIN to continue
      </div>

      {/* Dots */}
      <div className={shaking ? 'pin-shake' : ''} style={{ display: 'flex', gap: 18, marginBottom: 40 }}>
        {[0,1,2,3].map(i => {
          const filled = i < entry.length;
          const err = dotState === 'error';
          return (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              background: err ? '#E83E5C' : filled ? '#3D6BDF' : '#D4D8E8',
              boxShadow: err
                ? '0 0 0 4px rgba(232,62,92,0.2)'
                : filled
                ? '0 0 0 4px rgba(61,107,223,0.2)'
                : 'none',
              transition: 'all 0.18s',
            }} />
          );
        })}
      </div>

      {/* Number pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: 270 }}>
        {KEYS.map((k, i) => {
          if (!k) return <div key={i} />;
          if (k === 'del') {
            return (
              <button key="del" onClick={del} style={keyStyle}>
                <Delete size={22} />
              </button>
            );
          }
          return (
            <button key={k} onClick={() => press(k)} style={keyStyle}>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1A1D2E' }}>{k}</span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      <div style={{ marginTop: 18, minHeight: 18, fontSize: '0.74rem', color: '#E83E5C', fontWeight: 700 }}>
        {errMsg}
      </div>
    </div>
  );
}

const keyStyle: React.CSSProperties = {
  height: 72, borderRadius: 18,
  background: '#FFFFFF',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.12s', color: '#5A5F7A',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
};
