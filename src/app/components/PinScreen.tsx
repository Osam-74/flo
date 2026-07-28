import React, { useState, useCallback, useEffect } from 'react';
import { Delete, ArrowLeft, Download } from 'lucide-react';
import { showToast } from './Modals';
import { sha256 } from '../utils';
import { ViewUser } from '../types';

interface Props {
  onUnlock: (mode: 'master' | 'view') => void;
  onBack?: () => void;
  businessId: string;
  businessName: string;
  masterHash: string;
  viewHash?: string;
  viewUsers?: ViewUser[];
  onUnlockView: (personId: string, personName: string) => void;
}

export function PinScreen({ onUnlock, onBack, businessName, masterHash, viewHash, viewUsers, onUnlockView }: Props) {
  const [entry, setEntry] = useState('');
  const [dotState, setDotState] = useState<'idle' | 'error'>('idle');
  const [shaking, setShaking] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [lastPress, setLastPress] = useState(0);
  const [installReady, setInstallReady] = useState(!!(window.__pwaInstallReady && window.__pwaInstallPrompt));
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [welcomeInfo, setWelcomeInfo] = useState<{ name: string } | null>(null);
  const isStandalone = !!(window.__pwaIsStandalone);

  /* ── Listen for install prompt ── */
  useEffect(() => {
    const onReady = () => setInstallReady(!!(window.__pwaInstallPrompt));
    const onDone  = () => setInstallReady(false);
    window.addEventListener('pwa-install-ready', onReady);
    window.addEventListener('pwa-install-done',  onDone);
    return () => {
      window.removeEventListener('pwa-install-ready', onReady);
      window.removeEventListener('pwa-install-done',  onDone);
    };
  }, []);

  const handleInstall = async () => {
    // Try to use the captured beforeinstallprompt event
    const p = window.__pwaInstallPrompt;
    if (p) {
      try {
        p.prompt();
        const choice = await p.userChoice;
        if (choice?.outcome === 'accepted') {
          window.__pwaInstallPrompt = undefined;
          window.__pwaInstallReady = false;
          setInstallReady(false);
          showToast('✅ FloHQ installed!', 'success');
        } else {
          showToast('Installation cancelled', 'info');
        }
        return;
      } catch (e) {
        console.warn('[Install] prompt failed:', e);
      }
    }
    // If no prompt available, show instructions as last resort
    setShowInstallHelp(true);
  };

  const checkPin = useCallback(async (pin: string) => {
    const h = await sha256(pin);
    if (h === masterHash) {
      sessionStorage.setItem('cb_s', 'master');
      onUnlock('master');
    } else if (viewHash && h === viewHash) {
      sessionStorage.setItem('cb_s', 'view');
      onUnlock('view');
    } else if (viewUsers && viewUsers.length > 0) {
      const matched = viewUsers.find(vu => vu.pinHash === h);
      if (matched) {
        sessionStorage.setItem('cb_s', 'view');
        sessionStorage.setItem('cb_viewer_id', matched.personId);
        sessionStorage.setItem('cb_viewer_name', matched.personName);
        setWelcomeInfo({ name: matched.personName });
        setTimeout(() => {
          onUnlockView(matched.personId, matched.personName);
        }, 3000);
        return;
      } else {
        triggerError();
      }
    } else {
      triggerError();
    }

    function triggerError() {
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
  }, [onUnlock, onUnlockView, masterHash, viewHash, viewUsers]);

  const press = useCallback((d: string) => {
    const now = Date.now();
    if (now - lastPress < 40) return;
    setLastPress(now);
    setEntry(prev => {
      if (prev.length >= 6) return prev;
      const next = prev + d;
      if (next.length >= 4) setTimeout(() => checkPin(next), 120);
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
  const pinLen = Math.max(4, entry.length);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #F2F4F9 0%, #E8ECF5 100%)',
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
        @keyframes welcomeFade {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Welcome Screen Overlay */}
      {welcomeInfo && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(180deg, #F2F4F9 0%, #E8ECF5 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10005,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          animation: 'welcomeFade 3s forwards',
          userSelect: 'none',
        }}>
          {/* Logo */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 26,
            background: 'linear-gradient(145deg, #0D1B6E 0%, #2A4FCF 50%, #6B8FFF 100%)',
            boxShadow: '0 10px 40px rgba(13,27,110,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.4rem',
            marginBottom: 24,
          }}>💰</div>

          <div style={{
            fontSize: '2.1rem',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            marginBottom: 16,
            color: '#0A0F1F'
          }}>
            Flo<span style={{ color: '#00B4D8' }}>HQ</span>
          </div>

          <div style={{
            fontSize: '1rem',
            color: '#5A5F7A',
            fontWeight: 500,
            marginBottom: 4,
          }}>
            Welcome back,
          </div>

          <div style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: '#1A2FA8',
            marginBottom: 32,
            textAlign: 'center',
            padding: '0 24px',
          }}>
            {welcomeInfo.name}
          </div>

          {/* Spinner */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid rgba(61,107,223,0.1)',
            borderTopColor: '#3D6BDF',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute', top: 24, left: 24,
            background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.75rem', fontWeight: 700, color: '#5A5F7A',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
      )}

      {/* Logo */}
      <div style={{
        width: 76, height: 76, borderRadius: 24,
        background: 'linear-gradient(145deg, #0D1B6E 0%, #2A4FCF 50%, #6B8FFF 100%)',
        boxShadow: '0 8px 32px rgba(61,107,223,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2.2rem', marginBottom: 20,
      }}>💰</div>

      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        Flo<span style={{ color: '#00B4D8' }}>HQ</span>
      </div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A2FA8', letterSpacing: '0.02em', marginBottom: 2, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        {businessName}
      </div>
      <div style={{ fontSize: '0.62rem', color: '#9A9FB8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 40 }}>
        Enter PIN to continue
      </div>

      {/* Dots */}
      <div className={shaking ? 'pin-shake' : ''} style={{ display: 'flex', gap: 18, marginBottom: 40 }}>
        {Array.from({ length: pinLen }).map((_, i) => {
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

      {/* Install App button — always visible when not running as installed PWA */}
      {!isStandalone && (
        <button
          onClick={handleInstall}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '11px 22px', cursor: 'pointer', marginBottom: 24,
            fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em',
            boxShadow: '0 4px 16px rgba(61,107,223,0.35)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          <Download size={15} strokeWidth={2.5} />
          Install App
        </button>
      )}

      {/* Manual install instructions modal */}
      {showInstallHelp && (
        <div
          onClick={() => setShowInstallHelp(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: 28,
              maxWidth: 340, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16, color: '#0A0F1F' }}>
              📲 Install FloHQ
            </div>
            <div style={{ fontSize: '0.82rem', color: '#5A5F7A', lineHeight: 1.6, marginBottom: 20 }}>
              To install FloHQ as an app on your phone:
            </div>
            <div style={{ fontSize: '0.8rem', color: '#1A1D2E', lineHeight: 1.8, marginBottom: 8 }}>
              <strong>Chrome (Android):</strong>
              <div style={{ color: '#5A5F7A', marginTop: 4 }}>
                1. Tap the three-dot menu (⋮) in Chrome<br/>
                2. Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong><br/>
                3. Confirm installation
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#1A1D2E', lineHeight: 1.8, marginBottom: 20, marginTop: 12 }}>
              <strong>Safari (iPhone):</strong>
              <div style={{ color: '#5A5F7A', marginTop: 4 }}>
                1. Tap the Share button (□↑)<br/>
                2. Scroll down and tap <strong>"Add to Home Screen"</strong><br/>
                3. Tap <strong>"Add"</strong>
              </div>
            </div>
            <button
              onClick={() => setShowInstallHelp(false)}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px', fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

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
