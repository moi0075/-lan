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

## Mise à jour mobile — 1er octobre 2026

Le zoom maximal passe de 12× à 24× sur les écrans étroits ou tactiles. Les noms des pays utilisent une bulle de 16 pixels au-dessus des commandes sur mobile, pour rester lisibles indépendamment du zoom et éviter le panneau de question en paysage. Les deux doigts, les boutons, le recentrage et la stabilité des panneaux sont vérifiés.

- URL : https://gamelearning-snowy.vercel.app
- Cible : production
- État : READY
- Déploiement : `dpl_AUJ4yqyEbHuyXrhCFvyvD43mhu2g`
- Révision de base : `475d28c`, avec les modifications locales de cette mise à jour
- Framework : Vite / React
- Compilation Vite : 915 ms ; artefact précompilé, sans compilation distante
- Validation : 73 tests métier, 16 parcours ciblés, puis 3 tests mobiles sur le domaine public
- CSP et contrôles d’injection : réussis à 1440 et 390 pixels
- Erreurs de production : aucune retournée sur les 30 dernières minutes
- Drains : 0 configuré(s)
- Surveillance : vérification ponctuelle ; aucun suivi externe continu ajouté

Les limites de connexion et d’envoi d’e-mails décrites plus haut restent inchangées par cette mise à jour.

## Agrandissement mobile — 2 octobre 2026

Les noms passent de 16 à 22 pixels, avec une largeur de bulle adaptée pour éviter les retours à la ligne inutiles. Le zoom mobile passe de 24× à 48×. Les noms longs restent visibles sur un écran de 320 pixels ainsi qu’en paysage.

- URL : https://gamelearning-snowy.vercel.app
- Cible : production
- État : READY
- Déploiement : `dpl_A3umrmu8Z9DeDmWY3agLG4b8SsJT`
- Révision de base : `425825d`, avec les modifications locales auditées
- Framework : Vite / React
- Compilation Vite : 1,06 s ; artefact précompilé, sans compilation distante
- Validation : gestes et boutons jusqu’à 48×, recentrage, noms longs, stabilité des panneaux ; quatre tests mobiles réussis sur le domaine public
- Erreurs Vercel : aucune retournée sur les 15 dernières minutes
- Drains : aucun configuré ; suivi externe continu non configuré

## Proposition de transfert après inscription — 2 octobre 2026

Une personne ayant joué sans compte reçoit une proposition de conserver sa progression après la création effective d’un nouveau compte. Elle peut accepter ou démarrer un nouveau parcours. Le parcours actif, les deux jeux et les sessions sont conservés en cas d’acceptation ; la copie invitée reste intacte dans tous les cas.

L’intention d’inscription est conservée localement pendant sept jours maximum, liée au compte créé, puis supprimée après le choix. La confirmation e-mail peut reprendre cette proposition dans le même navigateur. Une connexion par e-mail n’amorce pas de transfert. Pour Google, la date de création doit correspondre à cette nouvelle tentative ; un compte déjà existant n’est pas éligible. Aucun compte ayant déjà une sauvegarde distante ou une progression en cache n’est remplacé. Les contrôles de révision empêchent également d’écraser une sauvegarde créée entre-temps sur un autre appareil.

Une erreur de sauvegarde locale laisse le choix disponible sans modifier le contrôleur. Si l’envoi en ligne échoue après l’acceptation, la progression est conservée dans le cache privé du compte et peut être réessayée. Les règles RLS et la configuration Supabase ne sont pas modifiées. Le conseiller Supabase signale uniquement l’avertissement préexistant sur les mots de passe divulgués, avec [sa documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

- URL : https://gamelearning-snowy.vercel.app
- Cible : production
- État : READY
- Déploiement : `dpl_J9ueY36qGvq519DJpwDnkWmjzwhf`
- Révision de base : `425825d`, avec les modifications locales auditées
- Framework : Vite / React
- Compilation Vite : 939 ms ; artefact précompilé, sans compilation distante
- Tests métier : 82 / 82
- Parcours navigateur complets : 80 / 80
- Tests sur le domaine public : 9 / 9, avec réponses Auth et sauvegardes simulées
- Accessibilité du nouveau dialogue mobile : aucune violation détectée
- Contrôles CSP et injection : réussis sur ordinateur et téléphone
- Erreurs de production : aucune retournée sur les 15 dernières minutes
- Drains : 0 configuré(s) ; pas de suivi externe continu ajouté

Aucun compte réel n’a été créé, aucune progression utilisateur distante n’a été modifiée et aucun e-mail n’a été envoyé pendant les tests.

## Zoom tactile et retour des réponses — 6 octobre 2026

Le domaine public était revenu à une version plafonnée à 12× : ce comportement a été reproduit sur deux navigateurs tactiles isolés avant la correction. La version publiée atteint 48× (4 800 %) au doigt et avec les boutons. La détection prend aussi en compte le matériel tactile et les interactions tactiles réelles lorsqu’un téléphone demande un affichage de bureau.

Les noms affichés après une réponse ou un toucher disparaissent après 2,5 secondes. Un nouveau toucher relance ce délai ; changer de question annule le délai précédent. Explorer un pays après une réponse ne soumet aucune nouvelle réponse. Le contour complet du pays actif est dessiné dans la dernière couche SVG, sans intercepter les interactions ; la sélection reste au premier plan après le retrait du doigt. Le pays choisi garde son remplissage gris dans le jeu.

Les bordures de la question et du pays répondu passent progressivement au vert ou au rouge en 700 ms. Une réponse correcte affiche huit petits confettis qui disparaissent en moins de 1,4 seconde. Ces éléments restent décoratifs et ne déplacent ni les commandes ni le panneau de placement. La préférence de réduction des animations affiche immédiatement les couleurs et masque les confettis. Aucun changement d’authentification ou de schéma de données n’a été nécessaire pour cette correction.

- URL : https://gamelearning-snowy.vercel.app
- Cible : production
- État : READY
- Déploiement : `dpl_5xnCeJGR2uTxNcpP2kNVSw3anmqY`
- Révision de base : `2578b5d`, avec les modifications locales validées
- Framework : Vite / React
- Compilation Vite : 914 ms ; artefact précompilé, sans compilation distante
- Tests métier : 82 / 82
- Parcours navigateur complets : 91 / 91
- Dernier ajustement du contour persistant : 13 / 13 tests ciblés
- Tests sur le domaine public : 16 / 16, dont gestes jusqu’à 48×, délai des noms, bordures, réduction des animations et affichage mobile
- Contrôles CSP et injection : réussis sur ordinateur et téléphone
- Erreurs de production : aucune retournée sur les 15 dernières minutes
- Drains : 0 configuré(s) ; vérification ponctuelle, sans suivi externe continu ajouté

Les vérifications utilisent uniquement des navigateurs et des sauvegardes locales de test isolés. Aucun compte réel, e-mail ou sauvegarde utilisateur distante n’a été créé ou modifié pendant ces contrôles.

## Glissement avec inertie — 6 octobre 2026

La carte poursuit brièvement son déplacement après un glissement à la souris ou au doigt, puis ralentit progressivement. La vitesse est mesurée en pixels d’écran pour garder un comportement cohérent aux différents niveaux de zoom. La décélération reste indépendante de la fréquence des images et s’arrête en moins d’une seconde.

Un nouveau toucher arrête le mouvement sans soumettre de pays ; le toucher suivant permet de répondre normalement. Les commandes de zoom et de recentrage, un changement de question, une réponse, la sortie du jeu, le redimensionnement, la perte de focus et le passage en arrière-plan annulent le mouvement restant. Un pincement n’amorce pas d’inertie supplémentaire ; le pavé tactile conserve ses deltas de défilement natifs. La préférence de réduction des animations désactive cet effet. Aucun schéma, en-tête de sécurité ou parcours d’authentification n’a été modifié pour cette mise à jour.

- URL : https://gamelearning-snowy.vercel.app
- Cible : production
- État : READY
- Déploiement : `dpl_HXVAR2zMGQgpQZi1dXqLsFW1qz34`
- Révision de base : `2578b5d`, avec les modifications locales validées
- Framework : Vite / React
- Compilation Vite : 925 ms ; artefact précompilé, sans compilation distante
- Tests métier : 84 / 84
- Parcours navigateur complets : 96 / 96
- Domaine public : neuf tests de navigation et de zoom mobile réussis, ainsi que les cinq tests de glissement, décélération et interruption
- L’horloge du test de glissement a été ajustée aux délais de chargement du domaine public ; les cinq tests concernés ont ensuite tous réussi
- Contrôles CSP, formulaires et injection : réussis sur ordinateur et téléphone
- Erreurs de production : aucune retournée sur les 15 dernières minutes
- Drains : 0 configuré(s) ; vérification ponctuelle sans surveillance externe continue ajoutée

Les tests utilisent des navigateurs isolés et des sauvegardes locales temporaires. Aucun compte réel, e-mail ou progression distante n’a été créé ou modifié.
