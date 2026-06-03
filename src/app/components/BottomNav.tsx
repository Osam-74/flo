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
  const half = Math.floor(visibleItems.length / 2);
  const leftItems  = visibleItems.slice(0, half);
  const rightItems = visibleItems.slice(half);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 -1px 0 rgba(0,119,182,0.1), 0 -4px 20px rgba(0,119,182,0.08)',
      borderRadius: '20px 20px 0 0',
      zIndex: 90,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      border: '1px solid rgba(144,224,239,0.4)',
      borderBottom: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        height: 64, paddingLeft: 8, paddingRight: 8, position: 'relative',
      }}>
        {leftItems.map(item => (
          <NavBtn key={item.id} item={item} active={activeTab === item.id} onTab={onTab} />
        ))}

        {/* FAB */}
        {!isReadOnly ? (
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <button
              onClick={onAdd}
              style={{
                position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                width: 58, height: 58, borderRadius: '50%',
                background: 'linear-gradient(135deg, #03045E 0%, #0077B6 60%, #00B4D8 100%)',
                boxShadow: '0 8px 24px rgba(0,119,182,0.55), 0 2px 8px rgba(3,4,94,0.3)',
                border: '3px solid rgba(202,240,248,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10,
                transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateX(-50%) scale(1.08)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,119,182,0.7), 0 4px 12px rgba(3,4,94,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,119,182,0.55), 0 2px 8px rgba(3,4,94,0.3)';
              }}
              onTouchStart={e => {
                e.currentTarget.style.transform = 'translateX(-50%) scale(0.92)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,119,182,0.4)';
              }}
              onTouchEnd={e => {
                e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,119,182,0.55), 0 2px 8px rgba(3,4,94,0.3)';
              }}
            >
              <Plus size={26} strokeWidth={2.5} color="#fff" />
            </button>
          </div>
        ) : (
          <div style={{ width: 32 }} />
        )}

        {rightItems.map(item => (
          <NavBtn key={item.id} item={item} active={activeTab === item.id} onTab={onTab} />
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
        color: active ? '#03045E' : '#4A5568',
        transition: 'color 0.18s',
        padding: '8px 4px',
        position: 'relative',
      }}
    >
      {item.icon}
      {active && (
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 4, borderRadius: '50%',
          background: '#0077B6',
        }} />
      )}
      <span style={{
        fontSize: '0.6rem', fontWeight: active ? 800 : 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        marginTop: active ? 6 : 0,
      }}>
        {item.label}
      </span>
    </button>
  );
}
