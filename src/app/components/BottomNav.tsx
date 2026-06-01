import React from 'react';
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
  masterOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home',   icon: <LayoutDashboard size={20} strokeWidth={2} /> },
  { id: 'ledger',    label: 'Ledger', icon: <BookOpen size={20} strokeWidth={2} /> },
  { id: 'credit',    label: 'Credit', icon: <CreditCard size={20} strokeWidth={2} /> },
  { id: 'people',    label: 'People', icon: <Users size={20} strokeWidth={2} />, masterOnly: true },
];

export function BottomNav({ activeTab, appMode, onTab, onAdd }: Props) {
  const isReadOnly = appMode === 'view';

  const visibleItems = NAV_ITEMS.filter(item => !item.masterOnly || !isReadOnly);

  /* Split into left and right halves around the center FAB */
  const half = Math.floor(visibleItems.length / 2);
  const leftItems  = visibleItems.slice(0, half);
  const rightItems = visibleItems.slice(half);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff',
      boxShadow: '0 -1px 0 rgba(0,0,0,0.07), 0 -4px 20px rgba(0,0,0,0.08)',
      borderRadius: '20px 20px 0 0',
      zIndex: 90,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        height: 64, paddingLeft: 8, paddingRight: 8, position: 'relative',
      }}>
        {/* Left items */}
        {leftItems.map(item => (
          <NavBtn
            key={item.id}
            item={item}
            active={activeTab === item.id}
            onTab={onTab}
          />
        ))}

        {/* Center FAB slot */}
        {!isReadOnly ? (
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <button
              onClick={onAdd}
              style={{
                position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3D6BDF, #6B8FFF)',
                boxShadow: '0 8px 24px rgba(61,107,223,0.5)',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(0.93)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; }}
              onTouchStart={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(0.93)'; }}
              onTouchEnd={e => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; }}
            >
              <Plus size={26} strokeWidth={2.5} color="#fff" />
            </button>
          </div>
        ) : (
          <div style={{ width: 32 }} />
        )}

        {/* Right items */}
        {rightItems.map(item => (
          <NavBtn
            key={item.id}
            item={item}
            active={activeTab === item.id}
            onTab={onTab}
          />
        ))}
      </div>
    </div>
  );
}

function NavBtn({ item, active, onTab }: { item: NavItem; active: boolean; onTab: (t: Tab) => void }) {
  return (
    <button
      onClick={() => onTab(item.id)}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        background: 'none', border: 'none', cursor: 'pointer',
        color: active ? '#3D6BDF' : '#9A9FB8',
        transition: 'color 0.18s',
        padding: '8px 4px',
      }}
    >
      {item.icon}
      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {item.label}
      </span>
    </button>
  );
}
