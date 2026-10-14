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

PostgreSQL est exposé sur **localhost:5433** pour cohabiter avec une installation locale utilisant déjà 5432. Si ce port est occupé, choisir un autre `POSTGRES_PORT` dans `.env` et reporter la même valeur dans `DATABASE_URL`, puis relancer `docker compose up -d postgres livekit`. Les connexions entre conteneurs utilisent `postgres:5432`.

Le `package-lock.json` inclut les [correctifs de l'audit npm](docs/dependencies.md). `npm ci` reproduit les versions verrouillées en local, dans Docker et dans la CI. Après une modification des dépendances, utiliser `npm install`, relancer les contrôles et `npm audit`, puis conserver le verrou avec les manifestes.

Sans Docker, retirer `DATABASE_URL` et les **quatre** variables `LIVEKIT_*` de `.env` : le serveur utilise une mémoire volatile pour les profils/résultats et désactive le vocal. Les règles, le hub et le chat restent utilisables ; tout est perdu à l'arrêt du serveur. Une erreur PostgreSQL avec une URL configurée ne déclenche jamais ce mode de secours.

Pour lancer aussi l'application compilée dans Docker :

```sh
docker compose --profile app up --build -d
```

Ouvrir alors **http://localhost:3001**, sans lancer `npm run dev` en parallèle. Les migrations s'appliquent au démarrage du conteneur applicatif. Les volumes conservent PostgreSQL après `docker compose down` ; `down -v` les supprime.

## Jouer à plusieurs

1. Choisir son pseudonyme et son avatar, puis créer un salon.
2. Copier le lien ou transmettre le code à ses amis.
3. Chaque personne rejoint depuis son navigateur, personnalise son avatar et indique qu'elle est prête.
4. L'hôte choisit les paramètres et lance la partie. Chaque personne voit uniquement son mot, sans savoir si elle est Civil ou Undercover. Mr. White n'a aucun mot.
5. Décrire son mot à son tour, discuter, puis voter. Un Mr. White éliminé peut deviner le mot des Civils une seule fois.
6. Aux résultats, l'hôte retourne au salon pour préparer la partie suivante. Le classement se cumule pendant le nombre de parties configuré, puis une nouvelle session commence.

Déplacements : **ZQSD/WASD**, flèches, ou commandes tactiles. Les positions pendant les phases de jeu sont mises en scène. Les emotes sont disponibles dans le salon. Pour le vocal, rejoindre l'audio puis activer son micro ; un clic sur une personne permet de couper son son localement.

Pour tester quatre joueurs sur un même ordinateur, utiliser **quatre profils de navigateur ou contextes privés isolés**. Plusieurs onglets d'un même profil représentent la même identité ; la connexion la plus récente remplace l'ancienne. Un rafraîchissement conserve sa place grâce au cookie invité. Les outils développeur ne peuvent pas modifier les règles, les rôles, les points ou les votes côté serveur.

`localhost` désigne l'ordinateur de chaque personne : il ne faut pas envoyer un lien localhost à des amis distants. Pour un essai sur le réseau local, utiliser l'adresse LAN du serveur pour le lien et `WEB_ORIGIN`, et adapter `LIVEKIT_URL` ainsi que `rtc.node_ip` dans `deploy/livekit.dev.yaml`. Les navigateurs demandent un contexte sécurisé pour le microphone : utiliser le déploiement HTTPS pour la recette multiappareil avec vocal.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur et client avec rechargement |
| `npm run check` | Types, lint, tests unitaires/intégration, puis build |
| `npm test` | Tests Vitest |
| `npx playwright install chromium` | Installer Chromium pour les tests navigateur |
| `npm run test:e2e` | Parcours multijoueur Playwright |
| `npm run build` | Compiler le client et le serveur |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:migrate` | Appliquer les migrations PostgreSQL versionnées |

Le résultat des tests locaux et les vérifications restant à réaliser sont décrits dans [la recette](docs/acceptance.md). La CI prépare PostgreSQL, contrôle le code et exécute les tests navigateur. Aucun workflow ne publie d'image ni ne déploie automatiquement.

À ce stade, **60 tests passent**, ainsi que le contrôle TypeScript complet, le lint et les builds client/serveur. Les tests HTTP utilisent les vrais plugins Fastify. Les tests Socket.IO restent bloqués par l'interdiction d'ouvrir un port dans l'environnement de création ; les parcours navigateur, le rendu 3D et le vocal restent à vérifier selon la recette.

## Configuration

| Variable | Valeur / usage |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` |
| `HOST`, `PORT` | `0.0.0.0`, `3001` par défaut |
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

La procédure détaillée se trouve dans [déploiement et exploitation](docs/deployment.md). Elle fournit PostgreSQL, l'application, LiveKit, HTTPS et TURN/TLS derrière Caddy sur une seule adresse IPv4 publique.

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

Les salles et les parties actives résident en mémoire dans **une seule instance applicative**. Un redémarrage termine ces salles ; PostgreSQL conserve les profils invités et les résultats déjà enregistrés, mais ne permet pas de reprendre une partie interrompue. Le classement affiché appartient à la session en cours. Les résultats archivés ne disposent pas encore d'un écran de consultation.

Supprimer les cookies fait perdre l'identité invitée et l'accès à sa place ; aucun mécanisme de récupération de compte n'est proposé. Les salons sans personne connectée expirent après 30 minutes. Le vocal auto-hébergé et le repli TURN doivent être validés sur les réseaux réels de la recette avant diffusion publique. La présence de la configuration Docker ne constitue pas à elle seule une validation de déploiement.

Voir [architecture](docs/architecture.md) et [roadmap](docs/roadmap.md) pour les décisions et les étapes restantes.
