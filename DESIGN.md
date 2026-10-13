# Élan — direction Paysage

Élan est une application d’apprentissage. La géographie est son premier thème disponible, pas sa marque. Cette direction traduit la construction des connaissances par des strates de papier et un chemin ascendant. Le paysage illustré appartient à l’accueil ; les écrans de travail reprennent ses couleurs et ses lignes, avec une composition plus calme.

Référence de départ : [Visible Curation](https://visiblecuration.vercel.app/). L’illustration, les textes et le motif de progression d’Élan sont originaux.

## Principes d’interface

1. **Comprendre sans effort.** Chaque écran nomme son sujet et expose sa prochaine action. Le fil d’Ariane situe l’utilisateur dans le thème et le jeu.
2. **Montrer l’essentiel.** La bibliothèque présente les activités avant la progression générale. Les détails statistiques restent accessibles dans des sections dépliables.
3. **Servir la tâche.** L’illustration se concentre sur l’accueil et les aperçus de thèmes. La carte et la question dominent pendant le jeu.
4. **Répéter les mêmes règles.** Une action principale est bleu nuit, une action secondaire est bordée de bleu, un lien reste du texte bleu souligné au survol. Les mêmes états se répètent partout.
5. **Montrer plutôt qu’expliquer.** Une carte montre la géographie ; les barres et les chiffres montrent l’avancement ; les réponses corrigées montrent immédiatement le résultat.
6. **Favoriser la reconnaissance.** Les jeux portent toujours les noms « Placer les pays » et « Nommer les pays », avec des pictogrammes et descriptions stables.
7. **Partir du besoin.** Choisir, jouer, explorer, puis consulter ses acquis forment l’ordre des contenus.
8. **Hiérarchiser.** Un titre, une phrase utile et une action principale ouvrent chaque page. Les éléments secondaires occupent moins de surface et de contraste.
9. **Donner un retour.** Chargement, succès, erreur et progression disposent d’un message lisible et d’un état visuel distinct.
10. **Inclure.** Focus visible, contrastes contrôlés, libellés explicites, cibles tactiles d’au moins 44 px quand l’espace le permet et mouvement réduit respecté.

## Couleurs

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Bleu nuit | `#173B58` | Titres, navigation active, boutons principaux |
| Bleu moyen | `#245A7D` | Liens, progression, actions secondaires |
| Bleu ciel | `#8BB8D4` | Fond du paysage, illustration |
| Bleu pâle | `#DCECF4` | Panneaux de contexte, carte, surfaces sélectionnées |
| Blanc papier | `#F7FBFC` | Fond de page |
| Jaune doux | `#FFF0A0` | Point d’arrivée du motif, accent rare |

Les états de connaissance utilisent des couleurs sémantiques en plus d’un texte : à découvrir `#C7D8E1`, à travailler `#91BFD8`, acquis `#7FB2A0`, sélection `#E9C765`. Le succès utilise `#23715A`, l’erreur `#AE3E42`. Ne jamais transmettre un état par la seule couleur.

## Typographie

- **Manrope 800** : marque, titre monumental de l’accueil, données courtes.
- **Fraunces 600** : titres des écrans et des sections, échelle 40–66 px sur grand écran et 39–55 px sur téléphone.
- **IBM Plex Sans 400/600/700** : navigation, textes, contrôles et formulaires. Corps 15–16 px, interligne proche de 1,6 ; ligne de lecture de 65–70 caractères au maximum.
- Casse de phrase par défaut. Les petites capitales espacées n’encodent pas une action et ne doivent pas être réintroduites comme décoration.

## Composition et espacements

- Accueil : scène illustrative pleine largeur, puis premier thème et activités en bandes. Le titre « APPRENDRE » porte la personnalité ; les autres éléments restent sobres.
- Pages intérieures : navigation persistante à gauche sur grand écran, fil d’Ariane en haut, contenu dans une largeur maximale d’environ 1 500 px. Sur téléphone, la navigation principale devient une barre inférieure.
- Espacements de référence : `8 / 12 / 20 / 28 / 36 / 48 / 64 px`. Les contenus d’une même fonction restent groupés ; les sections différentes respirent davantage.
- Panneaux : bordure bleu gris de 1 px, rayon de 4–5 px, sans ombre systématique. Les arches et les cercles appartiennent à l’illustration, pas aux composants usuels.
- Ruptures principales : 760 px pour le téléphone, 1 000–1 200 px pour les compositions intermédiaires. Aucun contenu ne doit provoquer un défilement horizontal de la page.

## Composants et comportements

- **Navigation** : libellés constants, état actif plein bleu nuit, focus visible. L’accueil reprend la marque et les destinations importantes.
- **Bouton principal** : fond bleu nuit, texte blanc, hauteur minimale 46 px. Son libellé décrit le résultat de l’action (« Commencer », « Enregistrer », « Explorer le thème »).
- **Bouton secondaire** : fond clair, contour bleu, hauteur minimale 44 px. Les icônes seules demandent un nom accessible.
- **Progression** : chiffre réel, dénominateur et barre native `<progress>` avec nom accessible. Les statistiques détaillées sont dépliables.
- **Jeu** : question et retours au premier plan ; carte claire, pays interactifs et légende. Le succès et l’erreur emploient texte, icône et couleur. Les contrôles du jeu restent accessibles au clavier et au toucher.
- **Formulaires** : libellés visibles, erreurs explicites, état occupé lisible, focus contrasté.
- **Messages** : les notifications de succès ou d’erreur restent lisibles sur bleu nuit ou sur fond jaune clair selon leur rôle. Les chargements indiquent ce qui se passe.

## Entretien du système

Les variables et les règles communes sont dans `src/paysage-system.css`. L’illustration et les règles propres à l’accueil sont dans `src/components/paysage-home.css`. Une nouvelle page doit réutiliser les mêmes tokens et états avant d’introduire une nouvelle couleur ou une nouvelle forme.
