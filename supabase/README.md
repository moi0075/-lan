# Comptes Élan

La connexion Google et la connexion e-mail/mot de passe passent par Supabase Auth avec PKCE. La clé publiée dans le navigateur est une clé **publishable**, jamais une clé secrète ni `service_role`.

## Configuration du site

Copier `.env.example` vers `.env.local`, renseigner la clé publique du projet Supabase, puis redémarrer Vite. Les variables `VITE_*` sont intégrées à la compilation : les renseigner aussi chez l’hébergeur avant de construire le site.

Les migrations du dossier `migrations/` sont déjà appliquées au projet `edogylmvtddskmikshyr`. Sur un nouveau projet, les appliquer une seule fois dans l’ordre. La première crée une sauvegarde par compte avec des règles RLS de lecture et écriture réservées à `auth.uid()`.

## Activation Google

1. Dans [Google Auth Platform](https://console.cloud.google.com/auth/overview), configurer le nom Élan, l’adresse de support, l’audience et les accès `openid`, email et profil. En mode test, ajouter les personnes qui vont tester à l’audience autorisée.
2. Créer un [client OAuth](https://console.cloud.google.com/auth/clients) de type **Application Web**. Ajouter `http://localhost:5173` aux origines JavaScript autorisées pour le développement, puis le domaine public lors du déploiement.
3. Ajouter l’URI de redirection **exacte** : `https://edogylmvtddskmikshyr.supabase.co/auth/v1/callback`.
4. Dans [Supabase → Google](https://supabase.com/dashboard/project/edogylmvtddskmikshyr/auth/providers?provider=Google), activer le fournisseur et y saisir le Client ID et le Client Secret. **Ne jamais mettre le secret Google dans `.env.local`, le code, Git ou le chat.**
5. Dans [URL Configuration](https://supabase.com/dashboard/project/edogylmvtddskmikshyr/auth/url-configuration), autoriser `http://127.0.0.1:5173/` et `http://localhost:5173/`. Pour l’hébergement, ajouter l’adresse exacte du site et définir son Site URL.
6. Cliquer « Se connecter → Continuer avec Google », accepter la connexion personnellement, puis vérifier le retour au site et la mention « Parcours sauvegardé sur votre compte ». Tester un second appareil et la déconnexion.

Documentation : [Google avec Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).

## E-mail et mot de passe

Le fournisseur Email doit rester activé dans Supabase Auth. Le formulaire utilise `signInWithPassword` et `signUp`. Une inscription avec confirmation activée envoie un e-mail de confirmation. « Mot de passe oublié ? » appelle `resetPasswordForEmail`, et le retour du lien ouvre le formulaire de nouveau mot de passe (`updateUser`). Les URL du site doivent être autorisées dans URL Configuration, comme pour Google. Le minimum de huit caractères et le changement sécurisé du mot de passe sont activés côté Supabase. Le Site URL de production est `https://gamelearning-snowy.vercel.app`, avec sa redirection exacte terminée par `/`.

Pour envoyer les confirmations et réinitialisations aux utilisateurs du site, configurer un fournisseur SMTP dans Supabase. Le service d’envoi par défaut est réservé aux essais et impose des limites.

## Sauvegarde et confidentialité

Sans connexion, le parcours reste sous la clé historique `atlas-learning-v1`. Avec connexion, chaque compte dispose d’un cache séparé sous `elan-account-<user-id>` et d’une ligne privée dans `learning_accounts`, protégée par RLS et `auth.uid()`.

Chaque nouveau compte possède un seul parcours. Les anciennes sauvegardes gardent leur format compatible et leur parcours actif ; leurs autres données ne sont pas supprimées. Il n’y a plus de sélecteur de profils, de récupération manuelle du parcours local, ni d’export/import dans l’interface.

Chaque modification est conservée localement, puis envoyée après 400 ms. En cas de coupure, le panneau compte propose de réessayer. Une comparaison des versions évite d’écraser les progrès d’un autre appareil. L’action d’actualisation conserve une copie de récupération avant de charger le parcours en ligne.

La déconnexion revient au parcours sans compte sans effacer le cache privé du compte. Les mots de passe sont traités exclusivement par Supabase Auth ; l’application ne les écrit jamais dans sa sauvegarde.

Les tests navigateur simulent Google, la connexion et l’inscription par e-mail, les erreurs de connexion, la récupération du mot de passe et la sauvegarde privée. Ils ne remplacent pas la validation personnelle d’une connexion Google ou de la réception d’un e-mail après configuration.

## Audit de sécurité

La base impose aussi une limite de 10 000 000 octets par sauvegarde. Voir [le rapport de sécurité et de publication](../SECURITY-AUDIT.md), notamment les limites sur les mots de passe divulgués et l’envoi des e-mails.

## Classement public

La page `/#/leaderboard` compare tous les comptes possédant un parcours en ligne. `leaderboard_players` ne contient qu’un identifiant public indépendant de l’identité Auth et un pseudo. Un pseudo générique est attribué au départ ; le joueur peut le modifier dans « Mon compte », les réglages ou le classement. Le changement met aussi à jour le nom de son parcours, sans modifier ses résultats. Les noms de ses profils, son email et ses réponses détaillées ne sont pas publiés.

`leaderboard_scores` conserve uniquement les totaux par jeu : XP, réponses, réponses correctes et acquis. Un déclencheur les actualise dans la même transaction que chaque sauvegarde. Le profil avec le plus de XP sur l’ensemble des jeux représente le compte ; en cas d’égalité, le nombre de réponses puis l’ordre des profils départagent. On ne somme jamais plusieurs profils d’un compte. Un acquis exige `acquired = true` et une série d’au moins trois réussites, comme dans le moteur d’apprentissage.

La fonction publique `learning_leaderboard` calcule le classement dans le périmètre thème/jeu, puis applique la recherche et la pagination. Les égalités sur le critère choisi partagent un rang. La précision utilise le ratio exact de bonnes réponses ; les joueurs sans réponse sont placés à la fin pour ce tri. La recherche ignore la casse et les accents latins courants, et traite `%` et `_` comme des caractères ordinaires. Les tables publiques sont en lecture seule pour les clients ; seule une fonction liée à `auth.uid()` peut modifier le pseudo du compte connecté. La suppression du compte Auth retire sa ligne publique et ses scores.

Pour ajouter un jeu, l’enregistrer dans `src/catalog/learningCatalog.ts` pour les menus et, dans une migration, ajouter sa ligne à `leaderboard_games` : identifiant, thème, chemin JSON du suivi dans un profil et nombre de connaissances. Recalculer ensuite les projections existantes avec `select elan_private.project_leaderboard(user_id, store) from public.learning_accounts;`. Le classement utilise ces métadonnées sans logique propre à la géographie.

`supabase/tests/leaderboard.sql` vérifie le calcul, les filtres, la recherche, les droits et la suppression avec des comptes temporaires dans une transaction annulée. Les tests navigateur couvrent les états de chargement, erreurs, mobile et édition du pseudo ; un test lit aussi le classement réel avec la clé publique et vérifie que la table privée reste inaccessible sans connexion.
