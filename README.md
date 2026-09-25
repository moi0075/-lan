# Élan — Le savoir en mouvement

Une bibliothèque de jeux d’apprentissage en français, organisée en **thèmes → sous-thèmes → jeux**. Son premier thème, **Géographie → Le monde**, propose deux jeux distincts : placer les pays sur une carte et nommer un pays surligné. Chaque jeu conserve son parcours adaptatif et ses acquis. React, TypeScript et Vite ; aucune clé API, aucun backend nécessaire.

## Lancer le jeu

Prérequis : Node.js 22.12+ et npm.

```bash
cd /Users/teo/Documents/Dev/GameLearning
npm ci
npm run dev
```

Ouvrir http://127.0.0.1:5173. Pour une version optimisée : `npm run build`, puis `npm run preview` (http://127.0.0.1:4173). Le dossier `dist/` peut être servi par n’importe quel hébergeur statique. Les chemins de ressources sont relatifs, ce qui autorise un déploiement dans un sous-dossier.

## Jouer

L’accueil présente les **Thèmes**. Choisissez **Géographie**, puis **Le monde**, puis **Placer les pays** ou **Nommer les pays**. Chaque carte permet de commencer ou reprendre sa session, de voir sa progression et de déplier ses statistiques. Le fil d’Ariane remonte aux jeux, au sous-thème ou à l’ensemble des thèmes ; les boutons précédent/suivant du navigateur et le rechargement conservent la page consultée. `/#/play` ouvre directement le dernier jeu du profil.

La **progression générale** compte les connaissances actuellement acquises dans tous les jeux du catalogue, y compris les jeux non commencés dans le total. Pour Le monde, le total est de **394 connaissances : 197 pays × 2 jeux**. Placer et nommer un même pays sont deux acquis distincts. La précision globale est calculée sur l’ensemble des réponses, et les jours d’activité sont regroupés sans les compter deux fois. Les statistiques dépliables montrent les réponses, la précision, les connaissances à consolider, les jours de suite et les XP ; chaque jeu affiche aussi ses déblocages et erreurs proches et donne accès au suivi par pays. Parcourir le menu ne crée aucune réponse et ne modifie aucun acquis.

La partie s’ouvre en **mode concentré** : la carte occupe toute la fenêtre et la question flotte au-dessus. Les corrections et le bouton « Pays suivant » restent dans ce bandeau superposé, qui ne modifie jamais la taille ou la position de la carte. « Plein écran » masque aussi l’interface du navigateur lorsque celui-ci le permet ; sinon, le mode concentré reste jouable. « Quitter le mode jeu » ramène au tableau de bord sans interrompre la session. Échap permet de quitter le mode concentré quand le navigateur n’est pas en plein écran.

- Cliquez sur le pays demandé. Tous les pays ont la même teinte neutre pendant le jeu. Après votre réponse, un repère indique la bonne position et le bandeau explique le résultat, sans colorer les pays.
- Le sélecteur **Placer / Nommer**, dans la question, change de variante. En mode **Nommer**, le pays est surligné en violet et accompagné d’un repère « ? ». Écrivez son nom puis validez avec Entrée ou « Valider ». Le nom et le drapeau sont révélés après la réponse. La carte reste déplaçable ; le recentrage retrouve le pays demandé et les petits États sont agrandis.
- Une faute comme **« fraance » ou « francece » reste une erreur**, affichée « Presque ! ». Elle ne compte ni comme réussite ni comme acquisition, mais le moteur retient qu’elle est proche. Un autre nom de pays (par exemple Niger pour Nigéria) reste une erreur complète. Majuscules, accents, espaces et traits d’union sont normalisés ; les noms usuels et certaines abréviations non ambiguës sont reconnus.
- Chaque variante conserve sa session, ses acquisitions et ses révisions dans chaque profil. Le mode Nommer commence également par les cinq pays les plus peuplés. Dans le suivi détaillé d’un jeu, le sélecteur Placer / Nommer permet de consulter les deux parcours et le nombre d’erreurs proches. Changer de variante retrouve la question précédente sans modifier l’autre parcours.
- Au trackpad, **glissez avec deux doigts pour déplacer la carte** et **pincez pour zoomer** autour du pointeur. Sur écran tactile, glissez ou pincez avec deux doigts. À la souris, glissez pour déplacer et utilisez **Ctrl + molette** ou **+ / −** pour zoomer. Le bouton de recentrage retrouve la vue du monde. Les petits États ont un repère circulaire. Le cadrage et le zoom restent identiques pendant les questions, les indices et les corrections : seul votre geste les modifie.
- **Indice : 5 pays** repère cinq zones possibles sur la carte, dont la bonne réponse, avec quatre alternatives. Les contours complets sont dessinés au-dessus des pays voisins et gardent la même épaisseur au zoom. Aucun pays n’est mis en avant avant votre demande. Les cinq choix sont conservés après rechargement ; l’indice ne fait pas avancer la maîtrise.
- **Je ne sais pas encore** donne directement la correction et programme un rappel.
- La partie est continue : « Pays suivant » ou **Espace après une réponse** enchaîne les questions sans limite de dix et sans écran de fin. Espace reste disponible pour écrire les noms composés dans le champ de saisie et pour activer les autres boutons au clavier. Vous décidez quand quitter. Le compteur et la question courante sont sauvegardés ; une ancienne partie terminée reprend automatiquement à la question suivante.
- **Ma progression** ouvre une vue générale de tous les thèmes et jeux, avec les acquis, la précision et l’activité réunis. Chaque jeu dispose d’un bouton « Voir le détail » qui mène aux erreurs par pays et aux échéances de révision.
- Dans **Géographie → Le monde**, « Explorer les 197 pays sur la carte » permet de parcourir et de rechercher toutes les entrées. La consultation est libre ; le déblocage s’applique aux questions du jeu.
- Créez des profils séparés avec l’avatar. Sur téléphone, les réglages et la sauvegarde sont également accessibles depuis ce sélecteur.

## Méthode d’apprentissage

Le catalogue est ordonné par population décroissante. Les cinq premiers pays sont l’Inde, la Chine, les États-Unis, l’Indonésie et le Pakistan.

1. Un pays devient **acquis** après trois réponses correctes consécutives, sans indice.
2. Une erreur ou une réponse guidée remet cette série à zéro. Une erreur sur un pays déjà acquis le replace parmi les connaissances à renforcer.
3. Quand tous les pays accessibles ont été acquis au moins une fois, le groupe de cinq suivant s’ouvre. Les déblocages sont permanents. Le dernier groupe contient deux pays.
4. Les deux questions les plus récentes sont exclues du tirage, ce qui évite de confondre répétition immédiate et rappel.
5. Les révisions acquises arrivées à échéance sont prioritaires ; une occasion de rappel est aussi réservée toutes les quatre questions lorsqu’un pays acquis est disponible.
6. Les erreurs et réponses guidées reviennent dès qu’elles ne font plus partie des deux dernières questions. Les nouvelles découvertes suivent le classement de population. Le tirage restant pondère erreurs, délai écoulé, maîtrise et retard.
7. Les échéances des réussites sont : 3 minutes, 1 heure, puis 1, 3, 7, 14 et 30 jours. Une erreur prévoit un rappel dans la séance. Les échéances ne bloquent pas l’entraînement : un pays peut être revu en avance.
8. Une erreur proche de nommage rompt la série de réussites, mais attend quatre questions intermédiaires avant de revenir, contre deux pour une erreur complète. Son échéance est de deux minutes au lieu d’une ; son poids d’erreur dans le tirage est réduit de moitié. Les confusions de pays passent avant les erreurs proches parmi les rappels. Trois XP récompensent ce rappel partiel, sans accorder de réussite.

La proximité orthographique utilise une distance d’édition qui compte une inversion de deux lettres voisines comme une faute. Après normalisation, une faute est tolérée pour classer un nom d’au moins quatre caractères comme proche, et jusqu’à deux pour un nom d’au moins cinq caractères. Le pays attendu doit être l’unique meilleur candidat parmi les 197 pays et leurs alias : un vrai nom d’un autre pays et les cas ambigus ne sont jamais convertis en réponses proches.

Une réponse correcte rapporte 10 XP sans indice ou 3 XP avec indice ; la première acquisition ajoute 20 XP. Les XP donnent un niveau de jeu et ne mesurent pas la mémoire. L’algorithme est une règle pédagogique explicite, sans prétention de validation clinique ou scientifique.

## Architecture réutilisable

```text
src/
  catalog/
    learningCatalog.ts # Arborescence thèmes/sous-thèmes/jeux et adaptateur des suivis existants
  engine/
    progressSummary.ts # Agrégation indépendante du thème, sans mutation des progrès
    learning.ts       # Sélection adaptative et mémorisation, fonctions pures
    hints.ts          # Sélection stable de cinq pays pour l’aide facultative
    nameAnswer.ts     # Noms usuels, normalisation et distinction exact/proche/incorrect
    storage.ts        # Profils, sessions, schéma versionné, import/export
    *.test.ts         # Tests du domaine et de la validation
  components/
    LearningLibrary.tsx # Menu hiérarchique, cartes de jeux, barres et statistiques facultatives
    WorldMap.tsx      # Carte SVG, contours superposés et micro-États
    useMapNavigation.ts # Navigation souris, trackpad et tactile
    mapNavigation.ts  # Transformations géométriques testables sans navigateur
    FocusQuestion.tsx # Bandeau flottant et correction du mode concentré
    NamingQuestion.tsx # Saisie d’un nom, correction et enchaînement au clavier
    ModeSwitch.tsx    # Choix de la variante de jeu et de son suivi
    LearningUI.tsx    # Drapeaux, indicateurs et cartes statistiques
    Modal.tsx         # Dialogue natif, focus et fermeture clavier
  data/
    catalog.ts        # Types et index du catalogue géographique
    countries.json    # 197 pays, noms français, capitales et populations
    map.json          # Frontières SVG simplifiées, calculées avant livraison
    source.json       # Provenance, date de collecte, hash et périmètre
  App.tsx             # Navigation et orchestration des écrans
  useAppNavigation.ts # Navigation par fragments, retour navigateur et liens directs
  styles.css          # Mise en page adaptative et styles partagés
scripts/
  build-data.mjs      # Reconstruction des données et de la carte
  audit-accessibility.mjs
  capture-preview.mjs
```

`engine/learning.ts` ne dépend ni de React, ni de la carte, ni du navigateur. Un autre module de connaissances fournit une liste ordonnée d’objets `{ id }`, utilise `selectNext` pour choisir une question, puis `recordAttempt` pour mémoriser le résultat. L’interface et le contenu peuvent donc changer sans réécrire la logique d’apprentissage. L’horloge et le générateur aléatoire sont injectables pour les tests.

Les paramètres de progression sont centralisés dans `BATCH_SIZE`, `MASTERY_STREAK` et les intervalles. Un futur stockage serveur peut remplacer l’adaptateur `storage.ts` et conserver les mêmes structures de domaine. Les écrans restent des composants React ; aucun service distant n’est requis pour jouer.

## Données, sauvegarde et limites

Les thèmes et sous-thèmes sont déclarés dans `catalog/learningCatalog.ts`. Le menu construit ses cartes et ses totaux depuis ce catalogue. Pour ajouter un jeu d’un autre thème, on fournit son contenu ordonné, son interface de jeu et son adaptateur de progression ; `summarizeProgress` et les niveaux du menu restent communs. L’adaptateur actuel lit les anciens suivis Placer/Nommer sans migration ni duplication des sauvegardes.

Les profils sont stockés dans `localStorage`, sous la clé historique `atlas-learning-v1`, conservée lors du changement de nom pour retrouver les progrès existants. La version du schéma est vérifiée à la lecture et à l’import. Le fichier exporté comprend tous les profils et leurs sessions. L’import valide le fichier entier avant de modifier la sauvegarde ; les profils importés reçoivent de nouveaux identifiants et ne remplacent jamais les profils existants.

La session conserve un compteur cumulatif et les dix dernières réponses pour ne pas grossir indéfiniment. Ce plafond technique ne limite pas le jeu. Les sauvegardes précédentes sont migrées à la lecture, y compris les anciens écrans de fin. Les totaux et l’activité quotidienne sont conservés ; l’historique détaillé est limité aux 3 000 dernières réponses par profil. Limite : 30 profils et 10 Mo par fichier importé. Une sauvegarde illisible est copiée, si possible, dans `atlas-learning-v1-recovery` avant réinitialisation. Le navigateur peut effacer ses données : exportez régulièrement. Il n’y a pas de compte, de synchronisation entre appareils ni de collecte de données. Les noms sont de simples pseudonymes, pas une authentification.

Les frontières, le catalogue et les polices sont intégrés dans le projet. Aucun appel réseau tiers n’est nécessaire à l’exécution. Un serveur local ou un hébergement statique reste nécessaire pour charger l’application ; ce projet n’installe pas de service worker.

Le jeu reste fondamentalement visuel. Les zones sont atteignables au clavier avec Tab puis Entrée/Espace, mais leurs noms sont masqués pendant les questions. Il ne constitue pas un équivalent non visuel complet pour une personne aveugle. Les dialogues gèrent le focus et Échap ; les animations respectent la préférence de mouvement réduit.

## Sources géographiques

- **Périmètre : 197 pays**, soit 193 États membres de l’ONU, plus le Vatican, la Palestine, le Kosovo et Taïwan. Les territoires dépendants sont visibles sur la carte mais ne font pas partie des questions. Ce choix de catalogue et les frontières de facto ne constituent pas une prise de position politique.
- [REST Countries](https://github.com/restcountries/restcountries) fournit noms, capitales, coordonnées et populations. Les années de référence varient selon les pays : ce classement correspond à l’instantané du dépôt, pas à des estimations harmonisées pour 2026. Les données adaptées sont soumises à la MPL 2.0 ; le texte de licence est conservé dans `licenses/`.
- [World Atlas 2.0.2](https://github.com/topojson/world-atlas), licence ISC, repose sur [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), domaine public. La carte 1:50 millions est simplifiée en conservant les frontières communes puis projetée en Natural Earth. Les détails trop petits sont complétés par des repères.
- Le générateur corrige le marqueur ONU erroné de la Guinée-Bissau dans les données source : [membre depuis 1974](https://www.un.org/en/about-us/member-states/guinea-bissau). Il normalise aussi l’identifiant du Kosovo en `XKX`.
- DM Sans et Manrope : SIL Open Font License, distribuées via les paquets Fontsource. Lucide : licence ISC. Les licences des dépendances sont présentes dans leurs paquets npm.

Pour reconstruire les données : `npm run data:refresh` (connexion requise), ou `node scripts/build-data.mjs chemin/vers/countriesV3.1.json` pour utiliser un instantané local. Le générateur valide la présence de 197 identifiants uniques et enregistre un hash SHA-256 de la source. Toute évolution du périmètre doit faire évoluer explicitement cette validation et le schéma de sauvegarde.

## Vérifications

```bash
npm test             # Tests métier et validation des sauvegardes
npm run build        # Vérification TypeScript et build optimisé
npm run test:e2e      # Parcours réels, bureau et mobile
npm run format       # Formatage du code
```

Les tests navigateur utilisent Google Chrome installé, dans un profil isolé. Pour Chromium Playwright : `npx playwright install chromium`, puis `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`. Le serveur local démarre automatiquement si nécessaire.

Les parcours couvrent les erreurs et corrections, les indices, la persistance après rechargement, le déblocage réel d’un groupe, les micro-États, les 197 entrées du catalogue, le zoom, les profils séparés, l’export/import et le mobile. Un test métier simule l’acquisition de tous les pays. Les captures de contrôle sont enregistrées dans `artifacts/`. L’audit automatisé d’accessibilité est complémentaire, pas une certification de conformité exhaustive.
