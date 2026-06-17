import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, CreditCard, Users, Plus } from 'lucide-react';
import type { Tab, AppMode } from '../types';

interface Props {
  activeTab: Tab;
  appMode: AppMode;
  onTab: (tab: Tab) => void;
  onAdd: () => void;
}

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home',   icon: <LayoutDashboard size={19} strokeWidth={2} /> },
  { id: 'ledger',    label: 'Ledger', icon: <BookOpen size={19} strokeWidth={2} /> },
  { id: 'credit',    label: 'Credit', icon: <CreditCard size={19} strokeWidth={2} /> },
  { id: 'people',    label: 'Team',   icon: <Users size={19} strokeWidth={2} /> },
];

export function BottomNav({ activeTab, appMode, onTab, onAdd }: Props) {
  const [pressedId, setPressedId] = useState<string | null>(null);

  return (
    <div style={{
      position: 'fixed',
      bottom: 18,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 90,
      // floating capsule
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 999,
      boxShadow: '0 8px 32px rgba(26,47,168,0.18), 0 2px 8px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
      border: '1px solid rgba(61,107,223,0.13)',
      padding: '0 6px',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      height: 60,
    }}>
      {NAV_ITEMS.map((item, idx) => {
        const isActive = activeTab === item.id;
        const isPressed = pressedId === item.id;

        // Insert FAB between ledger (idx=1) and credit (idx=2)
        const fab = idx === 2 ? (
          <button
            key="fab"
            onClick={onAdd}
            style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1A2FA8 0%, #3D6BDF 100%)',
              boxShadow: '0 4px 16px rgba(26,47,168,0.45)',
              border: '2.5px solid rgba(255,255,255,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              marginLeft: 4, marginRight: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.boxShadow = '0 6px 22px rgba(26,79,168,0.55)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,47,168,0.45)';
            }}
            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
            onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Plus size={22} strokeWidth={2.8} color="#fff" />
          </button>
        ) : null;

        return (
          <React.Fragment key={item.id}>
            {fab}
            <button
              onClick={() => onTab(item.id)}
              onPointerDown={() => setPressedId(item.id)}
              onPointerUp={() => setPressedId(null)}
              onPointerLeave={() => setPressedId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isActive ? 6 : 0,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(61,107,223,0.13) 0%, rgba(90,132,255,0.10) 100%)'
                  : isPressed ? 'rgba(61,107,223,0.06)' : 'transparent',
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
                padding: isActive ? '8px 14px 8px 12px' : '8px 12px',
                transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                transform: isPressed ? 'scale(0.92)' : 'scale(1)',
                flexShrink: 0,
                minWidth: isActive ? 'auto' : 42,
                height: 44,
                color: isActive ? '#1A2FA8' : '#7A8FC4',
                position: 'relative',
              }}
            >
              {/* Active indicator: subtle glow ring around icon */}
              {isActive && (
                <span style={{
                  position: 'absolute',
                  left: isActive ? 10 : '50%',
                  transform: isActive ? 'none' : 'translateX(-50%)',
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: 'rgba(61,107,223,0.14)',
                  transition: 'all 0.22s ease',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}/>
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              {/* Label expands next to icon only when active */}
              {isActive && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: '#1A2FA8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: 60,
                  opacity: 1,
                  transition: 'max-width 0.25s ease, opacity 0.2s ease',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  position: 'relative', zIndex: 1,
                }}>
                  {item.label}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
