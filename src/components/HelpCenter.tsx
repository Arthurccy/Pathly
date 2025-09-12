import React, { useState } from 'react';
import { HelpCircle, Book, Video, MessageCircle, Search, ChevronDown, ChevronRight } from 'lucide-react';

const HelpCenter: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const faqItems = [
    {
      id: 'getting-started',
      question: 'Comment commencer avec BudgetDiary ?',
      answer: `Pour commencer avec BudgetDiary :
      1. Ajoutez vos comptes bancaires dans la section "Comptes"
      2. Créez vos catégories de revenus et dépenses
      3. Commencez à enregistrer vos transactions
      4. Définissez vos budgets mensuels
      5. Fixez-vous des objectifs d'épargne
      
      L'application vous guidera ensuite avec des tableaux de bord et des analyses automatiques.`
    },
    {
      id: 'recurring-transactions',
      question: 'Comment configurer des transactions récurrentes ?',
      answer: `Les transactions récurrentes vous permettent d'automatiser vos revenus et dépenses réguliers :
      1. Allez dans "Transactions récurrentes"
      2. Cliquez sur "Nouvelle récurrence"
      3. Définissez le montant, la fréquence et la catégorie
      4. L'application générera automatiquement les transactions futures
      
      Vous pouvez suspendre ou modifier une récurrence à tout moment.`
    },
    {
      id: 'budget-tracking',
      question: 'Comment suivre mes budgets ?',
      answer: `Le suivi des budgets se fait automatiquement :
      1. Définissez des budgets par catégorie dans les paramètres
      2. Vos dépenses sont automatiquement comparées aux budgets
      3. Des alertes visuelles vous préviennent en cas de dépassement
      4. Le tableau de bord affiche votre progression en temps réel
      
      Vous pouvez ajuster vos budgets à tout moment selon vos besoins.`
    },
    {
      id: 'savings-goals',
      question: 'Comment utiliser les objectifs d\'épargne ?',
      answer: `Les objectifs d'épargne vous aident à atteindre vos projets :
      1. Créez un objectif avec un montant cible et une échéance
      2. Effectuez des virements vers vos objectifs
      3. Suivez votre progression avec des graphiques visuels
      4. Recevez des rappels pour rester motivé
      
      Vous pouvez avoir plusieurs objectifs en parallèle.`
    },
    {
      id: 'debt-management',
      question: 'Comment gérer mes dettes et crédits ?',
      answer: `La gestion des dettes vous aide à planifier vos remboursements :
      1. Ajoutez vos dettes avec les détails (montant, taux, échéances)
      2. Enregistrez vos paiements au fur et à mesure
      3. Visualisez votre progression de remboursement
      4. Calculez automatiquement les intérêts et la durée de remboursement
      
      L'application vous aide à optimiser votre stratégie de désendettement.`
    },
    {
      id: 'export-data',
      question: 'Comment exporter mes données ?',
      answer: `Vous pouvez exporter vos données en plusieurs formats :
      1. Allez dans "Export & Sauvegarde"
      2. Choisissez la période et le format (CSV, JSON, PDF)
      3. Sélectionnez les données à inclure
      4. Téléchargez votre export
      
      Nous recommandons d'exporter régulièrement vos données pour les sauvegarder.`
    },
    {
      id: 'wealth-simulator',
      question: 'Comment utiliser le simulateur de patrimoine ?',
      answer: `Le simulateur vous aide à projeter votre patrimoine futur :
      1. Saisissez votre patrimoine actuel et votre épargne mensuelle
      2. Définissez vos hypothèses (rendement, inflation, fiscalité)
      3. Visualisez l'évolution sur plusieurs années
      4. Comparez différents scénarios
      
      Cet outil vous aide à planifier votre retraite et vos investissements.`
    },
    {
      id: 'calendar',
      question: 'À quoi sert le calendrier budgétaire ?',
      answer: `Le calendrier vous donne une vue d'ensemble de vos finances :
      1. Visualisez toutes vos transactions et échéances
      2. Anticipez vos flux de trésorerie
      3. Ne manquez plus aucune échéance importante
      4. Planifiez vos dépenses futures
      
      C'est un outil essentiel pour une gestion proactive de votre budget.`
    }
  ];

  const filteredFaq = faqItems.filter(item =>
    item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <HelpCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Centre d'aide
        </h1>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans l'aide..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg mb-4 w-fit mx-auto">
            <Book className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Guide de démarrage
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Apprenez les bases de BudgetDiary en quelques minutes
          </p>
          <button className="text-green-600 dark:text-green-400 hover:underline text-sm font-medium">
            Commencer le guide
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg mb-4 w-fit mx-auto">
            <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Tutoriels vidéo
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Découvrez toutes les fonctionnalités en vidéo
          </p>
          <button className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium">
            Voir les vidéos
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg mb-4 w-fit mx-auto">
            <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Support
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Contactez notre équipe pour une aide personnalisée
          </p>
          <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
            Nous contacter
          </button>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Questions fréquentes
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredFaq.map((item) => (
            <div key={item.id} className="p-6">
              <button
                onClick={() => toggleFaq(item.id)}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="text-base font-medium text-gray-900 dark:text-white pr-4">
                  {item.question}
                </h4>
                {expandedFaq === item.id ? (
                  <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                )}
              </button>
              
              {expandedFaq === item.id && (
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredFaq.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">Aucun résultat trouvé</p>
            <p className="text-sm">Essayez avec d'autres mots-clés</p>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          💡 Conseils pour bien utiliser BudgetDiary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Soyez régulier
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Enregistrez vos transactions quotidiennement pour un suivi précis. 
              Utilisez les transactions récurrentes pour automatiser.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Catégorisez finement
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Plus vos catégories sont précises, plus vos analyses seront utiles. 
              N'hésitez pas à créer des sous-catégories.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Fixez des objectifs réalistes
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Commencez par des budgets et objectifs atteignables. 
              Vous pourrez les ajuster au fil du temps.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Sauvegardez régulièrement
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Exportez vos données chaque mois pour éviter toute perte. 
              Vos données sont précieuses !
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;