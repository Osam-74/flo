import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// ── Business registry ────────────────────────────────────────────────────────
// Each business has: id, display name, and a sha256 hash of its PIN.
// To add a new business, add an entry here with the hashed PIN.
// Default hashes below match the original master/view PINs.
export const BUSINESSES: { id: string; name: string; masterHash: string; viewHash: string; fsDoc: string }[] = [
  {
    id: 'farm1',
    name: 'Poultry Farm',
    masterHash: '84b2a5d834daee2fff7eb5e31f44ba68eb860d86d2cf8e37606a26fa775cf23b',
    viewHash:   '2926a2731f4b312c08982cacf8061eb14bf65c1a87cc5d70e864e079c6220731',
    fsDoc: 'cashbook/main',
  },
  // Add more businesses below when needed:
  // {
  //   id: 'farm2',
  //   name: 'Second Farm',
  //   masterHash: '<sha256 of new master PIN>',
  //   viewHash:   '<sha256 of new view PIN>',
  //   fsDoc: 'cashbook/farm2',
  // },
];

interface Props {
  onSelect: (businessId: string) => void;
}

export function BusinessSelector({ onSelect }: Props) {
  const [selected, setSelected] = useState(BUSINESSES[0].id);
  const [showAdmin, setShowAdmin] = useState(false);

  const handleContinue = () => {
    onSelect(selected);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#F0F2F7',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 28, zIndex: 9999, userSelect: 'none',
    }}>
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
      <div style={{ fontSize: '0.68rem', color: '#9A9FB8', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 40 }}>
        Farm Expense Tracker
      </div>

      {/* Business picker */}
      <div style={{ width: '100%', maxWidth: 300, marginBottom: 16 }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8, textAlign: 'center' }}>
          Select Business
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{
              width: '100%', padding: '14px 44px 14px 18px',
              background: '#ffffff', border: '1.5px solid rgba(61,107,223,0.25)',
              borderRadius: 16, fontSize: '0.95rem', fontWeight: 700, color: '#1A2FA8',
              appearance: 'none', cursor: 'pointer', outline: 'none',
              boxShadow: '0 2px 8px rgba(61,107,223,0.08)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            {BUSINESSES.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <ChevronDown size={18} color="#3D6BDF" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        style={{
          width: '100%', maxWidth: 300, padding: '15px',
          borderRadius: 16, background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.04em',
          boxShadow: '0 4px 16px rgba(61,107,223,0.35)',
          marginBottom: 32,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        Continue →
      </button>

      {/* Register new business */}
      <button
        onClick={() => setShowAdmin(v => !v)}
        style={{
          background: 'none', border: '1px solid rgba(61,107,223,0.2)',
          borderRadius: 12, padding: '10px 20px',
          fontSize: '0.72rem', fontWeight: 700, color: '#3D6BDF',
          cursor: 'pointer', letterSpacing: '0.04em',
        }}
      >
        Register New Business
      </button>

      {/* Admin prompt */}
      {showAdmin && (
        <div style={{
          marginTop: 16, background: '#ffffff', border: '1px solid rgba(61,107,223,0.18)',
          borderRadius: 14, padding: '14px 18px', maxWidth: 300, width: '100%',
          textAlign: 'center', boxShadow: '0 2px 12px rgba(61,107,223,0.1)',
        }}>
          <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>📞</div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1A2FA8', marginBottom: 4 }}>
            Contact Admin to Register
          </div>
          <div style={{ fontSize: '0.72rem', color: '#5A5F7A', lineHeight: 1.6 }}>
            To add a new business profile, please contact the administrator. They will set up your business and provide your access PIN.
          </div>
        </div>
      )}
    </div>
  );
}
