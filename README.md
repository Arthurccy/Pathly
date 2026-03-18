# Pathly - Plan de Travail Produit et Technique

Ce document est le guide principal des prochaines taches pour faire evoluer Pathly.
Il remplace une simple TODO liste par un plan actionnable: priorites, jalons, definition of done, tests, risques, et plan 30/60/90 jours.

## 1. Vision Produit

Pathly est une application de gestion budgetaire personnelle orientee simplicite:
- suivre revenus, depenses, budgets, objectifs d'epargne
- visualiser les tendances (dashboard et analytics)
- accelerer la saisie/import des transactions
- fiabiliser la categorisation automatique

Objectif du semestre:
- livrer un MVP stable et demonstrable en soutenance
- simplifier l'import de transactions sur des fichiers de test realistes
- garder une base de code propre, testable, et facile a expliquer

## 2. Situation Actuelle

D'apres le codebase actuel:
- Stack: React + TypeScript + Vite + Tailwind + Supabase
- Composants metier deja presents: dashboard, budget, savings goals, debt, import/export, recurring transactions, rules manager
- Base import existante: `ImportCSV` + service d'import
- Documentation existante: `TODO_DEV.md` et `SUMMARY.md`

Points deja traites recemment: 
- bug spinner de deconnexion
- pourcentages dashboard passes en calcul dynamique

## 3. Principes de Priorisation

Ordre de priorite a respecter:
1. Fiabilite des donnees (integrite et calculs)
2. Flux utilisateur critiques (import, creation transaction, dashboard)
3. Observabilite et tests
4. Vitesse d'execution (perf front + requetes)
5. Extensions produit (fonctionnalites avancees)

## 4. Objectifs Mesurables (KPIs)

KPIs a suivre a chaque sprint (niveau etudiant):
- taux de succes import sur fichiers de test (objectif: >= 90%)
- temps moyen import d'un fichier standard (objectif: <= 15 sec)
- taux d'erreur runtime front sur parcours principal (objectif: faible et non bloquant)
- couverture tests unitaires services critiques (objectif: >= 50%)
- taux de categorisation automatique correcte sur dataset de reference (objectif: >= 75%)
- temps de chargement dashboard (objectif: percu fluide en demo)

## 5. Roadmap Globale

## Phase A - Stabilisation Core (Semaine 1 a 2)

Objectif:
- fiabiliser le coeur metier avant de livrer de grosses features

Taches:
- [ ] audit des calculs du dashboard (revenus, depenses, soldes, comparaisons)
- [ ] verifier coherence multi-comptes dans `AccountManager` et `AccountsOverview`
- [ ] valider gestion timezone/date pour toutes les transactions
- [ ] centraliser les garde-fous anti-doublons import
- [ ] ajouter logs explicites cote services critiques
- [ ] corriger incoherences UI texte et libelles (Pathly vs BudgetDiary si necessaire)

Livrables:
- [ ] checklist de validation des calculs
- [ ] patch correctif sur bugs detectes
- [ ] mini rapport de non-regression

Definition of done:
- aucun bug bloquant sur dashboard/import
- build et lint propres
- jeux de tests de base green

## Phase B - Import de Releves Simules V2 (Semaine 3 a 6)

Objectif:
- importer des releves de test (formats courants) avec fallback CSV manuel

Taches:
- [ ] creer `bankFormatDetector` (detection OFX/QIF/MT940/CSV)
- [ ] definir interface unique de parser (input, output, erreurs)
- [ ] implementer parser OFX prioritaire
- [ ] implementer parser QIF
- [ ] creer parser CSV a templates banque
- [ ] brancher le tout dans `importService`
- [ ] supporter fallback manuel si auto-detection echoue
- [ ] afficher format detecte et feedback clair en UI
- [ ] ajouter guide d'aide import par banque

Livrables:
- [ ] import automatique fonctionnel sur 2-3 profils d'export fictifs
- [ ] support CSV template + 1 format standard (OFX ou QIF)
- [ ] messages d'erreur exploitables pour utilisateur

Definition of done:
- import successful sur jeux de fichiers exemples
- mapping transaction coherent (date, montant, libelle, categorie)
- fallback manuel toujours operationnel

## Phase C - Qualite, Tests et DX (Semaine 6 a 8)

Objectif:
- reduire le risque de regression et augmenter la vitesse de dev

Taches:
- [ ] ajouter tests unitaires sur services import/parsing
- [ ] ajouter tests unitaires sur fonctions de calcul dashboard
- [ ] ajouter tests d'integration front sur parcours critiques
- [ ] definir fixtures de donnees anonymisees realistes
- [ ] mettre en place conventions de logs erreurs
- [ ] enrichir doc technique (architecture import, ajout d'une banque)

Livrables:
- [ ] suite tests mini fiable
- [ ] guide contribution dev
- [ ] template d'ajout de nouveau parser

Definition of done:
- couverture minimum atteinte sur modules critiques
- scenarios d'integration stables en CI locale

## Phase D - UX Avancee et Retention (Semaine 9 a 12)

Objectif:
- augmenter adoption et comprehension des insights

Taches:
- [ ] ameliorer onboarding utilisateur
- [ ] enrichir vue analytics (tendances, alertes budgets)
- [ ] ajouter indicateurs de confiance sur donnees importees
- [ ] optimiser performance charts sur grands volumes
- [ ] affiner navigation et architecture informationnelle

Livrables:
- [ ] parcours utilisateur simplifie
- [ ] dashboard plus lisible et actionnable

Definition of done:
- temps d'acces aux infos cles reduit
- retours utilisateurs internes positifs

## 6. Backlog Detaille Par Domaine

## 6.1 Donnees et Domaine

- [ ] definir schema transaction canonique unique (source manuelle, CSV, OFX, QIF)
- [ ] garantir idempotence import (hash robuste)
- [ ] uniformiser gestion devise
- [ ] formaliser regles de categorisation auto (priorite, exceptions)
- [ ] tracer provenance transaction (source, parser, date import)

## 6.2 Frontend

- [ ] renommer `ImportCSV.tsx` vers `ImportTransactions.tsx`
- [ ] rendre les etats de chargement coherents sur tous les ecrans
- [ ] gerer vide, erreur, succes de maniere uniforme
- [ ] ameliorer accessibilite de base (labels, focus, contrastes)
- [ ] ajouter skeletons ou placeholders sur dashboards lourds

## 6.3 Services et Infra Applicative

- [ ] separer clairement service parsing et service orchestration import
- [ ] creer couche de validation centralisee des donnees importees
- [ ] standardiser les erreurs techniques en erreurs metier lisibles
- [ ] verifier contraintes Supabase et indexes utiles

## 6.4 Performance

- [ ] profiler rendus graphiques et composants lourds
- [ ] memoiser calculs repetitifs cote dashboard
- [ ] paginer ou virtualiser listes de transactions longues
- [ ] limiter recalculs sur changement de filtre

## 6.5 Securite et Conformite

- [ ] verifier que aucune cle sensible n'est exposee en front
- [ ] reviser policies Supabase (RLS) si necessaire
- [ ] minimiser donnees sensibles stockees en clair
- [ ] clarifier politique de conservation donnees importees

## 7. Quick Wins (A faire tout de suite)

- [ ] creer un `README` operationnel (ce document)
- [ ] ajouter section scripts et commandes frequentes
- [ ] valider une checklist de release simple
- [ ] ajouter une convention de nommage des branches
- [ ] harmoniser messages d'erreur visibles utilisateur

## 8. Risques et Mitigations

Risque:
- formats bancaires heterogenes et instables
Mitigation:
- templates versionnes + fallback manuel

Risque:
- regressions silencieuses sur calculs financiers
Mitigation:
- tests unitaires de reference + fixtures golden

Risque:
- augmentation complexite import
Mitigation:
- architecture modulaire parser par parser

Risque:
- performance degradee avec gros volumes
Mitigation:
- profiling + memoization + virtualisation

## 9. Plan 30/60/90 Jours

## J+30

- [ ] baseline qualite (lint/build/tests minimum)
- [ ] audit bugs critiques et correctifs
- [ ] spec technique Import V2 validee

## J+60

- [ ] OFX ou QIF + CSV templates operationnels
- [ ] UI import amelioree avec feedback format
- [ ] tests unitaires services critiques en place

## J+90

- [ ] couverture profils d'export prioritaires supportee
- [ ] perf dashboard amelioree
- [ ] doc dev complete pour ajout parser/banque

## 10. Definition Of Ready (DoR)

Une tache est PRETE si:
- [ ] probleme utilisateur clairement decrit
- [ ] scope technique defini
- [ ] dependances identifiees
- [ ] criteres d'acceptation listes
- [ ] risque principal documente

## 11. Definition Of Done (DoD)

Une tache est TERMINEE si:
- [ ] code mergeable (lint/build ok)
- [ ] tests pertinents ajoutes ou maj
- [ ] verification manuelle parcours cible
- [ ] doc impactee mise a jour
- [ ] rollback plan basique connu

## 12. Processus de Travail Recommande

Cycle par ticket:
1. Spec courte
2. Implementation incrementale
3. Tests
4. Relecture technique
5. Validation metier
6. Merge

Rythme conseille:
- sprint court de 1 semaine
- demo fin de sprint
- retro actionnable

## 13. Commandes Utiles

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## 14. Structure Cible (Import V2)

```text
src/
  services/
    bankFormatDetector.ts
    bankTemplates.ts
    parsers/
      ofxParser.ts
      qifParser.ts
      mt940Parser.ts
      csvBankParser.ts
  components/
    ImportTransactions.tsx
    BankImportGuide.tsx
```

## 15. Profils d'Export Prioritaires (MVP Etudiant)

Priorite 1:
- Profil A: CSV simple (date, libelle, montant)
- Profil B: CSV avec montant debit/credit separes
- Profil C: CSV avec date locale (JJ/MM/AAAA)

Priorite 2:
- Profil D: OFX minimal
- Profil E: QIF minimal

Priorite 3:
- Profil F: CSV bruitte (colonnes en trop, en-tetes variables)
- Profil G: CSV avec encodage heterogene
- Profil H: fichier partiellement invalide (tests robustesse)

## 16. Checklist Release

Avant release:
- [ ] build propre
- [ ] lint propre
- [ ] parcours import teste
- [ ] parcours dashboard teste
- [ ] message de changelog prepare

Apres release:
- [ ] monitorer erreurs runtime
- [ ] collecter retours utilisateurs
- [ ] planifier patch correctif si besoin

## 17. Prochaine Action Immediate

Lancer `Phase A - Stabilisation Core` avec 3 tickets:
1. Audit calculs dashboard
2. Uniformisation gestion des erreurs import
3. Plan de tests unitaires sur services critiques

---

Document maintenu pour le pilotage execution Pathly.
Derniere mise a jour: 2026-03-18
