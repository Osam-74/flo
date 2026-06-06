import React from 'react';
import { Lock, Printer, Settings, Download } from 'lucide-react';
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

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#0D1120',
      padding: '0 16px',
      height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
        Flow<span style={{ color: '#00B4D8' }}>HQ</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {installReady && (
          <button onClick={onInstall} style={headerBtn('#00A8A0')}>
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
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
  width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

function headerBtn(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', borderRadius: 8,
    padding: '6px 10px', color: '#fff',
    display: 'flex', alignItems: 'center', gap: 5,
    cursor: 'pointer',
  };
}
