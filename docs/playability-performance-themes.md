# Jouabilité, fluidité et choix des thèmes

Correctif préparé le 20 octobre 2026 depuis `main` (`d9c4621`). Cette proposition corrige les arrivées et reconnexions côté interface, réduit le travail de rendu et rend les interactions directement accessibles. Elle ajoute aussi une sélection de thèmes commune au salon.

## Arriver, retrouver les indices, jouer

La règle serveur était déjà la suivante : une nouvelle personne rejoint comme spectatrice de la partie commencée et joue à la suivante ; une reconnexion avec la même session reprend la place existante. Les rôles ne sont pas redistribués au milieu d’une partie. Le correctif rend ce fonctionnement visible et vérifie le parcours complet.

- Un arrivant voit immédiatement les indices publics déjà donnés, avec une indication claire « Vous jouez à la prochaine partie » et un accès aux indices.
- Le tableau conserve les contributions des joueurs des tours précédents. Les tours passés restent consultables dans leur panneau.
- Au début de la partie suivante, le tiroir mobile se referme pour laisser l’accès au mot privé. Un participant actif qui recharge retrouve également cet accès.
- Une reconnexion qui découvre un autre salon efface l’ancien salon, son état privé et ses positions. Les modales et tiroirs se réinitialisent par code de salon.
- Quitter volontairement abandonne sa place dans la partie en cours. Après les résultats, l’hôte revient au salon et chaque participant confirme être prêt.

Les scénarios serveur utilisent de véritables connexions Socket.IO et distinguent arrivée, reconnexion, remplacement d’onglet et nouvelle partie. Le scénario navigateur ajoute une cinquième personne sur téléphone après deux indices, recharge sa session, termine la partie et vérifie sa participation ainsi que l’accès au mot à la suivante.

## Le nom d’abord, l’indice dessous

Les numéros attribués aux joueurs disparaissent de l’affichage. Le portrait, la couleur et le nom forment l’identité publique ; les cartes affichent le nom en gras au-dessus de l’indice complet. L’ordre des cartes ne change pas lorsqu’un indice arrive.

Sur ordinateur, le tableau présente tous les indices du tour. Sur petit écran, les cartes conservent une taille lisible dans un panneau à défilement natif. Les commandes de partie, le vocal et les onglets restent accessibles. Ce défilement fonctionne aussi au clavier sans déplacer l’avatar. Les indices longs ne sont pas tronqués dans le tableau.

Dans la scène, les noms tiennent sur une ligne. Un nom long peut être abrégé visuellement dans ce badge, tout en restant complet dans le tableau et son libellé accessible. L’indice apparaît dans une bulle au survol ou au focus ; il ne gonfle plus simultanément toutes les étiquettes. Les badges sont masqués lorsque le tableau d’indices occupe l’écran mobile.

## Des gestes accessibles directement

Le clic ou le toucher sur un avatar ou son nom ouvre une palette non modale. Les voisins sont des boutons, avec sélection directe et choix du plus proche. Le menu déroulant a été supprimé. La palette laisse le déplacement, le chat et le vocal accessibles.

| Touche | Action |
| --- | --- |
| H | Saluer |
| J | Danser |
| K | Exprimer un soupçon |
| E | Sélectionner le voisin le plus proche |
| B | Ouvrir ou fermer le catalogue de gestes |
| F | Frapper |
| X | Arrêter son animation |
| Échap | Fermer la palette |
| V | Parler en mode appuyer-pour-parler |

Les raccourcis de gestes ignorent les champs de saisie, les compositions de texte, les répétitions et les combinaisons avec modificateurs. Une réponse réseau tardive ne reprend pas le focus si la personne a commencé à écrire dans le chat.

Les distances, obstacles, permissions, consentements et délais de recharge restent validés par le serveur. Le choix direct d’un voisin ne les contourne pas. La disponibilité locale se rafraîchit toutes les 250 ms uniquement lorsque la palette est ouverte. Les icônes principales sont des SVG locaux simples, indépendants des polices d’emoji.

## Réduire le travail pendant les déplacements

Le flux de positions ne reconstruisait pas seulement les avatars : il recréait auparavant le tableau de joueurs dans l’état React de la partie. Une salle animée provoquait donc du travail dans les panneaux qui n’avaient pas changé.

Le nouveau module `poses.ts` reçoit les positions transitoires. Les avatars, la caméra et le ciblage les lisent directement. Les snapshots complets restent autoritaires pour les phases, indices, rôles privés et positions de référence. Un départ vide le cache ; les positions d’un ancien joueur sont ignorées.

Autres réductions :

- Le salut et les autres gestes utilisent un trait continu par bras et une main simple, sans coude ni demi-bras articulé : six maillages retirés par avatar.
- Le serveur ignore les déplacements qui ne changent ni la position ni l’orientation.
- Le décor statique est mémorisé ; la projection de la caméra change seulement quand le zoom change.
- La résolution du rendu 3D est plafonnée à 1,25 sur ordinateur et à 1 en affichage compact. Les textes de l’interface restent des éléments HTML.
- Le rendu 3D est suspendu lorsque l’onglet est masqué.
- L’adresse du salon n’est réécrite que lorsque son code change.

Le test de rafale envoie 180 mises à jour de positions et vérifie zéro notification de l’état de jeu. Un scénario navigateur vérifie aussi que l’avatar bouge réellement pendant que cet état reste stable.

## Thèmes et pack 18+

L’hôte choisit un ou plusieurs thèmes dans les règles du salon. Toute la salle voit la sélection avant de se déclarer prête. Le résumé et le bouton « Choisir » restent dans le pied du panneau, juste au-dessus des actions de préparation, y compris sur téléphone et en paysage. Modifier les règles remet les confirmations de préparation à zéro ; la sélection est conservée lors des reconnexions et des nouvelles parties du même salon.

Le catalogue propose **15 thèmes classiques** et un pack **18+**, désactivé par défaut. Son activation est explicite et signalée dans le récapitulatif partagé. Il regroupe des références politiques, historiques et d’humour noir. Il peut être choisi seul ou associé aux thèmes classiques. Le serveur l’exclut tant que l’option n’est pas activée, même si un client forge une sélection de catégorie.

Les anciens paramètres restent compatibles. Les nouvelles sélections multiples prennent priorité sur l’ancienne catégorie unique. L’interface empêche d’enregistrer une sélection vide ; le protocole conserve le repli sur l’ancienne catégorie pour les anciens clients. Le serveur refuse les filtres sans correspondance avec la difficulté, avec un message explicite.

La banque compte **1 659 paires uniques : 1 619 classiques et 40 dans le pack 18+**. Elle reprend les 120 paires historiques et les 1 500 entrées de la [PR V1.4 #4](https://github.com/RomainMarcadet/rene/pull/4), avec 39 ajouts supplémentaires. Une entrée de V1.4 est reclassée dans le pack adulte ; les textes des entrées reprises sont conservés. Cette proposition ne fusionne ni ne ferme la PR #4.

L’historique des tirages est borné à 3 318 identifiants pour conserver les cycles sans répétition avec le catalogue agrandi. Les mots et associations restent dans le moteur côté serveur. Le client reçoit les catégories publiques et son état privé individuel. Le serveur de développement refuse l’accès aux sources privées et le build contrôle les ressources construites du client.

Les captures de recette utilisent des indices inventés et ne montrent aucune nouvelle paire de mots. L’audit du catalogue ne remonte que les identifiants en cas de problème. Le contrôle exhaustif des devinettes Mr. White conserve ses 3 264 validations exactes et 10 650 426 comparaisons dirigées ; sa préparation et ses assertions ont été optimisées pour couvrir le catalogue agrandi sans échantillonnage.

## Mesures de rendu à 12 joueurs

La scène utilise les mêmes douze modèles d’avatar que la référence V1.5 versionnée. Les comptes actuels restent identiques au repos et pendant l’animation collective.

| Mesure | Référence V1.5 | Correctif | Réduction |
| --- | ---: | ---: | ---: |
| Appels de dessin par image | 427 | 355 | 72, soit 16,86 % |
| Maillages dans la scène | 475 | 403 | 72, soit 15,16 % |
| Triangles dessinés | 36 912 | 35 664 | 1 248, soit 3,38 % |
| Géométries partagées | 62 | 62 | — |
| Matériaux partagés | 66 | 66 | — |

Sources : [mesure V1.5](media/v1.5/metrics.json), [mesure brute actuelle](media/playability/render-12-raw.json) et [comparaison structurée](media/playability/render-comparison.json). La référence n’a pas été rejouée sur cette machine. Les compteurs établissent une réduction du travail demandé au rendu ; ils ne mesurent pas un gain en images par seconde sur les appareils des joueurs.

## Résultats de validation

`npm run check` réussit sur les sources finales : typage TypeScript, ESLint, **353 tests dans 29 fichiers**, build web, contrôle de séparation de la banque de mots, puis build serveur. Le contrôle du client inspecte huit ressources construites et détecte zéro fuite du catalogue.

Les **32 scénarios navigateur distincts** ont réussi au cours de la campagne et des reprises ciblées :

| Passage | Réussis | Échecs | Ignorés |
| --- | ---: | ---: | ---: |
| Suite complète initiale, vocal désactivé | 21 | 4 | 7 |
| Reprise finale ciblée, vocal actif | 16 | 0 | 0 |

Les quatre échecs du premier passage ont été repris avec succès : deux attentes visuelles devenues obsolètes (nom d’avatar cliquable et statut physique affiché au focus) et deux décalages de lignes avec des noms longs. Ces derniers ont conduit à réserver davantage de hauteur aux cartes sur ordinateur, sans réduire la taille des noms. Les sept scénarios de vocal initialement ignorés ont tous été exécutés avec succès dans le second passage. Cinq autres scénarios déjà verts ont été revérifiés avec les dernières dispositions et le vocal actif. La suite complète n’a pas été relancée une troisième fois.

La recette couvre notamment :

- Une partie réelle dans quatre navigateurs, arrivée d’une cinquième personne, reconnexion, indices déjà publiés, résultats et nouvelle partie.
- Les cartes avec **4, 6, 8 et 12 personnes**, chacune aux six dimensions **1586 × 992, 1366 × 768, 1024 × 768, 768 × 1024, 390 × 844 et 844 × 390** : nom au-dessus de l’indice, ordre stable, texte complet, défilement mobile et commandes accessibles.
- Les thèmes communs, l’activation et la désactivation du pack 18+, la persistance après rechargement et la visibilité du choix avant préparation.
- Le choix direct d’un avatar, les raccourcis, les brouillons de chat et d’indice, les consentements, les animations simultanées et les commandes tactiles.
- Le vocal avec de vrais échanges LiveKit : écoute maintenue après coupure du micro, reprise d’une génération périmée, changements de taille d’écran, appuyer-pour-parler au clavier et au toucher, refus puis rétablissement de l’autorisation microphone, écoute après élimination.

Les résultats structurés sont consignés dans [validation.json](media/playability/validation.json). Les essais utilisent des participants fictifs et des salons locaux de recette.

## Environnement de recette

- Node 24.19.0 ; Playwright 1.64.0 ; binaire Chromium 141.0.7390.37.
- Le binaire attendu par Playwright n’a pas pu être téléchargé complètement dans cet environnement. La recette utilise donc un Chromium disponible, via `RENE_CHROMIUM_EXECUTABLE_PATH`. Le User-Agent du profil Playwright annonce une autre version et ne doit pas être utilisé pour identifier le binaire exécuté.
- LiveKit 1.13.9, version déjà retenue par le dépôt, lancé localement sans Docker. La commande ci-dessous active explicitement les candidats loopback pour cette recette native ; aucune configuration de production n’est modifiée.

```bash
livekit-server --config deploy/livekit.dev.yaml \
  --bind 127.0.0.1 --rtc.enable_loopback_candidate

npm run check

RENE_CHROMIUM_EXECUTABLE_PATH=/chemin/vers/chromium \
  npx playwright test

RENE_VOICE_E2E=1 RENE_CHROMIUM_EXECUTABLE_PATH=/chemin/vers/chromium \
  npx playwright test tests/e2e/voice.spec.ts tests/e2e/ux.spec.ts \
  tests/e2e/layout.spec.ts:16 tests/e2e/themes.spec.ts \
  tests/e2e/reliability.spec.ts tests/e2e/chaos.spec.ts:131 \
  tests/e2e/chaos.spec.ts:258
```

Les validations locales ne remplacent pas une mesure sur téléphone physique, Safari, réseau mobile ou hébergement réel. Le délai réseau et la charge du serveur de production n’ont pas été mesurés ici. Aucun changement de dépendance, migration de base de données ou déploiement n’accompagne cette proposition.

## Captures vérifiées

Les pseudos et les indices des captures sont des données de test. Les cartes de mots privés restent fermées ; aucune nouvelle paire n’est montrée.

| Capture | Ce qu’elle vérifie |
| --- | --- |
| [Tableau de 12 joueurs sur ordinateur](media/playability/clues-desktop-12.png) | Noms en gras, indices complets et vocal connecté |
| [Tableau de 12 joueurs sur mobile](media/playability/clues-mobile-12.png) | Cartes lisibles dans un panneau défilant, commandes accessibles |
| [Arrivée en cours de partie sur mobile](media/playability/arrival-mobile.png) | Indices existants et accès explicite à la partie suivante |
| [Choix des thèmes sur mobile](media/playability/themes-options-mobile.png) | Sélection multiple et activation explicite du pack 18+ |
| [Thèmes dans le lobby mobile](media/playability/themes-lobby-mobile.png) | Choix visible avant les boutons de préparation |
| [Thèmes dans le lobby sur ordinateur](media/playability/themes-lobby-desktop.png) | Résumé partagé et indication 18+ |

## Réconciliation avec la bibliothèque et le salon TPS

La mise à niveau conserve le salon immersif déjà présent sur main : caméra perspective, rotation libre, joystick, collisions partagées, placement de vote, personnalités et animation de la bouche restent actifs. Les optimisations de cette PR sont appliquées à ce salon plutôt qu’au cadrage orthographique historique.

Le cache des poses est lu directement par les avatars, le suivi de caméra, les cadrages collectifs, le recentrage, les regards et les interactions à deux. Le HUD reste indépendant des paquets de mouvement. La projection de caméra est recalculée seulement lorsque le viewport ou la zone dégagée change. Le décor courant est mémoïsé ; le plafond de DPR est combiné à l’adaptation existante. Masquer l’onglet suspend le rendu sans démonter le Canvas ni le vocal.

La palette sociale reste non modale et permet de marcher ; la saisie, les vraies modales et les panneaux de lecture conservent leur protection clavier. Un glissement de caméra ne sélectionne pas un avatar comme un simple clic. Les tests de déplacement utilisent désormais l’orientation TPS.

Les deux rapports V1.4 sont conservés : docs/v1.4.md pour le salon et docs/word-library-v1.4.md pour la bibliothèque. Le contrôle automatisé compare l’empreinte des 1 500 associations reprises et des 120 historiques ; aucune association n’est publiée dans les diagnostics. Le catalogue final compte 1 659 entrées, dont 40 réservées à l’activation adulte explicite. Les contrôles éditoriaux, de confidentialité et de tirage de la PR bibliothèque restent présents, adaptés à la sélection par thèmes.

Les mesures de réduction des appels de dessin ci-dessus décrivent la scène historique utilisée pour la PR initiale ; elles ne constituent pas une mesure avant/après du nouveau salon TPS. La recette de réconciliation est précisée dans la PR avec les résultats des commandes locales et GitHub Actions.
