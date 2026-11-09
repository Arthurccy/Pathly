import { useState } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import SignedAmountInput from './SignedAmountInput';
import { parseSignedAmount } from '../utils/amountInput';

const inputClass = 'w-full rounded-lg border border-slate-300 p-2 dark:bg-slate-800 dark:text-white';

export function ImportAccountSetup({ onCreated }: { onCreated: (id: string, balance: number) => void }) {
  const { addAccount, accounts } = useBudget();
  const [open, setOpen] = useState(accounts.length === 0);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:bg-slate-900">
    <button type="button" className="font-semibold text-blue-700 dark:text-blue-300" onClick={() => setOpen(!open)} aria-expanded={open}>Créer un compte pour cet import</button>
    {open && <form className="mt-3 space-y-3" onSubmit={async event => {
      event.preventDefault();
      const amount = parseSignedAmount(balance);
      if (!name.trim() || !Number.isFinite(amount)) { setError('Indiquez un nom et un solde valide, par exemple -150,25.'); return; }
      if (accounts.some(a => a.type === 'checking' && a.name.trim().toLowerCase() === name.trim().toLowerCase())) { setError('Ce compte existe déjà : sélectionnez-le dans la liste.'); return; }
      setBusy(true); setError('');
      try {
        const account = await addAccount({ name: name.trim(), balance: amount, type: 'checking', currency: 'EUR', color: '#2563eb', isActive: true, order: accounts.length });
        if (!account) throw new Error();
        onCreated(account.id, amount); setOpen(false);
      } catch { setError('Impossible de créer le compte. Réessayez.'); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm text-slate-600 dark:text-slate-300">Donnez un nom à votre compte courant et indiquez le solde affiché par votre banque. Un découvert est un solde négatif. Ce solde sera conservé à la fin de l’import.</p>
      <label className="block">Nom du compte<input required value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Mon compte courant" /></label>
      <label className="block">Solde bancaire actuel (€)<SignedAmountInput required value={balance} onValueChange={setBalance} className={inputClass} placeholder="Ex. -150,25" /></label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{busy ? 'Création…' : 'Créer et sélectionner ce compte'}</button>
    </form>}
  </section>;
}

export function ImportCategoryCreator({ type, onCreated, onCancel }: { type: 'income' | 'expense'; onCreated: (id: string) => void; onCancel: () => void }) {
  const { addCategory, categories } = useBudget();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form className="rounded-xl border border-blue-300 p-4 space-y-3" onSubmit={async event => {
    event.preventDefault(); if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      const category = await addCategory({ name: name.trim(), type, icon: type === 'income' ? 'Banknote' : 'Tag', color: '#2563eb', order: categories.length, isActive: true });
      if (!category) throw new Error();
      onCreated(category.id);
    } catch { setError('Impossible de créer cette catégorie. Réessayez.'); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-semibold">Nouvelle catégorie de {type === 'income' ? 'revenu' : 'dépense'}</h3>
    <p className="text-sm">Elle sera appliquée à cette opération et disponible pour les suivantes.</p>
    <label className="block">Nom de la catégorie<input autoFocus required value={name} onChange={e => setName(e.target.value)} className={inputClass} /></label>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{busy ? 'Création…' : 'Créer et appliquer'}</button>
    <button type="button" disabled={busy} className="ml-3 underline" onClick={onCancel}>Annuler</button>
  </form>;
}
