import React, { useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, CloudUpload, Trash2, Smartphone } from 'lucide-react';

interface Props {
  currency: string;
  dbStatus: string;
  onSaveCurrency: (c: string) => void;
  onPull: () => void;
  onPush: () => void;
  onClearAll: () => void;
}

export function SettingsTab({ currency, dbStatus, onSaveCurrency, onPull, onPush, onClearAll }: Props) {
  const [cur, setCur] = useState(currency);

  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* Currency */}
      <div style={sh}>Currency</div>
      <div style={card}>
        <Field label="Currency Symbol">
          <input style={inp} placeholder="e.g. GHS, NGN, USD"
            value={cur} onChange={e => setCur(e.target.value)} />
        </Field>
        <button
          onClick={() => { if (cur.trim()) { onSaveCurrency(cur.trim()); toast.success('Currency updated to ' + cur.trim()); } }}
          style={primaryBtn}
        >
          Save Currency
        </button>
      </div>

      {/* Cloud Sync */}
      <div style={sh}>Cloud Sync</div>
      <div style={card}>
        <div style={{
          fontSize: '0.78rem', color: '#5A5F7A', marginBottom: 14, lineHeight: 1.7,
          padding: '10px 12px', background: '#F5F7FF', borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          {dbStatus}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onPull} style={{ ...primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <CloudDownload size={16} /> Pull Cloud
          </button>
          <button onClick={onPush} style={{ ...primaryBtn, background: 'linear-gradient(135deg, #2a4a9a, #3d6bdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <CloudUpload size={16} /> Push Local
          </button>
        </div>
      </div>

      {/* Data */}
      <div style={sh}>Data Management</div>
      <div style={card}>
        <button
          onClick={onClearAll}
          style={{ ...primaryBtn, background: 'linear-gradient(135deg, #c0203a, #e83e5c)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Trash2 size={16} /> Clear All Data
        </button>

        <div style={{ background: '#F5F7FF', borderRadius: 12, padding: '14px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Smartphone size={16} color="#3D6BDF" />
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1A1D2E' }}>Install as App</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#5A5F7A', lineHeight: 1.8 }}>
            <strong>Desktop:</strong> Use the Install button in the header (Chrome/Edge).<br />
            <strong>iOS Safari:</strong> Share → Add to Home Screen<br />
            <strong>Android Chrome:</strong> Menu → Add to Home Screen
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
      <label style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9FB8' }}>{label}</label>
      {children}
    </div>
  );
}

const sh: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#9A9FB8', marginBottom: 10,
};

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: 18, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid rgba(0,0,0,0.05)',
};

const inp: React.CSSProperties = {
  background: '#F5F7FF', border: '1.5px solid rgba(0,0,0,0.08)',
  borderRadius: 10, padding: '10px 13px', fontSize: '0.88rem',
  color: '#1A1D2E', width: '100%', fontFamily: "'DM Mono',monospace",
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px', borderRadius: 12, fontSize: '0.78rem',
  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  background: 'linear-gradient(135deg, #3D6BDF, #5A84FF)', color: '#fff',
  border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(61,107,223,0.3)',
};
