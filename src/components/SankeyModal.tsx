import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, TrendingDown, TrendingUp, Calendar, Wallet, CheckCircle, ChevronRight, Info } from 'lucide-react';
import { Sankey, ResponsiveContainer } from 'recharts';
import { CashFlow, Category, Transaction, BankAccount } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SankeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashFlow: CashFlow | null;
  categories: Category[];
  accounts?: BankAccount[];
}

type Side = 'in' | 'root' | 'out';

interface SankeyNodeData {
  name: string;
  fill: string;
  side: Side;
  value?: number;
  categoryId?: string;
  isBudgetReserve?: boolean;
}

const ROOT = 'Mois';
const ROOT_LABEL = 'Budget du mois';

const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

interface Tip {
  x: number;
  y: number;
  title: string;
  value: number;
  share: number | null;
  color: string;
}

const SankeyModal: React.FC<SankeyModalProps> = ({ isOpen, onClose, cashFlow, categories, accounts = [] }) => {
  const [hover, setHover] = useState<{ kind: 'node' | 'link'; key: string } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<SankeyNodeData | null>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setHover(null);
      setTip(null);
      setSelectedNodeDetails(null);
    }
  }, [isOpen]);

  const data = useMemo(() => {
    if (!cashFlow || !cashFlow.allTransactions) return null;

    const nodes: SankeyNodeData[] = [];
    const links: { source: number; target: number; value: number }[] = [];

    const getNodeIndex = (name: string, color: string, side: Side, categoryId?: string, isBudgetReserve?: boolean) => {
      const existing = nodes.findIndex(n => n.name === name);
      if (existing !== -1) return existing;
      nodes.push({ name, fill: color, side, categoryId, isBudgetReserve });
      return nodes.length - 1;
    };

    const rootIndex = getNodeIndex(ROOT, '#475569', 'root');

    const incomeMap = new Map<string, { amount: number; categoryId?: string }>();
    const expenseMap = new Map<string, { amount: number; categoryId?: string }>();

    cashFlow.allTransactions.forEach(t => {
      if (t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal') {
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat ? cat.name : 'Revenus divers';
        const current = incomeMap.get(name) || { amount: 0, categoryId: cat?.id };
        incomeMap.set(name, { amount: current.amount + t.amount, categoryId: cat?.id });
      } else if (t.type === 'expense' || t.type === 'bill') {
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat ? cat.name : 'Dépenses diverses';
        const current = expenseMap.get(name) || { amount: 0, categoryId: cat?.id };
        expenseMap.set(name, { amount: current.amount + t.amount, categoryId: cat?.id });
      }
    });

    let totalInputs = 0;
    [...incomeMap.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .forEach(([name, { amount, categoryId }]) => {
        if (amount <= 0.01) return;
        const idx = getNodeIndex(name, '#10b981', 'in', categoryId);
        links.push({ source: idx, target: rootIndex, value: amount });
        totalInputs += amount;
      });

    let totalOutputs = 0;
    [...expenseMap.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .forEach(([name, { amount, categoryId }]) => {
        if (amount <= 0.01) return;
        const cat = categories.find(c => c.name === name);
        const idx = getNodeIndex(name, cat?.color || '#ef4444', 'out', categoryId);
        links.push({ source: rootIndex, target: idx, value: amount });
        totalOutputs += amount;
      });

    const addOutflow = (name: string, color: string, amount: number, isBudgetReserve?: boolean) => {
      if (amount > 0.01) {
        const idx = getNodeIndex(name, color, 'out', undefined, isBudgetReserve);
        links.push({ source: rootIndex, target: idx, value: amount });
        totalOutputs += amount;
      }
    };

    addOutflow('Épargne', '#8b5cf6', cashFlow.savings || 0);
    addOutflow('Virements externes', '#f59e0b', cashFlow.transfersOut || 0);
    addOutflow('Budgets libres', '#3b82f6', cashFlow.budgetReserve || 0, true);
    addOutflow('Dettes', '#f43f5e', cashFlow.debtPayments || 0);

    // Balance the diagram: root inflow must equal root outflow
    if (totalInputs < totalOutputs) {
      const deficit = totalOutputs - totalInputs;
      if (deficit > 0.01) {
        const idx = getNodeIndex('Déficit', '#f43f5e', 'in');
        links.push({ source: idx, target: rootIndex, value: deficit });
      }
    } else if (totalInputs > totalOutputs) {
      const surplus = totalInputs - totalOutputs;
      if (surplus > 0.01) {
        const idx = getNodeIndex('Excédent', '#14b8a6', 'out');
        links.push({ source: rootIndex, target: idx, value: surplus });
      }
    }

    nodes.forEach((node, idx) => {
      let incoming = 0;
      let outgoing = 0;
      links.forEach(l => {
        if (l.target === idx) incoming += l.value;
        if (l.source === idx) outgoing += l.value;
      });
      node.value = Math.max(incoming, outgoing);
    });

    if (links.length === 0) return null;

    return {
      nodes,
      links,
      totals: { income: totalInputs, outflow: totalOutputs, balance: totalInputs - totalOutputs },
    };
  }, [cashFlow, categories]);

  const base = data ? Math.max(data.totals.income, data.totals.outflow) || 1 : 1;
  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    data?.nodes.forEach(n => map.set(n.name, n.fill));
    return map;
  }, [data]);

  const showTip = useCallback((e: React.MouseEvent, title: string, value: number, share: number | null, color: string) => {
    setTip({ x: e.clientX, y: e.clientY, title, value, share, color });
  }, []);

  const clear = useCallback(() => {
    setHover(null);
    setTip(null);
  }, []);

  // Filter transactions for the selected node drilldown
  const selectedNodeTransactions = useMemo(() => {
    if (!selectedNodeDetails || !cashFlow?.allTransactions) return [];
    
    // If it's a category node (income or expense)
    if (selectedNodeDetails.categoryId) {
      return cashFlow.allTransactions.filter(t => t.categoryId === selectedNodeDetails.categoryId);
    }

    // If it's root
    if (selectedNodeDetails.side === 'root') {
      return cashFlow.allTransactions;
    }

    // If it's Epargne
    if (selectedNodeDetails.name === 'Épargne') {
      return cashFlow.allTransactions.filter(t => t.type === 'savings');
    }

    // If it's Virements externes
    if (selectedNodeDetails.name === 'Virements externes') {
      return cashFlow.allTransactions.filter(t => t.type === 'transfer' && !t.description.toLowerCase().includes('depuis'));
    }

    // Fallback: match by name
    return cashFlow.allTransactions.filter(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      return cat?.name === selectedNodeDetails.name;
    });
  }, [selectedNodeDetails, cashFlow?.allTransactions, categories]);

  // Which nodes / links stay highlighted for the current hover
  const isNodeActive = (name: string) => {
    if (!hover || !data) return true;
    if (hover.kind === 'node') {
      if (hover.key === name) return true;
      return data.links.some(l => {
        const s = data.nodes[l.source].name;
        const t = data.nodes[l.target].name;
        return (s === hover.key && t === name) || (t === hover.key && s === name);
      });
    }
    const [s, t] = hover.key.split('>');
    return name === s || name === t;
  };

  const isLinkActive = (source: string, target: string) => {
    if (!hover) return true;
    if (hover.kind === 'node') return source === hover.key || target === hover.key;
    return hover.key === `${source}>${target}`;
  };

  const renderLink = (props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload } = props;
    const sName: string = payload.source.name;
    const tName: string = payload.target.name;
    const active = isLinkActive(sName, tName);
    const sColor = colorByName.get(sName) || '#94a3b8';
    const tColor = colorByName.get(tName) || '#94a3b8';
    const gradId = `sankey-grad-${index}`;
    const dim = hover !== null && !active;
    const strong = hover !== null && active;

    return (
      <g>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={sourceX} x2={targetX} y1="0" y2="0">
            <stop offset="0%" stopColor={sColor} />
            <stop offset="100%" stopColor={tColor} />
          </linearGradient>
        </defs>
        <path
          d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={Math.max(linkWidth, 1.5)}
          strokeOpacity={dim ? 0.08 : strong ? 0.6 : 0.3}
          style={{ transition: 'stroke-opacity 0.15s ease', cursor: 'pointer' }}
          onMouseEnter={() => setHover({ kind: 'link', key: `${sName}>${tName}` })}
          onMouseMove={e =>
            showTip(e, `${sName === ROOT ? ROOT_LABEL : sName} → ${tName === ROOT ? ROOT_LABEL : tName}`, payload.value, (payload.value / base) * 100, sName === ROOT ? tColor : sColor)
          }
          onMouseLeave={clear}
        />
      </g>
    );
  };

  const handleNodeClick = (node: SankeyNodeData) => {
    setSelectedNodeDetails(node);
  };

  const renderNode = (props: any) => {
    const { x, y, width, height, index } = props;
    const node = data?.nodes[index];
    if (!node) return <g />;

    const active = isNodeActive(node.name);
    const isSelected = selectedNodeDetails?.name === node.name;
    const value = node.value || 0;
    const share = (value / base) * 100;
    const label = node.side === 'root' ? ROOT_LABEL : truncate(node.name, isNarrow ? 12 : 24);
    const amount = eur0.format(value);
    const sub = node.side === 'root' ? amount : `${amount} · ${share < 1 ? '<1' : Math.round(share)} %`;
    const opacity = active ? 1 : 0.25;

    const events = {
      onMouseEnter: () => setHover({ kind: 'node', key: node.name }),
      onMouseMove: (e: React.MouseEvent) =>
        showTip(e, `${node.side === 'root' ? ROOT_LABEL : node.name} (cliquer pour le détail)`, value, node.side === 'root' ? null : share, node.fill),
      onMouseLeave: clear,
      onClick: () => handleNodeClick(node),
    };

    let textProps: { x: number; anchor: 'start' | 'end' | 'middle'; y: number };
    if (node.side === 'root') {
      textProps = { x: x + width / 2, anchor: 'middle', y: y - 18 };
    } else if (node.side === 'in') {
      textProps = { x: x - 12, anchor: 'end', y: y + height / 2 };
    } else {
      textProps = { x: x + width + 12, anchor: 'start', y: y + height / 2 };
    }

    return (
      <g style={{ transition: 'opacity 0.15s ease', cursor: 'pointer' }} opacity={opacity} {...events}>
        <rect 
          x={x} 
          y={y} 
          width={width} 
          height={Math.max(height, 3)} 
          rx={4} 
          fill={node.fill} 
          stroke={isSelected ? '#3b82f6' : 'rgba(255,255,255,0.3)'}
          strokeWidth={isSelected ? 3 : 0.5}
        />
        {/* larger invisible hit area so thin nodes are easy to click & hover */}
        <rect x={x - 8} y={y - 3} width={width + 16} height={Math.max(height, 3) + 6} fill="transparent" />
        
        {/* Crisp text labels */}
        <text 
          x={textProps.x} 
          y={textProps.y} 
          textAnchor={textProps.anchor} 
          dominantBaseline="middle"
          className="font-sans select-none"
        >
          <tspan 
            className="fill-slate-800 dark:fill-slate-100 font-semibold text-[11px] sm:text-xs tracking-tight"
          >
            {label}
          </tspan>
          <tspan 
            className="fill-slate-400 dark:fill-slate-500 font-normal text-[10px] sm:text-[11px]" 
            dx="5"
          >
            {sub}
          </tspan>
        </text>
      </g>
    );
  };

  if (!isOpen) return null;

  // Generous side margins so long category names and amounts NEVER clip or overlap
  const margin = isNarrow
    ? { top: 40, right: 130, bottom: 20, left: 130 }
    : { top: 45, right: 230, bottom: 25, left: 230 };

  const totals = data?.totals;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm modal-overlay" onClick={onClose}>
      <div
        className="flex flex-col w-full max-w-5xl max-h-[92dvh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Diagramme de flux de trésorerie
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                Interactif
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {cashFlow && cashFlow.date ? format(cashFlow.date, 'MMMM yyyy', { locale: fr }) : ''} • Cliquez sur un budget ou une catégorie pour afficher ses opérations
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 transition-colors rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Pills */}
        {totals && (
          <div className="grid grid-cols-3 gap-3 px-6 pt-4 shrink-0">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 sm:px-4 sm:py-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Entrées</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 opacity-70" />
              </div>
              <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {eur0.format(totals.income)}
              </p>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5 sm:px-4 sm:py-3 dark:border-rose-900/30 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Sorties</span>
                <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 opacity-70" />
              </div>
              <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {eur0.format(totals.outflow)}
              </p>
            </div>

            <div
              className={`rounded-xl border p-2.5 sm:px-4 sm:py-3 ${
                totals.balance >= 0
                  ? 'border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20'
                  : 'border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
                    totals.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {totals.balance >= 0 ? 'Excédent' : 'Déficit'}
                </span>
                <Sparkles className="h-3.5 w-3.5 opacity-70" />
              </div>
              <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {eur0.format(Math.abs(totals.balance))}
              </p>
            </div>
          </div>
        )}

        {/* Sankey Flow Diagram Content */}
        <div className="px-4 py-2 overflow-x-auto shrink-0" style={{ height: selectedNodeDetails ? '290px' : '440px', minHeight: '260px', transition: 'height 0.2s ease' }}>
          {data ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={isNarrow ? 560 : undefined}>
              <Sankey
                data={data}
                nodeWidth={10}
                nodePadding={isNarrow ? 22 : 28}
                margin={margin}
                link={renderLink as any}
                node={renderNode as any}
              />
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 text-sm">
              Aucune donnée à afficher pour ce mois.
            </div>
          )}
        </div>

        {/* Detail Panel when node is clicked */}
        {selectedNodeDetails ? (
          <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex-1 overflow-hidden flex flex-col min-h-[200px]">
            {/* Header of details panel */}
            <div className="px-6 py-2.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center space-x-2.5">
                <span 
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm" 
                  style={{ backgroundColor: selectedNodeDetails.fill }} 
                />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedNodeDetails.name === ROOT ? ROOT_LABEL : selectedNodeDetails.name}</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({eur2.format(selectedNodeDetails.value || 0)})
                    </span>
                  </h4>
                </div>
              </div>

              <button
                onClick={() => setSelectedNodeDetails(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Fermer ×
              </button>
            </div>

            {/* List of transactions */}
            <div className="overflow-y-auto px-6 py-3 space-y-2 flex-1">
              {selectedNodeTransactions.length > 0 ? (
                selectedNodeTransactions.map((tx, idx) => {
                  const account = accounts.find(a => a.id === tx.accountId);
                  const isIncome = tx.type === 'income' || tx.type === 'refund' || tx.type === 'savings_withdrawal';

                  return (
                    <div 
                      key={tx.id || idx}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700">
                          {tx.date ? format(new Date(tx.date), 'dd MMM', { locale: fr }) : '-'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {tx.description}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {account && <span>{account.name}</span>}
                            {tx.status === 'scheduled' && (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">À venir</span>
                            )}
                            {tx.isRecurring && <span>(Récurrent)</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <span className={`font-bold text-sm ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                          {isIncome ? '+' : '-'}{tx.amount.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : selectedNodeDetails.isBudgetReserve ? (
                <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Budget prévisionnel disponible</p>
                  <p>Cette enveloppe de <strong>{eur2.format(selectedNodeDetails.value || 0)}</strong> correspond aux budgets alloués qui n'ont pas encore été dépensés ce mois-ci.</p>
                </div>
              ) : (
                <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  Aucune transaction enregistrée pour ce poste.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-center shrink-0">
            <span className="text-[11px] text-slate-400">
              💡 Astuce : Cliquez sur un budget à droite ou un revenu à gauche pour afficher ses transactions
            </span>
          </div>
        )}
      </div>

      {tip &&
        createPortal(
          <div
            className="fixed z-[100] pointer-events-none rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-sm shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
            style={{
              left: Math.min(tip.x + 16, window.innerWidth - 240),
              top: Math.min(tip.y + 16, window.innerHeight - 90),
              maxWidth: 230,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tip.color }} />
              <p className="font-semibold text-slate-900 dark:text-white">{tip.title}</p>
            </div>
            <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-white">{eur2.format(tip.value)}</p>
            {tip.share !== null && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tip.share < 1 ? '<1' : tip.share.toFixed(0)} % du total
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default SankeyModal;
