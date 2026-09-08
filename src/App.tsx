import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import './App.css';
import { useIsAuthenticated } from '@azure/msal-react';
import { Transaction, SavingsGoal, Budget, RecurringTransaction, Account, DetectedSubscription, CreditStatementHistoryEntry, Investment } from './types';
import { getFxRates, refreshFxRates } from './utils/fx';
import { getMyOwnerRole } from './utils/userIdentity';
import { storageAPI as storage } from './utils/storage';
import { getLastLoadError } from './utils/storageAPI';
import { reconnectInteractive } from './auth/getToken';
import { findMatchingRecurring, advanceOnePeriod, applyEarlyPaymentMatchesBulk, reconcileUnlinkedTransactions } from './utils/matchRecurring';
import { routeExistingTransactions } from './utils/accountRouter';
import { calculateStatistics, calculateMonthlyPlan, calculatePreviousMonthStats, formatCurrency, MonthlyPlan } from './utils/calculations';
import { getNextCharge } from './utils/recurringCalculations';
import { collectSubscriptions } from './utils/subscriptionDetector';
import { toStableDateISO } from './utils/stableDate';
import { TransactionModal } from './components/TransactionModal';
import { ImportExportButtons } from './components/ImportExportButtons';
import { GoalModal } from './components/GoalModal';
import { BudgetModal } from './components/BudgetModal';
import { AccountModal } from './components/AccountModal';
import { RecurringModal } from './components/RecurringModal';
import { MonthSelector } from './components/MonthSelector';
import { Sidebar } from './components/Sidebar';
import type { ViewType } from './components/Sidebar';
import { Header, PeriodFilter } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { AltaHogar } from './components/AltaHogar';
import { consultarHogar, EstadoHogar } from './utils/hogar';
import { useToast } from './components/ui/Toast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIsMobile } from './hooks/useIsMobile';
import { AppShellMobile } from './components/mobile/AppShellMobile';
import { CategoryManager } from './components/settings/CategoryManager';
import { NotificationSettings } from './components/settings/NotificationSettings';
import type { HomeSection } from './components/mobile/MobileHomeView';
import { OwnerLabelsModal } from './components/settings/OwnerLabelsModal';
import { isSameMonth } from 'date-fns';

// Lazy load view components
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TransactionList = lazy(() => import('./components/TransactionList').then(m => ({ default: m.TransactionList })));
const SavingsGoals = lazy(() => import('./components/SavingsGoals').then(m => ({ default: m.SavingsGoals })));
const Budgets = lazy(() => import('./components/Budgets').then(m => ({ default: m.Budgets })));
const RecurringTransactions = lazy(() => import('./components/RecurringTransactions').then(m => ({ default: m.RecurringTransactions })));
// Removed: SubscriptionsView and SavingsCenterView (info lives in Dashboard)
const ImportWizard = lazy(() => import('./components/import/ImportWizard').then(m => ({ default: m.ImportWizard })));
const YearRecap = lazy(() => import('./components/YearRecap').then(m => ({ default: m.YearRecap })));
const CreditCardView = lazy(() => import('./components/CreditCardView').then(m => ({ default: m.CreditCardView })));
const SubscriptionsView = lazy(() => import('./components/subscriptions/SubscriptionsView').then(m => ({ default: m.SubscriptionsView })));
const SavingsCenterView = lazy(() => import('./components/savings/SavingsCenterView').then(m => ({ default: m.SavingsCenterView })));
const NetWorthView = lazy(() => import('./components/networth/NetWorthView').then(m => ({ default: m.NetWorthView })));
const MobileSettingsView = lazy(() => import('./components/mobile/MobileSettingsView').then(m => ({ default: m.MobileSettingsView })));
const MobileHomeView = lazy(() => import('./components/mobile/MobileHomeView').then(m => ({ default: m.MobileHomeView })));
const MobileTransactionsView = lazy(() => import('./components/mobile/MobileTransactionsView').then(m => ({ default: m.MobileTransactionsView })));
const MobileNewExpenseSheet = lazy(() => import('./components/mobile/MobileNewExpenseSheet').then(m => ({ default: m.MobileNewExpenseSheet })));
const QuickReconcileModal = lazy(() => import('./components/QuickReconcileModal').then(m => ({ default: m.QuickReconcileModal })));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    color: 'var(--text-secondary)'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
      <div>Cargando...</div>
    </div>
  </div>
);

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transacciones',
  goals: 'Metas de Ahorro',
  budgets: 'Presupuestos',
  recurring: 'Recurrentes',
  subscriptions: 'Suscripciones',
  savings: 'Centro de Ahorro',
  networth: 'Patrimonio neto',
  settings: 'Ajustes',
  recap: 'Recap anual',
  credit: 'Crédito',
};

function App() {
  const isAuthenticated = useIsAuthenticated();
  // null mientras se pregunta; sin hogarId, toca el alta antes de la aplicacion.
  const [hogar, setHogar] = useState<EstadoHogar | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currency, setCurrency] = useState('PEN');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Layout state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');

  // View state
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  // Dashboard month selector
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isCurrentMonth, setIsCurrentMonth] = useState(true);

  // Goals state
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Budgets state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Recurring transactions state
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showQuickReconcile, setShowQuickReconcile] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Import wizard state
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  // Lo que el usuario marco como "no es suscripcion". Se persiste en el
  // servidor: la lista se rearma en cada visita, asi que sin esto el
  // descarte se perdia al salir de la vista.
  const [dismissedSubscriptions, setDismissedSubscriptions] = useState<string[]>([]);
  // La seccion de Inicio sobrevive a ir a Movimientos y volver, por eso vive
  // aca y no dentro de la vista.
  const [homeSection, setHomeSection] = useState<HomeSection>('resumen');
  const [showQuickExpense, setShowQuickExpense] = useState(false);

  // Detected subscriptions (cached for Savings Center)
  // Derivado de las transacciones. Antes era useState y nadie llamaba nunca a
  // su setter, asi que el Centro de Ahorro no tenia de donde sacar datos.
  const detectedSubscriptions = useMemo<DetectedSubscription[]>(
    () => collectSubscriptions(transactions, recurring, dismissedSubscriptions),
    [transactions, recurring, dismissedSubscriptions]
  );

  // Receipt mode for PWA scan-receipt action
  const [openReceiptMode, setOpenReceiptMode] = useState(false);

  // Error state
  const [loadError, setLoadError] = useState(false);

  // Category manager for mobile
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  // La coleccion ya existia en el servidor y en storageAPI, pero la app
  // nunca la leia: el modelo Investment estaba definido y sin uso.
  const [investments, setInvestments] = useState<Investment[]>([]);

  // Owner labels (couple-finance) settings modal
  // false = cerrado; 'pareja' | 'cambio' = abierto en esa seccion.
  const [showOwnerLabels, setShowOwnerLabels] = useState<false | 'pareja' | 'cambio'>(false);

  // Toast
  const { addToast } = useToast();

  // Keyboard shortcuts
  const openTransactionModal = useCallback(() => {
    setEditingTransaction(null);
    setOpenReceiptMode(false);
    setShowModal(true);
  }, []);

  // Handle PWA Quick Action URL params (?action=new-transaction | scan-receipt)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'new-transaction') {
      openTransactionModal();
    } else if (action === 'scan-receipt') {
      setEditingTransaction(null);
      setOpenReceiptMode(true);
      setShowModal(true);
    }
    // Clean URL without reload
    if (action) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [openTransactionModal]);

  useKeyboardShortcuts({
    onNewTransaction: openTransactionModal,
    onEscape: () => {
      setShowModal(false);
      setShowGoalModal(false);
      setShowBudgetModal(false);
      setShowRecurringModal(false);
      setShowImportWizard(false);
    }
  });

  const loadData = useCallback(async () => {
    try {
      const [
        loadedTransactions,
        loadedCurrency,
        loadedGoals,
        loadedBudgets,
        loadedRecurring,
        loadedAccounts,
        loadedInvestments,
        loadedDismissed
      ] = await Promise.all([
        storage.getTransactions(),
        storage.getCurrency(),
        storage.getGoals(),
        storage.getBudgets(),
        storage.getRecurring(),
        storage.getAccounts(),
        storage.getInvestments(),
        storage.getDismissedSubscriptions(),
      ]);

      setInvestments(loadedInvestments || []);
      setDismissedSubscriptions(loadedDismissed || []);

      const goalsWithDefaults = loadedGoals.map((goal: SavingsGoal) => ({
        ...goal,
        startDate: goal.startDate || new Date().toISOString(),
        isActive: goal.isActive !== undefined ? goal.isActive : true,
      }));

      // Auto-advance stale nextDate for active recurring items.
      // Also auto-resume items that were paused after an early payment
      // once the saved pausedUntil has been reached — this is what brings
      // the recurring back into the calendar / disponible-real automatically.
      const now = new Date();
      let recurringUpdated = false;
      const fixedRecurring = loadedRecurring.map((r: RecurringTransaction) => {
        // Phase 1: resume from auto-pause when pausedUntil has arrived
        let cur = r;
        if (cur.pausedUntil && new Date(cur.pausedUntil) <= now) {
          recurringUpdated = true;
          cur = { ...cur, isActive: true, pausedUntil: undefined };
        }
        // Phase 2: auto-advance if the resumed item's nextDate is in the past
        if (cur.isActive && new Date(cur.nextDate) < now) {
          recurringUpdated = true;
          return { ...cur, nextDate: toStableDateISO(getNextCharge(cur, now)) };
        }
        return cur;
      });
      if (recurringUpdated) {
        storage.saveRecurring(fixedRecurring).catch(() => {});
      }

      // One-shot owner backfill: existing transactions/recurring imported
      // before the owner field existed have it as undefined. Per user
      // preference, default those to "me" — the signed-in user. Items tagged
      // 'shared' or 'partner' explicitly are left alone. Guarded by a
      // localStorage
      // flag so we don't keep rewriting on every load.
      let txsAfterBackfill = loadedTransactions;
      let recAfterBackfill = fixedRecurring;
      const BACKFILL_FLAG = 'juntos:owner-backfill-me-v1';
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(BACKFILL_FLAG)) {
        let txTouched = 0;
        let recTouched = 0;
        txsAfterBackfill = loadedTransactions.map(t => {
          if (t.owner === undefined) { txTouched++; return { ...t, owner: 'me' as const }; }
          return t;
        });
        recAfterBackfill = fixedRecurring.map(r => {
          if (r.owner === undefined) { recTouched++; return { ...r, owner: 'me' as const }; }
          return r;
        });
        if (txTouched > 0) storage.saveTransactions(txsAfterBackfill).catch(() => {});
        if (recTouched > 0) storage.saveRecurring(recAfterBackfill).catch(() => {});
        localStorage.setItem(BACKFILL_FLAG, '1');
        if (txTouched + recTouched > 0) {
          // Best-effort notification — uses addToast if available later,
          // but at this point we want to keep loadData fast and quiet.
          console.info(`[owner-backfill] tagged ${txTouched} tx + ${recTouched} recurring as owner='me'`);
        }
      }

      // One-shot retro reconciliation: tries to match every un-linked
      // transaction against the active recurring items. Catches rows
      // imported before the matcher learned about price drift / bulk
      // detection. Guarded so it runs once per browser.
      let txsAfterRetro = txsAfterBackfill;
      let recAfterRetro = recAfterBackfill;
      // v2 — bumped after widening the match window to cover the previous
      // already-billed cycle. Re-runs once for users who already saw v1.
      const RETRO_FLAG = 'juntos:recurring-retro-match-v2';
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(RETRO_FLAG)) {
        const retro = reconcileUnlinkedTransactions(txsAfterBackfill, recAfterBackfill);
        if (retro.matches.length > 0) {
          txsAfterRetro = retro.taggedTransactions;
          recAfterRetro = retro.updatedRecurring;
          storage.saveTransactions(txsAfterRetro).catch(() => {});
          storage.saveRecurring(recAfterRetro).catch(() => {});
          const priceChanged = retro.matches.filter(m => m.priceChanged).length;
          console.info(`[retro-reconcile] linked ${retro.matches.length} tx to recurring (${priceChanged} con cambio de precio)`);
          // Defer the toast to the next tick so it shows after the UI mounts.
          setTimeout(() => {
            addToast({
              type: 'success',
              message: `${retro.matches.length} transacciones enlazadas a recurrentes${priceChanged > 0 ? ` (${priceChanged} con precio actualizado)` : ''}.`,
              duration: 8000,
            });
          }, 1500);
        }
        localStorage.setItem(RETRO_FLAG, '1');
      }

      // Retro re-route: every transaction currently on 'default' gets a
      // shot at being routed to a real user account based on description
      // prefix (Débito/Crédito/Yape) + last-4 hint. Runs once per browser.
      let txsAfterRoute = txsAfterRetro;
      const ROUTE_FLAG = 'juntos:account-route-v1';
      if (
        typeof localStorage !== 'undefined' &&
        !localStorage.getItem(ROUTE_FLAG) &&
        loadedAccounts.length > 0
      ) {
        const routed = routeExistingTransactions(txsAfterRetro, loadedAccounts);
        if (routed.reassignedCount > 0) {
          txsAfterRoute = routed.updated;
          storage.saveTransactions(txsAfterRoute).catch(() => {});
          const count = routed.reassignedCount;
          setTimeout(() => {
            addToast({
              type: 'success',
              message: `${count} transacciones reasignadas a sus cuentas reales (débito / crédito).`,
              duration: 8000,
            });
          }, 1800);
        }
        localStorage.setItem(ROUTE_FLAG, '1');
      }

      // One-shot cleanup of echo / duplicate cash-advance pairs.
      // BCP records a debit-side "Disposición Efectivo" and a credit-side
      // "Operación Crédito" for the same withdrawal, with empty/short
      // description on the credit side. Both look like separate movements
      // but represent the same cash. Drop them — the canonical entry comes
      // from the credit-card statement PDF (DISPOSICION CONSUMO row).
      let txsAfterEchoClean = txsAfterRoute;
      const ECHO_FLAG = 'juntos:echo-cleanup-v1';
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(ECHO_FLAG)) {
        const isEcho = (t: typeof txsAfterRoute[number]): boolean => {
          const d = (t.description || '').toLowerCase();
          // Disposición Efectivo / Yape Disposición de efectivo / Op-Crédito
          // bookkeeping rows.
          if (/disposici[oó]n\s*(?:de\s*)?efectivo/.test(d)) return true;
          if (/(yape|d[eé]bito)\s*-\s*disposici[oó]n/.test(d)) return true;
          if (/op-?cr[eé]dito|operaci[oó]n\s*cr[eé]dito\b/.test(d)) return true;
          return false;
        };
        const removedIds = txsAfterRoute.filter(isEcho).map(t => t.id);
        if (removedIds.length > 0) {
          const removedSet = new Set(removedIds);
          txsAfterEchoClean = txsAfterRoute.filter(t => !removedSet.has(t.id));
          storage.saveTransactions(txsAfterEchoClean).catch(() => {});
          const count = removedIds.length;
          setTimeout(() => {
            addToast({
              type: 'success',
              message: `${count} transacciones eco (Disposición Efectivo / Operación Crédito) eliminadas. El gasto real queda en el PDF de crédito.`,
              duration: 9000,
            });
          }, 2200);
        }
        localStorage.setItem(ECHO_FLAG, '1');
      }

      setTransactions(txsAfterEchoClean);
      setCurrency(loadedCurrency);
      setGoals(goalsWithDefaults);
      setBudgets(loadedBudgets);
      setRecurring(recAfterRetro);
      setAccounts(loadedAccounts);

      // storageAPI swallows fetch errors and returns empty shell so the UI
      // doesn't crash. Detect that silent-fail case via getLastLoadError()
      // and surface it to the user instead of showing fake empty data.
      const silentErr = getLastLoadError();
      if (silentErr) {
        setLoadError(true);
        // If the silent error is an auth one, offer Reconectar (interactive
        // login) instead of just Reintentar. Heuristic: phrase contains
        // "sesión" / "acceso" / "Microsoft" / "401". The reconnect runs on a
        // user gesture, which is the only reliable way to do loginRedirect on
        // mobile/PWA without browser popup blocking.
        const isAuthErr = /sesi(ó|o)n|acceso|Microsoft|401/i.test(silentErr);
        addToast({
          type: 'error',
          message: silentErr,
          duration: 14000,
          action: isAuthErr
            ? { label: 'Reconectar', onClick: () => reconnectInteractive().catch(() => {}) }
            : { label: 'Reintentar', onClick: () => loadData() },
        });
      } else {
        setLoadError(false);
      }
    } catch (error) {
      console.error('Error loading data from backend:', error);
      setLoadError(true);
      addToast({
        type: 'error',
        message: 'Error al cargar datos',
        duration: 8000,
        action: { label: 'Reintentar', onClick: () => loadData() },
      });
    }
  }, [addToast]);

  // Los datos son del hogar, no del usuario. Mientras no se sepa cual es, no se
  // piden: el servidor responderia 409 y saldria un error donde en realidad
  // falta un paso de alta.
  // Se pregunta SIEMPRE, no solo con sesion de Microsoft: quien entra por
  // Google no tiene cuenta en MSAL, y su identidad viaja en la cookie. El
  // servidor es el unico que sabe si reconoce a quien pregunta.
  useEffect(() => {
    let vigente = true;
    consultarHogar().then(e => { if (vigente) setHogar(e); });
    return () => { vigente = false; };
  }, [isAuthenticated]);

  // Load data only when authenticated and the household is known
  useEffect(() => {
    if (isAuthenticated && hogar?.hogarId) loadData();
  }, [loadData, isAuthenticated, hogar?.hogarId]);

  // Tipo de cambio: se refresca al entrar, como mucho cada 6 horas y solo si
  // no hay una tasa fijada a mano. Falla en silencio a proposito.
  useEffect(() => { if (isAuthenticated) refreshFxRates().catch(() => {}); }, [isAuthenticated]);

  // Auto-reload every day at 12:00 PM
  useEffect(() => {
    const scheduleNoonReload = () => {
      const now = new Date();
      const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

      // If noon already passed today, schedule for tomorrow
      if (now >= noon) {
        noon.setDate(noon.getDate() + 1);
      }

      const msUntilNoon = noon.getTime() - now.getTime();

      return setTimeout(() => {
        loadData();
        // After firing, schedule the next day's reload
        intervalRef = scheduleNoonReload();
      }, msUntilNoon);
    };

    let intervalRef = scheduleNoonReload();
    return () => clearTimeout(intervalRef);
  }, [loadData]);

  // Poll the lightweight version endpoint every few minutes so a save made
  // from another device (or another tab) shows up here without a manual
  // refresh or a hard reload. Only reloads when the version actually moved —
  // the endpoint is cheap, but re-fetching the whole dataset isn't.
  useEffect(() => {
    if (!isAuthenticated) return;
    let knownVersion: number | null = null;
    let cancelled = false;

    const checkVersion = async () => {
      const meta = await storage.getVersion();
      if (cancelled || !meta) return;
      if (knownVersion === null) {
        knownVersion = meta.version;
        return;
      }
      if (meta.version !== knownVersion) {
        knownVersion = meta.version;
        await loadData();
        addToast({
          type: 'info',
          message: 'Se actualizaron los datos desde otro dispositivo.',
          duration: 6000,
        });
      }
    };

    const interval = setInterval(checkVersion, 3 * 60 * 1000); // every 3 min
    checkVersion(); // establish baseline immediately
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, loadData, addToast]);

  // Auto-update to current month if user is on "current month" mode
  useEffect(() => {
    if (isCurrentMonth) {
      const interval = setInterval(() => {
        const now = new Date();
        if (!isSameMonth(selectedMonth, now)) {
          setSelectedMonth(now);
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [isCurrentMonth, selectedMonth]);

  /**
   * Devuelve true si ya mostro un aviso propio. Quien llama puede entonces
   * callarse: dos toasts seguidos por una sola accion se tapan entre ellos.
   */
  const handleAddTransaction = (newTransaction: Omit<Transaction, 'id'>): boolean => {
    if (editingTransaction) {
      const updatedTransactions = transactions.map(t =>
        t.id === editingTransaction.id
          ? { ...newTransaction, id: editingTransaction.id }
          : t
      );
      setTransactions(updatedTransactions);
      storage.saveTransactions(updatedTransactions);
      setEditingTransaction(null);
      return false;
    }

    let transaction: Transaction = {
      ...newTransaction,
      id: Date.now().toString(),
    };

    // Detect "I paid the recurring early" — match against active recurring
    // items by description / amount / date window. When matched:
    //   1) Link the tx via sourceRecurringId so calculations don't double-count.
    //   2) Advance the recurring's nextDate by one full period.
    //   3) PAUSE the recurring (isActive=false, pausedUntil=newNextDate) so it
    //      disappears from the calendar / disponible-real / projections during
    //      the period the user already paid for.
    //   4) loadData() auto-resumes (isActive=true) once pausedUntil arrives,
    //      so the next cycle fires normally with no user intervention.
    let pausedRecurring: RecurringTransaction | null = null;
    let snapshot:
      | { nextDate: string; isActive: boolean; pausedUntil?: string; amount: number; previousAmounts?: RecurringTransaction['previousAmounts'] }
      | null = null;
    const match = findMatchingRecurring(transaction, recurring);
    if (match) {
      transaction = { ...transaction, sourceRecurringId: match.recurring.id };
      snapshot = {
        nextDate: match.recurring.nextDate,
        isActive: match.recurring.isActive,
        pausedUntil: match.recurring.pausedUntil,
        amount: match.recurring.amount,
        previousAmounts: match.recurring.previousAmounts,
      };
      const newNextDate = match.isUpcoming
        ? advanceOnePeriod(match.recurring).toISOString()
        : match.recurring.nextDate;
      const updatedRecurring = recurring.map(r => {
        if (r.id !== match.recurring.id) return r;
        const next = { ...r } as RecurringTransaction;
        if (match.isUpcoming) {
          next.nextDate = newNextDate;
          next.isActive = false;
          next.pausedUntil = newNextDate;
        }
        if (match.priceChanged) {
          next.amount = transaction.amount;
          next.previousAmounts = [
            ...(r.previousAmounts || []),
            { date: transaction.date, amount: match.oldAmount },
          ];
        }
        return next;
      });
      setRecurring(updatedRecurring);
      storage.saveRecurring(updatedRecurring).catch(() => {});
      pausedRecurring = updatedRecurring.find(r => r.id === match.recurring.id) || null;
    }

    const updatedTransactions = [...transactions, transaction];
    setTransactions(updatedTransactions);
    storage.saveTransactions(updatedTransactions);

    if (pausedRecurring && snapshot) {
      const newDateLabel = new Date(pausedRecurring.nextDate)
        .toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
      const priceChanged = match?.priceChanged === true;
      const priceNote = priceChanged
        ? ` Precio actualizado: S/ ${match!.oldAmount.toFixed(2)} → S/ ${transaction.amount.toFixed(2)}.`
        : '';
      addToast({
        type: 'success',
        message: `Pago de "${pausedRecurring.description}" detectado. Pausado hasta el ${newDateLabel}.${priceNote} Se reanuda solo.`,
        duration: 10000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            const restoredRecurring = recurring.map(r =>
              r.id === pausedRecurring!.id
                ? {
                    ...r,
                    nextDate: snapshot!.nextDate,
                    isActive: snapshot!.isActive,
                    pausedUntil: snapshot!.pausedUntil,
                    amount: snapshot!.amount,
                    previousAmounts: snapshot!.previousAmounts,
                  }
                : r
            );
            setRecurring(restoredRecurring);
            storage.saveRecurring(restoredRecurring).catch(() => {});
            const restoredTx = updatedTransactions.map(t =>
              t.id === transaction.id ? { ...t, sourceRecurringId: undefined } : t
            );
            setTransactions(restoredTx);
            storage.saveTransactions(restoredTx).catch(() => {});
          },
        },
      });
      return true;
    }

    return false;
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedTransactions = transactions.filter(t => t.id !== id);
    setTransactions(updatedTransactions);
    storage.saveTransactions(updatedTransactions);
  };

  const handleBulkDeleteTransactions = (ids: string[]) => {
    const idSet = new Set(ids);
    const updatedTransactions = transactions.filter(t => !idSet.has(t.id));
    setTransactions(updatedTransactions);
    storage.saveTransactions(updatedTransactions);
  };

  const handleInlineUpdateTransaction = (tx: Transaction) => {
    const existing = transactions.find(t => t.id === tx.id);
    if (existing) {
      // Update in-place
      const updatedTransactions = transactions.map(t => t.id === tx.id ? tx : t);
      setTransactions(updatedTransactions);
      storage.saveTransactions(updatedTransactions);
    } else {
      // Restore (undo delete)
      const updatedTransactions = [...transactions, tx];
      setTransactions(updatedTransactions);
      storage.saveTransactions(updatedTransactions);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const handleImport = (importedTransactions: Transaction[]) => {
    // Bulk early-pay match: each new tx is checked against active
    // recurring items; matches link sourceRecurringId AND auto-pause the
    // recurring until its next cycle.
    const { taggedTransactions, updatedRecurring, matches } =
      applyEarlyPaymentMatchesBulk(importedTransactions, recurring);

    const updatedTransactions = [...transactions, ...taggedTransactions];
    setTransactions(updatedTransactions);
    storage.saveTransactions(updatedTransactions);

    if (matches.length > 0) {
      setRecurring(updatedRecurring);
      storage.saveRecurring(updatedRecurring).catch(() => {});
      const priceChanged = matches.filter(m => m.priceChanged).length;
      const priceNote = priceChanged > 0 ? ` ${priceChanged} con cambio de precio.` : '';
      addToast({
        type: 'success',
        message: `${matches.length} pago${matches.length === 1 ? '' : 's'} adelantado${matches.length === 1 ? '' : 's'} detectado${matches.length === 1 ? '' : 's'}.${priceNote} Recurrentes pausados hasta el próximo cobro.`,
        duration: 9000,
      });
    }
  };

  // ─── Import BCP "Estado de Cuenta" PDFs ────────────────────────
  // Triggered by a file picker. Accepts multiple PDFs (typically one per
  // cycle). For each, extracts the text, parses the BCP statement, routes
  // every row to the user's matching credit-card account by last-4, and
  // hands the merged list to handleImport (which dedups + matches recurring).
  // Unified entry point: one "Importar" button. Detects file type per file:
  //   • PDF with BCP statement markers → rich BCP parser (statement metadata
  //     + account routing by last-4 + cuotas)
  //   • CSV / Excel / non-BCP PDF      → opens the generic ImportWizard
  // Multi-select is supported for batch BCP imports (one per cycle).
  const handleImportBcpPdf = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.csv,.xlsx,.xls,.txt';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;

      // Split: BCP PDFs go inline, everything else falls back to the wizard.
      const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name));
      const nonPdfFiles = files.filter((f) => !/\.pdf$/i.test(f.name));

      // Quick text extraction so we can sniff BCP markers before committing
      // to a heavy parser path.
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;
      const extractText = async (f: File): Promise<string> => {
        const buf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
        }
        return text;
      };
      const isBcpStatement = (text: string): boolean =>
        /Estado\s+de\s+Cuenta\s+Tarjeta\s+Visa/i.test(text) ||
        /Estado\s+de\s+Cuenta\s+de\s+Ahorros|Cuenta\s+Digital/i.test(text) ||
        /Ciclo\s+de\s+Facturaci/i.test(text);

      const bcpPdfs: { file: File; text: string }[] = [];
      const otherPdfs: File[] = [];
      for (const f of pdfFiles) {
        try {
          const text = await extractText(f);
          if (isBcpStatement(text)) {
            bcpPdfs.push({ file: f, text });
          } else {
            otherPdfs.push(f);
          }
        } catch {
          otherPdfs.push(f);
        }
      }

      // Non-BCP files (CSV/Excel/other PDFs) → open wizard with the first one
      // so the user gets the same UX as the old "Importar" button.
      const wizardFiles = [...nonPdfFiles, ...otherPdfs];
      if (wizardFiles.length > 0) {
        setPendingImportFile(wizardFiles[0]);
        setShowImportWizard(true);
        if (wizardFiles.length > 1) {
          addToast({
            type: 'info',
            message: `Procesando "${wizardFiles[0].name}". Importá el resto uno a uno.`,
            duration: 6000,
          });
        }
      }

      if (bcpPdfs.length === 0) return;

      addToast({
        type: 'info',
        message: `Leyendo ${bcpPdfs.length} estado${bcpPdfs.length === 1 ? '' : 's'} de cuenta BCP…`,
        duration: 4000,
      });
      try {
        const [{ readPdfFile }, { parseBcpStatementText }] = await Promise.all([
          import('./utils/pdfImporter'),
          import('./utils/bcpPdfParser'),
        ]);
        const all: Transaction[] = [];
        const summary: string[] = [];
        for (const { file: f, text } of bcpPdfs) {
          const r = parseBcpStatementText(text);
          // Route to the matching user account:
          //   - credit statement → match by lastFourDigits (e.g. 9164)
          //   - debit statement  → first debit account
          let acct;
          if (r.kind === 'debit') {
            acct = accounts.find((a) => a.type === 'debit');
          } else {
            acct = r.cardLastFour
              ? accounts.find((a) => a.lastFourDigits === r.cardLastFour)
              : undefined;
          }
          for (const tx of r.transactions) {
            all.push({ ...tx, accountId: acct?.id || 'default' });
          }
          // Save credit statement snapshot (saldo, pago mínimo, TEA, cuotas)
          // to the matched credit account so CreditCardView can read real
          // PDF-derived numbers instead of falling back to defaults.
          if (r.kind === 'credit' && r.statement && acct) {
            const stmt = r.statement;
            const targetId = acct.id;
            setAccounts(prev =>
              prev.map(a => {
                if (a.id !== targetId) return a;
                // Snapshot the previous cycle into history before
                // overwriting (same logic as the manual editor path).
                const old = a.latestStatement;
                const history = [...(a.statementHistory || [])];
                if (old && old.cycleEnd && old.cycleEnd !== stmt.cycleEnd) {
                  const fx = getFxRates();
                  const limit = a.creditLimit || 0;
                  const totalPEN = (old.saldoTotalPEN || 0) + (old.saldoTotalUSD || 0) * fx.USD;
                  const utilization = limit > 0 ? totalPEN / limit : undefined;
                  const entry: CreditStatementHistoryEntry = {
                    cycleEnd: old.cycleEnd,
                    saldoTotalPEN: old.saldoTotalPEN,
                    saldoTotalUSD: old.saldoTotalUSD,
                    pagoTotalPEN: old.pagoTotalPEN,
                    pagoTotalUSD: old.pagoTotalUSD,
                    pagoMinimoPEN: old.pagoMinimoPEN,
                    pagoMinimoUSD: old.pagoMinimoUSD,
                    utilization,
                    teaPEN: old.teaPEN,
                    teaUSD: old.teaUSD,
                    fxRateUSD: fx.USD,
                    recordedAt: new Date().toISOString(),
                  };
                  const idx = history.findIndex(h => h.cycleEnd === entry.cycleEnd);
                  if (idx >= 0) history[idx] = entry;
                  else history.push(entry);
                  history.sort((x, y) => x.cycleEnd.localeCompare(y.cycleEnd));
                  while (history.length > 12) history.shift();
                }
                return { ...a, latestStatement: stmt, statementHistory: history };
              })
            );
          }
          const tag =
            r.kind === 'debit'
              ? `débito ${r.accountCode ? r.accountCode.slice(-4) : ''}`
              : r.cardLastFour ? `crédito ${r.cardLastFour}` : 'crédito';
          summary.push(`${f.name}: ${r.transactions.length} mov (${tag.trim()})`);
          void readPdfFile; // imported for type-side; not invoked
        }
        if (all.length === 0) {
          addToast({
            type: 'error',
            message: 'No se detectaron movimientos en el(los) PDF(s).',
            duration: 8000,
          });
          return;
        }
        // handleImport handles dedup + early-pay matching + recurring update.
        handleImport(all);
        addToast({
          type: 'success',
          message: `Importadas ${all.length} transacciones desde PDF: ${summary.join(' · ')}.`,
          duration: 10000,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast({
          type: 'error',
          message: `Error leyendo PDF BCP: ${msg}`,
          duration: 10000,
        });
      }
    };
    input.click();
  };

  // Goals handlers
  const handleAddGoal = (newGoal: Omit<SavingsGoal, 'id'>) => {
    if (editingGoal) {
      const updatedGoals = goals.map((g) =>
        g.id === editingGoal.id ? { ...newGoal, id: editingGoal.id } : g
      );
      setGoals(updatedGoals);
      storage.saveGoals(updatedGoals);
      setEditingGoal(null);
    } else {
      const goal: SavingsGoal = { ...newGoal, id: Date.now().toString() };
      const updatedGoals = [...goals, goal];
      setGoals(updatedGoals);
      storage.saveGoals(updatedGoals);
    }
  };

  const handleEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setShowGoalModal(true);
  };

  const handleDeleteGoal = (id: string) => {
    const deleted = goals.find(g => g.id === id);
    const updatedGoals = goals.filter((g) => g.id !== id);
    setGoals(updatedGoals);
    storage.saveGoals(updatedGoals);
    if (deleted) {
      addToast({
        type: 'info', message: 'Meta eliminada', duration: 6000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            setGoals(prev => [...prev, deleted]);
            storage.saveGoals([...updatedGoals, deleted]);
          },
        },
      });
    }
  };

  const handleContributeToGoal = (goalId: string, amount: number, note?: string) => {
    const updatedGoals = goals.map((g) => {
      if (g.id !== goalId) return g;
      const contribution = { date: new Date().toISOString(), amount, note };
      return {
        ...g,
        currentAmount: g.currentAmount + amount,
        contributions: [...(g.contributions || []), contribution],
      };
    });
    setGoals(updatedGoals);
    storage.saveGoals(updatedGoals);
  };

  const handleToggleGoalActive = (id: string) => {
    const updatedGoals = goals.map((g) =>
      g.id === id ? { ...g, isActive: !g.isActive } : g
    );
    setGoals(updatedGoals);
    storage.saveGoals(updatedGoals);
  };

  // Budgets handlers
  const handleAddBudget = (newBudget: Omit<Budget, 'id' | 'spent'>) => {
    if (editingBudget) {
      const updatedBudgets = budgets.map((b) =>
        b.id === editingBudget.id ? { ...newBudget, id: editingBudget.id, spent: editingBudget.spent } : b
      );
      setBudgets(updatedBudgets);
      storage.saveBudgets(updatedBudgets);
      setEditingBudget(null);
    } else {
      const budget: Budget = { ...newBudget, id: Date.now().toString(), spent: 0 };
      const updatedBudgets = [...budgets, budget];
      setBudgets(updatedBudgets);
      storage.saveBudgets(updatedBudgets);
    }
  };

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setShowBudgetModal(true);
  };

  const handleDeleteBudget = (id: string) => {
    const deleted = budgets.find(b => b.id === id);
    const updatedBudgets = budgets.filter((b) => b.id !== id);
    setBudgets(updatedBudgets);
    storage.saveBudgets(updatedBudgets);
    if (deleted) {
      addToast({
        type: 'info', message: 'Presupuesto eliminado', duration: 6000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            setBudgets(prev => [...prev, deleted]);
            storage.saveBudgets([...updatedBudgets, deleted]);
          },
        },
      });
    }
  };

  // Account handlers
  const handleSaveAccount = (account: Account) => {
    if (editingAccount) {
      const updated = accounts.map(a => a.id === editingAccount.id ? { ...account, id: editingAccount.id } : a);
      setAccounts(updated);
      storage.saveAccounts(updated);
      setEditingAccount(null);
    } else {
      const newAccount = { ...account, id: Date.now().toString() };
      const updated = [...accounts, newAccount];
      setAccounts(updated);
      storage.saveAccounts(updated);
    }
  };

  const handleDeleteAccount = (id: string) => {
    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    storage.saveAccounts(updated);
    addToast({ type: 'info', message: 'Cuenta eliminada' });
  };

  // Recurring transactions handlers
  const handleAddRecurring = (newRecurring: Omit<RecurringTransaction, 'id'>) => {
    if (editingRecurring) {
      // Track price history if amount changed
      const prevAmounts = editingRecurring.previousAmounts || [];
      const amountChanged = newRecurring.amount !== editingRecurring.amount;
      const updatedPrevAmounts = amountChanged
        ? [...prevAmounts, { date: new Date().toISOString(), amount: editingRecurring.amount }]
        : prevAmounts;

      const updatedRecurring = recurring.map((r) =>
        r.id === editingRecurring.id
          ? { ...newRecurring, id: editingRecurring.id, previousAmounts: updatedPrevAmounts }
          : r
      );
      setRecurring(updatedRecurring);
      storage.saveRecurring(updatedRecurring);
      setEditingRecurring(null);
    } else {
      const recurringTx: RecurringTransaction = { ...newRecurring, id: Date.now().toString() };
      const updatedRecurring = [...recurring, recurringTx];
      setRecurring(updatedRecurring);
      storage.saveRecurring(updatedRecurring);
    }
  };

  const handleEditRecurring = (rec: RecurringTransaction) => {
    setEditingRecurring(rec);
    setShowRecurringModal(true);
  };

  const handleDeleteRecurring = (id: string) => {
    const deleted = recurring.find(r => r.id === id);
    const updatedRecurring = recurring.filter((r) => r.id !== id);
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
    if (deleted) {
      addToast({
        type: 'info', message: 'Recurrente eliminado', duration: 6000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            setRecurring(prev => [...prev, deleted]);
            storage.saveRecurring([...updatedRecurring, deleted]);
          },
        },
      });
    }
  };

  const handleToggleRecurringActive = (id: string) => {
    const previous = [...recurring];
    const updatedRecurring = recurring.map((r) =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    );
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring).catch(() => {
      setRecurring(previous);
      addToast({ type: 'error', message: 'Error al guardar cambio', duration: 4000 });
    });
  };

  const handleDuplicateRecurring = (rec: RecurringTransaction) => {
    const duplicate: RecurringTransaction = {
      ...rec,
      id: Date.now().toString(),
      description: `${rec.description} (copia)`,
      previousAmounts: [],
      tags: [...(rec.tags || [])],
    };
    const updatedRecurring = [...recurring, duplicate];
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
  };

  const handleBulkToggleRecurring = (ids: string[]) => {
    const previous = [...recurring];
    const updatedRecurring = recurring.map((r) =>
      ids.includes(r.id) ? { ...r, isActive: !r.isActive } : r
    );
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring).catch(() => {
      setRecurring(previous);
      addToast({ type: 'error', message: 'Error al guardar cambios', duration: 4000 });
    });
  };

  const handleBulkDeleteRecurring = (ids: string[]) => {
    const idSet = new Set(ids);
    const updatedRecurring = recurring.filter((r) => !idSet.has(r.id));
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
  };

  const handleBulkUpdateCategoryRecurring = (ids: string[], category: string) => {
    const updatedRecurring = recurring.map((r) =>
      ids.includes(r.id) ? { ...r, category } : r
    );
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
  };

  const handleUpdateRecurringTags = (id: string, tags: string[]) => {
    const updatedRecurring = recurring.map((r) =>
      r.id === id ? { ...r, tags } : r
    );
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
  };

  const handleUpdateRecurringNotes = (id: string, notes: string) => {
    const updatedRecurring = recurring.map((r) =>
      r.id === id ? { ...r, notes } : r
    );
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
  };

  // Create recurring from detected subscription
  const handleSaveInvestment = (inv: Investment) => {
    const exists = investments.some(i => i.id === inv.id);
    const updated = exists
      ? investments.map(i => (i.id === inv.id ? inv : i))
      : [...investments, inv];
    setInvestments(updated);
    storage.saveInvestments(updated).catch(() => {
      addToast({ type: 'error', message: 'No se pudo guardar la inversion' });
    });
  };

  const handleDeleteInvestment = (id: string) => {
    const updated = investments.filter(i => i.id !== id);
    setInvestments(updated);
    storage.saveInvestments(updated).catch(() => {
      addToast({ type: 'error', message: 'No se pudo eliminar la inversion' });
    });
  };

  const handleDismissedSubscriptionsChange = (ids: string[]) => {
    setDismissedSubscriptions(ids);
    storage.saveDismissedSubscriptions(ids).catch(() => {
      addToast({ type: 'error', message: 'No se pudo guardar el descarte' });
    });
  };

  const handleCreateRecurringFromSubscription = (sub: DetectedSubscription) => {
    // Map quarterly → monthly with adjusted amount; RecurringTransaction doesn't support quarterly
    const recurringFreq: RecurringTransaction['frequency'] =
      sub.frequency === 'quarterly' ? 'monthly' : sub.frequency;
    const recurringAmount =
      sub.frequency === 'quarterly' ? sub.estimatedAmount / 3 : sub.estimatedAmount;

    const newRecurring: RecurringTransaction = {
      id: Date.now().toString(),
      type: 'expense',
      amount: recurringAmount,
      category: sub.category,
      description: sub.normalizedName,
      frequency: recurringFreq,
      // nextExpectedDate viene como 'yyyy-MM-dd'; anclarlo evita que se
      // guarde como medianoche UTC y se muestre el día anterior.
      nextDate: toStableDateISO(sub.nextExpectedDate),
      isActive: true,
    };
    const updatedRecurring = [...recurring, newRecurring];
    setRecurring(updatedRecurring);
    storage.saveRecurring(updatedRecurring);
  };

  // Month selector handlers
  const handleMonthChange = (newMonth: Date) => {
    setSelectedMonth(newMonth);
    const now = new Date();
    setIsCurrentMonth(isSameMonth(newMonth, now));
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now);
    setIsCurrentMonth(true);
  };

  // Memoize expensive calculations
  const stats = useMemo(
    () => calculateStatistics(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const previousStats = useMemo(
    () => calculatePreviousMonthStats(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const monthlyPlan = useMemo(
    () => calculateMonthlyPlan(recurring, budgets, goals, transactions, selectedMonth),
    [recurring, budgets, goals, transactions, selectedMonth]
  );

  // Handle export
  const handleExport = () => {
    const exportBtn = document.querySelector('.import-export-btn') as HTMLButtonElement;
    if (exportBtn) exportBtn.click();
  };

  const isMobile = useIsMobile();

  // Shared view content rendered by both desktop and mobile shells
  const viewContent = (
    <Suspense fallback={<LoadingFallback />}>
      {/* En movil, Inicio es la vista de tres secciones del handoff; en
          escritorio sigue siendo el Dashboard completo. */}
      {currentView === 'dashboard' && isMobile && (
        <MobileHomeView
          transactions={transactions}
          recurring={recurring}
          currency={currency}
          section={homeSection}
          onSectionChange={setHomeSection}
          onGoSubscriptions={() => setCurrentView('subscriptions')}
          onAssignAuthors={() => setCurrentView('transactions')}
          onNavigate={setCurrentView}
          onImport={handleImportBcpPdf}
        />
      )}

      {currentView === 'dashboard' && !isMobile && (
        <Dashboard
          stats={stats}
          previousStats={previousStats}
          transactions={transactions}
          goals={goals}
          accounts={accounts}
          currency={currency}
          monthlyPlan={monthlyPlan}
          recurring={recurring}
          selectedMonth={selectedMonth}
          budgets={budgets}
          onRefresh={loadData}
          onAddAccount={() => { setEditingAccount(null); setShowAccountModal(true); }}
          onEditAccount={(account) => { setEditingAccount(account); setShowAccountModal(true); }}
          onQuickReconcile={() => setShowQuickReconcile(true)}
          onDeleteAccount={handleDeleteAccount}
          onAdjustBalance={(accountId, newBalance) => {
            const target = accounts.find(a => a.id === accountId);
            if (!target) return;
            const oldBalance = target.balance;
            const diff = newBalance - oldBalance;
            const updated = accounts.map(a =>
              a.id === accountId
                ? { ...a, balance: newBalance, balanceUpdatedAt: new Date().toISOString() }
                : a
            );
            setAccounts(updated);
            storage.saveAccounts(updated);

            // If the manual ajuste changed the balance meaningfully, offer
            // to record the diff as a transaction so cashflow / stats stay
            // honest. Diff < 0 on a debit = gasto que no se capturó;
            // diff > 0 = ingreso o devolución no registrado. For credit
            // accounts the sign is inverted (balance grows on expense).
            const absDiff = Math.abs(diff);
            if (absDiff < 0.5) {
              addToast({ type: 'success', message: 'Saldo actualizado.', duration: 2500 });
              return;
            }

            const isDebit = target.type !== 'credit';
            // On a debit account, balance going DOWN = expense.
            // On a credit account, balance going UP = expense (more debt).
            const isExpense = isDebit ? diff < 0 : diff > 0;
            const txAmount = absDiff;

            // Build an adjustment tx; the only difference between "today" and
            // "histórico" is the date. Historical = last day of previous
            // month → doesn't inflate the current cycle's variable spent.
            const createAdjustment = (historical: boolean) => {
              const today = new Date();
              const date = historical
                ? new Date(today.getFullYear(), today.getMonth(), 0)  // last day of prev month
                : today;
              const adjustmentTx: Transaction = {
                id: `adj_${Date.now()}`,
                type: isExpense ? 'expense' : 'income',
                amount: txAmount,
                category: isExpense ? 'other-expense' : 'other-income',
                description: `Ajuste de saldo (${target.name}), diferencia con BCP${historical ? ' [histórico]' : ''}`,
                date: date.toISOString().slice(0, 10),
                accountId: target.id,
                currency: 'PEN',
                owner: getMyOwnerRole(),
              };
              const nextTxs = [...transactions, adjustmentTx];
              setTransactions(nextTxs);
              storage.saveTransactions(nextTxs);
              addToast({
                type: 'success',
                message: historical
                  ? `Ajuste histórico registrado en mes anterior (no afecta Disponible Real de este mes).`
                  : `Transacción de ajuste registrada (${isExpense ? 'gasto' : 'ingreso'} S/ ${txAmount.toFixed(2)} este mes).`,
                duration: 4000,
              });
            };

            const amountLabel = `S/ ${txAmount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            addToast({
              type: 'success',
              message: `Saldo de ${target.name} actualizado · diferencia ${amountLabel}. ¿Cómo registrarla?`,
              duration: 14000,
              action: {
                label: `Gasto de hoy`,
                onClick: () => createAdjustment(false),
              },
              actionSecondary: {
                label: `Histórico (mes anterior)`,
                onClick: () => createAdjustment(true),
              },
            });
          }}
          onCreateGoal={() => { setEditingGoal(null); setShowGoalModal(true); }}
        />
      )}

      {currentView === 'transactions' && isMobile && (
        <MobileTransactionsView
          transactions={transactions}
          recurring={recurring}
          currency={currency}
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onImport={handleImportBcpPdf}
        />
      )}

      {currentView === 'transactions' && !isMobile && (
        <TransactionList
          transactions={transactions}
          currency={currency}
          onDelete={handleDeleteTransaction}
          onEdit={handleEditTransaction}
          onAddNew={openTransactionModal}
          onImport={() => setShowImportWizard(true)}
          onBulkDelete={handleBulkDeleteTransactions}
          onInlineUpdate={handleInlineUpdateTransaction}
        />
      )}

      {currentView === 'goals' && (
        <SavingsGoals
          goals={goals}
          onAddGoal={() => {
            setEditingGoal(null);
            setShowGoalModal(true);
          }}
          onEditGoal={handleEditGoal}
          onDeleteGoal={handleDeleteGoal}
          onContribute={handleContributeToGoal}
          onToggleGoalActive={handleToggleGoalActive}
          currency={currency}
        />
      )}

      {currentView === 'budgets' && (
        <Budgets
          budgets={budgets}
          transactions={transactions}
          onAddBudget={() => {
            setEditingBudget(null);
            setShowBudgetModal(true);
          }}
          onEditBudget={handleEditBudget}
          onDeleteBudget={handleDeleteBudget}
          onSuggestBudget={(categoryId, amount) => {
            handleAddBudget({ categoryId, amount, period: 'monthly', currency: currency as any });
          }}
          currency={currency}
        />
      )}

      {currentView === 'recurring' && (
        <RecurringTransactions
          recurring={recurring}
          onAddRecurring={() => {
            setEditingRecurring(null);
            setShowRecurringModal(true);
          }}
          onEditRecurring={handleEditRecurring}
          onDeleteRecurring={handleDeleteRecurring}
          onToggleActive={handleToggleRecurringActive}
          currency={currency}
          onDuplicateRecurring={handleDuplicateRecurring}
          onBulkToggleRecurring={handleBulkToggleRecurring}
          onBulkDeleteRecurring={handleBulkDeleteRecurring}
          onBulkUpdateCategoryRecurring={handleBulkUpdateCategoryRecurring}
          onUpdateTags={handleUpdateRecurringTags}
          onUpdateNotes={handleUpdateRecurringNotes}
        />
      )}

      {currentView === 'subscriptions' && (
        <SubscriptionsView
          transactions={transactions}
          recurring={recurring}
          currency={currency}
          dismissedIds={dismissedSubscriptions}
          onDismissedChange={handleDismissedSubscriptionsChange}
          onCreateRecurring={handleCreateRecurringFromSubscription}
        />
      )}

      {currentView === 'savings' && (
        <SavingsCenterView
          subscriptions={detectedSubscriptions}
          currency={currency}
        />
      )}

      {currentView === 'networth' && (
        <NetWorthView
          accounts={accounts}
          investments={investments}
          currency={currency}
          onSaveInvestment={handleSaveInvestment}
          onDeleteInvestment={handleDeleteInvestment}
        />
      )}

      {currentView === 'settings' && (
        <MobileSettingsView
          correoSesion={hogar?.correo}
          onViewChange={setCurrentView}
          onExport={handleExport}
          onOpenSettings={() => setShowCategoryManager(true)}
          onOpenNotifications={() => setShowNotificationSettings(true)}
          onOpenOwnerLabels={foco => setShowOwnerLabels(foco || 'pareja')}
        />
      )}

      {currentView === 'recap' && (
        <YearRecap
          transactions={transactions}
          goals={goals}
          currency={currency}
        />
      )}

      {currentView === 'credit' && (
        <CreditCardView
          accounts={accounts}
          transactions={transactions}
          recurring={recurring}
          currency={currency}
          onUpdateStatement={(acctId, statement) => {
            const updated = accounts.map(a => {
              if (a.id !== acctId) return a;
              // Persist a snapshot of the OLD statement into the history
              // when its cycleEnd is meaningful and different from the
              // incoming one — so we can chart utilization / interest
              // over time without manual user effort.
              const old = a.latestStatement;
              const history = [...(a.statementHistory || [])];
              if (old && old.cycleEnd && old.cycleEnd !== statement.cycleEnd) {
                const fx = getFxRates();
                const limit = a.creditLimit || 0;
                const totalPEN = (old.saldoTotalPEN || 0) + (old.saldoTotalUSD || 0) * fx.USD;
                const utilization = limit > 0 ? totalPEN / limit : undefined;
                const entry: CreditStatementHistoryEntry = {
                  cycleEnd: old.cycleEnd,
                  saldoTotalPEN: old.saldoTotalPEN,
                  saldoTotalUSD: old.saldoTotalUSD,
                  pagoTotalPEN: old.pagoTotalPEN,
                  pagoTotalUSD: old.pagoTotalUSD,
                  pagoMinimoPEN: old.pagoMinimoPEN,
                  pagoMinimoUSD: old.pagoMinimoUSD,
                  utilization,
                  teaPEN: old.teaPEN,
                  teaUSD: old.teaUSD,
                  fxRateUSD: fx.USD,
                  recordedAt: new Date().toISOString(),
                };
                // Replace existing entry for the same cycleEnd if present.
                const existingIdx = history.findIndex(h => h.cycleEnd === entry.cycleEnd);
                if (existingIdx >= 0) history[existingIdx] = entry;
                else history.push(entry);
                // Cap at 12 most recent.
                history.sort((x, y) => x.cycleEnd.localeCompare(y.cycleEnd));
                while (history.length > 12) history.shift();
              }
              return { ...a, latestStatement: statement, statementHistory: history };
            });
            setAccounts(updated);
            storage.saveAccounts(updated);
            addToast({ type: 'success', message: 'Datos del ciclo actualizados.', duration: 3500 });
          }}
        />
      )}
    </Suspense>
  );

  // Todavia preguntando quien es. Un parpadeo del login a quien ya tiene sesion
  // seria peor que esperar un momento en blanco.
  if (hogar === null) {
    return <div className="app-cargando" aria-busy="true" />;
  }

  // Ni token de Microsoft ni cookie de Google: no hay a quien enseñarle nada.
  if (!isAuthenticated && !hogar.autenticado) {
    return <LoginPage />;
  }

  if (!hogar.hogarId) {
    return (
      <AltaHogar
        estado={hogar}
        // Recarga completa a proposito: storageAPI cachea los datos en el
        // modulo, y tras estrenar o unirse a un hogar ese cache es de otro.
        onListo={() => window.location.reload()}
      />
    );
  }

  return (
      <div className={`app-layout ${isMobile ? 'is-mobile' : ''}`}>
        {isMobile ? (
          <AppShellMobile
            currentView={currentView}
            onViewChange={setCurrentView}
            title={viewTitles[currentView]}
            showMonthSelector={currentView === 'dashboard'}
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
            isCurrentMonth={isCurrentMonth}
            onResetToCurrentMonth={handleResetToCurrentMonth}
            onNewTransaction={() => setShowQuickExpense(true)}
            onScanReceipt={() => {
              setEditingTransaction(null);
              setOpenReceiptMode(true);
              setShowModal(true);
            }}
            onNewGoal={() => {
              setEditingGoal(null);
              setShowGoalModal(true);
            }}
            onNewBudget={() => {
              setEditingBudget(null);
              setShowBudgetModal(true);
            }}
            onExport={handleExport}
            onOpenSettings={() => setShowCategoryManager(true)}
            onOpenNotifications={() => setShowNotificationSettings(true)}
            onOpenOwnerLabels={() => setShowOwnerLabels('pareja')}
            onImportBcpPdf={handleImportBcpPdf}
          >
            {viewContent}
            {currentView === 'dashboard' && (
              <div style={{ display: 'none' }}>
                <ImportExportButtons
                  transactions={transactions}
                  onImport={handleImport}
                  onOpenSmartImport={() => setShowImportWizard(true)}
                />
              </div>
            )}
          </AppShellMobile>
        ) : (
          <>
            <Sidebar
              currentView={currentView}
              onViewChange={setCurrentView}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              isMobileOpen={mobileMenuOpen}
              onMobileClose={() => setMobileMenuOpen(false)}
              onOpenImport={() => setShowImportWizard(true)}
              onOpenSettings={() => setShowCategoryManager(true)}
            onOpenNotifications={() => setShowNotificationSettings(true)}
              onOpenOwnerLabels={() => setShowOwnerLabels('pareja')}
              onImportBcpPdf={handleImportBcpPdf}
            />

            <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
              <Header
                correoSesion={hogar?.correo}
                title={viewTitles[currentView]}
                periodFilter={periodFilter}
                onPeriodChange={setPeriodFilter}
                onNewTransaction={() => setShowQuickExpense(true)}
                onExport={handleExport}
                showPeriodFilter={currentView === 'dashboard'}
                showMonthSelector={currentView === 'dashboard'}
                selectedMonth={selectedMonth}
                onMonthChange={handleMonthChange}
                isCurrentMonth={isCurrentMonth}
                onResetToCurrentMonth={handleResetToCurrentMonth}
                onMobileMenuOpen={() => setMobileMenuOpen(true)}
              />

              <main className="container">
                {viewContent}
                {currentView === 'dashboard' && (
                  <div style={{ display: 'none' }}>
                    <ImportExportButtons
                      transactions={transactions}
                      onImport={handleImport}
                      onOpenSmartImport={() => setShowImportWizard(true)}
                    />
                  </div>
                )}
              </main>

            </div>
          </>
        )}

        {showModal && (
          <TransactionModal
            onClose={() => {
              setShowModal(false);
              setEditingTransaction(null);
              setOpenReceiptMode(false);
            }}
            onSave={handleAddTransaction}
            editingTransaction={editingTransaction}
            openReceiptMode={openReceiptMode}
          />
        )}

        {showGoalModal && (
          <GoalModal
            onClose={() => {
              setShowGoalModal(false);
              setEditingGoal(null);
            }}
            onSave={handleAddGoal}
            editingGoal={editingGoal}
          />
        )}

        {showBudgetModal && (
          <BudgetModal
            onClose={() => {
              setShowBudgetModal(false);
              setEditingBudget(null);
            }}
            onSave={handleAddBudget}
            editingBudget={editingBudget}
            existingBudgets={budgets}
          />
        )}

        {showAccountModal && (
          <AccountModal
            onClose={() => { setShowAccountModal(false); setEditingAccount(null); }}
            onSave={handleSaveAccount}
            editingAccount={editingAccount}
          />
        )}

        {showQuickReconcile && (
          <Suspense fallback={null}>
            <QuickReconcileModal
              accounts={accounts}
              onClose={() => setShowQuickReconcile(false)}
              onApply={(rows) => {
                // 1) Update all account balances + timestamps in one batch.
                const stamp = new Date().toISOString();
                const updatedAccounts = accounts.map(a => {
                  const row = rows.find(r => r.accountId === a.id);
                  return row
                    ? { ...a, balance: row.realBalance, balanceUpdatedAt: stamp }
                    : a;
                });
                setAccounts(updatedAccounts);
                storage.saveAccounts(updatedAccounts);

                // 2) Create one adjustment tx per row (gasto/ingreso/histórico).
                const today = new Date();
                const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                const newTxs: Transaction[] = rows.map((r, i) => {
                  const target = accounts.find(a => a.id === r.accountId)!;
                  const isExpense = r.diff < 0;
                  const amount = Math.abs(r.diff);
                  const date = r.historical ? lastDayPrevMonth : today;
                  return {
                    id: `adj_${Date.now()}_${i}`,
                    type: isExpense ? 'expense' : 'income',
                    amount,
                    category: isExpense ? 'other-expense' : 'other-income',
                    description: `Ajuste de saldo (${target.name}), diferencia con BCP${r.historical ? ' [histórico]' : ''}`,
                    date: date.toISOString().slice(0, 10),
                    accountId: target.id,
                    currency: 'PEN',
                    owner: getMyOwnerRole(),
                  };
                });
                const nextTxs = [...transactions, ...newTxs];
                setTransactions(nextTxs);
                storage.saveTransactions(nextTxs);

                const totalExpense = newTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                const totalIncome = newTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                const parts: string[] = [];
                if (totalExpense > 0) parts.push(`S/ ${totalExpense.toFixed(2)} gasto`);
                if (totalIncome > 0) parts.push(`S/ ${totalIncome.toFixed(2)} ingreso`);
                addToast({
                  type: 'success',
                  message: `Reconciliación: ${rows.length} cuenta${rows.length === 1 ? '' : 's'} ajustada${rows.length === 1 ? '' : 's'} (${parts.join(' · ')}).`,
                  duration: 5000,
                });
                setShowQuickReconcile(false);
              }}
            />
          </Suspense>
        )}

        {showRecurringModal && (
          <RecurringModal
            onClose={() => {
              setShowRecurringModal(false);
              setEditingRecurring(null);
            }}
            onSave={handleAddRecurring}
            editingRecurring={editingRecurring}
          />
        )}

        {/* Smart Import Wizard */}
        {showImportWizard && (
          <Suspense fallback={null}>
            <ImportWizard
              onImport={handleImport}
              onClose={() => {
                setShowImportWizard(false);
                setPendingImportFile(null);
              }}
              currency={currency}
              initialFile={pendingImportFile ?? undefined}
            />
          </Suspense>
        )}

        {/* MobileNewExpenseSheet es lazy y estaba fuera de todo Suspense: al
            pulsar el + React no podia montarla y no pasaba nada. */}
        {showQuickExpense && (
          <Suspense fallback={null}>
            <MobileNewExpenseSheet
              onClose={() => setShowQuickExpense(false)}
              onSave={t => {
                const yaAvisado = handleAddTransaction(t);
                setShowQuickExpense(false);
                // Al cerrarse la hoja la pantalla vuelve identica: sin este
                // aviso no hay forma de saber si el gasto entro.
                if (!yaAvisado) {
                  addToast({
                    type: 'success',
                    message: `Gasto de ${formatCurrency(t.amount, currency)} registrado`,
                    duration: 2500,
                  });
                }
              }}
              onMoreOptions={() => { setShowQuickExpense(false); openTransactionModal(); }}
            />
          </Suspense>
        )}

        {showNotificationSettings && (
          <NotificationSettings onClose={() => setShowNotificationSettings(false)} />
        )}

        {showCategoryManager && (
          <CategoryManager
            onClose={() => setShowCategoryManager(false)}
          />
        )}

        {showOwnerLabels && (
          <OwnerLabelsModal
            foco={showOwnerLabels || undefined}
            onClose={() => setShowOwnerLabels(false)}
          />
        )}
      </div>
  );
}

export default App;
