import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, Plus, Trash2, LogIn, ShieldCheck, X, Delete,
  Lock, Building2, Clock, KeyRound, CloudDownload, CloudUpload,
  Settings2, RefreshCw, Pencil, Check, Users
} from 'lucide-react';
import { sha256 } from '../utils';
import type { ViewUser, Person } from '../types';

const FALLBACK_ADMIN_HASH = '8d146af9e9ac06938e5292116f80ececf77541427baf0b9fd7b2483d23fe6577';
const ADMIN_HASH_KEY = 'cb_admin_hash';

/** Get the current admin hash — checks localStorage first, falls back to the hardcoded constant. */
function getAdminHash(): string {
  try {
    const stored = localStorage.getItem(ADMIN_HASH_KEY);
    if (stored && stored.length === 64) return stored;
  } catch {}
  return FALLBACK_ADMIN_HASH;
}

export interface BizRecord {
  id: string;
  name: string;
  masterHash: string;
  viewHash?: string;
  viewUsers?: ViewUser[];
  fsDoc: string;
  hasViewAccess?: boolean;
  createdAt?: number;
}

interface Props {
  onSelectBusiness: (biz: BizRecord) => void;
  onMasterAdmin: () => void;
  onLogoutMasterAdmin?: () => void;
  businesses: BizRecord[];
  onCreateBusiness: (name: string, masterPin: string, viewPin?: string) => Promise<void>;
  onDeleteBusiness: (id: string) => Promise<void>;
  onResetPin: (bizId: string, newMasterPin: string, newViewPin?: string) => Promise<void>;
  onRenameBusiness?: (bizId: string, newName: string) => Promise<void>;
  onExport?: (bizId: string) => void;
  onImport?: (bizId: string, file: File) => void;
  onClearData?: (bizId: string) => void;
  onPull?: (bizId: string) => void;
  onPush?: (bizId: string) => void;
  onFetchPeople?: (bizId: string) => Promise<Person[]>;
  onSaveViewUsers?: (bizId: string, viewUsers: ViewUser[]) => Promise<void>;
  isMasterAdmin: boolean;
  authRef?: React.MutableRefObject<any>;
  authInst?: React.MutableRefObject<any>;
}

/* ── Secret tap ── */
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

/* ── Mini keypad ── */
function PinKeypad({ value, onChange, maxLen = 6, label }: { value: string; onChange: (v: string) => void; maxLen?: number; label?: string }) {
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];
  const press = (k: string) => {
    if (k === 'del') { onChange(value.slice(0, -1)); return; }
    if (value.length >= maxLen) return;
    onChange(value + k);
  };
  return (
    <div>
      {label && <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8, textAlign: 'center' }}>{label}</div>}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
        {Array.from({ length: Math.max(4, value.length) }).map((_, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < value.length ? '#3D6BDF' : '#D4D8E8', boxShadow: i < value.length ? '0 0 0 3px rgba(61,107,223,0.18)' : 'none', transition: 'all 0.15s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {KEYS.map((k, i) => {
          if (!k) return <div key={i} />;
          if (k === 'del') return (
            <button key="del" onClick={() => press('del')} style={{ height: 52, borderRadius: 14, background: '#F5F7FF', border: '1px solid rgba(61,107,223,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Delete size={18} color="#5A5F7A" />
            </button>
          );
          return (
            <button key={k} onClick={() => press(k)} style={{ height: 52, borderRadius: 14, background: '#FFFFFF', border: '1px solid rgba(61,107,223,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', fontSize: '1.3rem', fontWeight: 700, color: '#1A1D2E', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Create Business Wizard ── */
function CreateBusinessWizard({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string, masterPin: string, viewPin?: string) => Promise<void> }) {
  const [step, setStep] = useState<'name'|'masterPin'|'viewPin'>('name');
  const [name, setName] = useState('');
  const [masterPin, setMasterPin] = useState('');
  const [viewPin, setViewPin] = useState('');
  const [skipView, setSkipView] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async () => {
    if (creating) return;
    setCreating(true); setError('');
    try {
      await onSubmit(name.trim(), masterPin, skipView ? undefined : (viewPin || undefined));
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to create. Please try again.');
      setCreating(false);
    }
  };

  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 22, padding: '24px 20px', width: '100%', maxWidth: 320, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'Plus Jakarta Sans, sans-serif' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="#3D6BDF" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>
              {step === 'name' ? 'New Business' : step === 'masterPin' ? 'Set Access PIN' : 'View-Only PIN'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 22 }}>
          {['name','masterPin','viewPin'].map((s) => (
            <div key={s} style={{ width: step === s ? 20 : 7, height: 7, borderRadius: 4, background: step === s ? '#3D6BDF' : ((s === 'name' && step !== 'name') || (s === 'masterPin' && step === 'viewPin')) ? '#A8C4FF' : '#E0E4F0', transition: 'all 0.2s' }} />
          ))}
        </div>
        {step === 'name' && (
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8 }}>Business Name</div>
            <input type="text" placeholder="e.g. Nsawam Farm" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('masterPin')} autoFocus style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1.5px solid rgba(61,107,223,0.22)', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#1A1D2E' }} />
            <button onClick={() => name.trim() && setStep('masterPin')} disabled={!name.trim()} style={{ width: '100%', padding: '13px', borderRadius: 12, marginTop: 16, background: name.trim() ? 'linear-gradient(135deg, #1A2FA8, #3D6BDF)' : '#D4D8E8', color: '#fff', border: 'none', cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 800 }}>Continue →</button>
          </div>
        )}
        {step === 'masterPin' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#5A5F7A', textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>Set the <strong>master access PIN</strong> for <em>{name}</em></div>
            <PinKeypad value={masterPin} onChange={setMasterPin} label="Enter PIN (min 4 digits)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setStep('name'); setMasterPin(''); }} style={{ padding: '12px', borderRadius: 12, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A', fontSize: '0.8rem' }}>← Back</button>
              <button onClick={() => masterPin.length >= 4 && setStep('viewPin')} disabled={masterPin.length < 4} style={{ padding: '12px', borderRadius: 12, background: masterPin.length >= 4 ? 'linear-gradient(135deg, #1A2FA8, #3D6BDF)' : '#D4D8E8', color: '#fff', border: 'none', cursor: masterPin.length >= 4 ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.8rem' }}>Next →</button>
            </div>
          </div>
        )}
        {step === 'viewPin' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#5A5F7A', textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>Optional: set a <strong>view-only PIN</strong></div>
            {!skipView ? (
              <>
                <PinKeypad value={viewPin} onChange={setViewPin} label="View-Only PIN (optional)" />
                <button onClick={() => setSkipView(true)} style={{ width: '100%', padding: '8px', marginTop: 10, background: 'none', border: '1.5px dashed rgba(61,107,223,0.2)', borderRadius: 10, cursor: 'pointer', fontSize: '0.72rem', color: '#9A9FB8', fontWeight: 600 }}>Skip — no view-only access</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#9A9FB8', fontSize: '0.8rem' }}>
                No view-only PIN — skipped<br />
                <button onClick={() => setSkipView(false)} style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#3D6BDF', fontWeight: 700, fontSize: '0.75rem' }}>Set one instead</button>
              </div>
            )}
            {error && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button onClick={() => { setStep('masterPin'); setViewPin(''); setSkipView(false); }} style={{ padding: '12px', borderRadius: 12, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A', fontSize: '0.8rem' }}>← Back</button>
              <button onClick={handleFinish} disabled={creating || (!skipView && viewPin.length > 0 && viewPin.length < 4)} style={{ padding: '12px', borderRadius: 12, background: creating ? '#D4D8E8' : 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff', border: 'none', cursor: creating ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.8rem' }}>{creating ? 'Creating…' : '✓ Create'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Team Member PIN Setup Modal ── */
function TeamMemberPinsModal({
  biz, onClose, onFetchPeople, onSaveViewUsers,
}: {
  biz: BizRecord;
  onClose: () => void;
  onFetchPeople?: (bizId: string) => Promise<Person[]>;
  onSaveViewUsers?: (bizId: string, viewUsers: ViewUser[]) => Promise<void>;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewUsers, setViewUsers] = useState<ViewUser[]>(biz.viewUsers ?? []);
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [pinEntry, setPinEntry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!onFetchPeople) { setLoading(false); return; }
    onFetchPeople(biz.id).then(p => { setPeople(p); setLoading(false); }).catch(() => setLoading(false));
  }, [biz.id]); // eslint-disable-line

  const handleAssign = async () => {
    if (!selectedPerson || pinEntry.length < 4) return;
    const person = people.find(p => p.id === selectedPerson);
    if (!person) return;
    setSaving(true);
    try {
      const pinHash = await sha256(pinEntry);
      const updated = viewUsers.filter(vu => vu.personId !== person.id);
      updated.push({ personId: person.id, personName: person.name, pinHash });
      setViewUsers(updated);
      setSelectedPerson(''); setPinEntry('');
    } catch { setError('Failed to hash PIN'); }
    setSaving(false);
  };

  const handleRemove = (personId: string) => {
    setViewUsers(prev => prev.filter(vu => vu.personId !== personId));
  };

  const handleSave = async () => {
    if (!onSaveViewUsers) return;
    setSaving(true);
    try { await onSaveViewUsers(biz.id, viewUsers); onClose(); }
    catch { setError('Failed to save'); setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '24px 20px', width: '100%', maxWidth: 340, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#3D6BDF" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Team Member Access</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9A9FB8', marginBottom: 18 }}>{biz.name} — assign PINs so team members can view their own transactions</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#9A9FB8', fontSize: '0.82rem' }}>Loading team members…</div>
        ) : people.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#9A9FB8', fontSize: '0.82rem', lineHeight: 1.6 }}>No team members found for this business.<br />Add people first, then assign their PINs here.</div>
        ) : (
          <>
            {viewUsers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8 }}>Active Access</div>
                {viewUsers.map(vu => (
                  <div key={vu.personId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(61,107,223,0.06)', borderRadius: 10, marginBottom: 6, border: '1px solid rgba(61,107,223,0.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(61,107,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#3D6BDF' }}>{vu.personName.slice(0,2).toUpperCase()}</div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A1D2E' }}>{vu.personName}</span>
                    </div>
                    <button onClick={() => handleRemove(vu.personId)} style={{ background: 'rgba(232,62,92,0.1)', color: '#E83E5C', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><X size={12} /> Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: '#F5F7FF', borderRadius: 14, padding: '14px', border: '1px solid rgba(61,107,223,0.1)' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8 }}>Assign New PIN</div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} style={{ width: '100%', padding: '11px 36px 11px 14px', background: '#fff', border: '1.5px solid rgba(61,107,223,0.2)', borderRadius: 12, fontSize: '0.85rem', fontWeight: 600, color: '#1A1D2E', appearance: 'none', cursor: 'pointer', outline: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  <option value="">— Select team member —</option>
                  {people.filter(p => !viewUsers.some(vu => vu.personId === p.id)).map(p => (<option key={p.id} value={p.id}>{p.name} ({p.role})</option>))}
                </select>
                <ChevronDown size={16} color="#3D6BDF" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              <PinKeypad value={pinEntry} onChange={setPinEntry} label="PIN (min 4 digits)" maxLen={6} />
              <button onClick={handleAssign} disabled={!selectedPerson || pinEntry.length < 4 || saving} style={{ width: '100%', padding: '11px', borderRadius: 12, marginTop: 12, background: selectedPerson && pinEntry.length >= 4 ? 'linear-gradient(135deg, #1A2FA8, #3D6BDF)' : '#D4D8E8', color: '#fff', border: 'none', cursor: selectedPerson && pinEntry.length >= 4 ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 800 }}>+ Assign PIN</button>
            </div>
            {error && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{error}</div>}
            <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '13px', borderRadius: 12, marginTop: 16, background: saving ? '#D4D8E8' : 'linear-gradient(135deg, #E8A000, #F5C800)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>{saving ? 'Saving…' : '✓ Save Team Access'}</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Reset PIN Modal ── */
function ResetPinModal({ biz, onClose, onSubmit }: { biz: BizRecord; onClose: () => void; onSubmit: (bizId: string, masterPin: string, viewPin?: string) => Promise<void> }) {
  const [step, setStep] = useState<'masterPin'|'viewPin'>('masterPin');
  const [masterPin, setMasterPin] = useState('');
  const [viewPin, setViewPin] = useState('');
  const [skipView, setSkipView] = useState(!biz.hasViewAccess);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onSubmit(biz.id, masterPin, skipView ? undefined : (viewPin || undefined));
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to reset PIN.');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '24px 20px', width: '100%', maxWidth: 320, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={18} color="#3D6BDF" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Reset PIN</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9A9FB8', marginBottom: 18 }}>
          {biz.name}
        </div>

        {step === 'masterPin' && (
          <div>
            <PinKeypad value={masterPin} onChange={setMasterPin} label="New Master PIN (min 4 digits)" />
            <button onClick={() => masterPin.length >= 4 && setStep('viewPin')} disabled={masterPin.length < 4} style={{ width: '100%', padding: '13px', borderRadius: 12, marginTop: 16, background: masterPin.length >= 4 ? 'linear-gradient(135deg, #1A2FA8, #3D6BDF)' : '#D4D8E8', color: '#fff', border: 'none', cursor: masterPin.length >= 4 ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.85rem' }}>
              Next →
            </button>
          </div>
        )}

        {step === 'viewPin' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#5A5F7A', textAlign: 'center', marginBottom: 14 }}>
              Update the <strong>view-only PIN</strong> (optional)
            </div>
            {!skipView ? (
              <>
                <PinKeypad value={viewPin} onChange={setViewPin} label="New View-Only PIN" />
                <button onClick={() => setSkipView(true)} style={{ width: '100%', padding: '8px', marginTop: 10, background: 'none', border: '1.5px dashed rgba(61,107,223,0.2)', borderRadius: 10, cursor: 'pointer', fontSize: '0.72rem', color: '#9A9FB8', fontWeight: 600 }}>Remove view-only access</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#9A9FB8', fontSize: '0.8rem' }}>
                View-only access will be removed<br />
                <button onClick={() => setSkipView(false)} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#3D6BDF', fontWeight: 700, fontSize: '0.75rem' }}>Set a view PIN instead</button>
              </div>
            )}
            {error && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button onClick={() => { setStep('masterPin'); setViewPin(''); }} style={{ padding: '12px', borderRadius: 12, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A', fontSize: '0.8rem' }}>← Back</button>
              <button onClick={handleFinish} disabled={saving || (!skipView && viewPin.length > 0 && viewPin.length < 4)} style={{ padding: '12px', borderRadius: 12, background: saving ? '#D4D8E8' : 'linear-gradient(135deg, #E8A000, #F5C800)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.8rem' }}>{saving ? 'Saving…' : '✓ Reset PIN'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Master Data Backup Panel (master admin only) ── */
function MasterDataBackup({
  businesses,
  onExport,
  onImport,
  onClearData,
}: {
  businesses: BizRecord[];
  onExport?: (bizId: string) => void;
  onImport?: (bizId: string, file: File) => void;
  onClearData?: (bizId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState('');
  const [confirmClear, setConfirmClear] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const biz = businesses.find(b => b.id === selectedId) ?? null;

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{ background: '#fff', borderRadius: 14, padding: '13px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 10px rgba(61,107,223,0.08)', border: '1px solid rgba(61,107,223,0.12)', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #B45309, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CloudDownload size={15} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1A1D2E' }}>Data Backup & Restore</div>
            <div style={{ fontSize: '0.62rem', color: '#9A9FB8', marginTop: 1 }}>Export, import or clear a business</div>
          </div>
        </div>
        <ChevronDown size={16} color="#9A9FB8" />
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px', marginBottom: 14, boxShadow: '0 2px 10px rgba(61,107,223,0.08)', border: '1px solid rgba(61,107,223,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #B45309, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloudDownload size={14} color="#fff" />
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1A1D2E' }}>Data Backup & Restore</span>
        </div>
        <button onClick={() => { setExpanded(false); setSelectedId(''); setConfirmClear(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 6 }}>Select Business</div>
      <select
        value={selectedId}
        onChange={e => { setSelectedId(e.target.value); setConfirmClear(false); }}
        style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid rgba(61,107,223,0.2)', fontSize: '0.85rem', fontWeight: 600, color: '#1A1D2E', background: '#F8F9FF', outline: 'none', marginBottom: 14, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer' }}
      >
        <option value="">— Choose a business —</option>
        {businesses.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {!biz ? (
        <div style={{ fontSize: '0.75rem', color: '#C0C5D8', textAlign: 'center', padding: '8px 0' }}>Select a business above to manage its data</div>
      ) : (
        <>
          <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8 }}>Backup / Restore</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <button onClick={() => onExport && onExport(biz.id)} style={{ ...backupBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <CloudDownload size={13} /> Export
            </button>
            <label style={{ width: '100%' }}>
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f && onImport) { onImport(biz.id, f); if (fileRef.current) fileRef.current.value = ''; } }}
              />
              <button style={{ ...backupBtn, width: '100%', background: 'linear-gradient(135deg, #2a4a9a, #3d6bdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={() => fileRef.current?.click()}>
                <CloudUpload size={13} /> Restore
              </button>
            </label>
          </div>
          <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8 }}>Danger Zone</div>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} style={{ ...backupBtn, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Trash2 size={13} /> Clear All Data for {biz.name}
            </button>
          ) : (
            <div style={{ background: 'rgba(232,62,92,0.08)', borderRadius: 13, padding: '13px', border: '1px solid rgba(232,62,92,0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: '#C0203A', fontWeight: 700, marginBottom: 12, textAlign: 'center', lineHeight: 1.5 }}>
                ⚠️ Permanently delete ALL data for <strong>{biz.name}</strong>?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => setConfirmClear(false)} style={{ padding: '11px', borderRadius: 11, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A', fontSize: '0.78rem' }}>Cancel</button>
                <button onClick={() => { onClearData && onClearData(biz.id); setConfirmClear(false); setSelectedId(''); }} style={{ padding: '11px', borderRadius: 11, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', border: 'none', cursor: 'pointer', fontWeight: 800, color: '#fff', fontSize: '0.78rem' }}>Yes, Clear</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const backupBtn: React.CSSProperties = {
  width: '100%', padding: '11px', borderRadius: 11, fontSize: '0.72rem', fontWeight: 700,
  letterSpacing: '0.04em', background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)',
  color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 3px 12px rgba(61,107,223,0.22)',
};

/* ── Business Settings Modal (master access) ── */
function BizSettingsModal({
  biz, onClose, onExport, onImport, onClearData, onPull, onPush
}: {
  biz: BizRecord;
  onClose: () => void;
  onExport?: (bizId: string) => void;
  onImport?: (bizId: string, file: File) => void;
  onClearData?: (bizId: string) => void;
  onPull?: (bizId: string) => void;
  onPush?: (bizId: string) => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '24px 20px', width: '100%', maxWidth: 340, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings2 size={18} color="#3D6BDF" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Business Settings</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9A9FB8', marginBottom: 20 }}>{biz.name}</div>

        {/* Cloud Sync */}
        <div style={sectionLabel}>Cloud Sync</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <button onClick={() => { onPull && onPull(biz.id); onClose(); }} style={{ ...actionBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <CloudDownload size={14} /> Pull Cloud
          </button>
          <button onClick={() => { onPush && onPush(biz.id); onClose(); }} style={{ ...actionBtn, background: 'linear-gradient(135deg, #2a4a9a, #3d6bdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <CloudUpload size={14} /> Push Local
          </button>
        </div>


      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#9A9FB8', marginBottom: 10,
};
const actionBtn: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
  letterSpacing: '0.04em', background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)',
  color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 3px 12px rgba(61,107,223,0.25)',
};

/* ── Live Clock ── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ background: 'linear-gradient(135deg, #0D1120 0%, #1A2FA8 100%)', borderRadius: 16, padding: '14px 18px', marginBottom: 16, boxShadow: '0 4px 20px rgba(26,47,168,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Clock size={18} color="rgba(255,255,255,0.6)" />
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '1.3rem', fontWeight: 500, color: '#fff', letterSpacing: '0.04em' }}>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', marginTop: 1, letterSpacing: '0.08em' }}>{now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 0 3px rgba(74,222,128,0.25)', animation: 'pulse 2s infinite' }} />
    </div>
  );
}


/* ── Reset Master PIN Modal: verify email → set new PIN ── */
function ResetMasterPinModal({
  authRef, authInst, adminHashKey, onClose, onSuccess,
}: {
  authRef?: React.MutableRefObject<any>;
  authInst?: React.MutableRefObject<any>;
  adminHashKey: string;
  onClose: () => void;
  onSuccess: (newHash: string) => void;
}) {
  type Step = 'verify' | 'newPin' | 'confirmPin' | 'done';
  const [step, setStep] = useState<Step>('verify');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 16 };
  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 22, padding: '24px 20px', width: '100%', maxWidth: 320, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'Plus Jakarta Sans, sans-serif' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E4F0', fontSize: '0.85rem', fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s' };
  const labelStyle: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', display: 'block', marginBottom: 6 };
  const btnPrimary: React.CSSProperties = { width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' };
  const btnBack: React.CSSProperties = { width: '100%', marginTop: 10, padding: '8px', background: 'none', border: '1.5px dashed rgba(61,107,223,0.2)', borderRadius: 10, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, color: '#9A9FB8', fontFamily: "'Plus Jakarta Sans', sans-serif" };

  // Verify email/password with Firebase Auth
  const handleVerify = async () => {
    if (!authRef?.current || !authInst?.current) {
      setError('Firebase Auth is not available. Cannot verify identity.');
      return;
    }
    if (!email || !password) { setError('Enter your email and password'); return; }
    setLoading(true); setError('');
    try {
      const fa = authRef.current;
      await fa.signInWithEmailAndPassword(authInst.current, email, password);
      setLoading(false);
      setStep('newPin');
    } catch (e: any) {
      setLoading(false);
      const code = e?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid email or password');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(e?.message || 'Verification failed');
      }
    }
  };

  // Save the new PIN
  const handleSavePin = async () => {
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match'); return; }
    const h = await sha256(newPin);
    try { localStorage.setItem(adminHashKey, h); } catch {}
    setStep('done');
  };

  // Auto-advance: newPin at 6 digits → confirm
  useEffect(() => {
    if (step === 'newPin' && newPin.length >= 6) {
      setStep('confirmPin');
    }
  }, [step, newPin]);

  // Auto-advance: confirmPin at 6 digits → save
  useEffect(() => {
    if (step === 'confirmPin' && confirmPin.length >= 6) {
      handleSavePin();
    }
  }, [step, confirmPin]); // eslint-disable-line

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} color="#3D6BDF" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Reset Master PIN</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
        </div>

        {/* Step 1: Verify identity */}
        {step === 'verify' && (
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5A5F7A', marginBottom: 14, textAlign: 'center' }}>
              Verify your identity to reset the master PIN
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Admin Email</label>
              <input
                type="email" placeholder="admin@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && password) handleVerify(); }}
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#3D6BDF'}
                onBlur={e => e.currentTarget.style.borderColor = '#E0E4F0'}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && email) handleVerify(); }}
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#3D6BDF'}
                onBlur={e => e.currentTarget.style.borderColor = '#E0E4F0'}
              />
            </div>
            {error && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 8, marginBottom: 8 }}>{error}</div>}
            <button
              onClick={handleVerify}
              disabled={loading || !email || !password}
              style={{
                ...btnPrimary,
                background: loading || !email || !password ? '#D4D8E8' : btnPrimary.background,
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Verifying…' : 'Verify Identity'}
            </button>
            <button onClick={onClose} style={btnBack}>← Cancel</button>
          </div>
        )}

        {/* Step 2: Enter new PIN */}
        {step === 'newPin' && (
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1A8A4A', marginBottom: 10, textAlign: 'center' }}>
              ✓ Identity verified
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5A5F7A', marginBottom: 14, textAlign: 'center' }}>
              Enter your new master PIN
            </div>
            <PinKeypad value={newPin} onChange={setNewPin} label="New PIN" maxLen={6} />
            {error && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{error}</div>}
            {newPin.length >= 4 && (
              <button
                onClick={() => { setError(''); setStep('confirmPin'); }}
                style={btnPrimary}
              >
                Continue
              </button>
            )}
            <button onClick={() => { setStep('verify'); setNewPin(''); setError(''); }} style={btnBack}>← Back</button>
          </div>
        )}

        {/* Step 3: Confirm new PIN */}
        {step === 'confirmPin' && (
          <div>
            <div style={{ fontSize: '0.72rem', color: '#5A5F7A', marginBottom: 14, textAlign: 'center' }}>
              Confirm your new PIN
            </div>
            <PinKeypad value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" maxLen={6} />
            {error && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{error}</div>}
            {confirmPin.length >= 4 && (
              <button
                onClick={handleSavePin}
                style={{ ...btnPrimary, background: 'linear-gradient(135deg, #1A8A4A, #2DB36A)' }}
              >
                Save New PIN
              </button>
            )}
            <button onClick={() => { setStep('newPin'); setConfirmPin(''); setError(''); }} style={btnBack}>← Back</button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 4px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A1D2E', marginBottom: 6 }}>PIN Updated!</div>
            <div style={{ fontSize: '0.75rem', color: '#5A5F7A', lineHeight: 1.5, marginBottom: 16 }}>
              Your master PIN has been updated. You can now use both email and PIN to log in.
            </div>
            <button
              onClick={() => {
                const h = localStorage.getItem(adminHashKey) || '';
                onSuccess(h);
              }}
              style={btnPrimary}
            >
              Continue to Admin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export function BusinessSelector({
  onSelectBusiness, onMasterAdmin, onLogoutMasterAdmin,
  businesses, onCreateBusiness, onDeleteBusiness, onResetPin, onRenameBusiness,
  onExport, onImport, onClearData, onPull, onPush,
  onFetchPeople, onSaveViewUsers,
  isMasterAdmin, authRef, authInst,
}: Props) {
  const [selected, setSelected] = useState<string>(businesses[0]?.id ?? '');

  // Admin reset screen removed — now using Firebase Auth email/password login
  const [adminHash, setAdminHash] = useState(() => getAdminHash());

  // Admin PIN (legacy fallback)
  const [showAdmin, setShowAdmin]   = useState(false);
  const [adminPin, setAdminPin]     = useState('');
  const [adminErr, setAdminErr]     = useState('');
  const [checking, setChecking]     = useState(false);
  const [adminShake, setAdminShake] = useState(false);

  // Email/password login (primary)
  const [loginMode, setLoginMode]   = useState<'email' | 'pin'>('email');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [emailErr, setEmailErr]     = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetSent, setResetSent]   = useState(false);

  // Reset PIN flow — now handled by ResetMasterPinModal component
  const [showResetMasterPin, setShowResetMasterPin] = useState(false);

  // Modals
  const [showCreate, setShowCreate]           = useState(false);
  const [resetPinBiz, setResetPinBiz]         = useState<BizRecord | null>(null);
  const [settingsBiz, setSettingsBiz]         = useState<BizRecord | null>(null);
  const [deleteId, setDeleteId]               = useState<string | null>(null);
  const [renameId, setRenameId]               = useState<string | null>(null);
  const [renameName, setRenameName]           = useState('');
  const [renaming, setRenaming]               = useState(false);
  const [showContact, setShowContact]         = useState(false);
  const [teamMemberPinsBiz, setTeamMemberPinsBiz] = useState<BizRecord | null>(null);

  useEffect(() => {
    if (businesses.length > 0 && !selected) setSelected(businesses[0].id);
  }, [businesses, selected]);

  const secretTap = useSecretTap(() => setShowAdmin(true));

  const handleAdminLogin = async () => {
    if (adminPin.length < 4) return;
    setChecking(true);
    const h = await sha256(adminPin);
    setChecking(false);
    if (h === adminHash) {
      setAdminErr(''); setAdminPin(''); setShowAdmin(false); onMasterAdmin();
    } else {
      setAdminErr('Incorrect master PIN');
      setAdminShake(true);
      setTimeout(() => { setAdminShake(false); setAdminPin(''); setAdminErr(''); }, 900);
    }
  };

  // Email/password sign-in via Firebase Auth
  const handleEmailLogin = async () => {
    if (!authRef?.current || !authInst?.current) {
      setEmailErr('Firebase Auth not available. Use PIN login instead.');
      setLoginMode('pin');
      return;
    }
    if (!email || !password) { setEmailErr('Enter email and password'); return; }
    setEmailLoading(true); setEmailErr('');
    try {
      const fa = authRef.current;
      await fa.signInWithEmailAndPassword(authInst.current, email, password);
      setEmailLoading(false);
      setShowAdmin(false); setEmail(''); setPassword('');
      onMasterAdmin();
    } catch (e: any) {
      setEmailLoading(false);
      const code = e?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setEmailErr('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        setEmailErr('Too many attempts. Try again later or reset your password.');
      } else if (code === 'auth/invalid-email') {
        setEmailErr('Invalid email address');
      } else {
        setEmailErr(e?.message || 'Login failed');
      }
    }
  };

  // Send password reset email via Firebase
  const handleForgotPassword = async () => {
    if (!authRef?.current || !authInst?.current) {
      setEmailErr('Firebase Auth not available.');
      return;
    }
    if (!email) { setEmailErr('Enter your email first'); return; }
    setEmailLoading(true); setEmailErr('');
    try {
      const fa = authRef.current;
      await fa.sendPasswordResetEmail(authInst.current, email);
      setEmailLoading(false);
      setResetSent(true);
    } catch (e: any) {
      setEmailLoading(false);
      const code = e?.code || '';
      if (code === 'auth/user-not-found') {
        setResetSent(true);
      } else {
        setEmailErr(e?.message || 'Failed to send reset email');
      }
    }
  };

  useEffect(() => { if (adminPin.length >= 6) handleAdminLogin(); }, [adminPin, adminHash]); // eslint-disable-line

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 };
  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', fontFamily: 'Plus Jakarta Sans, sans-serif' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #F2F4F9 0%, #E8ECF5 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 9999, userSelect: 'none', overflowY: 'auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}} .admin-shake{animation:shake 0.45s ease}`}</style>

      {/* Logo */}
      <div onClick={secretTap} style={{ width: 80, height: 80, borderRadius: 26, background: 'linear-gradient(145deg, #0D1B6E 0%, #2A4FCF 50%, #6B8FFF 100%)', boxShadow: '0 10px 40px rgba(13,27,110,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem', marginBottom: 22, cursor: 'pointer' }}>💰</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4, fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0A0F1F' }}>Flo<span style={{ color: '#00D9F0' }}>HQ</span></div>
      <div style={{ fontSize: '0.68rem', color: '#5A5F7A', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 36 }}>Farm Expense Tracker</div>

      {/* ══ MASTER ADMIN VIEW ══ */}
      {isMasterAdmin ? (
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ShieldCheck size={17} color="#3D6BDF" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1A2FA8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Master Admin</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCreate(true)} style={{ background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Plus size={13} /> New Business
              </button>
              <button onClick={onLogoutMasterAdmin} title="Lock" style={{ background: 'rgba(232,62,92,0.1)', border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Lock size={16} color="#E83E5C" />
              </button>
            </div>
          </div>

          <LiveClock />

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Businesses', val: businesses.length, sub: 'registered' },
              { label: 'With View', val: businesses.filter(b => b.hasViewAccess).length, sub: 'view-only access' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 10px rgba(61,107,223,0.08)', border: '1px solid rgba(61,107,223,0.1)' }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1A2FA8', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '0.6rem', color: '#9A9FB8', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Data Backup — master admin only */}
          <MasterDataBackup
            businesses={businesses}
            onExport={onExport}
            onImport={onImport}
            onClearData={onClearData}
          />

          {/* Business list */}
          <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', marginBottom: 16 }}>
            {businesses.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9A9FB8', fontSize: '0.82rem', lineHeight: 1.7 }}>
                <Building2 size={32} color="#D4D8E8" style={{ marginBottom: 10 }} /><br />
                No businesses yet.<br />Tap <strong>New Business</strong> to create one.
              </div>
            ) : businesses.map((biz, i) => (
              <div key={biz.id} style={{ padding: '12px 14px', borderBottom: i < businesses.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                {/* Top row: avatar + name + Open/Delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(61,107,223,0.12), rgba(107,143,255,0.18))', border: '1.5px solid rgba(61,107,223,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#3D6BDF' }}>
                      {biz.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      {renameId === biz.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            autoFocus
                            value={renameName}
                            onChange={e => setRenameName(e.target.value)}
                            onKeyDown={async e => {
                              if (e.key === 'Enter' && renameName.trim() && !renaming) {
                                setRenaming(true);
                                await onRenameBusiness?.(biz.id, renameName.trim());
                                setRenaming(false); setRenameId(null);
                              }
                              if (e.key === 'Escape') setRenameId(null);
                            }}
                            style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1A1D2E', border: '1.5px solid rgba(61,107,223,0.35)', borderRadius: 8, padding: '3px 8px', outline: 'none', width: 130, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                          />
                          <button
                            disabled={renaming || !renameName.trim()}
                            onClick={async () => {
                              if (!renameName.trim() || renaming) return;
                              setRenaming(true);
                              await onRenameBusiness?.(biz.id, renameName.trim());
                              setRenaming(false); setRenameId(null);
                            }}
                            style={{ background: 'rgba(61,107,223,0.12)', border: 'none', borderRadius: 7, padding: '4px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Check size={13} color="#3D6BDF" />
                          </button>
                          <button onClick={() => setRenameId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', display: 'flex', alignItems: 'center' }}>
                            <X size={13} color="#9A9FB8" />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1A1D2E' }}>{biz.name}</div>
                          <button
                            onClick={() => { setRenameId(biz.id); setRenameName(biz.name); }}
                            title="Rename business"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center', opacity: 0.55 }}
                          >
                            <Pencil size={11} color="#5A5F7A" />
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        {biz.hasViewAccess && <span style={{ fontSize: '0.58rem', background: 'rgba(61,107,223,0.1)', color: '#3D6BDF', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>+ view</span>}
                        {biz.createdAt && <span style={{ fontSize: '0.58rem', color: '#C0C5D8' }}>{new Date(biz.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onSelectBusiness(biz)} style={{ background: 'linear-gradient(135deg, #3D6BDF, #6B8FFF)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LogIn size={12} /> Open
                    </button>
                    <button onClick={() => setDeleteId(biz.id)} style={{ background: 'rgba(232,62,92,0.1)', color: '#E83E5C', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {/* Bottom row: Reset PIN + Settings */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => setResetPinBiz(biz)} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'rgba(61,107,223,0.07)', border: '1px solid rgba(61,107,223,0.15)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, color: '#3D6BDF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <KeyRound size={12} /> Reset PIN
                  </button>
                  <button onClick={() => setTeamMemberPinsBiz(biz)} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'rgba(61,107,223,0.07)', border: '1px solid rgba(61,107,223,0.15)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, color: '#3D6BDF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Users size={12} /> Team PINs
                  </button>
                  <button onClick={() => setSettingsBiz(biz)} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'rgba(61,107,223,0.07)', border: '1px solid rgba(61,107,223,0.15)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, color: '#3D6BDF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Settings2 size={12} /> Settings
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ══ NORMAL SELECTOR ══ */
        <div style={{ width: '100%', maxWidth: 300, marginBottom: 16 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 8, textAlign: 'center' }}>Select Farm</div>
          {businesses.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9A9FB8', fontSize: '0.82rem', padding: '20px 0' }}>No farm registered yet</div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <select value={selected} onChange={e => setSelected(e.target.value)} style={{ width: '100%', padding: '14px 44px 14px 18px', background: '#ffffff', border: '1.5px solid rgba(61,107,223,0.25)', borderRadius: 16, fontSize: '0.95rem', fontWeight: 700, color: '#1A2FA8', appearance: 'none', cursor: 'pointer', outline: 'none', boxShadow: '0 2px 8px rgba(61,107,223,0.08)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={18} color="#3D6BDF" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
              <button onClick={() => { const biz = businesses.find(b => b.id === selected); if (biz) onSelectBusiness(biz); }} style={{ width: '100%', padding: '15px', borderRadius: 16, marginTop: 14, background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(61,107,223,0.35)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Continue →</button>

              {/* Register prompt */}
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <span style={{ fontSize: '0.7rem', color: '#B0B5CC' }}>Want to register a business? </span>
                <button
                  onClick={() => setShowContact(true)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: '#3D6BDF', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                >
                  Contact admin →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ⠨ ADMIN LOGIN OVERLAY ⠨ */}
      {showAdmin && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={20} color="#3D6BDF" /><span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Master Admin</span></div>
              <button onClick={() => { setShowAdmin(false); setAdminPin(''); setAdminErr(''); setEmail(''); setPassword(''); setEmailErr(''); setResetSent(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
            </div>

            {/* ── Email/password login (primary) ── */}
            {loginMode === 'email' && (
              <div>
                {!resetSent ? (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', display: 'block', marginBottom: 6 }}>Admin Email</label>
                      <input
                        type="email" placeholder="admin@example.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && password) handleEmailLogin(); }}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E4F0', fontSize: '0.85rem', fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#3D6BDF'}
                        onBlur={e => e.currentTarget.style.borderColor = '#E0E4F0'}
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8', display: 'block', marginBottom: 6 }}>Password</label>
                      <input
                        type="password" placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && email) handleEmailLogin(); }}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E4F0', fontSize: '0.85rem', fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s' }}
                        onFocus={e => e.currentTarget.style.borderColor = '#3D6BDF'}
                        onBlur={e => e.currentTarget.style.borderColor = '#E0E4F0'}
                      />
                    </div>
                    {emailErr && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 8, marginBottom: 8 }}>{emailErr}</div>}
                    <button
                      onClick={handleEmailLogin}
                      disabled={emailLoading || !email || !password}
                      style={{
                        width: '100%', padding: '13px', borderRadius: 12,
                        background: emailLoading || !email || !password ? '#D4D8E8' : 'linear-gradient(135deg, #1A2FA8, #3D6BDF)',
                        color: '#fff', border: 'none', cursor: emailLoading || !email || !password ? 'not-allowed' : 'pointer',
                        fontWeight: 800, fontSize: '0.85rem', transition: 'all 0.15s',
                      }}
                    >
                      {emailLoading ? 'Signing in…' : 'Sign In'}
                    </button>
                    <button
                      onClick={handleForgotPassword}
                      disabled={!email || emailLoading}
                      style={{
                        width: '100%', marginTop: 10, padding: '8px',
                        background: 'none', border: 'none', cursor: !email || emailLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.72rem', fontWeight: 600, color: !email ? '#C4C8D8' : '#3D6BDF',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      Forgot password?
                    </button>
                    <button
                      onClick={() => setShowResetMasterPin(true)}
                      style={{
                        width: '100%', marginTop: 6, padding: '8px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.72rem', fontWeight: 600, color: '#9A9FB8',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#3D6BDF'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#9A9FB8'; }}
                    >
                      Reset PIN
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 4px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>📧</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1A1D2E', marginBottom: 6 }}>Password reset sent!</div>
                    <div style={{ fontSize: '0.75rem', color: '#5A5F7A', lineHeight: 1.5 }}>
                      Check <strong>{email}</strong> for a password reset link from Firebase.
                    </div>
                    <button
                      onClick={() => { setResetSent(false); setPassword(''); }}
                      style={{ marginTop: 14, background: 'none', border: '1.5px solid #E0E4F0', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#3D6BDF', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      ← Back to login
                    </button>
                  </div>
                )}
                <button
                  onClick={() => { setLoginMode('pin'); setEmailErr(''); setResetSent(false); }}
                  style={{
                    width: '100%', marginTop: 14, padding: '8px',
                    background: 'none', border: '1.5px dashed rgba(61,107,223,0.2)',
                    borderRadius: 10, cursor: 'pointer',
                    fontSize: '0.68rem', fontWeight: 600, color: '#9A9FB8',
                    fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3D6BDF'; e.currentTarget.style.color = '#3D6BDF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,107,223,0.2)'; e.currentTarget.style.color = '#9A9FB8'; }}
                >
                  Use PIN instead
                </button>
              </div>
            )}


            {/* ── Legacy PIN login (fallback) ── */}
            {loginMode === 'pin' && (
              <div>
                <div className={adminShake ? 'admin-shake' : ''}>
                  <PinKeypad value={adminPin} onChange={setAdminPin} label="Enter master PIN" maxLen={6} />
                </div>
                {adminErr && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{adminErr}</div>}
                {checking && <div style={{ color: '#9A9FB8', fontSize: '0.72rem', textAlign: 'center', marginTop: 10 }}>Checking…</div>}
                <button
                  onClick={() => { setLoginMode('email'); setAdminPin(''); setAdminErr(''); }}
                  style={{
                    width: '100%', marginTop: 10, padding: '8px',
                    background: 'none', border: '1.5px dashed rgba(61,107,223,0.2)',
                    borderRadius: 10, cursor: 'pointer',
                    fontSize: '0.68rem', fontWeight: 600, color: '#9A9FB8',
                    fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3D6BDF'; e.currentTarget.style.color = '#3D6BDF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,107,223,0.2)'; e.currentTarget.style.color = '#9A9FB8'; }}
                >
                  Use email instead
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CREATE WIZARD ══ */}
      {showCreate && <CreateBusinessWizard onClose={() => setShowCreate(false)} onSubmit={onCreateBusiness} />}

      {/* ══ RESET PIN MODAL ══ */}
      {resetPinBiz && <ResetPinModal biz={resetPinBiz} onClose={() => setResetPinBiz(null)} onSubmit={onResetPin} />}

      {/* ══ RESET MASTER PIN MODAL ══ */}
      {showResetMasterPin && (
        <ResetMasterPinModal
          authRef={authRef}
          authInst={authInst}
          adminHashKey={ADMIN_HASH_KEY}
          onClose={() => setShowResetMasterPin(false)}
          onSuccess={(newHash) => {
            setAdminHash(newHash);
            setShowResetMasterPin(false);
            setShowAdmin(false);
            onMasterAdmin();
          }}
        />
      )}

      {/* ══ BIZ SETTINGS MODAL ══ */}
      {settingsBiz && (
        <BizSettingsModal
          biz={settingsBiz}
          onClose={() => setSettingsBiz(null)}
          onExport={onExport}
          onImport={onImport}
          onClearData={onClearData}
          onPull={onPull}
          onPush={onPush}
        />
      )}

      {/* ══ DELETE CONFIRM ══ */}
      {deleteId && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 300, textAlign: 'center' }}>
            <Trash2 size={32} color="#E83E5C" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1D2E', marginBottom: 8 }}>Delete Business?</div>
            <div style={{ fontSize: '0.8rem', color: '#5A5F7A', marginBottom: 20, lineHeight: 1.6 }}>
              This will remove <strong>{businesses.find(b => b.id === deleteId)?.name}</strong> and all its data permanently.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '12px', borderRadius: 12, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A' }}>Cancel</button>
              <button onClick={async () => { await onDeleteBusiness(deleteId!); setDeleteId(null); }} style={{ padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fff' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TEAM MEMBER PINS MODAL ══ */}
      {teamMemberPinsBiz && (
        <TeamMemberPinsModal
          biz={teamMemberPinsBiz}
          onClose={() => setTeamMemberPinsBiz(null)}
          onFetchPeople={onFetchPeople}
          onSaveViewUsers={onSaveViewUsers}
        />
      )}

      {/* ══ CONTACT ADMIN ══ */}
      {showContact && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 320, textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowContact(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
            {/* Icon */}
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, rgba(61,107,223,0.12), rgba(107,143,255,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1.5px solid rgba(61,107,223,0.18)' }}>
              <Building2 size={24} color="#3D6BDF" />
            </div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1D2E', marginBottom: 8 }}>Register a Business</div>
            <div style={{ fontSize: '0.8rem', color: '#5A5F7A', lineHeight: 1.7, marginBottom: 6 }}>
              Business accounts are set up by the admin.<br />
              Reach out to get your business registered and receive your access PIN.
            </div>
            <div style={{ background: 'rgba(61,107,223,0.06)', border: '1px solid rgba(61,107,223,0.14)', borderRadius: 12, padding: '12px 16px', margin: '14px 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={16} color="#3D6BDF" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: '#3D6BDF', fontWeight: 600, textAlign: 'left', lineHeight: 1.5 }}>
                Contact the <strong>master admin</strong> to register your business and get started.
              </span>
            </div>
            <button onClick={() => setShowContact(false)} style={{ width: '100%', padding: '13px', borderRadius: 14, background: 'linear-gradient(135deg, #1A2FA8, #3D6BDF)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, boxShadow: '0 4px 14px rgba(61,107,223,0.3)' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

