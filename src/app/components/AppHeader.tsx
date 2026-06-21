import React, { useState } from 'react';
import { Lock, Printer, Settings, Download, X } from 'lucide-react';
import type { Tab, AppMode } from '../types';

interface Props {
  appMode: AppMode;
  installReady: boolean;
  activeTab: Tab;
  onLock: () => void;
  onInstall: () => void;
  onTab: (tab: Tab) => void;
}

export function AppHeader({ appMode, installReady, onLock, onInstall, onTab }: Props) {
  const isReadOnly = appMode === 'view';
  const isStandalone = !!(window.__pwaIsStandalone);
  const [showHelp, setShowHelp] = useState(false);

  const handleInstallClick = () => {
    if (installReady) {
      onInstall();
    } else {
      setShowHelp(true);
    }
  };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'linear-gradient(180deg, #0A0F1F 0%, #0D1120 100%)',
      padding: '0 16px',
      height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    }}>
      {/* Brand */}
      <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', textShadow: '0 1px 8px rgba(0,180,216,0.25)' }}>
        Flo<span style={{ color: '#00D9F0' }}>HQ</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {!isStandalone && (
          <button onClick={handleInstallClick} style={headerBtn('#00A8A0')}>
            <Download size={14} strokeWidth={2.5} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' }}>Install</span>
          </button>
        )}

        {/* Report — always visible; disabled (no pointer) in view-only mode */}
        <button
          onClick={isReadOnly ? undefined : () => onTab('report')}
          title="Report"
          style={{
            ...iconBtn,
            cursor: isReadOnly ? 'default' : 'pointer',
            opacity: isReadOnly ? 0.45 : 1,
            pointerEvents: isReadOnly ? 'none' : 'auto',
          }}
        >
          <Printer size={18} strokeWidth={2} color="#C8CDE8" />
        </button>

        {/* Settings — always visible; disabled in view-only mode */}
        <button
          onClick={isReadOnly ? undefined : () => onTab('settings')}
          title="Settings"
          style={{
            ...iconBtn,
            cursor: isReadOnly ? 'default' : 'pointer',
            opacity: isReadOnly ? 0.45 : 1,
            pointerEvents: isReadOnly ? 'none' : 'auto',
          }}
        >
          <Settings size={18} strokeWidth={2} color="#C8CDE8" />
        </button>

        <button onClick={onLock} title="Lock" style={iconBtn}>
          <Lock size={18} strokeWidth={2} color="#C8CDE8" />
        </button>
      </div>

      {/* Manual install instructions modal */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
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
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowHelp(false)}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8,
                width: 30, height: 30, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} color="#5A5F7A" />
            </button>
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
              onClick={() => setShowHelp(false)}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px', fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
  width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'background 0.15s',
};

function headerBtn(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', borderRadius: 8,
    padding: '6px 10px', color: '#fff',
    display: 'flex', alignItems: 'center', gap: 5,
    cursor: 'pointer',
  };
}
