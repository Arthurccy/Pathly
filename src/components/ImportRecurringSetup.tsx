import { useState } from 'react';
import { format, parseISO, startOfDay } from 'date-fns';
import { useBudget } from '../contexts/BudgetContext';
import type { RecurringPattern } from '../types';
import { importRecurrenceCandidates, nextImportOccurrence, recurrenceKey } from '../utils/importRecurrence';

export default function ImportRecurringSetup({ accountId }: { accountId: string }) {
  const { transactions, addTransaction } = useBudget();
  const [selected, setSelected] = useState('');
  const [frequency, setFrequency] = useState<RecurringPattern['frequency']>('monthly');
  const [nextDate, setNextDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<string[]>([]);
  const candidates = importRecurrenceCandidates(transactions, accountId).filter(t => !created.includes(recurrenceKey(t)));
  const transaction = candidates.find(t => t.id === selected);
  return <section className="my-6 rounded-xl border border-blue-200 p-4 text-left space-y-3">
    <h3 className="font-semibold">Préparer mes prochaines opérations (facultatif)</h3>
    <p className="text-sm text-slate-600 dark:text-slate-300">Votre salaire, votre loyer ou un abonnement revient régulièrement ? Choisissez une opération du compte, puis confirmez sa fréquence et sa prochaine date. Une seule récurrence sera créée, sans rejouer les opérations importées. Vous pourrez la modifier dans Récurrences.</p>
    {message && <p role="status" className="text-emerald-700">{message}</p>}
    {candidates.length === 0 ? <p className="text-sm">Aucune autre opération disponible pour créer une récurrence.</p> : <form className="space-y-3" onSubmit={async event => {
      event.preventDefault();
      const date = parseISO(nextDate);
      if (!transaction || !Number.isFinite(date.getTime()) || date <= startOfDay(new Date())) { setError('Choisissez une opération et une prochaine date à partir de demain.'); return; }
      setBusy(true); setError('');
      try {
        await addTransaction({ accountId: transaction.accountId, amount: transaction.amount, description: transaction.description, date, categoryId: transaction.categoryId, type: transaction.type,
          status: 'scheduled', isRecurring: true, recurringPattern: { frequency, interval: 1, isActive: true, nextDate: date } });
        setCreated(prev => [...prev, recurrenceKey(transaction)]);
        setMessage(`Récurrence créée : ${transaction.description}.`); setSelected(''); setNextDate('');
      } catch { setError('La récurrence n’a pas pu être créée. Vos opérations importées restent enregistrées. Réessayez.'); }
      finally { setBusy(false); }
    }}>
      <div><label className="block" htmlFor="import-recurring-operation">Opération</label><select id="import-recurring-operation" className="block w-full rounded border p-2 dark:bg-slate-800" required value={selected} onChange={e => {
        setSelected(e.target.value); const next = candidates.find(t => t.id === e.target.value);
        if (next) setNextDate(format(nextImportOccurrence(next.date, frequency), 'yyyy-MM-dd'));
      }}><option value="">Choisir une opération</option>{candidates.map(t => <option key={t.id} value={t.id}>{t.description} — {t.amount.toFixed(2)} €</option>)}</select></div>
      <div><label className="block" htmlFor="import-recurring-frequency">Fréquence</label><select id="import-recurring-frequency" className="block rounded border p-2 dark:bg-slate-800" value={frequency} onChange={e => {
        const value = e.target.value as RecurringPattern['frequency']; setFrequency(value);
        if (transaction) setNextDate(format(nextImportOccurrence(transaction.date, value), 'yyyy-MM-dd'));
      }}><option value="monthly">Tous les mois</option><option value="weekly">Toutes les semaines</option><option value="quarterly">Tous les trimestres</option><option value="yearly">Tous les ans</option></select></div>
      <label className="block">Prochaine date<input className="block rounded border p-2 dark:bg-slate-800" type="date" required value={nextDate} onChange={e => setNextDate(e.target.value)} /></label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={busy || !transaction} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Création…' : 'Créer cette récurrence'}</button>
    </form>}
  </section>;
}
