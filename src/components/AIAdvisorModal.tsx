import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { CashFlow, Category } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashFlow: CashFlow | null;
  categories: Category[];
}

// Very simple markdown parser for bold and lists
const renderMarkdown = (text: string) => {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    
    // Headers
    if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-100">{line.replace('### ', '')}</h3>;
    if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-5 mb-3 text-slate-900 dark:text-white">{line.replace('## ', '')}</h2>;
    if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-slate-900 dark:text-white">{line.replace('# ', '')}</h1>;
    
    // Lists
    if (line.startsWith('* ') || line.startsWith('- ')) {
      const parts = line.substring(2).split('**');
      return (
        <li key={i} className="ml-5 list-disc mt-1 text-slate-700 dark:text-slate-300">
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-slate-900 dark:text-white">{part}</strong> : part)}
        </li>
      );
    }
    
    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      const textPart = line.replace(/^\d+\.\s/, '');
      const parts = textPart.split('**');
      return (
        <li key={i} className="ml-5 list-decimal mt-1 text-slate-700 dark:text-slate-300">
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-slate-900 dark:text-white">{part}</strong> : part)}
        </li>
      );
    }

    // Paragraphs with inline bold
    const parts = line.split('**');
    return (
      <p key={i} className="mt-2 text-slate-700 dark:text-slate-300">
        {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-slate-900 dark:text-white">{part}</strong> : part)}
      </p>
    );
  });
};

const AIAdvisorModal: React.FC<AIAdvisorModalProps> = ({ isOpen, onClose, cashFlow, categories }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reset state when modal opens for a new month
  useEffect(() => {
    if (isOpen) {
      setAdvice(null);
      setError(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, cashFlow?.date]);

  const money = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

  const generateAdvice = async () => {
    // Check if key exists in env
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      setError("Clé API manquante.");
      return;
    }
    
    if (!cashFlow) return;

    setLoading(true);
    setError(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      let prompt = `Tu es un conseiller financier expert, bienveillant, constructif et très synthétique. Ton rôle est d'analyser le budget du mois ci-dessous et de me donner 3 astuces ou actions concrètes pour optimiser mon budget. Utilise le vouvoiement. Ne fais pas de longue introduction.\n\n`;
      
      prompt += `--- Données du mois ---\n`;
      prompt += `Revenus totaux : ${cashFlow.income} €\n`;
      prompt += `Dépenses totales (hors épargne) : ${cashFlow.expenses} €\n`;
      prompt += `Épargne planifiée : ${cashFlow.savings} €\n`;
      prompt += `Budgets libres (reste à vivre) : ${cashFlow.budgetReserve} €\n`;
      prompt += `Résultat net du mois : ${cashFlow.planBalance} € (Si négatif, cela signifie un déficit pour ce mois).\n\n`;

      if (cashFlow.allTransactions && cashFlow.allTransactions.length > 0) {
        prompt += `Détail des dépenses :\n`;
        const expenseMap = new Map<string, number>();
        cashFlow.allTransactions.forEach(t => {
          if (t.type === 'expense' || t.type === 'bill') {
            const cat = categories.find(c => c.id === t.categoryId);
            const name = cat ? cat.name : 'Divers';
            expenseMap.set(name, (expenseMap.get(name) || 0) + t.amount);
          }
        });
        
        // Sort expenses by amount descending
        const sortedExpenses = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]);
        sortedExpenses.forEach(([name, amount]) => {
          if (amount > 0) {
            prompt += `- ${name} : ${amount} €\n`;
          }
        });
      }

      prompt += `\nFormat de réponse attendu :\n1 courte phrase d'analyse globale de la situation.\nEnsuite, une liste numérotée de 3 conseils clairs et actionnables. Mets les mots clés en gras avec **mot**.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setAdvice(response.text());
    } catch (err: any) {
      console.error(err);
      setError(`Erreur lors de la communication avec l'IA : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasApiKey = !!import.meta.env.VITE_GEMINI_API_KEY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="flex flex-col w-full max-w-2xl max-h-full overflow-hidden bg-white shadow-xl dark:bg-slate-800 rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/50 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Conseiller IA
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Analyse de {cashFlow && cashFlow.date ? format(cashFlow.date, 'MMMM yyyy', { locale: fr }) : 'ce mois'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 transition-colors rounded-lg hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {!hasApiKey ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 dark:bg-amber-950/30 dark:border-amber-900/50">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    Configuration requise
                  </h4>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    Pour utiliser le conseiller IA, vous devez configurer votre clé d'API personnelle Gemini. Cette clé restera stockée uniquement sur votre ordinateur.
                  </p>
                  <div className="mt-4 p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-900 text-sm font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
                    1. Créez un fichier <strong>.env.local</strong> à la racine du projet<br/>
                    2. Ajoutez la ligne suivante :<br/>
                    <span className="text-indigo-600 dark:text-indigo-400">VITE_GEMINI_API_KEY=votre_cle_api_ici</span><br/>
                    3. Redémarrez le serveur de développement
                  </div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 dark:bg-red-950/30 dark:border-red-900/50">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 rounded-lg text-red-600 dark:bg-red-900/50 dark:text-red-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-red-800 dark:text-red-300">
                    Erreur de génération
                  </h4>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-400/90">
                    {error}
                  </p>
                  <button 
                    onClick={generateAdvice}
                    className="mt-4 px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/80"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            </div>
          ) : !advice ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Prêt à analyser vos finances ?
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                L'IA va croiser vos revenus ({cashFlow?.income ? money(cashFlow.income) : '0 €'}) et vos dépenses pour vous proposer des optimisations sur mesure pour ce mois.
              </p>
              <button
                onClick={generateAdvice}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Générer mon conseil
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed prose-li:leading-relaxed">
              {renderMarkdown(advice)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAdvisorModal;
