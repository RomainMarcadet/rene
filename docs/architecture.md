# Architecture de RENÉ

## Incréments

1. Contrats partagés et moteur déterministe, puis transports et première partie complète.
2. Reconnexion et scores fiables, puis salon 3D et personnalisation.
3. Vocal, mise en scène, tests navigateur et conditionnement Docker.

Le moteur ne dépend ni du réseau, ni de React, ni de la base. Le hasard et le temps sont injectables pour tester les transitions. Le serveur utilise le hasard cryptographique de Node pour les parties réelles.

## Composants

```mermaid
flowchart LR
  Web[React · HUD et scène 3D] <-->|Socket.IO : commandes et projections| Server[Fastify · salles autoritaires]
  Server --> Engine[Moteur de jeu pur]
  Server -->|identités et résultats| DB[(PostgreSQL · Prisma)]
  Server -->|jetons et permissions| Voice[LiveKit]
  Web <-->|WebRTC audio| Voice
  Contracts[Contrats Zod et TypeScript] -.-> Web
  Contracts -.-> Server
  Contracts -.-> Engine
```

Les avatars sont des géométries originales modulaires aux couleurs de `style.md` : poire, rectangle et haricot, visages et accessoires assemblés. Aucune génération d'image ou de personnage externe n'est requise à l'exécution. Le décor et les animations servent les phases ; les contrôles critiques restent en 2D.

## États et règles

```mermaid
stateDiagram-v2
  [*] --> Salon
  Salon --> Distribution : tous prêts, hôte démarre
  Distribution --> Description
  Description --> Description : joueur suivant
  Description --> Discussion : tous ont parlé
  Discussion --> Vote : unanimité des vivants, hôte autorisé ou chronomètre
  Vote --> Departage : égalité
  Departage --> Elimination : vote, puis hasard si nécessaire
  Vote --> Elimination : majorité
  Vote --> Description : aucun suffrage
  Departage --> Description : aucun suffrage
  Elimination --> Devinette : Mr. White éliminé
  Devinette --> Resultats : mot exact
  Devinette --> Elimination : échec ou expiration
  Elimination --> Resultats : victoire d'un camp
  Elimination --> Description : cycle suivant
  Resultats --> Salon : rejouer
```

La représentation réseau nomme les phases `reveal`, `description`, `discussion`, `vote`, `tiebreak`, `elimination`, `whiteGuess`, `results`. L'élimination d'un Mr. White ouvre directement sa tentative avant le contrôle de victoire habituel. Distribution : 8 secondes ; scène d'élimination : 3 secondes. Les autres durées sont configurables, avec 45/120/30/30 secondes par défaut pour description/discussion/vote/devinette.

Les mots et les rôles restent identiques pendant toute une partie. Un nouveau cycle de description n'est pas une nouvelle partie. Une session rassemble plusieurs parties et leur classement cumulé. Une absence laisse courir les échéances ; un départ volontaire est un abandon sans tentative spéciale. Les Civils gagnent dès qu'aucun Infiltré n'est vivant ; sinon les Infiltrés gagnent lorsqu'il reste au plus un Civil. Les points récompensent tous les membres du camp gagnant, même éliminés ; une devinette réussie récompense seulement son auteur.

## Protocole et confidentialité

Les événements sont définis dans `packages/contracts`. Le client émet `command` avec identifiant de commande et, pour les actions de jeu, identifiant de phase. L'accusé retourne un succès ou un message d'erreur. Les actions doublonnées ou concernant une ancienne phase ne doivent pas être exécutées à nouveau. Les mutations d'une salle et ses échéances sont sérialisées.

Le serveur publie une `RoomSnapshot` explicite et un `PrivatePlayerState` par joueur. Ce dernier étend le `PrivateGameState` du moteur avec les choix personnels de réactions, sans faire dépendre le moteur du chat. La projection privée contient son mot ou `null`, jamais son rôle Civil/Undercover. La projection publique révèle le rôle d'un éliminé et ne contient les deux mots et tous les rôles qu'aux résultats. La banque de mots est importée exclusivement par le serveur. Les mouvements transmettent une direction bornée ; le serveur calcule la position, limite la vitesse et applique les collisions du salon. `canMoveInPhase` dans les contrats autorise toutes les phases sauf vote/départage. À l’entrée en vote, le serveur place les vivants via `voteSeat`, sans replacer les éliminés ni les arrivants en attente. Les clients interpolent les positions ; elles restent les positions de départ après le vote.

La connexion utilise une identité invitée par cookie HttpOnly. PostgreSQL conserve le **hash** du jeton et l'apparence, sans stocker le jeton brut. Un rafraîchissement récupère une projection fraîche. Deux onglets partageant un cookie ne constituent pas deux joueurs. L'hôte est transféré au participant connecté le plus ancien après 30 secondes d'absence, immédiatement s'il quitte explicitement.

Les descriptions et messages sont bornés et rendus comme texte React. Les commandes sont validées avec Zod côté serveur ; identité, disponibilité, phase, droits d'hôte et éligibilité au vote sont vérifiés indépendamment de l'interface.

## Bibliothèque V1.4

Le catalogue serveur contient 1 620 paires, dont 1 500 ajouts dans quinze catégories. Les données JSON portent des identifiants stables et deux axes éditoriaux privés. Un audit refuse les doublons, inversions, variantes normalisées et métadonnées invalides. Le tirage est uniforme parmi les entrées filtrées hors de la fenêtre récente ; l'historique de salle est borné à 512 identifiants, sans exclusion permanente. Les projections de partie ne portent aucune métadonnée de la paire tirée. Vite bloque les sources serveur et le build client est contrôlé. Les tests navigateur utilisent un catalogue fictif. Voir le [rapport V1.4 sans spoiler](v1.4.md).

## Persistance et audio

`Persistence` expose `getGuest`, `saveGuest`, `recordResult` et `close`. L'adaptateur PostgreSQL enregistre une ligne immuable par ID de partie (`ON CONFLICT DO NOTHING`) : les répétitions n'ajoutent pas deux scores. Le JSON du résultat constitue le registre des points ; aucune table de total dénormalisé n'est nécessaire. Les sessions en mémoire sont identifiées par UUID afin que la réutilisation d'un code de salle ne mélange pas l'historique.

Une sauvegarde de résultat indisponible reste en attente et est retentée avec un délai, sans bloquer le chat ou le départ de la salle. La partie suivante attend l'enregistrement pour préserver l'attribution unique des points. Les identités des participants partis sont conservées pour les résultats ; un retour dans la même session retrouve son score.

Les salles actives utilisent `RoomStore`, implémenté en mémoire. La V1 est mono-instance ; ajouter Redis et une reprise durable exigera de coordonner les commandes, échéances, sockets et transitions, pas seulement de remplacer une Map.

Les jetons LiveKit n'autorisent que l'audio et sont liés au joueur et à la génération du salon vocal. À une réduction de droits, les clients migrent vers une nouvelle génération ; un ancien jeton ne permet donc pas de rejoindre le salon actif avec les anciens droits. Les éliminés et les arrivants en attente écoutent, sauf si l'hôte autorise leur parole. Le chat suit les mêmes permissions. LiveKit auto-hébergé ne fournit pas la révocation immédiate des jetons de LiveKit Cloud : [comparaison officielle](https://docs.livekit.io/transport/self-hosting/).


## Interface et animations V1.1

La présentation du tour et des éliminés dérive uniquement de `RoomSnapshot`. Les yeux rouges sont une variante de rendu du portrait ; aucune mutation de profil. `DescriptionHistory` groupe les tours décroissants sans modifier l’ordre des descriptions ; un encart séparé montre le dernier indice immédiatement. Le tutoriel contient uniquement des exemples statiques.

`avatarPose` calcule une pose complète et sa priorité : élimination, victoire, emote, marche, repos. Les emotes utilisent l’échéance serveur ajustée par l’offset client. Le salut et la suspicion durent 3,5 secondes ; la danse conserve ses 2,5 secondes et le cooldown serveur reste de 2 secondes. Les mouvements réduits gardent des poses fixes et toutes les transformations sont réinitialisées à l’expiration.

`useVoiceConnection` gère LiveKit et les abonnements distants. `MicrophoneController` sérialise la capture, avec priorité au relâchement même si une demande de permission est en cours. Le push-to-talk V/bouton tactile est le mode par défaut, le mode ouvert demande une activation volontaire. Les événements LiveKit fournissent l’état réel du micro. La sourdine d’écoute agit uniquement sur les éléments audio distants, indépendamment de la publication. Les changements de génération/connexion effacent l’intention de transmettre ; un décalage de credentials provoque une nouvelle tentative. Le transport LiveKit à deux connexions évite l’erreur de négociation SDP reproduite dans Chromium ; voir les preuves dans `v1.1.md`. Les jetons et la rotation serveur restent l’autorité de publication.


## Interactions sociales V1.2

`chat.react` fixe une réaction (`up`, `down`, `null`) par identité et message sous le verrou de salle existant. `Rooms` vérifie les mêmes permissions que le chat et la présence du message ; la projection publique expose deux compteurs, la projection privée uniquement le choix local. Les données restent en mémoire et sont effacées avec l’historique ou la partie. Les réactions sont indépendantes des scores et bulletins. Le tick et les commandes réussies diffusent selon les révisions modifiées pour éviter les snapshots de réaction sans changement.

`game.setVoteReady` passe à l’action moteur `setVoteReady`. `readyToVotePlayerIds` est public, indépendant de la préparation au lobby. Tous les vivants comptent, déconnectés compris ; un départ définitif retire la confirmation et recalcule l’unanimité après les conditions de victoire. Chaque phase efface les confirmations. Une unanimité ouvre `vote` côté moteur sans déplacer l’échéance de discussion ; expiration et raccourci hôte restent disponibles. La transition réutilise le placement à table V1.1.

La décision de `guess` utilise `isAcceptableWhiteGuess`, dans le moteur exclusivement. Normalisation Unicode, formes grammaticales éditoriales et fautes explicites sont acceptées ; les autres cas ne sont pas déduits d’une distance de caractères. Aucun service externe, dictionnaire complet ou LLM. Le serveur conserve son unique tentative et ses scores. `RoleReveal` réutilise seulement le rôle public d’un éliminé pendant élimination/devinette, et les cartes conservent ce rôle jusqu’au rejeu.

Voir [le rapport V1.2](v1.2.md) pour les cas limites, les tests et la politique d’extension du validateur. L’infrastructure et le port HTTP 8080 sont inchangés.
