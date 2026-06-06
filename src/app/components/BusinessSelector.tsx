import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, Plus, Trash2, LogIn, ShieldCheck, X, Delete,
  Lock, Building2, Clock, KeyRound, CloudDownload, CloudUpload,
  Settings2, RefreshCw, Pencil, Check
} from 'lucide-react';
import { sha256 } from '../utils';

const MASTER_ADMIN_HASH = '8d146af9e9ac06938e5292116f80ececf77541427baf0b9fd7b2483d23fe6577';

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
  isMasterAdmin: boolean;
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
  const [confirmClear, setConfirmClear] = useState(false);

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

        {/* Export / Import */}
        <div style={sectionLabel}>Data Backup</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <button onClick={() => { onExport && onExport(biz.id); onClose(); }} style={{ ...actionBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <CloudDownload size={14} /> Export
          </button>
          <label style={{ width: '100%' }}>
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f && onImport) { onImport(biz.id, f); onClose(); } }} />
            <button style={{ ...actionBtn, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={e => (e.currentTarget.previousElementSibling as HTMLInputElement)?.click()}>
              <CloudUpload size={14} /> Import
            </button>
          </label>
        </div>

        {/* Danger zone */}
        <div style={sectionLabel}>Danger Zone</div>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} style={{ ...actionBtn, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
            <Trash2 size={14} /> Clear All Data
          </button>
        ) : (
          <div style={{ background: 'rgba(232,62,92,0.08)', borderRadius: 14, padding: '14px', border: '1px solid rgba(232,62,92,0.2)' }}>
            <div style={{ fontSize: '0.78rem', color: '#C0203A', fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
              ⚠️ This will permanently delete ALL transactions and people for {biz.name}.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setConfirmClear(false)} style={{ padding: '11px', borderRadius: 12, background: '#F5F7FF', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', fontWeight: 700, color: '#5A5F7A', fontSize: '0.78rem' }}>Cancel</button>
              <button onClick={() => { onClearData && onClearData(biz.id); onClose(); }} style={{ padding: '11px', borderRadius: 12, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', border: 'none', cursor: 'pointer', fontWeight: 800, color: '#fff', fontSize: '0.78rem' }}>Yes, Clear</button>
            </div>
          </div>
        )}
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

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export function BusinessSelector({
  onSelectBusiness, onMasterAdmin, onLogoutMasterAdmin,
  businesses, onCreateBusiness, onDeleteBusiness, onResetPin, onRenameBusiness,
  onExport, onImport, onClearData, onPull, onPush,
  isMasterAdmin,
}: Props) {
  const [selected, setSelected] = useState<string>(businesses[0]?.id ?? '');

  // Admin PIN
  const [showAdmin, setShowAdmin]   = useState(false);
  const [adminPin, setAdminPin]     = useState('');
  const [adminErr, setAdminErr]     = useState('');
  const [checking, setChecking]     = useState(false);
  const [adminShake, setAdminShake] = useState(false);

  // Modals
  const [showCreate, setShowCreate]           = useState(false);
  const [resetPinBiz, setResetPinBiz]         = useState<BizRecord | null>(null);
  const [settingsBiz, setSettingsBiz]         = useState<BizRecord | null>(null);
  const [deleteId, setDeleteId]               = useState<string | null>(null);
  const [renameId, setRenameId]               = useState<string | null>(null);
  const [renameName, setRenameName]           = useState('');
  const [renaming, setRenaming]               = useState(false);
  const [showContact, setShowContact]         = useState(false);

  useEffect(() => {
    if (businesses.length > 0 && !selected) setSelected(businesses[0].id);
  }, [businesses, selected]);

  const secretTap = useSecretTap(() => setShowAdmin(true));

  const handleAdminLogin = async () => {
    if (adminPin.length < 4) return;
    setChecking(true);
    const h = await sha256(adminPin);
    setChecking(false);
    if (h === MASTER_ADMIN_HASH) {
      setAdminErr(''); setAdminPin(''); setShowAdmin(false); onMasterAdmin();
    } else {
      setAdminErr('Incorrect master PIN');
      setAdminShake(true);
      setTimeout(() => { setAdminShake(false); setAdminPin(''); setAdminErr(''); }, 900);
    }
  };

  useEffect(() => { if (adminPin.length >= 6) handleAdminLogin(); }, [adminPin]); // eslint-disable-line

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 };
  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', fontFamily: 'Plus Jakarta Sans, sans-serif' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F0F2F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 9999, userSelect: 'none', overflowY: 'auto' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}} .admin-shake{animation:shake 0.45s ease}`}</style>

      {/* Logo */}
      <div onClick={secretTap} style={{ width: 76, height: 76, borderRadius: 24, background: 'linear-gradient(145deg, #2A4FCF, #6B8FFF)', boxShadow: '0 8px 32px rgba(61,107,223,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', marginBottom: 20, cursor: 'pointer' }}>💰</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Flow<span style={{ color: '#00B4D8' }}>HQ</span></div>
      <div style={{ fontSize: '0.68rem', color: '#9A9FB8', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 36 }}>Farm Expense Tracker</div>

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

      {/* ══ ADMIN PIN KEYPAD OVERLAY ══ */}
      {showAdmin && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={20} color="#3D6BDF" /><span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1A1D2E' }}>Master Admin</span></div>
              <button onClick={() => { setShowAdmin(false); setAdminPin(''); setAdminErr(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9FB8' }}><X size={18} /></button>
            </div>
            <div className={adminShake ? 'admin-shake' : ''}>
              <PinKeypad value={adminPin} onChange={setAdminPin} label="Enter master PIN" maxLen={6} />
            </div>
            {adminErr && <div style={{ color: '#E83E5C', fontSize: '0.73rem', fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{adminErr}</div>}
            {checking && <div style={{ color: '#9A9FB8', fontSize: '0.72rem', textAlign: 'center', marginTop: 10 }}>Checking…</div>}
          </div>
        </div>
      )}

      {/* ══ CREATE WIZARD ══ */}
      {showCreate && <CreateBusinessWizard onClose={() => setShowCreate(false)} onSubmit={onCreateBusiness} />}

      {/* ══ RESET PIN MODAL ══ */}
      {resetPinBiz && <ResetPinModal biz={resetPinBiz} onClose={() => setResetPinBiz(null)} onSubmit={onResetPin} />}

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

