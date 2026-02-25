# TODO List pour les Développeurs - BudgetDiary

## 📋 Vue d'ensemble
Ce document liste les tâches de développement pour améliorer l'application BudgetDiary, notamment l'import bancaire simplifié et les corrections de bugs.

---

## ✅ Bugs Corrigés

### 1. ✅ Bouton de déconnexion - charge en boucle
**Status:** Corrigé
**Fichier:** `src/components/Header.tsx`
**Problème:** Le composant utilisait `setIsLoading` qui n'était pas défini localement
**Solution:** Ajout d'un état local `isLoggingOut` avec `useState` pour gérer l'état de chargement indépendamment

### 2. ✅ Pourcentages aléatoires sur le tableau de bord
**Status:** Corrigé
**Fichier:** `src/components/Dashboard.tsx`
**Problème:** Les pourcentages de changement étaient codés en dur (ex: '+12.5%', '-3.2%')
**Solution:** 
- Calcul de la période précédente (mois ou année précédente selon le mode de vue)
- Calcul réel des variations en comparant les totaux actuels avec ceux de la période précédente
- Fonction `calculateChange()` pour calculer le pourcentage de variation
- Affichage de "—" si aucune donnée de comparaison n'est disponible

### 3. ⚠️ Titre BudgetDiary - positionnement
**Status:** À vérifier
**Fichier:** `src/components/Header.tsx`
**Note:** Le code semble correct avec les classes Tailwind appropriées. Nécessite une vérification visuelle dans l'interface pour identifier le problème spécifique.

---

## 🚀 Feature: Import Bancaire Simplifié

### Objectif
Permettre aux utilisateurs d'importer directement leurs exports bancaires sans avoir à créer manuellement un fichier CSV. Cela simplifie l'expérience utilisateur en acceptant les formats natifs des banques.

### Contexte Actuel
- ✅ Import CSV existant avec mapping manuel des colonnes
- ✅ Système de règles de catégorisation automatique
- ✅ Détection des doublons
- ✅ Interface de prévisualisation avant import

### Tâches à Réaliser

#### Phase 1: Analyse et Préparation
- [ ] **1.1** Rechercher les formats d'export des principales banques françaises
  - Formats propriétaires (CSV personnalisés)
  - Standards internationaux (OFX, QIF, MT940, CAMT.053)
  - Documenter les variations de format par banque
  
- [ ] **1.2** Définir l'architecture du système de détection
  - Créer un système de "détecteurs" de format
  - Définir une interface commune pour tous les parsers
  - Prévoir l'extensibilité pour ajouter de nouvelles banques

#### Phase 2: Implémentation Backend

- [ ] **2.1** Ajouter les dépendances nécessaires
  ```bash
  npm install ofx-js  # Pour OFX
  npm install node-qif # Pour QIF (si disponible)
  # Rechercher des bibliothèques pour MT940, CAMT.053
  ```

- [ ] **2.2** Créer le service de détection de format
  - **Fichier:** `src/services/bankFormatDetector.ts`
  - Analyser les premières lignes/octets du fichier
  - Identifier le format (OFX/QIF/MT940/CSV personnalisé)
  - Retourner le type de format détecté

- [ ] **2.3** Créer les parsers spécifiques
  - **Fichier:** `src/services/parsers/ofxParser.ts` - Parser OFX
  - **Fichier:** `src/services/parsers/qifParser.ts` - Parser QIF
  - **Fichier:** `src/services/parsers/mt940Parser.ts` - Parser MT940
  - **Fichier:** `src/services/parsers/csvBankParser.ts` - Parser CSV avec templates banques
  - Interface commune: `BankTransactionParser`

- [ ] **2.4** Créer les templates pour banques françaises populaires
  - **Fichier:** `src/services/bankTemplates.ts`
  - Templates pour: Crédit Agricole, BNP Paribas, Société Générale, La Banque Postale, Caisse d'Épargne, etc.
  - Structure de mapping prédéfinie pour chaque banque
  - Patterns de reconnaissance (en-têtes spécifiques, format de date, etc.)

- [ ] **2.5** Intégrer avec le service d'import existant
  - **Fichier:** `src/services/importService.ts`
  - Ajouter méthode `detectAndParseBank(file: File): Promise<ParsedTransaction[]>`
  - Gérer les erreurs de parsing
  - Fallback vers l'import CSV manuel si détection échoue

#### Phase 3: Interface Utilisateur

- [ ] **3.1** Améliorer l'écran d'upload
  - **Fichier:** `src/components/ImportCSV.tsx` (renommer en `ImportTransactions.tsx`)
  - Accepter plusieurs types de fichiers (.ofx, .qif, .csv, .txt, .940, .xml)
  - Ajouter un message clair: "Importez votre export bancaire directement"
  - Détection automatique dès l'upload

- [ ] **3.2** Créer un sélecteur de banque optionnel
  - Composant dropdown avec logos des banques
  - Permet de forcer un template si détection automatique échoue
  - "Je ne trouve pas ma banque" → fallback vers mapping manuel

- [ ] **3.3** Améliorer le feedback utilisateur
  - Afficher le format détecté: "Format OFX détecté - Export Crédit Agricole"
  - Message d'erreur explicite si format non reconnu
  - Guide rapide pour chaque banque (comment obtenir l'export)

- [ ] **3.4** Créer une page d'aide spécifique
  - **Fichier:** `src/components/BankImportGuide.tsx`
  - Instructions pour chaque banque supportée
  - Screenshots du processus d'export
  - Lien vers cette page depuis ImportTransactions

#### Phase 4: Tests et Documentation

- [ ] **4.1** Tests unitaires
  - Tester chaque parser avec des exemples réels
  - Tester la détection de format
  - Tester les cas limites et erreurs

- [ ] **4.2** Tests d'intégration
  - Import complet de fichiers exemples
  - Vérifier la cohérence des données importées
  - Tester avec différentes banques

- [ ] **4.3** Documentation technique
  - **Fichier:** `docs/BANK_IMPORT.md`
  - Architecture du système
  - Comment ajouter une nouvelle banque
  - Format des templates

- [ ] **4.4** Documentation utilisateur
  - Mettre à jour `src/components/HelpCenter.tsx`
  - Guide pas à pas pour l'import bancaire
  - FAQ sur les formats supportés

#### Phase 5: Améliorations Futures

- [ ] **5.1** Système de plugins pour banques
  - Permettre l'ajout de templates via configuration JSON
  - Interface admin pour gérer les templates

- [ ] **5.2** Machine Learning pour améliorer la détection
  - Utiliser l'historique des imports réussis
  - Améliorer la reconnaissance automatique

- [ ] **5.3** Synchronisation automatique
  - API connection avec les banques (PSD2)
  - Import automatique régulier
  - Nécessite backend sécurisé

---

## 📚 Ressources et Références

### Standards Bancaires
- **OFX (Open Financial Exchange):** Format XML standard pour les transactions financières
- **QIF (Quicken Interchange Format):** Format texte ancien mais encore utilisé
- **MT940:** Standard SWIFT pour les relevés bancaires
- **CAMT.053:** Standard ISO 20022 pour les relevés (XML)

### Bibliothèques NPM Potentielles
- `ofx-js` - Parser OFX pour JavaScript
- `node-qif` - Parser QIF
- Rechercher: parsers MT940 et CAMT.053 pour JavaScript/TypeScript

### Banques Françaises à Supporter (Priorité)
1. Crédit Agricole
2. BNP Paribas
3. Société Générale
4. La Banque Postale
5. Caisse d'Épargne
6. Crédit Mutuel
7. Boursorama
8. Fortuneo
9. N26
10. Revolut

---

## 🔧 Configuration Technique

### Modifications de Configuration Nécessaires

#### vite.config.ts
Aucune modification prévue pour l'instant

#### package.json
Ajouter les nouvelles dépendances:
```json
{
  "dependencies": {
    "ofx-js": "^version",
    // Autres parsers selon disponibilité
  }
}
```

#### tsconfig.json
Aucune modification prévue

---

## 📝 Notes de Développement

### Complexité
- **Backend/Parsing:** Augmente significativement (support multi-formats)
- **UX:** Simplifie drastiquement (un clic vs mapping manuel)
- **Maintenance:** Templates à maintenir par banque

### Risques
- Formats propriétaires peuvent changer sans préavis
- Tous les exports ne contiennent pas les mêmes informations
- Encodage des fichiers peut varier (UTF-8, ISO-8859-1, etc.)

### Recommandations
1. Commencer avec 2-3 banques populaires pour valider l'approche
2. Garder le système de mapping manuel comme fallback
3. Collecter des exemples réels de fichiers d'export (anonymisés)
4. Implémenter une télémétrie pour suivre les formats non reconnus

---

## ✅ Checklist de Validation

Avant de considérer la feature terminée:

- [ ] Au moins 3 formats bancaires différents sont supportés
- [ ] L'import CSV manuel fonctionne toujours comme fallback
- [ ] Les tests couvrent les cas principaux
- [ ] La documentation utilisateur est à jour
- [ ] La documentation technique est complète
- [ ] Les performances restent acceptables (fichiers jusqu'à 2 Mo)
- [ ] L'interface est intuitive (test utilisateur)
- [ ] Les messages d'erreur sont clairs et utiles

---

## 🎯 Priorités de Développement

### Court terme (Sprint actuel)
1. ✅ Corriger les bugs existants
2. Créer l'architecture du système de détection

### Moyen terme (Prochains sprints)
1. Implémenter support OFX (format le plus standard)
2. Ajouter templates pour 2-3 banques populaires
3. Tests et documentation

### Long terme (Roadmap)
1. Compléter le support de toutes les banques françaises majeures
2. Support formats supplémentaires (QIF, MT940)
3. Amélioration continue basée sur les retours utilisateurs

---

*Document créé le: 2026-01-09*
*Dernière mise à jour: 2026-01-09*
