import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import '../styles/fonts.css';

import { PinScreen }      from './components/PinScreen';
import { BusinessSelector, MASTER_ADMIN_HASH } from './components/BusinessSelector';
import type { BizRecord } from './components/BusinessSelector';
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
import { gs, ss, sha256 } from './utils';

/* ── Firebase config ───────────────────────────────── */
const FB = {
  apiKey: "AIzaSyDEl6cN6IYqAZrbwIxW36tFudj8OzxVbpQ",
  authDomain: "expense-4d9f5.firebaseapp.com",
  projectId: "expense-4d9f5",
  storageBucket: "expense-4d9f5.firebasestorage.app",
  messagingSenderId: "323704270723",
  appId: "1:323704270723:web:f5d7d6a2695d332937d0b6",
};

/* Firestore collection for the business registry */
const REGISTRY_DOC = ['cashbook_meta', 'businesses'];

const BIZ_ACCOUNT = { id: 'biz', name: 'Biz Account', role: 'biz', color: 'gold' };

/* ── Screen states ─────────────────────────────────── */
type Screen = 'selector' | 'pin' | 'app';

export default function App() {
  /* ── Screen / session ────────────────────────── */
  const [screen, setScreen] = useState<Screen>('selector');
  const [appMode, setAppMode] = useState<AppMode>('locked');
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  /* ── Business registry (loaded from Firestore) ── */
  const [businesses, setBusinesses] = useState<BizRecord[]>([]);
  const [bizLoading, setBizLoading] = useState(true);

  /* ── Selected business ─────────────────────────── */
  const [selectedBiz, setSelectedBiz] = useState<BizRecord | null>(null);

  /* ── Business data ─────────────────────────────── */
  const [people,   setPeople]   = useState<Person[]>([]);
  const [txs,      setTxs]      = useState<Transaction[]>([]);
  const [currency, setCurrency] = useState('GHS');

  /* ── UI state ──────────────────────────────────── */
  const [activeTab,   setActiveTab]   = useState<Tab>('dashboard');
  const [isAddOpen,   setIsAddOpen]   = useState(false);
  const [addInitType, setAddInitType] = useState<TxType>('income');
  const [dbStatus,    setDbStatus]    = useState('Connecting to Firebase…');
  const [installReady, setInstallReady] = useState(false);
  const [personFilterForLedger, setPersonFilterForLedger] = useState('all');

  /* ── Modal states ──────────────────────────────── */
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; desc: string }>({ open: false, id: '', desc: '' });
  const [editModal,   setEditModal]   = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [payModal,    setPayModal]    = useState<{ open: boolean; buyer: string }>({ open: false, buyer: '' });
  const [clearModal,  setClearModal]  = useState(false);

  /* ── Refs ──────────────────────────────────────── */
  const dbRef    = useRef<any>(null);
  const fsRef    = useRef<any>(null);
  const syncRef  = useRef<ReturnType<typeof setTimeout>>();
  const promptRef = useRef<any>(null);
  const bizUnsubRef = useRef<any>(null); // unsubscribe for biz data listener
  const regUnsubRef = useRef<any>(null); // unsubscribe for registry listener

  const isReadOnly = appMode === 'view';

  /* ── PWA install ────────────────────────────────── */
  useEffect(() => {
    const onBefore = (e: any) => { e.preventDefault(); promptRef.current = e; setInstallReady(true); };
    const onInstalled = () => { promptRef.current = null; setInstallReady(false); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /* ── Service Worker ─────────────────────────────── */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/flo/sw.js', { scope: '/flo/' })
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

  /* ── Init Firebase & load business registry ─────── */
  const initFirebase = useCallback(async () => {
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js' as any);
      const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js' as any);
      fsRef.current = fs;
      const app = getApps().length === 0 ? initializeApp(FB) : getApps()[0];
      dbRef.current = fs.getFirestore(app);

      // Listen to business registry
      const regRef = fs.doc(dbRef.current, REGISTRY_DOC[0], REGISTRY_DOC[1]);
      if (regUnsubRef.current) regUnsubRef.current();
      regUnsubRef.current = fs.onSnapshot(regRef, (snap: any) => {
        if (snap.exists()) {
          const data = snap.data();
          const list: BizRecord[] = data.businesses ?? [];
          setBusinesses(list);
        } else {
          setBusinesses([]);
        }
        setBizLoading(false);
      }, () => setBizLoading(false));

    } catch (e) {
      console.warn('[DB] Firebase failed:', e);
      setBizLoading(false);
    }
  }, []);

  useEffect(() => {
    initFirebase();
    return () => {
      if (regUnsubRef.current) regUnsubRef.current();
      if (bizUnsubRef.current) bizUnsubRef.current();
    };
  }, [initFirebase]);

  /* ── Auto-restore session ────────────────────────── */
  useEffect(() => {
    if (bizLoading) return;
    const s   = sessionStorage.getItem('cb_s');
    const bId = sessionStorage.getItem('cb_biz');
    const master = sessionStorage.getItem('cb_master');
    if (master === '1') {
      setIsMasterAdmin(true);
      return;
    }
    if ((s === 'master' || s === 'view') && bId) {
      const biz = businesses.find(b => b.id === bId);
      if (biz) {
        setSelectedBiz(biz);
        unlockBiz(biz, s === 'master' ? 'master' : 'view');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizLoading]);

  /* ── Apply remote data ───────────────────────────── */
  const applyRemote = useCallback((r: any) => {
    const p = r.people ?? gs('cb_people', []);
    const ppl = Array.isArray(p) ? p : [];
    const withBiz = ppl.find((x: any) => x?.id === BIZ_ACCOUNT.id) ? ppl : [...ppl, BIZ_ACCOUNT];
    const t = r.txs     ?? gs('cb_txs', []);
    const c = r.currency ?? gs('cb_currency', 'GHS');
    setPeople(withBiz); setTxs(t); setCurrency(c);
    ss('cb_people', withBiz); ss('cb_txs', t); ss('cb_currency', c);
    setDbStatus('✅ Live sync active. Last update: ' + new Date().toLocaleTimeString());
  }, []);

  /* ── Subscribe to business data ──────────────────── */
  const subscribeToBiz = useCallback((biz: BizRecord) => {
    if (!dbRef.current || !fsRef.current) return;
    if (bizUnsubRef.current) bizUnsubRef.current();
    const [col, doc] = biz.fsDoc.split('/');
    const ref = fsRef.current.doc(dbRef.current, col, doc);
    bizUnsubRef.current = fsRef.current.onSnapshot(ref, (snap: any) => {
      if (!snap.exists()) {
        const ppl = gs('cb_people', []);
        const withBiz = (Array.isArray(ppl) && ppl.find((x: any) => x?.id === BIZ_ACCOUNT.id)) ? ppl : [...(Array.isArray(ppl) ? ppl : []), BIZ_ACCOUNT];
        setPeople(withBiz); setTxs(gs('cb_txs', [])); setCurrency(gs('cb_currency', 'GHS'));
        ss('cb_people', withBiz);
        setDbStatus('⚠️ No cloud data yet.');
      } else {
        applyRemote(snap.data());
      }
    }, (err: any) => {
      console.warn('[DB]', err);
      setDbStatus('❌ Sync error: ' + err.code);
      setPeople(gs('cb_people', [])); setTxs(gs('cb_txs', [])); setCurrency(gs('cb_currency', 'GHS'));
    });
  }, [applyRemote]);

  /* ── DB sync (debounced write) ───────────────────── */
  const dbSync = useCallback((nextPeople: Person[], nextTxs: Transaction[], nextCurrency: string) => {
    if (!dbRef.current || !fsRef.current || !selectedBiz) return;
    clearTimeout(syncRef.current);
    syncRef.current = setTimeout(async () => {
      try {
        const ppl = Array.isArray(nextPeople) ? nextPeople : [];
        const withBiz = ppl.find(p => p.id === BIZ_ACCOUNT.id) ? ppl : [...ppl, BIZ_ACCOUNT];
        const [col, doc] = selectedBiz.fsDoc.split('/');
        await fsRef.current.setDoc(
          fsRef.current.doc(dbRef.current, col, doc),
          { txs: nextTxs, people: withBiz, currency: nextCurrency, ts: Date.now() }
        );
        setDbStatus('✅ Last sync: ' + new Date().toLocaleTimeString());
      } catch (e: any) {
        setDbStatus('❌ Sync failed: ' + e.message);
      }
    }, 800);
  }, [selectedBiz]);

  /* ── Unlock a business ───────────────────────────── */
  const unlockBiz = useCallback((biz: BizRecord, mode: 'master' | 'view') => {
    setAppMode(mode);
    setScreen('app');
    subscribeToBiz(biz);
    sessionStorage.setItem('cb_s',   mode);
    sessionStorage.setItem('cb_biz', biz.id);
  }, [subscribeToBiz]);

  const lock = useCallback(() => {
    sessionStorage.clear();
    setScreen('selector');
    setAppMode('locked');
    setIsMasterAdmin(false);
    setSelectedBiz(null);
    setPeople([]); setTxs([]); setCurrency('GHS');
    if (bizUnsubRef.current) bizUnsubRef.current();
  }, []);

  /* ── Guard write ─────────────────────────────────── */
  const guardWrite = (): boolean => {
    if (isReadOnly) { toast.error('🔒 View-only mode'); return false; }
    return true;
  };

  /* ── Save business registry to Firestore ─────────── */
  const saveRegistry = useCallback(async (list: BizRecord[]) => {
    if (!dbRef.current || !fsRef.current) return;
    const ref = fsRef.current.doc(dbRef.current, REGISTRY_DOC[0], REGISTRY_DOC[1]);
    await fsRef.current.setDoc(ref, { businesses: list });
  }, []);

  /* ── Create business ─────────────────────────────── */
  const handleCreateBusiness = useCallback(async (name: string, masterPin: string, viewPin?: string) => {
    const masterHash = await sha256(masterPin);
    const viewHash   = viewPin ? await sha256(viewPin) : undefined;
    const id = 'biz_' + Date.now();
    const fsDoc = `cashbook/${id}`;
    const newBiz: BizRecord = {
      id, name, masterHash, viewHash, fsDoc,
      hasViewAccess: !!viewPin,
      createdAt: Date.now(),
    };
    const updated = [...businesses, newBiz];
    await saveRegistry(updated);
    toast.success(`"${name}" created!`);
  }, [businesses, saveRegistry]);

  /* ── Delete business ─────────────────────────────── */
  const handleDeleteBusiness = useCallback(async (bizId: string) => {
    const biz = businesses.find(b => b.id === bizId);
    if (!biz) return;
    // Delete Firestore data document
    if (dbRef.current && fsRef.current) {
      try {
        const [col, doc] = biz.fsDoc.split('/');
        await fsRef.current.deleteDoc(fsRef.current.doc(dbRef.current, col, doc));
      } catch (e) { console.warn('Delete data failed:', e); }
    }
    const updated = businesses.filter(b => b.id !== bizId);
    await saveRegistry(updated);
    toast.success(`"${biz.name}" deleted`);
  }, [businesses, saveRegistry]);

  /* ── Transactions ────────────────────────────────── */
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

  const confirmEdit = useCallback((id: string, updates: Partial<Transaction>) => {
    setTxs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      ss('cb_txs', next);
      dbSync(people, next, currency);
      return next;
    });
  }, [people, currency, dbSync]);

  /* ── Credit payment ──────────────────────────────── */
  const confirmPayment = useCallback((buyer: string, amount: number, receiver: string, receiverName: string, note: string) => {
    const date = new Date().toISOString().slice(0, 10);
    setTxs(prev => {
      const next = prev.map(t => {
        if (t.type !== 'credit') return t;
        const tBuyer = t.creditBuyer || 'Unknown';
        if (tBuyer !== buyer) return t;
        const alreadyPaid  = t.creditPaid  || 0;
        const total        = t.creditTotal || 0;
        const outstanding  = Math.max(0, total - alreadyPaid);
        if (outstanding <= 0) return t;
        const payAmt = Math.min(amount, outstanding);
        const newPayments = [
          ...(t.payments || []),
          { amount: payAmt, receiver, receiverName, date, note },
        ];
        const newPaid = alreadyPaid + payAmt;
        return {
          ...t,
          creditPaid: newPaid,
          creditReceiver: receiver,
          creditReceiverName: receiverName,
          payments: newPayments,
        };
      });
      ss('cb_txs', next);
      dbSync(people, next, currency);
      return next;
    });
    setPayModal(s => ({ ...s, open: false }));
    toast.success('Payment recorded');
  }, [people, currency, dbSync]);

  /* ── People ──────────────────────────────────────── */
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

  /* ── Currency ────────────────────────────────────── */
  const saveCurrency = useCallback((c: string) => {
    if (!guardWrite()) return;
    setCurrency(c);
    ss('cb_currency', c);
    dbSync(people, txs, c);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, txs, dbSync, isReadOnly]);

  /* ── Cloud pull / push ───────────────────────────── */
  const manualPull = async () => {
    if (!dbRef.current || !fsRef.current || !selectedBiz) { toast.error('Not connected'); return; }
    toast.loading('Pulling…');
    const [col, doc] = selectedBiz.fsDoc.split('/');
    const s = await fsRef.current.getDoc(fsRef.current.doc(dbRef.current, col, doc));
    toast.dismiss();
    if (s.exists()) { applyRemote(s.data()); toast.success('Pulled from cloud'); }
    else toast.info('No cloud data');
  };

  const manualPush = async () => {
    if (!dbRef.current || !fsRef.current || !selectedBiz) { toast.error('Not connected'); return; }
    toast.loading('Pushing…');
    try {
      const [col, doc] = selectedBiz.fsDoc.split('/');
      await fsRef.current.setDoc(fsRef.current.doc(dbRef.current, col, doc), { txs, people, currency, ts: Date.now() });
      toast.dismiss();
      toast.success('Pushed to cloud');
      setDbStatus('✅ Pushed: ' + new Date().toLocaleTimeString());
    } catch (e: any) { toast.dismiss(); toast.error('Push failed'); }
  };

  /* ── Clear all ───────────────────────────────────── */
  const executeFullClear = useCallback(() => {
    const emptyTxs: Transaction[] = [];
    const peopleWithBiz: Person[] = [BIZ_ACCOUNT as any];
    setPeople(peopleWithBiz); setTxs(emptyTxs); setCurrency('GHS');
    ss('cb_people', peopleWithBiz); ss('cb_txs', emptyTxs); ss('cb_currency', 'GHS');
    dbSync(peopleWithBiz, emptyTxs, 'GHS');
    toast.success('All data cleared');
  }, [dbSync]);

  /* ── Tab switch ──────────────────────────────────── */
  const handleTab = (tab: Tab) => {
    if (isReadOnly && tab === 'settings') { toast.error('🔒 View-only mode'); return; }
    setActiveTab(tab);
  };

  const openAdd = () => {
    if (!guardWrite()) return;
    setAddInitType('income');
    setIsAddOpen(true);
  };

  const handlePersonFilter = (pid: string) => {
    setPersonFilterForLedger(pid);
    setActiveTab('ledger');
  };

  /* ── Export / Import ─────────────────────────────── */
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
          setPeople(withBiz); setTxs(obj.txs); setCurrency(obj.currency || 'GHS');
          ss('cb_people', withBiz); ss('cb_txs', obj.txs); ss('cb_currency', obj.currency || 'GHS');
          dbSync(withBiz, obj.txs, obj.currency || 'GHS');
          toast.success('Imported data');
        } else toast.error('Invalid import file');
      } catch { toast.error('Import failed'); }
    };
    fr.readAsText(file);
  };

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */

  /* Loading state while registry loads */
  if (bizLoading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#F0F2F7',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(145deg, #2A4FCF, #6B8FFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8rem', marginBottom: 16,
          boxShadow: '0 8px 32px rgba(61,107,223,0.35)',
        }}>💰</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 12 }}>
          Cash<span style={{ color: '#3D6BDF' }}>book</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9A9FB8' }}>Loading…</div>
        <Toaster position="bottom-center" richColors />
      </div>
    );
  }

  /* Business selector / master admin */
  if (screen === 'selector') {
    return (
      <>
        <BusinessSelector
          businesses={businesses}
          isMasterAdmin={isMasterAdmin}
          onMasterAdmin={() => {
            setIsMasterAdmin(true);
            sessionStorage.setItem('cb_master', '1');
          }}
          onLogoutMasterAdmin={() => {
            setIsMasterAdmin(false);
            sessionStorage.removeItem('cb_master');
          }}
          onSelectBusiness={(biz) => {
            setSelectedBiz(biz);
            setScreen('pin');
          }}
          onCreateBusiness={handleCreateBusiness}
          onDeleteBusiness={handleDeleteBusiness}
        />
        <Toaster position="bottom-center" richColors />
      </>
    );
  }

  /* PIN screen */
  if (screen === 'pin' && selectedBiz) {
    return (
      <>
        <PinScreen
          businessId={selectedBiz.id}
          businessName={selectedBiz.name}
          masterHash={selectedBiz.masterHash}
          viewHash={selectedBiz.viewHash}
          onUnlock={(mode) => unlockBiz(selectedBiz, mode)}
          onBack={() => setScreen('selector')}
        />
        <Toaster position="bottom-center" richColors />
      </>
    );
  }

  /* Main app */
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#ffffff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden',
    }}>
      <style>{globalCss}</style>
      <div className="app-container">
        <Toaster position="bottom-center" richColors />

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
              if (choice?.outcome === 'accepted') toast.success('App installed');
              else toast('Install dismissed');
            } catch (e) { console.warn('[Install]', e); }
            promptRef.current = null; setInstallReady(false);
          }}
          onTab={handleTab}
        />

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
              currency={currency}
              businessName={selectedBiz?.name ?? ''}
              dbStatus={dbStatus}
              onSaveCurrency={saveCurrency}
              onSaveBusinessName={() => {}} // name is managed via master admin
              onPull={manualPull}
              onPush={manualPush}
              onClearAll={() => { if (!guardWrite()) return; setClearModal(true); }}
              onExport={exportData}
              onImport={(file) => { if (!guardWrite()) return; importData(file); }}
            />
          )}
        </div>

        <BottomNav
          activeTab={activeTab}
          appMode={appMode}
          onTab={handleTab}
          onAdd={openAdd}
        />

        <AddEntrySheet
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          people={people}
          currency={currency}
          initialType={addInitType}
          onSave={saveTx}
        />

        <DeleteModal
          open={deleteModal.open}
          desc={deleteModal.desc}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal(s => ({ ...s, open: false }))}
        />
        <EditModal
          open={editModal.open}
          tx={editModal.tx}
          people={people}
          currency={currency}
          onConfirm={confirmEdit}
          onCancel={() => setEditModal({ open: false, tx: null })}
        />
        <PaymentModal
          open={payModal.open}
          buyer={payModal.buyer}
          txs={txs}
          people={people}
          currency={currency}
          onConfirm={confirmPayment}
          onCancel={() => setPayModal(s => ({ ...s, open: false }))}
        />
        <ClearModal
          open={clearModal}
          onConfirm={() => { executeFullClear(); setClearModal(false); }}
          onCancel={() => setClearModal(false)}
        />
      </div>
    </div>
  );
}

const globalCss = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; overflow: hidden; }
  .app-container {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    max-width: 480px; margin: 0 auto;
    box-shadow: 0 0 60px rgba(0,0,0,0.08);
    position: relative; overflow: hidden;
  }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(61,107,223,0.25); border-radius: 10px; }
`;
