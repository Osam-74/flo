import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import '../styles/fonts.css';

import { PinScreen }      from './components/PinScreen';
import { BusinessSelector } from './components/BusinessSelector';
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
import { gs, ss, sha256, sanitizeTxs, stripUndefined } from './utils';

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
  const applyRemote = useCallback((r: any, _bizId: string) => {
    const p = r.people ?? [];
    const ppl = Array.isArray(p) ? p : [];
    const withBiz = ppl.find((x: any) => x?.id === BIZ_ACCOUNT.id) ? ppl : [...ppl, BIZ_ACCOUNT];
    const rawTxs = r.txs ?? [];
    const t = sanitizeTxs(rawTxs);
    const c = r.currency ?? 'GHS';
    setPeople(withBiz); setTxs(t); setCurrency(c);
    setDbStatus('✅ Live sync active. Last update: ' + new Date().toLocaleTimeString());
  }, []);

  /* ── Subscribe to business data ──────────────────── */
  const subscribeToBiz = useCallback((biz: BizRecord) => {
    // If Firebase hasn't loaded yet, retry every 200ms until it's ready (max 10s)
    if (!dbRef.current || !fsRef.current) {
      const start = Date.now();
      const interval = setInterval(() => {
        if (dbRef.current && fsRef.current) {
          clearInterval(interval);
          subscribeToBiz(biz);
        } else if (Date.now() - start > 10000) {
          clearInterval(interval);
          setDbStatus('❌ Firebase not ready — please refresh.');
        }
      }, 200);
      return;
    }
    if (bizUnsubRef.current) bizUnsubRef.current();
    const [col, doc] = biz.fsDoc.split('/');
    const ref = fsRef.current.doc(dbRef.current, col, doc);
    bizUnsubRef.current = fsRef.current.onSnapshot(ref, (snap: any) => {
      if (!snap.exists()) {
        setPeople([BIZ_ACCOUNT]); setTxs([]); setCurrency('GHS');
        setDbStatus('⚠️ No cloud data yet — add your first transaction!');
      } else {
        applyRemote(snap.data(), biz.id);
      }
    }, (err: any) => {
      console.warn('[DB]', err);
      setDbStatus('❌ Sync error: ' + err.code + ' — check your connection and refresh.');
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
        const payload = stripUndefined({
          txs: nextTxs,
          people: withBiz,
          currency: nextCurrency,
          ts: Date.now(),
        });
        await fsRef.current.setDoc(
          fsRef.current.doc(dbRef.current, col, doc),
          payload
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
    // Strip undefined values — Firestore rejects them
    const clean = list.map(b => {
      const obj: any = { ...b };
      Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; });
      return obj;
    });
    const ref = fsRef.current.doc(dbRef.current, REGISTRY_DOC[0], REGISTRY_DOC[1]);
    await fsRef.current.setDoc(ref, { businesses: clean });
  }, []);

  /* ── Create business ─────────────────────────────── */
  const handleCreateBusiness = useCallback(async (name: string, masterPin: string, viewPin?: string) => {
    const masterHash = await sha256(masterPin);
    const id = 'biz_' + Date.now();
    const fsDoc = `cashbook/${id}`;
    const newBiz: any = {
      id, name, masterHash, fsDoc,
      hasViewAccess: !!viewPin,
      createdAt: Date.now(),
    };
    // Only add viewHash if a view PIN was provided — Firestore rejects undefined fields
    if (viewPin) {
      newBiz.viewHash = await sha256(viewPin);
    }
    const updated = [...businesses, newBiz];
    await saveRegistry(updated);
    toast.success(`"${name}" created!`);
  }, [businesses, saveRegistry]);

  /* ── Reset PIN for a business ───────────────────── */
  const handleResetPin = useCallback(async (bizId: string, newMasterPin: string, newViewPin?: string) => {
    const biz = businesses.find(b => b.id === bizId);
    if (!biz) return;
    const masterHash = await sha256(newMasterPin);
    const updated = businesses.map(b => {
      if (b.id !== bizId) return b;
      const obj: any = { ...b, masterHash, hasViewAccess: !!newViewPin };
      if (newViewPin) {
        // viewHash will be set below after async sha256
        return obj;
      }
      delete obj.viewHash;
      return obj;
    });
    // Set viewHash async if needed
    if (newViewPin) {
      const viewHash = await sha256(newViewPin);
      const final = updated.map(b => b.id === bizId ? { ...b, viewHash } : b);
      await saveRegistry(final);
    } else {
      await saveRegistry(updated);
    }
    toast.success('PIN reset for "' + biz.name + '"!');
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

  /* ── Rename business ────────────────────────────── */
  const handleRenameBusiness = useCallback(async (bizId: string, newName: string) => {
    const updated = businesses.map(b => b.id === bizId ? { ...b, name: newName } : b);
    await saveRegistry(updated);
    // If the currently open business is being renamed, update selectedBiz
    if (selectedBiz?.id === bizId) setSelectedBiz(prev => prev ? { ...prev, name: newName } : prev);
    toast.success(`Renamed to "${newName}"`);
  }, [businesses, saveRegistry, selectedBiz]);

  /* ── Transactions ────────────────────────────────── */
  const saveTx = useCallback((tx: Transaction) => {
    if (!guardWrite()) return;
    setTxs(prev => {
      const next = [...prev, tx];
      // if (selectedBiz) ss(`cb_txs_${selectedBiz.id}`, next); // removed: Firebase is source of truth
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
      // if (selectedBiz) ss(`cb_txs_${selectedBiz.id}`, next); // removed: Firebase is source of truth
      dbSync(people, next, currency);
      return next;
    });
    setDeleteModal(s => ({ ...s, open: false }));
    toast.success('Transaction deleted');
  }, [deleteModal.id, people, currency, dbSync]);

  const confirmEdit = useCallback((id: string, updates: Partial<Transaction>) => {
    setTxs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      // if (selectedBiz) ss(`cb_txs_${selectedBiz.id}`, next); // removed: Firebase is source of truth
      dbSync(people, next, currency);
      return next;
    });
  }, [people, currency, dbSync]);

  /* ── Credit payment ──────────────────────────────── */
  const confirmPayment = useCallback((buyer: string, amount: number, date: string, receiver: string) => {
    const receiverName = people.find(p => p.id === receiver)?.name || receiver;
    const note = '';
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
      // if (selectedBiz) ss(`cb_txs_${selectedBiz.id}`, next); // removed: Firebase is source of truth
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
      // if (selectedBiz) ss(`cb_people_${selectedBiz.id}`, next); // removed: Firebase is source of truth
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
      // if (selectedBiz) ss(`cb_people_${selectedBiz.id}`, next); // removed: Firebase is source of truth
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
    // if (selectedBiz) ss(`cb_currency_${selectedBiz.id}`, c); // removed: Firebase is source of truth
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
      await fsRef.current.setDoc(fsRef.current.doc(dbRef.current, col, doc), stripUndefined({ txs, people, currency, ts: Date.now() }));
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
    if (selectedBiz) {
      ss(`cb_people_${selectedBiz.id}`, peopleWithBiz);
      ss(`cb_txs_${selectedBiz.id}`, emptyTxs);
      ss(`cb_currency_${selectedBiz.id}`, 'GHS');
    }
    dbSync(peopleWithBiz, emptyTxs, 'GHS');
    toast.success('All data cleared');
  }, [dbSync]);

  /* ── Tab switch ──────────────────────────────────── */
  const handleTab = (tab: Tab) => {
    setActiveTab(tab);
  };

  const openAdd = () => {
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
          const cleanTxs = sanitizeTxs(obj.txs);
          setPeople(withBiz); setTxs(cleanTxs); setCurrency(obj.currency || 'GHS');
          if (selectedBiz) {
            ss(`cb_people_${selectedBiz.id}`, withBiz);
            ss(`cb_txs_${selectedBiz.id}`, cleanTxs);
            ss(`cb_currency_${selectedBiz.id}`, obj.currency || 'GHS');
          }
          dbSync(withBiz, cleanTxs, obj.currency || 'GHS');
          toast.success('Imported data');
        } else toast.error('Invalid import file');
      } catch { toast.error('Import failed'); }
    };
    fr.readAsText(file);
  };

  /* ── Master-level biz data ops (by bizId) ──────────── */
  const masterExport = useCallback((bizId: string) => {
    if (selectedBiz?.id === bizId) { exportData(); return; }
    toast.info('Open that business first to export its data.');
  }, [selectedBiz, exportData]);

  const masterImport = useCallback((bizId: string, file: File) => {
    if (selectedBiz?.id === bizId) { importData(file); return; }
    toast.info('Open that business first to import data.');
  }, [selectedBiz, importData]);

  const masterClearData = useCallback((bizId: string) => {
    if (selectedBiz?.id === bizId) { executeFullClear(); return; }
    toast.info('Open that business first to clear its data.');
  }, [selectedBiz, executeFullClear]);

  const masterPull = useCallback((bizId: string) => {
    if (selectedBiz?.id === bizId) { manualPull(); return; }
    toast.info('Open that business first to pull data.');
  }, [selectedBiz, manualPull]);

  const masterPush = useCallback((bizId: string) => {
    if (selectedBiz?.id === bizId) { manualPush(); return; }
    toast.info('Open that business first to push data.');
  }, [selectedBiz, manualPush]);

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
          onResetPin={handleResetPin}
          onRenameBusiness={handleRenameBusiness}
          onExport={masterExport}
          onImport={masterImport}
          onClearData={masterClearData}
          onPull={masterPull}
          onPush={masterPush}
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
              businessName={selectedBiz?.name}
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
            <ReportTab txs={txs} people={people} currency={currency} businessName={selectedBiz?.name ?? ''} />
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
          isReadOnly={isReadOnly}
        />

        <DeleteModal
          open={deleteModal.open}
          desc={deleteModal.desc}
          onConfirm={confirmDelete}
          onClose={() => setDeleteModal(s => ({ ...s, open: false }))}
        />
        <EditModal
          open={editModal.open}
          tx={editModal.tx}
          people={people}
          onSave={confirmEdit}
          onClose={() => setEditModal({ open: false, tx: null })}
        />
        <PaymentModal
          open={payModal.open}
          buyer={payModal.buyer}
          outstanding={(() => {
            const buyer = payModal.buyer;
            let total = 0, paid = 0;
            txs.filter(t => t.type === 'credit' && (t.creditBuyer || 'Unknown') === buyer)
               .forEach(t => { total += t.creditTotal || 0; paid += t.creditPaid || 0; });
            return Math.max(0, total - paid);
          })()}
          people={people}
          currency={currency}
          onApply={(amount, date, receiver) => confirmPayment(payModal.buyer, amount, date, receiver)}
          onClose={() => setPayModal(s => ({ ...s, open: false }))}
        />
        <ClearModal
          open={clearModal}
          onConfirm={() => { executeFullClear(); setClearModal(false); }}
          onClose={() => setClearModal(false)}
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


