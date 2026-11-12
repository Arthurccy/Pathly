# Durcissement de Pathly

## Modifications livrées

- Suppression du conseiller Gemini, de son SDK et des références aux variables Gemini.
- Retrait des connecteurs Bridge/GoCardless côté navigateur et des proxies correspondants. L'écran de synchronisation indique que l'import CSV reste disponible. Les identifiants déjà stockés par ces anciens connecteurs sont supprimés du localStorage au démarrage.
- Suppression de l'apprentissage communautaire automatique des libellés bancaires. Les règles personnelles d'import restent disponibles.
- Caches financiers séparés par identifiant utilisateur, contexte React recréé à chaque changement de compte, temporisation d'enregistrement immobilier annulée au démontage.
- Ancien Pathly.zip retiré du dépôt : il contenait une copie du code supprimé. Une copie de récupération privée est conservée hors du checkout dans l'environnement de travail. L'historique Git reste inchangé ; les secrets bancaires précédemment exposés doivent être révoqués chez leurs fournisseurs s'ils sont valides.
- Mise à jour des dépendances verrouillées et passage à Vite 7. Utiliser Node 24 pour l'installation, les tests et le build, y compris dans Vercel.

Les anciens caches financiers sans identifiant ne sont pas attribués automatiquement à un compte : cela pourrait importer les données d'une autre personne sur un navigateur partagé. Les données déjà synchronisées dans Supabase restent récupérées normalement. Si des données n'existaient que dans ces anciens caches, les récupérer manuellement après vérification du propriétaire.

## Mise en production

1. Garder VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY. Supprimer les anciennes variables Gemini, Bridge et GoCardless des configurations de déploiement. Si une clé Gemini a seulement été supprimée dans Vercel, la révoquer aussi chez Google ; les anciens bundles peuvent encore la contenir.
2. Vérifier une sauvegarde de la base. Tester la migration `supabase/migrations/20261112090000_security_hardening.sql` sur un projet de test puis l'appliquer une seule fois à Supabase. Elle ferme les tables communautaires sans effacer leurs données et vérifie l'appartenance des relations financières. L'utilisateur a fourni une capture de son exécution réussie dans Supabase. Ne pas la réappliquer si elle a déjà été exécutée ; les règles déployées n'ont pas été relues directement depuis cette session.
3. Déployer le nouveau frontend. L'ancien frontend peut encore tenter d'interroger les règles communautaires jusqu'au redéploiement ; ces erreurs étaient déjà tolérées dans le flux d'import.
4. Tester connexion, import CSV, création/modification de comptes, catégories, transactions, épargne et dettes. Tester avec deux utilisateurs synthétiques pour la future V2. Les anciennes données ayant des références entre propriétaires ne sont pas réparées automatiquement : une mise à jour de ces lignes pourra désormais être refusée.
5. Pour l'usage personnel, désactiver les nouvelles inscriptions dans Supabase Auth une fois le compte propriétaire créé ; vérifier MFA administrateur, membres du projet et URLs de redirection autorisées. Ces réglages ne sont pas gérables par le code livré ici.

## Validation locale

Commandes : `npm ci`, `npm run build`, `npm test`, `npm audit --omit=dev`.

Le test de sécurité utilise PostgreSQL embarqué (PGlite), les migrations réelles du dépôt, des rôles anon/authenticated et deux utilisateurs fictifs. Il teste lectures/écritures isolées, références étrangères interdites, snapshots, parent de catégorie et accès communautaires. Il ne reproduit pas tout Supabase Auth ni tous les paramètres de production.

Résultats du 12 novembre 2026 : 34 tests réussis, build réussi, page d'accueil rendue dans Chromium sans exception JavaScript. Audit des dépendances de production : aucune vulnérabilité signalée. L'audit complet ne signale plus de vulnérabilité. Une surcharge ciblée de minimatch 11 corrige l'alerte transitive de typescript-eslint ; le lint et TypeScript valident son utilisation. Le lint (avec zéro avertissement autorisé), TypeScript et le build passent. Ces contrôles ne constituent pas une certification de sécurité complète. Le parcours connecté réel n'a pas été exécuté.

## CIC / Woob

Le connecteur n'est pas installé dans cette modification. Prévoir une VM dédiée et un worker privé qui initie les connexions sortantes, sans ouvrir Portainer/Proxmox ni une API bancaire au public. Vérifier le module CIC et le parcours MFA sur un environnement de test. Les identifiants bancaires doivent rester sur ce serveur, avec des droits Supabase minimaux. Le frontend peut rester sur Vercel : déplacer l'hébergement ne remplace ni RLS ni l'isolation des secrets.

## Contrôles permanents et corrections complémentaires

La CI `.github/workflows/quality.yml` exécute installation verrouillée, lint sans avertissement, TypeScript, tests, build et audit de dépendances. Les règles ESLint restent activées. Les pages sont chargées à la demande et le bundle Supabase séparé ; le build ne présente plus l'avertissement de taille des chunks.

Les exports CSV neutralisent les formules dans les champs texte et échappent séparateurs, guillemets et retours à la ligne tout en conservant les nombres. Les routes boursières publiques imposent méthodes, tailles, caractères, limite de 20 symboles uniques et délai réseau de 8 secondes ; cela ne remplace pas des limites de débit globales chez l'hébergeur.

L'import annule les requêtes trop lentes et ne les rejoue pas lorsque l'issue serveur est incertaine. Après un tel message, recharger et rapprocher les transactions avant une nouvelle tentative. Seules les erreurs d'intégrité SQL confirmées permettent une reprise ligne par ligne.

Un ancien nettoyage automatique de dettes au montage a été retiré pour éviter la suppression heuristique de données. L'agrégation analytics et le formulaire de transfert ont été corrigés ; la destination est transmise et les comptes actifs/devise/montant contrôlés.

Méthode : revue ciblée guidée par la compétence Cloudflare security-audit, en complément des tests locaux. Aucun audit Cloudflare complet ni test d'intrusion des services de production n'est revendiqué. Les réglages Auth/organisation, les en-têtes réellement déployés et le futur connecteur CIC/Woob restent des vérifications distinctes.
