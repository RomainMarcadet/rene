# RENÉ derrière un Caddy existant

Ce mode lance l'application compilée, PostgreSQL et LiveKit dans Docker, puis utilise votre Caddy pour HTTPS et les WebSockets. Le `Dockerfile` sert le client, l'API et Socket.IO en HTTP sur le **port 8080 du conteneur**. Caddy termine HTTPS et transmet les requêtes vers ce port.

La variante Caddy en conteneur utilise le réseau externe **`web`**. L'application y porte l'alias **`rene`** et le proxy peut utiliser **`reverse_proxy rene:8080`**. L'application n'a alors aucun port HTTP publié sur le PC. LiveKit porte l'alias `rene-livekit` et conserve son port de signalisation 7880.

Le processus applicatif tourne avec l'utilisateur `node`. Le port 8080 ne nécessite aucune permission spéciale. Le healthcheck contrôle le port réellement configuré dans l'image ; celui du Compose Caddy contrôle le port 8080.

Utiliser `compose.existing-caddy.yml` seul, avec éventuellement sa variante réseau ci-dessous. Ne pas le combiner avec `compose.yml` ou `compose.production.yml`. Les deux modes de production utilisent le projet Compose `rene` et le volume PostgreSQL associé : ils sont des alternatives, à ne pas lancer simultanément.

## Choisir les adresses

Choisir deux noms distincts, par exemple `rene.votre-domaine.fr` et `voice.votre-domaine.fr`, qui mènent au Caddy existant. Pour un réseau local, des noms comme `rene.home.arpa` et `voice.home.arpa` conviennent avec un DNS local et des certificats approuvés par les appareils. Les noms `example.com` des fichiers fournis sont des exemples refusés par le générateur.

| Paramètre | Usage |
| --- | --- |
| `RENE_DOMAIN` | Domaine canonique de l'application, sans `https://`, chemin ou port ; le serveur attend exactement l'origine `https://` suivie de ce domaine. |
| `VOICE_DOMAIN` | Domaine HTTPS/WSS de la signalisation LiveKit, accessible aux navigateurs. |
| `LIVEKIT_NODE_IP` | IPv4 directement joignable par les joueurs pour les médias : IP LAN du PC en usage LAN, ou IP publique avec redirections pour Internet. |
| `RENE_BIND_ADDRESS` | Adresse de publication des deux ports HTTP ; `127.0.0.1` lorsque Caddy fonctionne sur le même hôte. |
| `RENE_HTTP_PORT`, `LIVEKIT_HTTP_PORT` | Ports HTTP publiés uniquement pour Caddy sur l'hôte ; 8080 → 8080 et 7880 → 7880 par défaut. Sans effet avec la variante réseau Docker. |
| `RENE_NETWORK_SUBNET` | Réseau Docker privé `/24`, distinct du LAN, du VPN et des autres réseaux Docker. |
| `RENE_TRUST_PROXY` | Adresse IPv4 `/32` ou sous-réseau précis de Caddy **tel que le conteneur applicatif le voit**. |
| `CADDY_NETWORK` | Réseau Docker externe existant de Caddy, `web` par défaut ; utilisé par la variante Caddy en conteneur. |

La connexion interne de l'application à LiveKit reste `http://livekit:7880`. Son URL publique devient `wss://VOICE_DOMAIN`. PostgreSQL reste uniquement sur le réseau Docker privé, sans port hôte. Les ports hôte locaux de développement, dont PostgreSQL 5433, ne sont pas utilisés par ce mode.

`LIVEKIT_NODE_IP` ne doit pas être `127.0.0.1` ni une adresse du bridge Docker. Pour un accès Internet depuis chez soi, les redirections du routeur doivent pointer vers le PC serveur et conserver les ports 7881/TCP et 7882/UDP. Le CGNAT sans redirection entrante ne permet pas cet accès direct. Tester aussi depuis le LAN : selon le routeur, l'accès à l'IP publique depuis le réseau interne peut nécessiter le NAT loopback.

## Préparer la configuration

Prérequis : Docker Engine et Compose v2. La variante réseau utilise les balises `!reset` et `!override`, disponibles à partir de **Compose 2.24.4**. Le générateur peut être exécuté dans Docker ; Node.js n'est alors pas nécessaire sur le serveur.

```sh
cp .env.caddy.example .env.caddy
chmod 600 .env.caddy
openssl rand -hex 32
openssl rand -hex 32
```

Reporter séparément les deux secrets générés dans `POSTGRES_PASSWORD` et `LIVEKIT_API_SECRET`. Choisir une clé `LIVEKIT_API_KEY`, puis renseigner les domaines et les adresses. Ne jamais versionner `.env.caddy`. Une valeur de secret conservée dans un volume PostgreSQL existant ne change pas simplement en modifiant la variable : garder le mot de passe de cette base, ou effectuer sa rotation explicitement.

```sh
docker run --rm --env-file .env.caddy -v "${PWD}:/work" -w /work node:24-bookworm-slim node deploy/render-existing-caddy.mjs --check
docker run --rm --env-file .env.caddy -v "${PWD}:/work" -w /work node:24-bookworm-slim node deploy/render-existing-caddy.mjs
```

Le générateur refuse les valeurs d'exemple, secrets trop courts ou identiques, adresses multicast/loopback pour les médias, origines mal formées et conflits de ports réservés. Il écrit `deploy/generated/livekit.existing-caddy.yaml` avec les permissions **600**, dans un répertoire **700**, sans afficher les secrets. Relancer la génération après toute modification ; la configuration LiveKit et les variables Compose doivent correspondre. Les variables déjà exportées dans le terminal prennent priorité sur les fichiers d'environnement : utiliser un terminal sans anciennes valeurs RENÉ exportées.

## Caddy installé comme service sur le même PC

Conserver `RENE_BIND_ADDRESS=127.0.0.1`. Avec le réseau par défaut sur Linux, la passerelle Docker est généralement `172.30.93.1`, d'où `RENE_TRUST_PROXY=172.30.93.1/32`. Vérifier l'adresse de passerelle du réseau `rene_realtime` et la provenance réellement observée par l'application ; Docker Desktop ou une autre topologie peuvent employer une adresse différente. Si le sous-réseau Docker change, adapter également la confiance accordée au proxy.

```sh
docker compose --env-file .env.caddy -f compose.existing-caddy.yml config --quiet
docker compose --env-file .env.caddy -f compose.existing-caddy.yml up --build -d
```

Si nécessaire, ajouter les deux blocs de `deploy/Caddyfile.rene.example` à la configuration Caddy existante, en remplaçant les domaines **et les cibles** par `127.0.0.1:8080` et `127.0.0.1:7880`, ou les ports choisis dans `.env.caddy`. Le port 8080 de l'hôte est redirigé vers le port 8080 de RENÉ.

## Caddy dans un conteneur sur le même PC

Renseigner `CADDY_NETWORK` avec le nom d'un réseau auquel le conteneur Caddy est déjà connecté ; conserver `web` si c'est le réseau de vos autres applications. Vérifier avec `docker network inspect web` (ou le nom choisi). Les bridges Docker ne traversent pas les hôtes.

Configurer `RENE_TRUST_PROXY` avec l'adresse du Caddy sur ce réseau, ou son sous-réseau si les adresses des conteneurs sont dynamiques. N'accorder cette confiance qu'à un réseau contrôlé. Le réseau Caddy peut être inspecté avec `docker network inspect NOM_DU_RESEAU`.

```sh
docker compose --env-file .env.caddy -f compose.existing-caddy.yml -f compose.existing-caddy.network.yml config --quiet
docker compose --env-file .env.caddy -f compose.existing-caddy.yml -f compose.existing-caddy.network.yml up --build -d
```

Les cibles du fichier `deploy/Caddyfile.rene.example` sont déjà adaptées : **`rene:8080`** et **`rene-livekit:7880`**. Si votre Caddy a déjà les sites configurés, aucune modification n'est nécessaire. Sinon, remplacer les deux domaines par ceux de `.env.caddy`, par exemple :

```caddyfile
rene.votre-domaine.fr {
    reverse_proxy rene:8080
}

voice.votre-domaine.fr {
    reverse_proxy rene-livekit:7880
}
```

La variante retire les publications HTTP sur l'hôte et ajoute les alias sur le réseau externe. Caddy reste responsable des ports publics 80/443 et des certificats. Les réseaux privés et les ports des médias sont conservés. Les services se joignent par leur nom et leur port interne sur le [réseau partagé Compose](https://docs.docker.com/compose/how-tos/networking/#use-an-existing-network).

Conserver les deux arguments `-f` pour toutes les commandes suivantes : statut, journaux, mise à jour et arrêt. Les paramètres de ports HTTP hôte sont sans effet dans cette variante.

## Caddy sur une autre machine

Utiliser le fichier de base et remplacer `RENE_BIND_ADDRESS` par l'IPv4 LAN du PC Docker. Dans Caddy, viser cette adresse et les ports HTTP publiés. Le pare-feu doit limiter l'accès à ces ports aux connexions du Caddy ; ne pas les rediriger depuis Internet. Configurer `RENE_TRUST_PROXY` avec l'adresse réellement vue pour ce proxy, y compris une éventuelle traduction d'adresse. PostgreSQL reste non publié.

## Certificats, origine et WebSockets

Pour des domaines publics, conserver la gestion de certificats déjà en place dans Caddy. Si Caddy utilise des certificats fournis, reprendre ses directives `tls` et les chemins accessibles à son processus/conteneur.

Pour un domaine interne, activer `tls internal` dans **les deux** blocs et installer la CA racine de Caddy comme autorité approuvée sur chaque appareil joueur. Le navigateur ne doit présenter aucune erreur de certificat sur l'application ni sur le domaine voix. L'installation de la CA sur le serveur seul ne suffit pas ; le microphone et WSS dépendent aussi de la confiance sur les appareils. La [documentation HTTPS de Caddy](https://caddyserver.com/docs/automatic-https#local-https) décrit ce fonctionnement.

Utiliser un seul domaine canonique pour entrer dans le jeu. `WEB_ORIGIN` est construit à partir de `RENE_DOMAIN`, les cookies sont sécurisés et les accès Socket.IO d'une autre origine sont refusés. Une URL HTTP, un alias DNS différent ou un port HTTPS autre que 443 ne correspond pas à cette configuration.

Transmettre **l'intégralité** de chaque site avec `reverse_proxy` : aucune suppression de préfixe, aucun `handle_path /rene/*`, aucune réécriture de `/api` ou `/socket.io`. Le client utilise ces chemins à la racine. Caddy gère automatiquement la montée en WebSocket et les en-têtes de proxy ; ne pas remplacer l'en-tête `Origin`. Voir [reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Valider la configuration Caddy complète, par exemple avec `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, puis la recharger avec la procédure habituelle de votre installation. Un rechargement peut interrompre les WebSockets existants : effectuer cette opération hors d'une partie en cours.

## Audio : portée de ce mode

| Trafic | Chemin |
| --- | --- |
| Jeu, API, Socket.IO | Navigateur → Caddy HTTPS 443 → `rene:8080` (HTTP interne) |
| Signalisation LiveKit | Navigateur → Caddy HTTPS/WSS 443 → LiveKit HTTP 7880 |
| Médias ICE/UDP | Navigateur → `LIVEKIT_NODE_IP:7882/UDP` → LiveKit |
| Repli ICE/TCP | Navigateur → `LIVEKIT_NODE_IP:7881/TCP` → LiveKit |

Un `reverse_proxy` HTTP ne transporte pas les médias WebRTC ni TURN/TLS. Ce mode désactive explicitement TURN et n'annonce donc aucun relais inexistant. Il ne couvre pas les réseaux qui bloquent à la fois UDP et TCP 7881. Une connexion WSS réussie ne prouve pas que les participants peuvent s'entendre. Les ports suivent la [documentation LiveKit](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

Pour couvrir les réseaux restrictifs, ajouter ultérieurement un relais TURN fonctionnel. Sur une IP partageant déjà 443 avec Caddy, cela demande un routage SNI layer 4 dans le frontal existant, ou une autre adresse/frontière réseau adaptée. Le mode autonome décrit dans `deployment.md` fournit un exemple complet avec caddy-l4 ; ne pas démarrer son Caddy en concurrence avec celui déjà installé. [Déploiement et TURN LiveKit](https://docs.livekit.io/transport/self-hosting/deployment/).

## Vérifier et exploiter

1. Vérifier `docker compose ... ps` : PostgreSQL et l'application doivent être sains ; les migrations s'exécutent avant le démarrage applicatif et un échec empêche celui-ci.
2. Ouvrir `https://RENE_DOMAIN/health`, puis le jeu, sans erreur de certificat. Contrôler les deux domaines dans les outils réseau du navigateur.
3. Rejoindre la même salle depuis deux appareils, vérifier déplacements, chat et reconnexion après rafraîchissement.
4. Activer les micros et vérifier l'audio dans les deux sens. Refaire l'essai depuis un autre réseau pour un hébergement Internet ; vérifier les candidats ICE sélectionnés si l'audio échoue.
5. Terminer une partie à quatre et la relancer avant de diffuser largement le lien.

`/health` confirme uniquement que le processus applicatif répond. La santé PostgreSQL et la migration initiale sont vérifiées séparément ; le service LiveKit n'a pas de healthcheck Compose dans ce mode et doit être validé par une connexion audio réelle.

Les journaux sont limités à trois fichiers de 10 Mo par service. Conserver les consignes de sauvegarde et de mise à jour de `deployment.md`, en remplaçant les fichiers Compose et `.env.production` par ceux de ce mode. Un redémarrage de l'application perd les salles actives ; le volume conserve les profils et les résultats sauvegardés. Ne pas employer `down -v` pour une mise à jour ordinaire.

Les contrôles `--check` et `config --quiet` ne démarrent aucun conteneur et ne valident pas la présence du réseau Caddy, les certificats, le pare-feu, le NAT ou l'audio. Une recette sur le PC serveur reste nécessaire.
