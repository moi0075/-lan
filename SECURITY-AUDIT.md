# Audit de sécurité et publication — 30 septembre 2026

Projet : `/Users/teo/Documents/Dev/GameLearning`. Cet audit ne constitue pas une garantie de sécurité absolue. Aucun défaut bloquant n’a été trouvé dans les contrôles réalisés ; les limites connues sont détaillées ci-dessous.

## Corrections

- Politique CSP : scripts limités au site, connexions limitées au site et au projet Supabase, objets et encadrement interdits. Les styles en ligne sont conservés pour les positions dynamiques de la carte ; les scripts en ligne restent interdits.
- En-têtes HTTPS/HSTS, protection contre l’interprétation des types de fichiers, absence de référent et restriction des fonctions sensibles du navigateur. Le plein écran reste autorisé.
- SDK Supabase fixé à `2.117.2`, avec le fichier de verrouillage.
- Mot de passe de huit caractères minimum imposé dans Supabase, et changement sécurisé activé. Les confirmations d’adresse restent actives.
- Adresse du site et redirection exacte configurées vers `https://gamelearning-snowy.vercel.app`. Les deux redirections locales existantes sont conservées ; aucun domaine générique ni joker n’est ajouté.
- Limite de sauvegarde de 10 000 000 octets ajoutée en base, y compris pour les appels directs à l’API. Migration `20261001004925_learning_account_payload_limit.sql` appliquée et validée, sans supprimer de données.
- Fichiers privés, environnements locaux, rapports et tests exclus des sources à publier. Seul l’artefact statique précompilé a été déployé.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Dépendances complètes, développement compris | 0 vulnérabilité signalée par npm |
| Compilation et tests métier | Compilation réussie ; 71 / 71 tests |
| Dernier audit des parcours et de l’accessibilité | 62 / 62 parcours ; 0 violation sur 9 vues |
| CSP et fonctionnement des routes/formulaires | Réussis en local et en production à 1440 et 390 pixels |
| Injection de script en ligne | Bloquée par la CSP |
| Nom de sauvegarde contenant du HTML malveillant | Aucun élément HTML exécutable créé |
| En-têtes du domaine public | Les six en-têtes correspondent à la configuration |
| Mot de passe trop court envoyé au vrai service Auth | Rejet 422 `weak_password`, aucun compte créé |
| Fournisseur Google | Activé ; autorisation redirige vers `accounts.google.com` |
| Accès anonyme aux sauvegardes, lecture et écriture | Refus 401 / 42501 |
| Lecture avec l’identité d’un autre utilisateur | 0 ligne visible |
| Politiques RLS | Propriétaire requis en lecture, insertion et mise à jour ; `USING` et `WITH CHECK` présents |
| Contrainte de taille réelle | Sauvegarde trop grande refusée ; test dans une transaction annulée |
| Secrets privilégiés dans les sources et la compilation | Aucun candidat détecté |
| Conseiller de sécurité Supabase | Un avertissement : mots de passe divulgués, voir ci-dessous |
| Erreurs Vercel après publication | Aucune erreur retournée sur la dernière heure |

Les mots de passe sont traités par Supabase Auth, jamais inclus dans les sauvegardes. Les clés intégrées au navigateur sont publiques. Les caches par compte restent séparés ; l’identité utilisée par RLS provient du jeton vérifié par Supabase, pas des données modifiables du profil. Les règles sont appliquées par le serveur, indépendamment de l’interface.

## Publication Vercel

| Champ | Valeur |
| --- | --- |
| URL | https://gamelearning-snowy.vercel.app |
| Cible | Production |
| État vérifié | READY |
| Déploiement | `dpl_8A4BM5kPQgBfEhNNcHszjiVf8ruJ` |
| Révision de base | `bc46337`, avec les modifications locales auditées, non commitées |
| Framework | Vite / React |
| Construction | Artefact précompilé localement ; aucune compilation distante, durée locale non enregistrée |
| Contrôle des erreurs | Aucune erreur retournée par `vercel logs --level error --since 1h` |
| Drains | Aucun configuré |
| Surveillance | Contrôle ponctuel réalisé ; aucun suivi externe continu configuré |

La protection des déploiements Vercel est conservée. Le domaine de production répond publiquement avec un statut 200. Aucun autre projet Vercel n’a été modifié.

## Limites restantes

1. **Mots de passe divulgués** : Supabase signale cette protection comme désactivée. Elle nécessite le plan Pro ; aucun abonnement payant n’a été activé. [Documentation et remédiation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. **E-mails réels** : aucun SMTP personnalisé n’apparaît dans la configuration récupérée. La confirmation et la récupération existent dans l’application, mais la réception réelle n’a pas été testée. Configurer et valider un fournisseur SMTP pour des inscriptions publiques ; le service par défaut est destiné aux essais. Ne pas désactiver la confirmation pour contourner cette limite. [Documentation SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
3. **Connexion Google complète** : la redirection a été vérifiée, mais le consentement personnel, l’audience Google et le retour d’un compte réel n’ont pas été testés. Les tests des formulaires et de la synchronisation utilisent des réponses simulées.
4. **Surveillance** : les journaux ont été vérifiés ponctuellement. Aucun service externe de suivi des erreurs n’a été ajouté.

## Refaire les contrôles

```sh
npm ci
npm run build
npm test
npm run test:e2e
npm run audit:security
npm audit
```

`audit:security` sert la compilation avec les mêmes en-têtes que Vercel et utilise des profils de navigateur isolés. Les tests d’injection modifient uniquement leur stockage local temporaire. Aucun compte réel n’a été créé ni e-mail envoyé pendant l’audit.
