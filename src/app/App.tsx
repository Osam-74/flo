import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import '../styles/fonts.css';

import { PinScreen }      from './components/PinScreen';
import { AppHeader }      from './components/AppHeader';
import { BottomNav }      from './components/BottomNav';
import { Dashboard }      from './components/Dashboard';
import { LedgerTab }      from './components/LedgerTab';
import { AddEntrySheet }  from './components/AddEntrySheet';
import { CreditTab }      from './components/CreditTab';
import { PeopleTab }      from './components/PeopleTab';
import { ReportTab }      from './components/ReportTab';
import { SettingsTab }    from './components/SettingsTab';
import { DeleteModal, EditModal, PaymentModal, ClearModal } from './components/Modals';

import type { Transaction, Person, Tab, AppMode, TxType } from './types';
import { gs, ss, isOwner } from './utils';

/* ── Firebase config ──────────────────────────── */
const FB = {
  apiKey: "AIzaSyDEl6cN6IYqAZrbwIxW36tFudj8OzxVbpQ",
  authDomain: "expense-4d9f5.firebaseapp.com",
  projectId: "expense-4d9f5",
  storageBucket: "expense-4d9f5.firebasestorage.app",
  messagingSenderId: "323704270723",
  appId: "1:323704270723:web:f5d7d6a2695d332937d0b6",
};
const FS_DOC = ['cashbook','main'] as const;
const H_MASTER = '84b2a5d834daee2fff7eb5e31f44ba68eb860d86d2cf8e37606a26fa775cf23b';

const BIZ_ACCOUNT = { id: 'biz', name: 'Biz Account', role: 'biz', color: 'gold' };

export default function App() {
  /* ── Auth / session ──────────────────────── */
  const [appMode, setAppMode] = useState<AppMode>('locked');

  /* ── Data ──────────────────────────────────── */
  const [people,   setPeople]   = useState<Person[]>([]);
  const [txs,      setTxs]      = useState<Transaction[]>([]);
  const [currency, setCurrency] = useState('GHS');

  /* ── UI state ─────────────────────────────── */
  const [activeTab,   setActiveTab]   = useState<Tab>('dashboard');
  const [isAddOpen,   setIsAddOpen]   = useState(false);
  const [addInitType, setAddInitType] = useState<TxType>('income');
  const [dbStatus,    setDbStatus]    = useState('Connecting to Firebase…');
  const [installReady, setInstallReady] = useState(false);
  const [personFilterForLedger, setPersonFilterForLedger] = useState('all');

  /* ── Modal states ─────────────────────────── */
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; desc: string }>({ open: false, id: '', desc: '' });
  const [editModal,   setEditModal]   = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [payModal,    setPayModal]    = useState<{ open: boolean; buyer: string }>({ open: false, buyer: '' });
  const [clearModal,  setClearModal]  = useState(false);

  /* ── Refs ─────────────────────────────────── */
  const dbRef   = useRef<any>(null);
  const fsRef   = useRef<any>(null);
  const syncRef = useRef<ReturnType<typeof setTimeout>>();
  const promptRef = useRef<any>(null);

  const isReadOnly = appMode === 'view';

  /* ── PWA install ───────────────────────────── */
  useEffect(() => {
    const onBefore = (e: any) => { e.preventDefault(); promptRef.current = e; setInstallReady(true); };
    const onInstalled = () => { promptRef.current = null; setInstallReady(false); toast.success('App installed!'); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /* ── Service Worker ───────────────────────── */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        }).catch(err => console.warn('[SW]', err));
    }
  }, []);

  /* ── Auto-restore session ─────────────────── */
  useEffect(() => {
    const s = sessionStorage.getItem('cb_s');
    if (s === 'master' || s === 'view') unlock(s === 'master' ? 'master' : 'view');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Firebase ─────────────────────────────── */
  const applyRemote = useCallback((r: any) => {
    const p = r.people ?? gs('cb_people', []);
    // Ensure a Business Account entry exists so it can be selected as a receiver
    const ppl = Array.isArray(p) ? p : [];
    const withBiz = ppl.find((x: any) => x?.id === BIZ_ACCOUNT.id) ? ppl : [...ppl, BIZ_ACCOUNT];
    const t = r.txs    ?? gs('cb_txs',    []);
    const c = r.currency ?? gs('cb_currency', 'GHS');
    setPeople(withBiz); setTxs(t); setCurrency(c);
    ss('cb_people', withBiz); ss('cb_txs', t); ss('cb_currency', c);
    setDbStatus('✅ Live sync active. Last update: ' + new Date().toLocaleTimeString());
  }, []);

  const initFirebase = useCallback(async () => {
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js' as any);
      const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js' as any);
      fsRef.current = fs;
      const app = getApps().length === 0 ? initializeApp(FB) : getApps()[0];
      dbRef.current = fs.getFirestore(app);
      const ref = fs.doc(dbRef.current, ...FS_DOC);
      fs.onSnapshot(ref, (snap: any) => {
        if (!snap.exists()) {
          const ppl = gs('cb_people', []);
          const withBiz = (Array.isArray(ppl) && ppl.find((x: any) => x?.id === BIZ_ACCOUNT.id)) ? ppl : [...(Array.isArray(ppl) ? ppl : []), BIZ_ACCOUNT];
          setPeople(withBiz); setTxs(gs('cb_txs', [])); setCurrency(gs('cb_currency', 'GHS'));
          ss('cb_people', withBiz);
          setDbStatus('⚠️ No cloud data yet. Use ↑ Push Local to upload existing data.');
        } else {
          applyRemote(snap.data());
        }
      }, (err: any) => {
        console.warn('[DB]', err);
        setDbStatus('❌ Sync error: ' + err.code);
        setPeople(gs('cb_people', [])); setTxs(gs('cb_txs', [])); setCurrency(gs('cb_currency', 'GHS'));
      });
    } catch (e) {
      console.warn('[DB] Firebase failed:', e);
      setDbStatus('⚠️ Cloud unavailable — working offline.');
      setPeople(gs('cb_people', [])); setTxs(gs('cb_txs', [])); setCurrency(gs('cb_currency', 'GHS'));
    }
  }, [applyRemote]);

  const dbSync = useCallback((nextPeople: Person[], nextTxs: Transaction[], nextCurrency: string) => {
    if (!dbRef.current || !fsRef.current) return;
    clearTimeout(syncRef.current);
    syncRef.current = setTimeout(async () => {
      try {
        // Ensure Business account persists in cloud people list
        const ppl = Array.isArray(nextPeople) ? nextPeople : [];
        const withBiz = ppl.find(p => p.id === BIZ_ACCOUNT.id) ? ppl : [...ppl, BIZ_ACCOUNT];
        await fsRef.current.setDoc(
          fsRef.current.doc(dbRef.current, ...FS_DOC),
          { txs: nextTxs, people: withBiz, currency: nextCurrency, ts: Date.now(), _pinHash: H_MASTER }
        );
        setDbStatus('✅ Last sync: ' + new Date().toLocaleTimeString());
      } catch (e: any) {
        setDbStatus('❌ Sync failed: ' + e.message);
      }
    }, 800);
  }, []);

  /* ── Unlock ───────────────────────────────── */
  const unlock = useCallback((mode: 'master' | 'view') => {
    setAppMode(mode);
    initFirebase();
  }, [initFirebase]);

  const lock = useCallback(() => {
    sessionStorage.removeItem('cb_s');
    setAppMode('locked');
    setPeople([]); setTxs([]); setCurrency('GHS');
  }, []);

  /* ── Guard ────────────────────────────────── */
  const guardWrite = (): boolean => {
    if (isReadOnly) { toast.error('🔒 View-only mode'); return false; }
    return true;
  };

  /* ── Save transaction ─────────────────────── */
  const saveTx = useCallback((tx: Transaction) => {
    if (!guardWrite()) return;
    setTxs(prev => {
      const next = [...prev, tx];
      ss('cb_txs', next);
      dbSync(people, next, currency);
      return next;
    });
    toast.success('Transaction saved!');
    setActiveTab('ledger');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, currency, dbSync, isReadOnly]);

  /* ── Delete transaction ───────────────────── */
  const confirmDelete = useCallback(() => {
    setTxs(prev => {
      const next = prev.filter(t => t.id !== deleteModal.id);
      ss('cb_txs', next);
      dbSync(people, next, currency);
      return next;
    });
    setDeleteModal(s => ({ ...s, open: false }));
    toast.success('Transaction deleted');
  }, [deleteModal.id, people, currency, dbSync]);

  /* ── Edit transaction ─────────────────────── */
  const confirmEdit = useCallback((id: string, updates: Partial<Transaction>) => {
    setTxs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      ss('cb_txs', next);
      dbSync(people, next, currency);
      return next;
    });
    toast.success('Updated');
  }, [people, currency, dbSync]);

  /* ── Credit payment ───────────────────────── */
  const confirmPayment = useCallback((amount: number, date: string, receiver: string) => {
    const rName = people.find(p => p.id === receiver)?.name || '?';
    setTxs(prev => {
      let remaining = amount;
      const next = prev.map(t => {
        if (t.type !== 'credit' || (t.creditBuyer || 'Unknown') !== payModal.buyer) return t;
        if (remaining <= 0) return t;
        const owed = Math.max(0, (t.creditTotal || 0) - (t.creditPaid || 0));
        if (owed <= 0) return t;
        const alloc = Math.min(owed, remaining);
        remaining -= alloc;
        const payments = [...(t.payments || []), { amount: alloc, receiver, receiverName: rName, date, note: 'Balance payment' }];
        return { ...t, creditPaid: (t.creditPaid || 0) + alloc, amount: (t.creditPaid || 0) + alloc, payments, creditReceiver: receiver, creditReceiverName: rName };
      });
      ss('cb_txs', next);
      dbSync(people, next, currency);
      return next;
    });
    toast.success('Payment recorded');
  }, [payModal.buyer, people, currency, dbSync]);

  /* ── People ───────────────────────────────── */
  const addPerson = useCallback((name: string, role: string, color: string) => {
    if (!guardWrite()) return;
    const p: Person = { id: 'p_' + Date.now(), name, role, color };
    setPeople(prev => {
      const next = [...prev, p];
      ss('cb_people', next);
      dbSync(next, txs, currency);
      return next;
    });
    toast.success('Person added');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, currency, dbSync, isReadOnly]);

  const deletePerson = useCallback((id: string) => {
    if (!guardWrite()) return;
    if (id === BIZ_ACCOUNT.id) { toast.error('Cannot delete Business Account'); return; }
    if (txs.some(t =>
      t.person === id || t.transferFrom === id || t.transferTo === id ||
      t.ownerSender === id || t.ownerReceiver === id || t.frSender === id ||
      t.frReceiver === id || t.creditSeller === id || t.creditReceiver === id
    )) { toast.error('Cannot delete — person has transactions'); return; }
    setPeople(prev => {
      const next = prev.filter(p => p.id !== id);
      ss('cb_people', next);
      dbSync(next, txs, currency);
      return next;
    });
    toast.success('Person removed');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, currency, dbSync, isReadOnly]);

  /* ── Currency ─────────────────────────────── */
  const saveCurrency = useCallback((c: string) => {
    if (!guardWrite()) return;
    setCurrency(c);
    ss('cb_currency', c);
    dbSync(people, txs, c);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, txs, dbSync, isReadOnly]);

  /* ── Cloud ────────────────────────────────── */
  const manualPull = async () => {
    if (!dbRef.current || !fsRef.current) { toast.error('Not connected'); return; }
    toast.loading('Pulling…');
    const s = await fsRef.current.getDoc(fsRef.current.doc(dbRef.current, ...FS_DOC));
    toast.dismiss();
    if (s.exists()) { applyRemote(s.data()); toast.success('Pulled from cloud'); }
    else toast.info('No cloud data');
  };

  const manualPush = async () => {
    if (!dbRef.current || !fsRef.current) { toast.error('Not connected'); return; }
    toast.loading('Pushing…');
    try {
      await fsRef.current.setDoc(fsRef.current.doc(dbRef.current, ...FS_DOC), { txs, people, currency, ts: Date.now(), _pinHash: H_MASTER });
      toast.dismiss();
      toast.success('Pushed to cloud');
      setDbStatus('✅ Pushed: ' + new Date().toLocaleTimeString());
    } catch (e: any) { toast.dismiss(); toast.error('Push failed'); }
  };

  /* ── Clear all ────────────────────────────── */
  const executeFullClear = useCallback(() => {
    const emptyTxs: Transaction[] = [];
    const peopleWithBiz: Person[] = [BIZ_ACCOUNT as any];
    setPeople(peopleWithBiz); setTxs(emptyTxs); setCurrency('GHS');
    ss('cb_people', peopleWithBiz); ss('cb_txs', emptyTxs); ss('cb_currency', 'GHS');
    dbSync(peopleWithBiz, emptyTxs, 'GHS');
    toast.success('All data cleared');
  }, [dbSync]);

  /* ── Tab switch ───────────────────────────── */
  const handleTab = (tab: Tab) => {
    if (isReadOnly && ['settings'].includes(tab)) { toast.error('🔒 View-only mode'); return; }
    setActiveTab(tab);
  };

  /* ── FAB open ─────────────────────────────── */
  const openAdd = () => {
    if (!guardWrite()) return;
    setAddInitType('income');
    setIsAddOpen(true);
  };

  /* ── Person filter link from dashboard ────── */
  const handlePersonFilter = (pid: string) => {
    setPersonFilterForLedger(pid);
    setActiveTab('ledger');
  };

  /* ── Outstanding for payment modal ─────────── */
  const outstandingForBuyer = (buyer: string) => {
    const relevant = txs.filter(t => t.type === 'credit' && (t.creditBuyer || 'Unknown') === buyer);
    return Math.max(0, relevant.reduce((s, t) => s + (t.creditTotal || 0), 0) - relevant.reduce((s, t) => s + (t.creditPaid || 0), 0));
  };

  /* ── Render ───────────────────────────────── */
  if (appMode === 'locked') return (
    <>
      <PinScreen onUnlock={unlock} />
      <Toaster position="bottom-center" richColors />
    </>
  );

  // Export / Import handlers for settings
  const exportData = () => {
    const payload = { people, txs, currency };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cashbook-export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const importData = (file: File | null) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(String(fr.result || '{}'));
        if (obj.people && obj.txs) {
          const ppl = Array.isArray(obj.people) ? obj.people : [];
          const withBiz = ppl.find((x: any) => x?.id === BIZ_ACCOUNT.id) ? ppl : [...ppl, BIZ_ACCOUNT];
          setPeople(withBiz);
          setTxs(obj.txs);
          setCurrency(obj.currency || 'GHS');
          ss('cb_people', withBiz); ss('cb_txs', obj.txs); ss('cb_currency', obj.currency || 'GHS');
          dbSync(withBiz, obj.txs, obj.currency || 'GHS');
          toast.success('Imported data');
        } else {
          toast.error('Invalid import file');
        }
      } catch (e) { toast.error('Import failed'); }
    };
    fr.readAsText(file);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#F0F2F7',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflowX: 'hidden',
    }}>
      <style>{globalCss}</style>
      <div className="app-container">
      <Toaster position="bottom-center" richColors />

      {/* Header */}
      <AppHeader
        appMode={appMode}
        installReady={installReady}
        activeTab={activeTab}
        onLock={lock}
        onInstall={async () => {
          const p = promptRef.current;
          if (!p) { toast('Open browser menu to install'); return; }
          try {
            p.prompt();
            const choice = await p.userChoice;
            if (choice && choice.outcome === 'accepted') toast.success('Thanks — app installed');
            else toast('Install dismissed');
          } catch (e) { console.warn('[Install]', e); }
          promptRef.current = null; setInstallReady(false);
        }}
        onTab={handleTab}
      />

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            txs={txs} people={people} currency={currency}
            onPersonFilter={handlePersonFilter}
            onEdit={tx => { if (!guardWrite()) return; setEditModal({ open: true, tx }); }}
            onDelete={(id, desc) => { if (!guardWrite()) return; setDeleteModal({ open: true, id, desc }); }}
          />
        )}
        {activeTab === 'ledger' && (
          <LedgerTab
            txs={txs} people={people} currency={currency}
            initialPersonFilter={personFilterForLedger}
            isReadOnly={isReadOnly}
            onEdit={tx => { if (!guardWrite()) return; setEditModal({ open: true, tx }); }}
            onDelete={(id, desc) => { if (!guardWrite()) return; setDeleteModal({ open: true, id, desc }); }}
          />
        )}
        {activeTab === 'credit' && (
          <CreditTab
            txs={txs} people={people} currency={currency}
            isReadOnly={isReadOnly}
            onPayment={buyer => { if (!guardWrite()) return; setPayModal({ open: true, buyer }); }}
            onEdit={tx => { if (!guardWrite()) return; setEditModal({ open: true, tx }); }}
            onDelete={(id, desc) => { if (!guardWrite()) return; setDeleteModal({ open: true, id, desc }); }}
          />
        )}
        {activeTab === 'people' && (
          <PeopleTab
            people={people} txs={txs} currency={currency} isReadOnly={isReadOnly}
            onAdd={addPerson} onDelete={deletePerson}
          />
        )}
        {activeTab === 'report' && (
          <ReportTab txs={txs} people={people} currency={currency} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            currency={currency} dbStatus={dbStatus}
            onSaveCurrency={saveCurrency}
            onPull={manualPull} onPush={manualPush}
            onClearAll={() => { if (!guardWrite()) return; setClearModal(true); }}
            onExport={exportData}
            onImport={(file) => { if (!guardWrite()) return; importData(file); }}
          />
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav
        activeTab={activeTab}
        appMode={appMode}
        onTab={handleTab}
        onAdd={openAdd}
      />

      {/* Add Entry Sheet */}
      <AddEntrySheet
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        people={people}
        currency={currency}
        initialType={addInitType}
        onSave={saveTx}
      />

      {/* Modals */}
      <DeleteModal
        open={deleteModal.open}
        desc={deleteModal.desc}
        onClose={() => setDeleteModal(s => ({ ...s, open: false }))}
        onConfirm={confirmDelete}
      />
      <EditModal
        open={editModal.open}
        tx={editModal.tx}
        people={people}
        onClose={() => setEditModal(s => ({ ...s, open: false }))}
        onSave={confirmEdit}
      />
      <PaymentModal
        open={payModal.open}
        buyer={payModal.buyer}
        outstanding={payModal.buyer ? outstandingForBuyer(payModal.buyer) : 0}
        people={people}
        currency={currency}
        onClose={() => setPayModal(s => ({ ...s, open: false }))}
        onApply={confirmPayment}
      />
      <ClearModal
        open={clearModal}
        onClose={() => setClearModal(false)}
        onConfirm={executeFullClear}
      />
      </div>
    </div>
  );
}

const globalCss = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #c4c8d8; border-radius: 3px; }
  input, select, textarea { outline: none; }
  button { font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; border: none; }
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }

  /* Responsive container: mobile unchanged, desktop centered with max width */
  .app-container { width: 100%; max-width: 980px; margin: 0 auto; padding: 0; box-sizing: border-box; display: flex; flex-direction: column; height: 100%; }
  @media (min-width: 900px) {
    .app-container { padding: 18px 24px; }
    /* Slight visual adjustments on desktop */
    .AppHeader, header, .topbar { max-width: 980px; margin: 0 auto; }
  }
`;
