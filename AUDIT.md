# Audit des modifications — 30 septembre 2026

Projet vérifié et corrigé : `/Users/teo/Documents/Dev/GameLearning`.

L’audit porte sur les récents changements de la carte, des panneaux de jeu, de la navigation et de la connexion. La compilation et les tests finaux passent après correction. Aucun module de production inaccessible depuis le point d’entrée ni export sans référence n’a été détecté lors de la vérification statique.

## Corrections apportées

- Retrait des anciennes commandes de profils multiples, d’import et d’export encore présentes dans l’application. Le compte propose Google, e-mail et mot de passe, inscription, récupération et déconnexion.
- Suppression de `ModeSwitch`, sans aucun appel depuis les jeux désormais accessibles par leurs propres routes.
- Suppression de 235 sélecteurs CSS associés aux anciens écrans, après vérification des références et des classes construites dynamiquement. Les styles des deux jeux et des aperçus du catalogue sont conservés.
- Rétablissement des règles de dimensions et d’alignement du panneau de placement. L’indice, l’erreur, la bonne réponse et « Je ne sais pas encore » ne changent ni sa taille ni la position du bouton suivant.
- Correction des faux conflits de synchronisation lorsqu’un cache est illisible ou qu’une ancienne sauvegarde doit être adaptée à la lecture.
- Correction des erreurs de chargement et de reprise hors ligne : une erreur de stockage ne bloque plus l’écran de chargement et ne fait plus disparaître la possibilité de réessayer. Le parcours déjà affiché reste disponible pendant la reprise.
- Conservation du formulaire de nouveau mot de passe après rechargement de la page de récupération.
- Nettoyage des anciennes erreurs lors du passage entre connexion, inscription et mot de passe oublié ; titre du dialogue adapté au formulaire.
- Extension de l’audit d’accessibilité aux nouveaux formulaires et aux deux jeux. Il renvoie maintenant un échec si une violation est détectée.

Les anciennes données `profiles` et certains champs de session restent dans le lecteur de sauvegardes pour préserver la progression existante. Cette compatibilité est utilisée et testée ; elle n’expose aucun sélecteur de profils ou outil de transfert dans l’interface. Aucun transfert automatique des données invité vers un compte n’a été ajouté.

## Résultats finaux

| Vérification | Résultat |
| --- | --- |
| Compilation TypeScript et version de production | Réussie |
| Tests métier et sauvegardes | 71 / 71 |
| Parcours navigateur | 62 / 62 |
| Accessibilité automatisée WCAG 2 A/AA | 0 violation détectée sur 9 écrans |
| Dépendances de production, `npm audit --omit=dev` | 0 vulnérabilité signalée |
| Modules de production inaccessibles | Aucun détecté |
| Exports sans référence | Aucun détecté |
| Styles sans référence | Aucun candidat inexpliqué après contrôle des classes dynamiques |
| Vérification du diff | Aucune erreur d’espacement |

Les parcours navigateur couvrent notamment les noms au survol, le plein écran, le clavier, les gestes sur la carte, les quatre tailles d’écran, les dimensions du panneau après chaque type de réponse, les routes des jeux et la persistance. Dix parcours couvrent le compte, y compris les erreurs et la reprise hors ligne.

Contrôle visuel effectué sur ordinateur et téléphone : [jeu sur ordinateur](artifacts/audit-placement-1440.png), [jeu sur téléphone](artifacts/audit-placement-390.png), [connexion sur téléphone](artifacts/audit-account-390.png). Le résultat détaillé de l’accessibilité est conservé dans `artifacts/accessibility.json`.

## Vérification du service de connexion

Les paramètres réels du projet Supabase ont été vérifiés en lecture : Google et e-mail sont activés, l’inscription est autorisée et la confirmation de l’adresse e-mail est activée. La table `learning_accounts` dispose de la protection par utilisateur pour la lecture, la création et la mise à jour, avec `auth.uid() = user_id`.

Un avertissement reste dans la configuration Supabase : **la protection contre les mots de passe divulgués est désactivée**. La [documentation Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) décrit ce réglage. La configuration distante n’avait pas été modifiée lors de cet audit fonctionnel. Les corrections de sécurité et la publication réalisées ensuite sont détaillées dans [le rapport de sécurité](SECURITY-AUDIT.md).

Les tests de connexion utilisent des réponses simulées dans un navigateur isolé. Le consentement réel Google et la réception effective des e-mails n’ont pas été exécutés ; aucun compte réel n’a été créé et aucun e-mail n’a été envoyé pendant l’audit. L’audit automatisé d’accessibilité ne remplace pas une évaluation manuelle exhaustive.

## Refaire les vérifications

```sh
npm run build
npm test
npm run test:e2e
npm audit --omit=dev
```

Pour les neuf écrans d’accessibilité, lancer le serveur local avec `npm run dev`, puis `npm run audit:a11y`. Les tests navigateur démarrent eux-mêmes leur serveur si nécessaire.
