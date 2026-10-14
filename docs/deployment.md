# Déploiement et exploitation

## Préparer l'hébergement

Utiliser une machine Linux avec Docker Engine/Compose v2, une IPv4 publique fixe et trois noms DNS distincts : `rene.votre-domaine.fr`, `voice.votre-domaine.fr` et `turn.votre-domaine.fr`. Les enregistrements A doivent pointer directement vers l'IP ; ne pas activer un proxy CDN HTTP devant LiveKit/TURN. Ne publier des enregistrements AAAA qu'après avoir configuré et vérifié IPv6.

Le Compose de production est autonome : ne pas le combiner avec le Compose local. PostgreSQL n'a aucun port publié. L'application et l'API LiveKit sont accessibles uniquement sur les réseaux Docker ; Caddy expose le site et la signalisation HTTPS. Les médias WebRTC passent par leurs ports dédiés. Ce modèle suit les [ports documentés par LiveKit](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

| Port public | Usage |
| --- | --- |
| TCP 80 | Émission/renouvellement des certificats et redirection HTTPS |
| TCP 443 | HTTPS, WebSocket et TURN/TLS sélectionnés par nom SNI |
| TCP 7881 | Repli ICE/TCP |
| UDP 7882 | Médias ICE/UDP multiplexés |
| UDP 3478 | TURN/STUN UDP |

Autoriser ces ports dans le pare-feu de l'hébergeur et de la machine, en conservant l'accès d'administration existant. Si la machine est derrière un routeur, les redirections doivent préserver les numéros de ports ; le CGNAT sans redirection entrante ne convient pas. Ne pas exposer 3001, 5432, 7880 ni les réseaux Docker privés.

## Configurer et lancer

À la racine du dépôt :

```sh
cp .env.production.example .env.production
openssl rand -hex 32
openssl rand -hex 32
```

Reporter séparément les deux valeurs générées dans `POSTGRES_PASSWORD` et `LIVEKIT_API_SECRET`, puis renseigner les domaines, `PUBLIC_IPV4`, l'adresse d'exploitation `ACME_EMAIL` et une clé `LIVEKIT_API_KEY`. Utiliser un `/24` privé Docker sans conflit avec l'hôte ou son VPN. `.env.production` ne doit jamais être versionné ni rendu accessible par HTTP.

```sh
chmod 600 .env.production
node --env-file=.env.production deploy/render.mjs --check
node --env-file=.env.production deploy/render.mjs
docker compose --env-file .env.production -f compose.production.yml config --quiet
docker compose --env-file .env.production -f compose.production.yml up --build -d
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 app caddy livekit
```

Le générateur a besoin de Node 24 sur la machine où il est lancé ; les fichiers `deploy/generated/` peuvent aussi être préparés localement et transférés avec `.env.production` par un canal privé. Il valide les paramètres sans afficher les secrets et écrit uniquement dans ce dossier. Les fichiers de configuration et `.env.production` doivent correspondre : relancer le générateur après toute modification.

Caddy est compilé avec le module `caddy-l4` versionné. Son enveloppe de listener intercepte seulement le domaine TURN et termine son TLS avant de transmettre vers le port **443 interne** de LiveKit avec PROXY protocol v2. Les autres connexions suivent le reverse proxy HTTP standard. LiveKit annonce donc le bon port externe 443 et reçoit l'adresse d'origine nécessaire à certains navigateurs. La [documentation du module Caddy](https://github.com/mholt/caddy-l4/blob/v0.1.2/docs/examples/combining_apps.md) décrit cette combinaison de listeners HTTP et layer 4.

L'adresse `PUBLIC_IPV4` est explicitement annoncée par LiveKit pour les candidats ICE. Caddy obtient et renouvelle les certificats des trois domaines ; laisser le port 80 accessible. La procédure officielle [LiveKit sur une machine virtuelle](https://docs.livekit.io/transport/self-hosting/vm/) détaille les contraintes DNS et certificats.

## Vérifier avant de diffuser le lien

1. Ouvrir `https://rene.votre-domaine.fr/health` et vérifier un HTTP 200, puis ouvrir l'accueil. Vérifier que l'URL HTTP redirige vers HTTPS.
2. Créer une salle, la rejoindre depuis un appareil sur un autre réseau et déplacer les deux avatars.
3. Autoriser les microphones et vérifier que chacun entend l'autre, voit la prise de parole et peut couper localement un participant.
4. Depuis un réseau bloquant l'UDP, vérifier l'audio puis forcer une recette TURN/TLS avec les outils WebRTC du navigateur : la paire ICE sélectionnée doit inclure un candidat `relay`. Une réussite audio sur le même Wi-Fi ne valide pas TURN.
5. Jouer à quatre, éliminer un joueur pendant qu'il parle, et confirmer qu'il ne peut plus intervenir auprès des vivants après la migration audio ou un rafraîchissement.
6. Terminer et relancer une partie ; vérifier les résultats et la personnalisation après une nouvelle visite.

Les demandes de permission du navigateur et les gestes nécessaires à la lecture audio ne peuvent pas être contournés : le bouton pour rejoindre l'audio est une interaction explicite du joueur. Un casque évite le retour acoustique lors des essais côte à côte.

## Surveiller

- Contrôler `/health` depuis un moniteur externe, l'état des conteneurs, l'espace disque des volumes et les erreurs applicatives/LiveKit.
- Les journaux JSON sont limités par rotation Docker à trois fichiers de 10 Mo par service. Éviter le niveau debug en production : les logs de transport peuvent inclure des informations de salle.
- Le contrôle `/health` confirme que le processus répond ; compléter par une recette synthétique périodique pour vérifier effectivement salle, base et audio.
- Ne pas multiplier les réplicas applicatifs : l'état de salle est mono-instance. Une augmentation de charge doit d'abord être mesurée avec de vrais clients ; ne pas déduire une capacité Internet de la seule limite de douze participants par salle.

## Sauvegarder et restaurer

Créer une sauvegarde PostgreSQL dans un emplacement privé et sauvegarder également le volume Caddy des certificats. Exemple d'export :

```sh
docker compose --env-file .env.production -f compose.production.yml exec -T postgres pg_dump -U rene -d rene -Fc > rene.dump
chmod 600 rene.dump
```

Copier cette sauvegarde hors de la machine et appliquer une rétention adaptée. Pour vérifier une restauration, utiliser **une base de test vide** avec les mêmes migrations et y restaurer le dump ; ne pas tester sur la base active. La sauvegarde contient des profils invités et l'historique des résultats, pas les salles actives en mémoire.

## Mettre à jour

Prévenir les joueurs et attendre la fin des parties : tout redémarrage applicatif supprime les salles actives. Sauvegarder PostgreSQL, conserver l'image/version précédente, récupérer la nouvelle version puis :

```sh
node --env-file=.env.production deploy/render.mjs --check
node --env-file=.env.production deploy/render.mjs
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d
```

L'application exécute `prisma migrate deploy` avant son démarrage et s'arrête si la migration échoue. Les migrations sont versionnées ; ne jamais utiliser `prisma migrate reset` sur les données de production. Un retour à une ancienne image suppose un schéma compatible ; sinon restaurer la sauvegarde dans une base distincte avant de réorienter le service.

En cas d'échec vocal, vérifier d'abord HTTPS/WSS, DNS, ports et les URL interne/externe LiveKit, puis consulter les erreurs et les candidats ICE. En cas d'erreur de connexion à PostgreSQL, vérifier l'état du service et le secret ; l'application ne remplace pas silencieusement les données par une base en mémoire.

## Limites de validation

Les fichiers Compose sont contrôlables sans démarrer de conteneurs avec `config --quiet`. Ce contrôle ne vérifie ni la compilation de l'image Caddy, ni les migrations effectives, ni les certificats, ni les flux UDP/TURN. La recette de production doit être réalisée sur l'hébergement réel ; ses résultats doivent être ajoutés à `acceptance.md`.
