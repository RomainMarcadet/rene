# UNDERCOVER — RENÉ

Un salon peuplé de personnages absurdes, des mots presque identiques et des amis qui mentent très mal. RENÉ est un jeu multijoueur de déduction sociale pour **4 à 12 personnes**, dans un navigateur, sans compte obligatoire.

Le serveur distribue les mots, valide les actions, anime les phases et attribue les scores. Les joueurs rejoignent une vraie salle Socket.IO : les avatars, déplacements, descriptions, votes et résultats sont partagés entre navigateurs. Le vocal utilise LiveKit, le chat reste disponible sans microphone.

## Démarrer en développement

Prérequis : Node.js **24 LTS**, npm et Docker Compose v2 pour PostgreSQL et LiveKit.

```sh
cp .env.example .env
npm ci
npm run db:generate
docker compose up -d --wait postgres livekit
npm run db:migrate
npm run dev
```

Ouvrir **http://localhost:5173**. Le client Vite relaie `/api` et `/socket.io` au serveur local sur le port 3001. Le fichier `.env` est chargé par le script de développement du serveur. Les identifiants contenus dans `.env.example` sont réservés au développement local.

`npm run dev` génère automatiquement le client Prisma avant de démarrer le serveur et Vite, notamment après une réinstallation des dépendances. Cette génération ne modifie pas la base de données. Pour les commandes de build, de contrôle ou le lancement direct du workspace serveur, conserver l’étape explicite `npm run db:generate`. L’erreur `@prisma/client did not initialize yet` indique un client non généré ; les erreurs Vite `ECONNREFUSED 127.0.0.1:3001` en découlent si le backend s’est arrêté.

PostgreSQL est exposé sur **localhost:5433** pour cohabiter avec une installation locale utilisant déjà 5432. Si ce port est occupé, choisir un autre `POSTGRES_PORT` dans `.env` et reporter la même valeur dans `DATABASE_URL`, puis relancer `docker compose up -d postgres livekit`. Les connexions entre conteneurs utilisent `postgres:5432`.

Le `package-lock.json` inclut les [correctifs de l'audit npm](docs/dependencies.md). `npm ci` reproduit les versions verrouillées en local, dans Docker et dans la CI. Après une modification des dépendances, utiliser `npm install`, relancer les contrôles et `npm audit`, puis conserver le verrou avec les manifestes.

Sans Docker, retirer `DATABASE_URL` et les **quatre** variables `LIVEKIT_*` de `.env` : le serveur utilise une mémoire volatile pour les profils/résultats et désactive le vocal. Les règles, le hub et le chat restent utilisables ; tout est perdu à l'arrêt du serveur. Une erreur PostgreSQL avec une URL configurée ne déclenche jamais ce mode de secours.

Pour lancer aussi l'application compilée dans Docker :

```sh
docker compose --profile app up --build -d
```

Ouvrir alors **http://localhost:8080**, sans lancer `npm run dev` en parallèle. Les migrations s'appliquent au démarrage du conteneur applicatif. Les volumes conservent PostgreSQL après `docker compose down` ; `down -v` les supprime.

## Jouer à plusieurs

1. Choisir son pseudonyme et son avatar, puis créer un salon.
2. Copier le lien ou transmettre le code à ses amis.
3. Chaque personne rejoint depuis son navigateur, personnalise son avatar et indique qu'elle est prête.
4. L'hôte choisit les paramètres et lance la partie. Chaque personne voit uniquement son mot, sans savoir si elle est Civil ou Undercover. Mr. White n'a aucun mot.
5. Décrire son mot à son tour, discuter, puis voter. Un Mr. White éliminé peut deviner le mot des Civils une seule fois.
6. Pendant la discussion, chaque vivant peut confirmer être prêt à voter : l’unanimité ouvre immédiatement le vote ; sinon le chronomètre continue.
7. Aux résultats, l'hôte retourne au salon pour préparer la partie suivante. Le classement se cumule pendant le nombre de parties configuré, puis une nouvelle session commence.

Déplacements : **ZQSD/WASD**, flèches, ou joystick tactile, relativement à la caméra. Faites glisser la scène pour regarder autour de vous ; **R / Moi** recentre derrière votre avatar. Deux doigts permettent de marcher et regarder simultanément sur mobile. Les déplacements restent libres pendant la partie, sauf pendant le vote et le départage : les vivants rejoignent la table, puis repartent de cette position. Les emotes restent disponibles pour les joueurs autorisés. Pour le vocal, rejoindre le salon puis **maintenir V** ou le bouton tactile pour parler (mode par défaut). Le mode microphone ouvert s’active séparément. **Microphone**, **écoute** et **quitter le vocal** ont chacun leur commande ; le bouton d’un participant coupe seulement son son localement. Une perte de focus, une reconnexion ou un changement de génération vocale coupe la transmission : réactivez-la volontairement.

Pour tester quatre joueurs sur un même ordinateur, utiliser **quatre profils de navigateur ou contextes privés isolés**. Plusieurs onglets d'un même profil représentent la même identité ; la connexion la plus récente remplace l'ancienne. Un rafraîchissement conserve sa place grâce au cookie invité. Les outils développeur ne peuvent pas modifier les règles, les rôles, les points ou les votes côté serveur.

`localhost` désigne l'ordinateur de chaque personne : il ne faut pas envoyer un lien localhost à des amis distants. Pour un essai sur le réseau local, utiliser l'adresse LAN du serveur pour le lien et `WEB_ORIGIN`, et adapter `LIVEKIT_URL` ainsi que `rtc.node_ip` dans `deploy/livekit.dev.yaml`. Les navigateurs demandent un contexte sécurisé pour le microphone : utiliser le déploiement HTTPS pour la recette multiappareil avec vocal.

Si `/api/session` répond `200` mais que le salon ne se connecte pas, vérifier **l'adresse réellement ouverte dans le navigateur** : elle doit correspondre à `WEB_ORIGIN` (protocole, hôte et port, sans chemin). Par exemple, pour `http://192.168.1.50:5173`, définir cette même valeur puis redémarrer `npm run dev`. Le proxy doit conserver l'en-tête `Host`. Le serveur journalise l'origine attendue au démarrage et les refus de connexion temps réel. Vite conserve désormais le port 5173 au lieu d'en choisir silencieusement un autre s'il est occupé.

Le bouton **COMMENT JOUER ?** sur l’accueil et **Comment jouer ?** dans le salon ouvrent les mêmes règles illustrées. Pendant une description, une carte affiche le portrait, le nom et le chronomètre du joueur actif ; les éliminés sont marqués en rouge avec des yeux rouges. Le dernier indice reste en tête de l’historique, suivi des tours récents. Les cartes des éliminés conservent aussi leur rôle révélé. Sous chaque message du chat, ▲ soutient et ▼ désapprouve : une seule réaction par joueur, modifiable ou annulable, sans effet sur les points ni sur le vote officiel. Les permissions de parole s’appliquent également aux réactions.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Générer le client Prisma, puis lancer serveur et client avec rechargement |
| `npm run check` | Types, lint, tests unitaires/intégration, puis build |
| `npm test` | Tests Vitest |
| `npx playwright install chromium` | Installer Chromium pour les tests navigateur |
| `npm run test:e2e` | Parcours multijoueur et mobile Playwright ; audio ignoré explicitement |
| `RENE_VOICE_E2E=1 npm run test:e2e` | Même recette avec LiveKit local réel et microphones synthétiques |
| `npm run build` | Compiler le client et le serveur |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:migrate` | Appliquer les migrations PostgreSQL versionnées |

Playwright démarre ses serveurs isolés sur **5175** et **3005**, sans réutiliser votre serveur de développement. Le mode vocal suppose `docker compose up -d --wait livekit` et la configuration locale de `deploy/livekit.dev.yaml` sur 7880/7881/7882. Les tests n’utilisent pas de base de données ; les vérifications de persistance nécessitent PostgreSQL séparément. Les captures de recette sont écrites dans `output/playwright/` (non versionné).

Le résultat des tests locaux et les vérifications restant à réaliser sont décrits dans [la recette](docs/acceptance.md). La CI prépare PostgreSQL, contrôle le code et exécute les tests navigateur. Aucun workflow ne publie d'image ni ne déploie automatiquement.

La V1.2 ajoute les réactions de chat, le passage au vote à l’unanimité et les rôles éliminés persistants. La devinette de Mr. White accepte accents, pluriels connus et certaines petites fautes répertoriées (`balais`/`balaai` pour `balai`), avec une seule tentative. Le validateur reste conservateur : les synonymes et mots seulement ressemblants sont refusés. Les choix, limites et résultats figurent dans [le rapport V1.2](docs/v1.2.md).

La V1.3 fait du hub une scène plein écran, avec les panneaux de jeu superposés, un tiroir mobile Suspects / Indices / Discussion et une communication qui reste connectée pendant les replis et agrandissements. Le bouton « Sons » commande les effets du jeu ; l'écoute et le microphone se règlent dans le panneau de communication. Voir [le rapport, les captures et la recette V1.3](docs/v1.3.md).

Les validations de la V1.1, le diagnostic audio et les limites de la recette sont détaillés dans [le compte rendu V1.1](docs/v1.1.md). La recette automatisée emploie des clients indépendants et des données serveur réelles ; l’écoute humaine, Safari/mobile physique et les réseaux distants restent à valider sur l’hébergement cible.

L'image Docker sur le **port 8080** a également été compilée et testée dans une pile isolée avec PostgreSQL et Caddy 2.11.4 : migrations, frontend/API en HTTPS, quatre clients Socket.IO (polling et WebSocket), chat et cookies invités sont validés. Les certificats de cette recette sont internes ; le vocal reste à vérifier sur le serveur réel. Voir [les preuves de cette recette Docker/Caddy](docs/acceptance.md).

## Configuration

| Variable | Valeur / usage |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` |
| `HOST`, `PORT` | `0.0.0.0` ; `3001` pour le développement Node, `8080` dans l'image Docker |
| `WEB_ORIGIN` | Origine exacte du navigateur, `http://localhost:5173` en développement |
| `COOKIE_SECURE` | `false` en local HTTP ; obligatoire en production HTTPS |
| `POSTGRES_PORT` | Port hôte du PostgreSQL Docker de développement, `5433` par défaut ; utilisé par Compose |
| `DATABASE_URL` | URL PostgreSQL ; obligatoire en production |
| `LIVEKIT_URL` | URL WebSocket accessible **depuis les navigateurs**, `ws://…` en local ou `wss://…` en production |
| `LIVEKIT_API_URL` | URL HTTP interne accessible **depuis le serveur applicatif** |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Identifiants LiveKit exclusivement côté serveur |
| `MAX_ROOMS` | Plafond des salles en mémoire, 100 par défaut |
| `TRUST_PROXY` | Sous-réseau du reverse proxy de confiance ; absent en local, injecté par le Compose de production |

Configurer les quatre variables LiveKit ensemble ou les omettre ensemble. Aucun secret n'utilise le préfixe `VITE_` et aucun secret d'administration n'est envoyé au navigateur.

## Héberger pour ses amis

**Avec votre Caddy existant en conteneur**, RENÉ écoute en HTTP sur le **port 8080 de son conteneur**, avec l'alias **`rene`** sur le réseau externe **`web`**. Le proxy existant peut donc joindre `rene:8080`. Les paramètres propres à RENÉ se trouvent dans `.env.caddy` ; le [guide dédié](docs/caddy-existing.md) décrit les variantes de déploiement.

```sh
cp .env.caddy.example .env.caddy
# Renseigner domaines, IP, secrets et RENE_TRUST_PROXY (adresse/réseau Docker du Caddy).
docker run --rm --env-file .env.caddy -v "${PWD}:/work" -w /work node:24-bookworm-slim node deploy/render-existing-caddy.mjs
docker compose --env-file .env.caddy -f compose.existing-caddy.yml -f compose.existing-caddy.network.yml up --build -d
```

Cette procédure utilise uniquement Docker sur le serveur. Le réseau `web` doit déjà être partagé avec Caddy ; changer `CADDY_NETWORK` s'il porte un autre nom. Le fichier `deploy/Caddyfile.rene.example` sert de référence si un bloc de site est nécessaire. Le vocal utilise `rene-livekit:7880` pour HTTPS/WSS et les ports **7882/UDP** et **7881/TCP** pour les médias. Pour Caddy installé sur l'hôte, utiliser le fichier de base seul : RENÉ est publié sur `127.0.0.1:8080` et LiveKit sur `127.0.0.1:7880`.

Pour une installation autonome avec son propre Caddy, la procédure [déploiement et exploitation](docs/deployment.md) fournit également HTTPS et TURN/TLS sur une seule adresse IPv4 publique. Ces deux modes de déploiement sont des alternatives.

```sh
cp .env.production.example .env.production
# Renseigner domaines, adresse IP et secrets générés dans le fichier.
node --env-file=.env.production deploy/render.mjs
docker compose --env-file .env.production -f compose.production.yml up --build -d
```

Le fichier d'exemple refuse volontairement de générer une configuration tant que les valeurs d'exemple n'ont pas été remplacées. Le générateur écrit les fichiers contenant les secrets avec des permissions restreintes dans `deploy/generated/` ; ne pas les versionner.

## Structure et limites de cette version

- `packages/contracts` : types publics, validation des commandes et paramètres.
- `packages/engine` : moteur pur, banque française de mots et tests.
- `apps/server` : API Fastify, Socket.IO, salles autoritaires, persistance Prisma et autorisations vocales.
- `apps/web` : interface React, avatars et salon Three.js, client audio.
- `deploy` : configuration locale, génération de la configuration HTTPS/TURN de production.
- `docs` : architecture, roadmap, exploitation et recette.

La V1.4 ajoute **1 500 paires**, pour **1 620 au total**, dans quinze catégories. Le catalogue reste côté serveur ; les tests navigateur utilisent des données fictives pour préserver la découverte. `npm run words:check` affiche uniquement les statistiques et contrôles, et `npm run words:boundary` vérifie les ressources frontend après le build. Voir le [rapport V1.4 sans spoiler](docs/word-library-v1.4.md) pour les distributions, le tirage, la méthode éditoriale et les validations.

Les salles et les parties actives résident en mémoire dans **une seule instance applicative**. Un redémarrage termine ces salles ; PostgreSQL conserve les profils invités et les résultats déjà enregistrés, mais ne permet pas de reprendre une partie interrompue. Le classement affiché appartient à la session en cours. Les résultats archivés ne disposent pas encore d'un écran de consultation.

Supprimer les cookies fait perdre l'identité invitée et l'accès à sa place ; aucun mécanisme de récupération de compte n'est proposé. Les salons sans personne connectée expirent après 30 minutes. Le vocal auto-hébergé et le repli TURN doivent être validés sur les réseaux réels de la recette avant diffusion publique. La présence de la configuration Docker ne constitue pas à elle seule une validation de déploiement.

Voir [architecture](docs/architecture.md) et [roadmap](docs/roadmap.md) pour les décisions et les étapes restantes.

Le salon immersif « Chez René » conserve le HUD, le vocal et le catalogue social V1.5. Quatre allures se choisissent dans l’éditeur. Voir [la caméra TPS, les collisions, les captures et la recette](docs/v1.4.md).
