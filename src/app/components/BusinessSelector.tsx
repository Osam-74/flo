import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Trash2, LogIn, ShieldCheck, X } from 'lucide-react';
import { sha256 } from '../utils';

/* ─────────────────────────────────────────────────────────────
   MASTER ADMIN CONFIG
   Master PIN: 001212
   Hash of '001212' — global super-admin, never stored in DB.
───────────────────────────────────────────────────────────── */
export const MASTER_ADMIN_HASH = '8d146af9e9ac06938e5292116f80ececf77541427baf0b9fd7b2483d23fe6577';

/* Legacy export kept for any residual import */
export const BUSINESSES: any[] = [];

export interface BizRecord {
  id: string;
  name: string;
  masterHash: string;
  viewHash?: string;
  fsDoc: string;
  hasViewAccess?: boolean;
  createdAt?: number;
}

interface Props {
  onSelectBusiness: (biz: BizRecord) => void;
  onMasterAdmin: () => void;
  businesses: BizRecord[];
  onCreateBusiness: (name: string, masterPin: string, viewPin?: string) => Promise<void>;
  onDeleteBusiness: (id: string) => Promise<void>;
  isMasterAdmin: boolean;
}

/* ── Secret tap: tap logo 5× within 3s → admin login modal ── */
function useSecretTap(onTriggered: () => void) {
  const [taps, setTaps] = useState<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    setTaps(prev => {
      const recent = [...prev, now].filter(t => now - t < 3000);
      if (recent.length >= 5) { onTriggered(); return []; }
      return recent;
    });
  }, [onTriggered]);
}

export function BusinessSelector({
  onSelectBusiness,
  onMasterAdmin,
  businesses,
  onCreateBusiness,
  onDeleteBusiness,
  isMasterAdmin,
}: Props) {
  const [selected, setSelected] = useState<string>(businesses[0]?.id ?? '');

  // Admin PIN overlay
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPin, setAdminPin]   = useState('');
  const [adminErr, setAdminErr]   = useState('');
  const [checking, setChecking]   = useState(false);

  // Create business form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newMPin, setNewMPin]       = useState('');
  const [newVPin, setNewVPin]       = useState('');
  const [creating, setCreating]     = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (businesses.length > 0 && !selected) setSelected(businesses[0].id);
  }, [businesses, selected]);

  const secretTap = useSecretTap(() => setShowAdmin(true));

  const handleAdminLogin = async () => {
    setChecking(true);
    const h = await sha256(adminPin);
    setChecking(false);
    if (h === MASTER_ADMIN_HASH) {
      setAdminErr('');
      setAdminPin('');
      setShowAdmin(false);
      onMasterAdmin();
    } else {
      setAdminErr('Incorrect master PIN');
      setAdminPin('');
    }
  };

  const handleContinue = () => {
    const biz = businesses.find(b => b.id === selected);
    if (biz) onSelectBusiness(biz);
  };

  const handleCreate = async () => {
    if (!newName.trim() || newMPin.length < 4) return;
    setCreating(true);
    await onCreateBusiness(newName.trim(), newMPin, newVPin || undefined);
    setCreating(false);
    setShowCreate(false);
    setNewName(''); setNewMPin(''); setNewVPin('');
  };

  /* ─── Styles ──────────────────────────────────────── */
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000, padding: 16,
  };
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 340,
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
  };
  const inputStyle = (hasErr = false): React.CSSProperties => ({
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1.5px solid ${hasErr ? '#E83E5C' : 'rgba(61,107,223,0.2)'}`,
    fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  });
  const primaryBtn: React.CSSProperties = {
    width: '100%', padding: '13px', borderRadius: 12, marginTop: 4,
    background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#F0F2F7',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 28, zIndex: 9999, userSelect: 'none',
      overflowY: 'auto',
    }}>
      {/* Logo — secret tap zone */}
      <div
        onClick={secretTap}
        style={{
          width: 76, height: 76, borderRadius: 24,
          background: 'linear-gradient(145deg, #2A4FCF, #6B8FFF)',
          boxShadow: '0 8px 32px rgba(61,107,223,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.2rem', marginBottom: 20, cursor: 'pointer',
        }}
      >💰</div>

      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        Cash<span style={{ color: '#3D6BDF' }}>book</span>
      </div>
      <div style={{ fontSize: '0.68rem', color: '#9A9FB8', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 36 }}>
        Farm Expense Tracker
      </div>

      {/* ══ MASTER ADMIN VIEW ═══════════════════════════════ */}
      {isMasterAdmin ? (
        <div style={{ width: '100%', maxWidth: 340 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ShieldCheck size={17} color="#3D6BDF" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1A2FA8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Master Admin
              </span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '7px 14px',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Plus size={13} /> New Business
            </button>
          </div>

          {/* Business list */}
          <div style={{
            background: '#fff', borderRadius: 18, overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,0.07)', marginBottom: 16,
          }}>
            {businesses.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#9A9FB8', fontSize: '0.82rem' }}>
                No businesses yet — tap <strong>New Business</strong> to create one
              </div>
            ) : businesses.map((biz, i) => (
              <div key={biz.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: i < businesses.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A1D2E' }}>{biz.name}</div>
                  {biz.hasViewAccess && (
                    <div style={{ fontSize: '0.62rem', color: '#9A9FB8', marginTop: 1 }}>+ view-only access</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button
                    onClick={() => onSelectBusiness(biz)}
                    style={{
                      background: 'linear-gradient(135deg, #3D6BDF, #6B8FFF)', color: '#fff',
                      border: 'none', borderRadius: 8, padding: '6px 12px',
                      fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <LogIn size={12} /> Open
                  </button>
                  <button
                    onClick={() => setDeleteId(biz.id)}
                    style={{
                      background: 'rgba(232,62,92,0.1)', color: '#E83E5C',
                      border: 'none', borderRadius: 8, padding: '6px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ══ NORMAL BUSINESS SELECTOR ═══════════════════════ */
        <div style={{ width: '100%', maxWidth: 300, marginBottom: 16 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8, textAlign: 'center' }}>
            Select Business
          </div>
          {businesses.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9A9FB8', fontSize: '0.82rem', padding: '20px 0' }}>
              No businesses registered yet
            </div>
          ) : (
            <>
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
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={18} color="#3D6BDF" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              <button onClick={handleContinue} style={{
                width: '100%', padding: '15px', borderRadius: 16, marginTop: 14,
                background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.04em',
                boxShadow: '0 4px 16px rgba(61,107,223,0.35)',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>Continue →</button>
            </>
          )}
        </div>
      )}

      {/* ══ ADMIN PIN OVERLAY ════════════════════════════════ */}
      {showAdmin && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} color="#3D6BDF" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Master Admin</span>
              </div>
              <button onClick={() => { setShowAdmin(false); setAdminPin(''); setAdminErr(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}>
                <X size={18} />
              </button>
            </div>
            <input
              type="password" placeholder="Enter master PIN"
              value={adminPin} onChange={e => setAdminPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              style={{
                ...inputStyle(!!adminErr),
                fontSize: '1.1rem', fontFamily: 'monospace', letterSpacing: '0.2em',
                marginBottom: 8,
              }}
              autoFocus
            />
            {adminErr && (
              <div style={{ color: '#E83E5C', fontSize: '0.75rem', marginBottom: 8, fontWeight: 700 }}>{adminErr}</div>
            )}
            <button onClick={handleAdminLogin} disabled={checking} style={primaryBtn}>
              {checking ? 'Checking…' : 'Enter'}
            </button>
          </div>
        </div>
      )}

      {/* ══ CREATE BUSINESS OVERLAY ══════════════════════════ */}
      {showCreate && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Create Business</span>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}>
                <X size={18} />
              </button>
            </div>
            {([
              { label: 'Business Name', val: newName, set: setNewName, ph: 'e.g. Nsawam Farm', type: 'text' },
              { label: 'Access PIN (min 4 digits)', val: newMPin, set: setNewMPin, ph: '4–8 digit PIN', type: 'password' },
              { label: 'View-Only PIN (optional)', val: newVPin, set: setNewVPin, ph: 'Leave blank to disable', type: 'password' },
            ] as const).map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 5 }}>
                  {f.label}
                </div>
                <input
                  type={f.type} placeholder={f.ph} value={f.val}
                  onChange={e => (f.set as any)(e.target.value)}
                  style={{
                    ...inputStyle(),
                    fontFamily: f.type === 'password' ? 'monospace' : 'Plus Jakarta Sans, sans-serif',
                    letterSpacing: f.type === 'password' ? '0.15em' : 'normal',
                  }}
                />
              </div>
            ))}
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || newMPin.length < 4}
              style={{
                ...primaryBtn,
                background: (!newName.trim() || newMPin.length < 4) ? '#D4D8E8' : 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
                cursor: (!newName.trim() || newMPin.length < 4) ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Creating…' : 'Create Business'}
            </button>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM OVERLAY ═══════════════════════════ */}
      {deleteId && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 300, textAlign: 'center' }}>
            <Trash2 size={32} color="#E83E5C" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1D2E', marginBottom: 8 }}>Delete Business?</div>
            <div style={{ fontSize: '0.8rem', color: '#5A5F7A', marginBottom: 20, lineHeight: 1.6 }}>
              This will remove <strong>{businesses.find(b => b.id === deleteId)?.name}</strong> and all its data permanently.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{ padding: '12px', borderRadius: 12, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A' }}
              >Cancel</button>
              <button
                onClick={async () => { await onDeleteBusiness(deleteId!); setDeleteId(null); }}
                style={{ padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fff' }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
