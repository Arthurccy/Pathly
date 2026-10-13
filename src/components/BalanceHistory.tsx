import React, { useMemo, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { Transaction } from '../types';

type PeriodKey = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: '7d', label: '7 j', days: 7 },
  { key: '30d', label: '30 j', days: 30 },
  { key: '90d', label: '3 mois', days: 90 },
  { key: '180d', label: '6 mois', days: 180 },
  { key: '365d', label: '1 an', days: 365 },
  { key: 'all', label: 'Tout', days: null },
];

const MAX_POINTS = 120;

const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

// Same sign convention as the balance updates in BudgetContext
const balanceImpact = (t: Transaction) => {
  if (t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal') return t.amount;
  if (t.type === 'transfer') return t.description.toLowerCase().includes('depuis') ? t.amount : -t.amount;
  return -t.amount;
};

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899'];

const BalanceHistory: React.FC = () => {
  const { accounts, transactions, selectedAccountIds } = useBudget();
  const [period, setPeriod] = useState<PeriodKey>('90d');
  const [mode, setMode] = useState<'total' | 'accounts'>('total');
  const [compare, setCompare] = useState(false);

  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        a => a.isActive !== false && (selectedAccountIds.length === 0 || selectedAccountIds.includes(a.id)),
      ),
    [accounts, selectedAccountIds],
  );

  // Daily end-of-day balance per account, rebuilt backwards from the current balance
  const { dailyByDate, earliest, today } = useMemo(() => {
    const today = startOfDay(new Date());
    const ids = new Set(visibleAccounts.map(a => a.id));
    const done = transactions
      .filter(t => t.status === 'completed' && ids.has(t.accountId))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const earliest = done.length ? startOfDay(done[done.length - 1].date) : today;
    const span = Math.max(differenceInCalendarDays(today, earliest), 0);

    const running = new Map<string, number>(visibleAccounts.map(a => [a.id, a.balance]));
    const rows: { date: Date; balances: Map<string, number> }[] = [];
    let cursor = 0;

    for (let i = 0; i <= span; i++) {
      const day = subDays(today, i);
      const dayEnd = endOfDay(day);
      // Undo everything that happened after the end of this day
      while (cursor < done.length && done[cursor].date.getTime() > dayEnd.getTime()) {
        const t = done[cursor];
        running.set(t.accountId, (running.get(t.accountId) || 0) - balanceImpact(t));
        cursor++;
      }
      rows.push({ date: day, balances: new Map(running) });
    }

    rows.reverse();
    return { dailyByDate: rows, earliest, today };
  }, [visibleAccounts, transactions]);

  const view = useMemo(() => {
    const cfg = PERIODS.find(p => p.key === period)!;
    const available = dailyByDate.length; // days since earliest, inclusive
    const days = cfg.days === null ? available : Math.min(cfg.days + 1, available);
    const current = dailyByDate.slice(-days);

    const totalOf = (r: { balances: Map<string, number> }) => {
      let s = 0;
      r.balances.forEach(v => (s += v));
      return s;
    };

    // Previous period of the same length (only if history goes back far enough)
    const previous = dailyByDate.slice(Math.max(dailyByDate.length - days * 2 + 1, 0), dailyByDate.length - days + 1);
    const canCompare = cfg.days !== null && previous.length === current.length;

    const stride = Math.max(1, Math.ceil(current.length / MAX_POINTS));
    const points = current
      .map((row, i) => ({ row, i }))
      .filter(({ i }) => i % stride === 0 || i === current.length - 1)
      .map(({ row, i }) => {
        const point: Record<string, number | string> = {
          label: format(row.date, current.length > 200 ? 'MMM yy' : 'd MMM', { locale: fr }),
          full: format(row.date, 'd MMMM yyyy', { locale: fr }),
          total: totalOf(row),
        };
        visibleAccounts.forEach(a => (point[a.id] = row.balances.get(a.id) || 0));
        if (canCompare) {
          point.previous = totalOf(previous[i]);
          point.previousFull = format(previous[i].date, 'd MMMM yyyy', { locale: fr });
        }
        return point;
      });

    const totals = current.map(totalOf);
    const start = totals[0] ?? 0;
    const end = totals[totals.length - 1] ?? 0;
    const prevStart = canCompare ? totalOf(previous[0]) : null;
    const prevEnd = canCompare ? totalOf(previous[previous.length - 1]) : null;

    return {
      points,
      canCompare,
      start,
      end,
      delta: end - start,
      deltaPct: start !== 0 ? ((end - start) / Math.abs(start)) * 100 : null,
      min: totals.length ? Math.min(...totals) : 0,
      max: totals.length ? Math.max(...totals) : 0,
      prevDelta: prevStart !== null && prevEnd !== null ? prevEnd - prevStart : null,
      firstDate: current[0]?.date ?? today,
    };
  }, [dailyByDate, period, visibleAccounts, today]);

  const accountColor = (a: { color?: string }, index: number) => a.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  const positive = view.delta >= 0;
  const hasHistory = differenceInCalendarDays(today, earliest) > 0;

  const tooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-sm shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <p className="font-semibold text-slate-900 dark:text-white">{p.full}</p>
        {mode === 'total' ? (
          <>
            <p className="mt-0.5 font-bold tabular-nums text-blue-600 dark:text-blue-400">{eur2.format(p.total)}</p>
            {compare && p.previous !== undefined && (
              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {p.previousFull} : {eur2.format(p.previous)}
              </p>
            )}
          </>
        ) : (
          <div className="mt-1 space-y-0.5">
            {visibleAccounts.map((a, i) => (
              <p key={a.id} className="flex items-center justify-between gap-4 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accountColor(a, i) }} />
                  {a.name}
                </span>
                <span className="font-semibold">{eur0.format(p[a.id] as number)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const axisProps = {
    tick: { fontSize: 11, fill: '#94a3b8' },
    tickLine: false,
    axisLine: false,
  } as const;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Évolution des soldes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Depuis le {format(view.firstDate, 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            {PERIODS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  period === p.key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            {(['total', 'accounts'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  mode === m
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {m === 'total' ? 'Total' : 'Par compte'}
              </button>
            ))}
          </div>
          {mode === 'total' && (
            <label
              className={`flex items-center gap-1.5 text-xs ${
                view.canCompare ? 'cursor-pointer text-slate-600 dark:text-slate-300' : 'cursor-not-allowed text-slate-300 dark:text-slate-600'
              }`}
              title={view.canCompare ? undefined : "Historique insuffisant pour comparer avec la période précédente"}
            >
              <input
                type="checkbox"
                checked={compare && view.canCompare}
                disabled={!view.canCompare}
                onChange={e => setCompare(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
              />
              Comparer à la période précédente
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Solde actuel</p>
          <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{eur0.format(view.end)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Variation</p>
          <p
            className={`flex items-center gap-1 text-base font-bold tabular-nums ${
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {positive ? '+' : ''}
            {eur0.format(view.delta)}
            {view.deltaPct !== null && (
              <span className="text-xs font-medium opacity-80">
                ({positive ? '+' : ''}
                {view.deltaPct.toFixed(1)} %)
              </span>
            )}
          </p>
          {compare && view.prevDelta !== null && (
            <p className="text-[11px] tabular-nums text-slate-400">
              Période préc. : {view.prevDelta >= 0 ? '+' : ''}
              {eur0.format(view.prevDelta)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Plus haut</p>
          <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{eur0.format(view.max)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Plus bas</p>
          <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{eur0.format(view.min)}</p>
        </div>
      </div>

      <div className="h-72 px-2 pb-2 pt-4 sm:px-4">
        {visibleAccounts.length === 0 || !hasHistory ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Pas encore assez d'historique pour tracer une évolution.
          </div>
        ) : mode === 'total' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={view.points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="label" {...axisProps} minTickGap={32} />
              <YAxis {...axisProps} width={64} tickFormatter={v => eur0.format(v)} domain={['auto', 'auto']} />
              <Tooltip content={tooltip} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} />
              {compare && view.canCompare && (
                <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              )}
              <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} fill="url(#balanceFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view.points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="label" {...axisProps} minTickGap={32} />
              <YAxis {...axisProps} width={64} tickFormatter={v => eur0.format(v)} domain={['auto', 'auto']} />
              <Tooltip content={tooltip} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} />
              {visibleAccounts.map((a, i) => (
                <Line key={a.id} type="monotone" dataKey={a.id} stroke={accountColor(a, i)} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {mode === 'accounts' && visibleAccounts.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-3 text-xs text-slate-600 dark:text-slate-300">
          {visibleAccounts.map((a, i) => (
            <span key={a.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accountColor(a, i) }} />
              {a.name}
            </span>
          ))}
        </div>
      )}

      <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400 dark:border-slate-800">
        Historique reconstitué à partir de vos transactions terminées : les ajustements manuels de solde ne sont pas pris en compte.
      </p>
    </div>
  );
};

export default BalanceHistory;
