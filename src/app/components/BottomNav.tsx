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

// "fab" is a synthetic active-tab ID we use when the + button is pressed
// so all nav items collapse while the add sheet is open
type ActiveId = Tab | 'fab';

interface NavProps extends Props {
  fabActive?: boolean;
}

export function BottomNav({ activeTab, appMode, onTab, onAdd, fabActive }: NavProps & { fabActive?: boolean }) {
  const [pressedId, setPressedId] = useState<string | null>(null);

  // The "effective" active: if fab is active, no nav item is expanded
  const effectiveActive: ActiveId = fabActive ? 'fab' : activeTab;

  return (
    <div style={{
      position: 'fixed',
      bottom: 18,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 90,
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
        const isActive = effectiveActive === item.id;
        const isPressed = pressedId === item.id;

        // Insert FAB between ledger (idx=1) and credit (idx=2)
        const fab = idx === 2 ? (
          <button
            key="fab"
            onClick={onAdd}
            style={{
              width: 46, height: 46, borderRadius: '50%',
              background: fabActive
                ? 'linear-gradient(135deg, #0F1F80 0%, #2A50C0 100%)'
                : 'linear-gradient(135deg, #1A2FA8 0%, #3D6BDF 100%)',
              boxShadow: fabActive
                ? '0 4px 20px rgba(26,47,168,0.6), 0 0 0 3px rgba(61,107,223,0.25)'
                : '0 4px 16px rgba(26,47,168,0.45)',
              border: '2.5px solid rgba(255,255,255,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              marginLeft: 4, marginRight: 4,
              transform: fabActive ? 'scale(1.05) rotate(45deg)' : 'scale(1) rotate(0deg)',
            }}
            onMouseEnter={e => {
              if (!fabActive) {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(26,79,168,0.55)';
              }
            }}
            onMouseLeave={e => {
              if (!fabActive) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,47,168,0.45)';
              }
            }}
            onTouchStart={e => { if (!fabActive) e.currentTarget.style.transform = 'scale(0.92)'; }}
            onTouchEnd={e => { if (!fabActive) e.currentTarget.style.transform = 'scale(1)'; }}
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
                // Gap between icon and label: only when active
                gap: isActive ? 7 : 0,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(61,107,223,0.13) 0%, rgba(90,132,255,0.10) 100%)'
                  : isPressed ? 'rgba(61,107,223,0.06)' : 'transparent',
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
                // More padding on right when active to give label breathing room
                padding: isActive ? '0 16px 0 10px' : '0 12px',
                transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                transform: isPressed ? 'scale(0.92)' : 'scale(1)',
                flexShrink: 0,
                height: 44,
                color: isActive ? '#1A2FA8' : '#7A8FC4',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Active ring — perfectly centered over icon */}
              {isActive && (
                <span style={{
                  position: 'absolute',
                  // Icon is 19px wide, ring is 32px — offset = (32-19)/2 = 6.5 → left padding is 10px, so ring left = 10 - 6.5 = 3.5 → use 4
                  left: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(61,107,223,0.14)',
                  zIndex: 0,
                  pointerEvents: 'none',
                  flexShrink: 0,
                }}/>
              )}

              {/* Icon */}
              <span style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: 26,   // fixed slot so ring always sits behind it consistently
                height: 26,
              }}>
                {item.icon}
              </span>

              {/* Label — slides in when active */}
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: '#1A2FA8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                maxWidth: isActive ? 56 : 0,
                opacity: isActive ? 1 : 0,
                transition: 'max-width 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                position: 'relative',
                zIndex: 1,
                display: 'block',
              }}>
                {item.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
