import React, { useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { CashFlow, Category } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SankeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashFlow: CashFlow | null;
  categories: Category[];
}

const CustomNode = (props: any) => {
  const { x, y, width, height, index, payload, containerWidth } = props;
  const isOut = x + width + 50 > (containerWidth || 800);
  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.fill || '#3b82f6'}
        fillOpacity="1"
      />
      <text
        textAnchor={isOut ? 'end' : 'start'}
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2}
        fontSize="12"
        stroke="#333"
        strokeWidth="0"
        fill="#333"
        className="dark:fill-gray-300"
        dominantBaseline="middle"
      >
        {
          payload.name.length > 20
            ? payload.name.slice(0, 20) + '...'
            : payload.name
        }
      </text>
    </Layer>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(data.value);
    
    // For links
    if (data.source && data.target) {
      return (
        <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-sm z-50">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.source.name} → {data.target.name}</p>
          <p className="text-blue-600 dark:text-blue-400">{value}</p>
        </div>
      );
    }
    
    // For nodes
    return (
      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-sm text-sm z-50">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{data.name}</p>
        <p className="text-blue-600 dark:text-blue-400">{value}</p>
      </div>
    );
  }
  return null;
};

const SankeyModal: React.FC<SankeyModalProps> = ({ isOpen, onClose, cashFlow, categories }) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const data = useMemo(() => {
    if (!cashFlow || !cashFlow.allTransactions) return null;

    const nodes: { name: string; fill: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];

    const getNodeIndex = (name: string, color: string) => {
      const existing = nodes.findIndex(n => n.name === name);
      if (existing !== -1) return existing;
      nodes.push({ name, fill: color });
      return nodes.length - 1;
    };

    const rootIndex = getNodeIndex('Mois', '#94a3b8');

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    
    // Build maps from allTransactions
    cashFlow.allTransactions.forEach(t => {
      if (t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal') {
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat ? cat.name : 'Revenus divers';
        incomeMap.set(name, (incomeMap.get(name) || 0) + t.amount);
      } else if (t.type === 'expense' || t.type === 'bill') {
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat ? cat.name : 'Dépenses diverses';
        expenseMap.set(name, (expenseMap.get(name) || 0) + t.amount);
      }
    });

    let totalInputs = 0;
    incomeMap.forEach((amount, name) => {
      if (amount <= 0.01) return;
      const idx = getNodeIndex(name, '#10b981'); // Green
      links.push({ source: idx, target: rootIndex, value: amount });
      totalInputs += amount;
    });

    let totalOutputs = 0;
    expenseMap.forEach((amount, name) => {
      if (amount <= 0.01) return;
      const cat = categories.find(c => c.name === name);
      const color = cat?.color || '#ef4444';
      const idx = getNodeIndex(name, color);
      links.push({ source: rootIndex, target: idx, value: amount });
      totalOutputs += amount;
    });

    // Use aggregated values for other outflows
    const savingsAmount = cashFlow.savings || 0;
    if (savingsAmount > 0.01) {
      const idx = getNodeIndex('Épargne', '#8b5cf6'); // Purple
      links.push({ source: rootIndex, target: idx, value: savingsAmount });
      totalOutputs += savingsAmount;
    }

    const transfersAmount = cashFlow.transfersOut || 0;
    if (transfersAmount > 0.01) {
      const idx = getNodeIndex('Virements externes', '#f59e0b'); // Amber
      links.push({ source: rootIndex, target: idx, value: transfersAmount });
      totalOutputs += transfersAmount;
    }

    const budgetReserve = cashFlow.budgetReserve || 0;
    if (budgetReserve > 0.01) {
      const idx = getNodeIndex('Budgets libres', '#3b82f6'); // Blue
      links.push({ source: rootIndex, target: idx, value: budgetReserve });
      totalOutputs += budgetReserve;
    }
    
    // Add Debt Payments
    const debtPayments = cashFlow.debtPayments || 0;
    if (debtPayments > 0.01) {
      const idx = getNodeIndex('Dettes', '#f43f5e'); // Rose
      links.push({ source: rootIndex, target: idx, value: debtPayments });
      totalOutputs += debtPayments;
    }

    // Balance the diagram to ensure it renders correctly
    // The sum of values of links entering a node should equal the sum of links leaving it
    // EXCEPT for root node since we handle deficit/surplus explicitly
    
    if (totalInputs < totalOutputs) {
      const deficit = totalOutputs - totalInputs;
      if (deficit > 0.01) {
        const idx = getNodeIndex('Déficit / Solde courant', '#f43f5e');
        links.push({ source: idx, target: rootIndex, value: deficit });
      }
    } else if (totalInputs > totalOutputs) {
      const surplus = totalInputs - totalOutputs;
      if (surplus > 0.01) {
        const idx = getNodeIndex('Excédent', '#14b8a6');
        links.push({ source: rootIndex, target: idx, value: surplus });
      }
    }

    if (links.length === 0) return null;

    return { nodes, links };
  }, [cashFlow, categories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="flex flex-col w-full max-w-5xl max-h-full overflow-hidden bg-white shadow-xl dark:bg-gray-800 rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Diagramme de flux de trésorerie
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {cashFlow && cashFlow.date ? format(cashFlow.date, 'MMMM yyyy', { locale: fr }) : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ height: '60vh', minHeight: '400px' }}>
          {data ? (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={data}
                nodePadding={30}
                margin={{ top: 20, right: 150, bottom: 20, left: 150 }}
                link={{ stroke: '#cbd5e1', strokeOpacity: 0.4 }}
                node={<CustomNode />}
              >
                <Tooltip content={<CustomTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Aucune donnée à afficher pour ce mois.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SankeyModal;
