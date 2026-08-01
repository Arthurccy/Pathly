import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Search,
  ExternalLink,
  X,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Wallet,
  Sparkles
} from 'lucide-react';
import { BridgeService, BridgeAccount, BridgeBank } from '../services/bridgeService';
import { GoCardlessService } from '../services/gocardlessService';
import { useBudget } from '../contexts/BudgetContext';
import { BankAccount } from '../types';

interface BankSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankSyncModal: React.FC<BankSyncModalProps> = ({ isOpen, onClose }) => {
  const { accounts, categories, addAccount, updateAccount, addTransaction, transactions } = useBudget();

  const [provider, setProvider] = useState<'bridge' | 'gocardless'>('bridge');
  
  // Bridge State
  const [bridgeClientId, setBridgeClientId] = useState('');
  const [bridgeClientSecret, setBridgeClientSecret] = useState('');
  
  // GoCardless State
  const [gcSecretId, setGcSecretId] = useState('');
  const [gcSecretKey, setGcSecretKey] = useState('');

  const [showSecret, setShowSecret] = useState(false);
  const [activeStep, setActiveStep] = useState<'credentials' | 'select_bank' | 'link_accounts'>('select_bank');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [bridgeAccounts, setBridgeAccounts] = useState<BridgeAccount[]>([]);
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({}); // bridgeAccountId -> pathlyAccountId or 'new'

  const [gcInstitutions, setGcInstitutions] = useState<GoCardlessInstitution[]>([]);
  const [selectedGcInst, setSelectedGcInst] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const bCreds = BridgeService.getCredentials();
    setBridgeClientId(bCreds.clientId);
    setBridgeClientSecret(bCreds.clientSecret);

    const gcCreds = GoCardlessService.getCredentials();
    setGcSecretId(gcCreds.secretId);
    setGcSecretKey(gcCreds.secretKey);

    if (bCreds.clientId && bCreds.clientSecret) {
      setProvider('bridge');
      setActiveStep('select_bank');
    } else if (gcCreds.secretId && gcCreds.secretKey) {
      setProvider('gocardless');
      setActiveStep('select_bank');
    } else {
      setActiveStep('credentials');
    }

    // Check if returning from OAuth callback in URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('item_id') || params.get('requisition_id') || params.get('client_reference')) {
      handleOAuthReturn();
    }
  }, [isOpen]);

  // Load GoCardless institutions when switching to gocardless tab in select_bank step
  useEffect(() => {
    if (provider === 'gocardless' && activeStep === 'select_bank') {
      const loadInsts = async () => {
        try {
          if (!GoCardlessService.isConfigured()) {
            setActiveStep('credentials');
            return;
          }
          setLoading(true);
          const insts = await GoCardlessService.getInstitutions('FR');
          setGcInstitutions(insts);
        } catch (err: any) {
          setError('Erreur lors du chargement des banques GoCardless: ' + err.message);
          setActiveStep('credentials');
        } finally {
          setLoading(false);
        }
      };
      loadInsts();
    }
  }, [provider, activeStep]);

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (provider === 'bridge') {
        if (!bridgeClientId.trim() || !bridgeClientSecret.trim()) {
          throw new Error('Veuillez remplir le Client ID et le Client Secret de Bridge (Bankin\').');
        }
        BridgeService.setCredentials(bridgeClientId.trim(), bridgeClientSecret.trim());
        // Verify credentials by attempting to list banks
        await BridgeService.listBanks();
      } else {
        if (!gcSecretId.trim() || !gcSecretKey.trim()) {
          throw new Error('Veuillez remplir le Secret ID et la Secret Key de GoCardless.');
        }
        GoCardlessService.setCredentials(gcSecretId.trim(), gcSecretKey.trim());
        const insts = await GoCardlessService.getInstitutions('FR');
        setGcInstitutions(insts);
      }
      setActiveStep('select_bank');
      setStatusMessage('Identifiants API enregistrés avec succès !');
    } catch (err: any) {
      setError(err.message || 'Identifiants API invalides.');
    } finally {
      setLoading(false);
    }
  };

  const startBankConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      if (provider === 'bridge') {
        localStorage.setItem('pathly_pending_bridge', 'true');
        const connectUrl = await BridgeService.createConnectUrl(redirectUrl);
        window.location.href = connectUrl;
      } else if (provider === 'gocardless') {
        if (!selectedGcInst) {
          throw new Error('Veuillez sélectionner une banque.');
        }
        localStorage.setItem('pathly_pending_gocardless', 'true');
        const requisition = await GoCardlessService.createRequisition(selectedGcInst, redirectUrl);
        localStorage.setItem('pathly_gocardless_req_id', requisition.id);
        window.location.href = requisition.link;
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'initialisation de la connexion bancaire.');
      setLoading(false);
    }
  };

  const handleOAuthReturn = async () => {
    setLoading(true);
    setError(null);
    try {
      if (provider === 'bridge' || localStorage.getItem('pathly_pending_bridge')) {
        const fetchedAccs = await BridgeService.listAccounts();
        setBridgeAccounts(fetchedAccs);

        const initialMapping: Record<string, string> = {};
        fetchedAccs.forEach(acc => {
          const match = accounts.find(a => a.gocardlessAccountId === `bridge_${acc.id}`);
          initialMapping[acc.id] = match ? match.id : 'new';
        });
        setAccountMappings(initialMapping);
        setActiveStep('link_accounts');
      } else if (provider === 'gocardless' || localStorage.getItem('pathly_pending_gocardless') || new URLSearchParams(window.location.search).get('ref')) {
        const params = new URLSearchParams(window.location.search);
        let reqId = params.get('ref') || localStorage.getItem('pathly_gocardless_req_id');
        if (!reqId) throw new Error('Session GoCardless introuvable.');

        const requisition = await GoCardlessService.getRequisition(reqId);
        const gcAccounts: BridgeAccount[] = [];
        for (const accountId of requisition.accounts) {
            const details = await GoCardlessService.getAccountDetails(accountId);
            const balance = await GoCardlessService.getAccountBalances(accountId);
            gcAccounts.push({
                id: accountId,
                name: details.name || details.iban || 'Compte Bancaire',
                balance: balance,
                currency_code: 'EUR',
                type: 'checking',
                status: 0,
                updated_at: new Date().toISOString()
            });
        }
        setBridgeAccounts(gcAccounts);
        setProvider('gocardless');

        const initialMapping: Record<string, string> = {};
        gcAccounts.forEach(acc => {
          const match = accounts.find(a => a.gocardlessAccountId === `gc_${acc.id}`);
          initialMapping[acc.id] = match ? match.id : 'new';
        });
        setAccountMappings(initialMapping);
        setActiveStep('link_accounts');
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de récupérer la connexion bancaire.');
    } finally {
      setLoading(false);
      localStorage.removeItem('pathly_pending_bridge');
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };

  const finalizeBridgeLinkage = async () => {
    setLoading(true);
    setError(null);
    let syncedCount = 0;

    try {
      let allBridgeTransactions: any[] = [];
      if (provider === 'bridge') {
        allBridgeTransactions = await BridgeService.listTransactions();
      }

      for (const bridgeAcc of bridgeAccounts) {
        const selectedOption = accountMappings[bridgeAcc.id];
        let targetAccountId = selectedOption;
        const prefix = provider === 'bridge' ? 'bridge_' : 'gc_';
        const gcAccId = `${prefix}${bridgeAcc.id}`;

        if (selectedOption === 'new') {
          const newAccName = bridgeAcc.name || 'Compte Bancaire Synchro';
          const newAccount: Partial<BankAccount> = {
            name: newAccName,
            type: bridgeAcc.type === 'savings' ? 'savings' : 'checking',
            balance: bridgeAcc.balance,
            currency: bridgeAcc.currency_code || 'EUR',
            color: '#3B82F6',
            isActive: true,
            order: accounts.length + 1,
            bankName: provider === 'bridge' ? 'Bridge Bankin\'' : 'GoCardless',
            gocardlessAccountId: gcAccId,
            lastSyncedAt: new Date().toISOString(),
          };
          const created = await addAccount(newAccount);
          targetAccountId = created.id;
        } else if (targetAccountId) {
          const existing = accounts.find(a => a.id === targetAccountId);
          if (existing) {
            await updateAccount({
              ...existing,
              balance: bridgeAcc.balance,
              gocardlessAccountId: gcAccId,
              lastSyncedAt: new Date().toISOString(),
            });
          }
        }

        // Sync transactions for this account
        if (targetAccountId) {
          const existingGcTxIds = new Set(
            transactions
              .filter(t => t.gocardlessTransactionId)
              .map(t => t.gocardlessTransactionId)
          );

          if (provider === 'bridge') {
            const accTxs = allBridgeTransactions.filter(t => t.account_id === bridgeAcc.id);
            for (const rawTx of accTxs) {
              const normalized = BridgeService.normalizeTransaction(
                rawTx,
                targetAccountId,
                accounts[0]?.userId || 'user',
                categories
              );
              if (!existingGcTxIds.has(normalized.gocardlessTransactionId)) {
                await addTransaction(normalized);
                syncedCount++;
              }
            }
          } else {
            const accTxs = await GoCardlessService.getAccountTransactions(bridgeAcc.id);
            for (const rawTx of accTxs) {
              const normalized = GoCardlessService.normalizeTransaction(
                rawTx,
                targetAccountId,
                accounts[0]?.userId || 'user',
                categories
              );
              if (!existingGcTxIds.has(normalized.gocardlessTransactionId)) {
                await addTransaction(normalized);
                syncedCount++;
              }
            }
          }
        }
      }

      setStatusMessage(`Succès ! Les comptes ont été synchronisés avec ${syncedCount} nouvelle(s) transaction(s).`);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la synchronisation des transactions Bridge.');
    } finally {
      setLoading(false);
    }
  };

  const syncAllConnectedAccountsNow = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    let totalNewTx = 0;

    try {
      if (BridgeService.isConfigured()) {
        const bridgeAccs = await BridgeService.listAccounts();
        const bridgeTxs = await BridgeService.listTransactions();
        const existingGcTxIds = new Set(
          transactions
            .filter(t => t.gocardlessTransactionId)
            .map(t => t.gocardlessTransactionId)
        );

        for (const bridgeAcc of bridgeAccs) {
          const matchingPathlyAcc = accounts.find(a => a.gocardlessAccountId === `bridge_${bridgeAcc.id}`);
          if (!matchingPathlyAcc) continue;

          // Update balance
          await updateAccount({
            ...matchingPathlyAcc,
            balance: bridgeAcc.balance,
            lastSyncedAt: new Date().toISOString(),
          });

          // Insert transactions
          const accTxs = bridgeTxs.filter(t => t.account_id === bridgeAcc.id);
          for (const rawTx of accTxs) {
            const normalized = BridgeService.normalizeTransaction(
              rawTx,
              matchingPathlyAcc.id,
              matchingPathlyAcc.userId,
              categories
            );

            if (!existingGcTxIds.has(normalized.gocardlessTransactionId)) {
              await addTransaction(normalized);
              totalNewTx++;
            }
          }
        }
      }

      setStatusMessage(`Synchronisation terminée ! ${totalNewTx} nouvelle(s) transaction(s) importée(s).`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du rafraîchissement des comptes.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const connectedAccounts = accounts.filter(a => a.gocardlessAccountId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-950 dark:border dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Synchronisation Bancaire Automatique
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connexion directe et sécurisée via {provider === 'bridge' ? 'Bridge API (Bankin\')' : 'GoCardless'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-semibold">Une erreur est survenue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="font-medium">{statusMessage}</p>
            </div>
          )}

          {/* Connected accounts sync banner */}
          {connectedAccounts.length > 0 && activeStep === 'select_bank' && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                    Comptes actuellement synchronisés ({connectedAccounts.length})
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {connectedAccounts.map(acc => (
                      <span key={acc.id} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                        <Wallet className="h-3 w-3 text-sky-500" />
                        {acc.name} ({acc.balance.toFixed(2)} €)
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={syncAllConnectedAccountsNow}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Synchronisation...' : 'Tout rafraîchir'}
                </button>
              </div>
            </div>
          )}

          {/* Provider Toggle */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setProvider('bridge')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition ${
                provider === 'bridge'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              Bridge API (Bankin') 🇫🇷
            </button>
            <button
              type="button"
              onClick={() => setProvider('gocardless')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition ${
                provider === 'gocardless'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950'
              }`}
            >
              <Building2 className="h-3.5 w-3.5 text-indigo-500" />
              GoCardless (Nordigen)
            </button>
          </div>

          {/* STEP 1: API CREDENTIALS FORM */}
          {activeStep === 'credentials' && (
            <form onSubmit={saveCredentials} className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <KeyRound className="h-4 w-4 text-sky-600" />
                  <span>Identifiants API {provider === 'bridge' ? 'Bridge (Bankin\')' : 'GoCardless'}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {provider === 'bridge' ? (
                    <>
                      Collez vos identifiants obtenus gratuitement sur le portail <a href="https://dashboard.bridgeapi.io/" target="_blank" rel="noreferrer" className="text-sky-600 underline font-medium">Bridge API Dashboard</a>.
                    </>
                  ) : (
                    <>
                      Collez vos identifiants obtenus sur le portail GoCardless Bank Account Data.
                    </>
                  )}
                </p>
              </div>

              {provider === 'bridge' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={bridgeClientId}
                      onChange={e => setBridgeClientId(e.target.value)}
                      placeholder="ex: sandbox_id_2eadbe7777..."
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Client Secret
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={bridgeClientSecret}
                        onChange={e => setBridgeClientSecret(e.target.value)}
                        placeholder="ex: sandbox_secret_XxYMBmXOJQ..."
                        className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Secret ID
                    </label>
                    <input
                      type="text"
                      value={gcSecretId}
                      onChange={e => setGcSecretId(e.target.value)}
                      placeholder="Secret ID GoCardless"
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Secret Key
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={gcSecretKey}
                        onChange={e => setGcSecretKey(e.target.value)}
                        placeholder="Secret Key GoCardless"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Enregistrer mes identifiants'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: CONNECT BANK */}
          {activeStep === 'select_bank' && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 ring-8 ring-sky-50/50 dark:ring-sky-950/50">
                <Building2 className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Lier votre banque via {provider === 'bridge' ? 'Bridge API (Bankin\')' : 'GoCardless'}
                </h3>
                <p className="mt-1.5 max-w-md mx-auto text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  En cliquant sur le bouton ci-dessous, vous serez redirigé vers le portail sécurisé de votre banque pour valider l'accès à vos comptes et importer vos transactions dans Pathly.
                </p>

                {provider === 'gocardless' && (
                  <div className="mt-4 text-left">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Choisissez votre banque
                    </label>
                    <select
                      value={selectedGcInst}
                      onChange={e => setSelectedGcInst(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="">-- Sélectionnez une banque --</option>
                      {gcInstitutions.map(inst => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('credentials')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Changer les clés API
                </button>
                <button
                  type="button"
                  onClick={startBankConnection}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Lancer la connexion bancaire
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: LINK ACCOUNTS AFTER OAUTH */}
          {activeStep === 'link_accounts' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Connexion bancaire validée !</span>
                </div>
                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                  Associez chaque compte récupéré à un compte Pathly existant ou créez un nouveau compte.
                </p>
              </div>

              <div className="space-y-3">
                {bridgeAccounts.map(acc => (
                  <div key={acc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {acc.name || 'Compte Bancaire'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Solde bancaire : <span className="font-semibold text-slate-900 dark:text-white">{acc.balance.toFixed(2)} {acc.currency_code || '€'}</span>
                      </p>
                    </div>

                    <div className="sm:w-64">
                      <select
                        value={accountMappings[acc.id] || 'new'}
                        onChange={e => setAccountMappings({ ...accountMappings, [acc.id]: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="new">➕ Créer un nouveau compte Pathly</option>
                        {accounts.map(existingAcc => (
                          <option key={existingAcc.id} value={existingAcc.id}>
                            🔗 Associer à {existingAcc.name} ({existingAcc.balance.toFixed(2)} €)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={finalizeBridgeLinkage}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Finaliser la synchronisation
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pathly utilise l'API certifiée DSP2. Aucune donnée d'accès bancaire n'est conservée.
          </p>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
