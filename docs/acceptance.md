# Recette et preuves de validation

Les suites réseau et navigateur sont écrites pour exercer des clients indépendants ; elles ne remplacent pas la partie finale avec quatre personnes sur différents appareils et réseaux. Leur présence ne signifie pas qu'elles ont été exécutées : les preuves effectives figurent ci-dessous.

## Chaîne automatisée

```sh
npm ci
npm run db:generate
npm run check
npx playwright install chromium
npm run test:e2e
docker compose -f compose.yml config --quiet
docker compose --env-file .env.production.example -f compose.production.yml config --quiet
docker compose --env-file .env.caddy.example -f compose.existing-caddy.yml config --quiet
docker compose --env-file .env.caddy.example -f compose.existing-caddy.yml -f compose.existing-caddy.network.yml config --quiet
node --check deploy/render.mjs
node --check deploy/render-existing-caddy.mjs
```

Pour couvrir PostgreSQL, lancer le service local et les migrations avant les tests qui l'utilisent. Pour un test sans PostgreSQL, laisser `DATABASE_URL` vide uniquement en développement/test. Le générateur de production refuse les valeurs d'exemple : son contrôle de syntaxe est distinct d'une génération effective avec des paramètres réels.

## Scénarios métier et réseau

- [ ] Quatre identités créent/rejoignent la même salle ; une cinquième salle reste isolée.
- [ ] Les avatars, personnalisations, présences, mouvements et emotes sont synchronisés.
- [ ] L'hôte peut changer les paramètres ; une composition invalide et un démarrage prématuré sont rejetés côté serveur.
- [ ] Chaque client reçoit son propre mot sans son rôle Civil/Undercover ; les mots restent absents de toutes les projections publiques avant les résultats.
- [ ] Les descriptions suivent l'ordre prévu ; le tour expiré passe au suivant.
- [ ] Discussion et chat fonctionnent, puis un seul vote par vivant est accepté ; auto-vote, doublons et votes d'éliminés échouent.
- [ ] Une égalité déclenche le départage ; une seconde égalité est tirée au sort côté serveur ; aucun vote reprend un cycle.
- [ ] Mr. White a une seule tentative ; accents, casse et espaces sont normalisés, sans synonymes acceptés automatiquement.
- [ ] Les trois victoires produisent les mêmes résultats et points pour tous, sans double attribution.
- [ ] Un rafraîchissement au vote conserve identité et place ; une commande d'une ancienne phase est rejetée.
- [ ] L'hôte absent est remplacé après 30 secondes ; son départ volontaire transfère immédiatement le rôle.
- [ ] Une personne arrivée pendant la partie attend la suivante. Rejouer garde la salle et respecte le classement de session.
- [ ] Deux onglets du même profil ne créent pas deux votes ni deux identités.

## Recette visuelle, mobile et audio

- [ ] Les silhouettes poire, rectangle et haricot se distinguent au cadrage réel, avec accessoires et expressions.
- [ ] ZQSD/flèches et commandes tactiles permettent de se déplacer sans traverser la table.
- [ ] Douze avatars restent lisibles et fluides sur un ordinateur modeste ; mesurer le navigateur, l'appareil et la fréquence d'image.
- [ ] Les panneaux sont utilisables à 390 px de large, au clavier et avec les mouvements réduits.
- [ ] Un refus de microphone produit un message utilisable ; le chat permet de poursuivre.
- [ ] Le vocal fonctionne entre deux réseaux ; microphone, indicateurs de parole et sourdine locale sont cohérents.
- [ ] Un éliminé est réduit à l'écoute après la migration audio ; reconnecter ou réutiliser l'ancien jeton ne donne pas accès à la génération active avec ses anciens droits.
- [ ] Une connexion TURN/TLS 443 est effectivement sélectionnée lors d'un essai avec UDP indisponible.
- [ ] Quatre personnes terminent puis relancent une partie sans intervention technique.

## État de vérification lors de l'implémentation

- Contrôle syntaxique Node du générateur : réussi.
- Résolution des configurations Docker Compose locale et production : réussie. Le port hôte du PostgreSQL local est désormais `5433` ; les configurations `.env`, `.env.example` et une surcharge `POSTGRES_PORT=55432` ont été validées. Les connexions internes restent sur `postgres:5432`.
- Préflight production exercé avec paramètres de test : accepte une configuration structurée, route TURN sur 443 avec PROXY v2, refuse un secret d'exemple et une adresse privée.
- Vérification initiale : le daemon Docker était inaccessible. L'image applicative et le proxy Caddy standard ont depuis été testés localement (voir l'adaptation port 80 ci-dessous). La compilation Caddy avec `caddy-l4` et la recette TURN restent non vérifiées.
- **71 tests réussis avec les dépendances du projet installées par l'utilisateur** : moteur et banque de mots (28), cycle de vie des salles et sérialisation des mutations (13), persistance mémoire (3), configuration (3), politique d'origine Socket.IO (10), identifiants de commande HTTP local (2), intégration HTTP avec les vrais plugins Fastify (12). Commande : `npm test -- --exclude '**/network.test.ts'`.
- Les tests HTTP utilisent `app.inject` sans port réseau et couvrent les fichiers statiques, le retour SPA, les erreurs API, des chemins de traversal avec un fichier témoin hors du dossier public, et les sessions invitées. Ils ne constituent pas une validation Socket.IO.
- **Build client et serveur réussi** avec Vite 7.3.7 et tsup 8.5.1. Les modules 3D et vocal restent chargés séparément.
- **Génération Prisma 6.19.3 et validation du schéma réussies** avec les binaires déjà installés dans le workspace. Aucune connexion PostgreSQL n'est nécessaire pour ces deux commandes.
- **TypeScript complet réussi** après génération du client Prisma, correction du typage des en-têtes de test et alignement des résolutions sur Vite 7.3.7.
- **ESLint 10.12.0 réussi** avec `typescript-eslint 8.71.2`.
- **Les six tests Socket.IO passent désormais avec l'autorisation d'écoute locale.** Ils couvrent le polling authentifié sans `Origin` sur l'hôte configuré, une partie complète à quatre identités, reconnexion, origine étrangère, déconnexion pendant une écriture et arrêt du serveur avec WebSocket ouvert. La première exécution réelle a révélé une borne `crypto.randomInt` invalide (`2 ** 48`) ; son remplacement par `2 ** 32` corrige le démarrage des parties. Les suites utilisent le générateur réel du serveur pour couvrir cette régression. Aucun test n'a été désactivé.
- **Recette manuelle du serveur déjà lancé par l'utilisateur sur son adresse LAN : réussie pour la connexion et le salon.** Un salon a été créé depuis Comet privé, puis rejoint depuis Safari avec une autre identité. Les deux navigateurs affichaient les mêmes deux participants et le même historique de chat ; après actualisation de Safari, sa place était conservée sans doublon. Une capture réelle de Comet a confirmé le rendu du salon 3D et de l'avatar. Le texte de secours du canvas présent dans l'arbre d'accessibilité ne constituait pas une erreur visuelle.
- **Playwright, persistance PostgreSQL après redémarrage et vocal : non vérifiés ici.** Les tests de persistance automatisés concernent l'adaptateur mémoire. La migration et l'enregistrement des invités ont été vérifiés dans la pile Docker de test décrite ci-dessous. La recette manuelle à deux navigateurs ne valide pas une partie complète à quatre ni les performances à douze.
- **Mode Caddy existant :** trois configurations Compose résolues (Caddy hôte, Caddy conteneur, ports/LAN personnalisés), générateur validé avec adresses LAN/publiques et 22 cas de rejet, rendu et permissions 600/700 contrôlés. Le fragment est désormais validé par Caddy 2.11.4 et une pile isolée vérifie le proxy HTTPS vers le port 80. Les domaines et certificats réels, le routage Internet et l'audio restent à contrôler sur le PC serveur selon [le guide Caddy existant](caddy-existing.md).
- **Correctifs de dépendances installés et verrou actualisé.** Les contrôles ont été relancés avec Fastify Static 10.1.6, deepmerge-ts 8.0.2 et esbuild 0.28.2, ce dernier dédupliqué pour tsup, tsx et Vite. `npm ci --dry-run --ignore-scripts --offline --no-audit` réussit ; Docker et la CI utilisent désormais `npm ci`. Le nouvel audit en ligne reste à exécuter depuis un environnement ayant accès au registre (`ENOTFOUND` dans le sandbox). Voir [les versions retenues et leurs justifications](dependencies.md).
- Les essais WebSocket et navigateur nécessitent un environnement autorisant l'écoute locale.
- Recette humaine multiappareil : **à réaliser avec les amis et l'hébergement réels**.

Date de cette vérification : 14 octobre 2026. Runtime local : Node.js 25.8.0 ; la cible documentée pour développement et Docker est Node.js 24 LTS.

## Adaptation au port 80 et au réseau du Caddy existant

Vérifiée le 14 octobre 2026 sur Docker Desktop, dans un projet Compose distinct `rene-port80-check`, sans ports hôte publiés et sans modification des services `rene-dev` existants.

- Image `rene:caddy-port80` compilée avec le Dockerfile complet : génération Prisma, frontend Vite et serveur tsup réussis.
- Les quatre configurations Compose (développement, production autonome, Caddy sur l'hôte, Caddy sur réseau Docker) sont valides après le changement de port. Le mapping local reste `3001:80` ; la variante réseau utilise l'alias `rene` et le réseau externe `web` par défaut.
- Le conteneur applicatif tourne avec `USER node`, annonce uniquement `80/tcp`, écoute sur ce port et passe son healthcheck. La variante réseau ne publie aucun port HTTP de l'application sur l'hôte.
- PostgreSQL de test est sain ; les migrations versionnées s'appliquent avant le démarrage applicatif et quatre invités distincts sont enregistrés par `/api/session`.
- Le fragment `deploy/Caddyfile.rene.example` et le Caddyfile de test ont été validés par le binaire officiel Caddy 2.11.4.
- HTTPS est testé avec une CA interne propre à la pile, approuvée uniquement par le processus de test : `/health`, la page d'accueil et son bundle JavaScript répondent avec HTTP 200 via `reverse_proxy rene:80`. La vérification TLS reste activée.
- Quatre clients Socket.IO indépendants se connectent à travers Caddy : un en polling HTTPS et trois en WebSocket WSS. Création/rejoindre, liste des quatre participants, chat partagé et récupération de l'identité et de la salle avec le cookie invité sont validés. Les cookies sont `Secure` et `HttpOnly`.
- Ce test utilise des clients réseau automatisés ; il ne valide pas une partie complète à quatre personnes, le rendu navigateur ou l'audio WebRTC. Aucun domaine public ni Caddy du PC serveur n'a été modifié. L'accès UI AnyDesk a échoué par timeout.
- La pile temporaire, ses réseaux et ses volumes de test ont été retirés après vérification. Les services de développement existants ont été conservés.

## Configuration finale sur le port 8080

À la demande de l'utilisateur, le port de RENÉ est maintenant **8080** : `PORT=8080`, `EXPOSE 8080`, healthchecks, mappings Compose et cibles de proxy sont alignés. Les anciennes preuves sur le port 80 ci-dessus décrivent l'étape précédente. L'application reste exécutée avec `USER node` ; aucun sysctl de port privilégié n'est nécessaire.

- `npm run check` réussit : TypeScript, ESLint, **77 tests dont les six tests Socket.IO**, builds client et serveur.
- L'image `rene:caddy-port8080` compile avec Node 24 et le Dockerfile complet ; le healthcheck passe sur 8080. L'image annonce uniquement `8080/tcp` et la variante réseau ne publie aucun port HTTP sur l'hôte.
- Une nouvelle recette Docker isolée avec PostgreSQL, LiveKit et Caddy 2.11.4 confirme `/health`, la page d'accueil et le bundle via HTTPS vers `rene:8080`, ainsi que quatre identités Socket.IO, le polling/WSS, le chat partagé et la récupération de l'identité et de la salle par cookie.
- L'image intégrant le correctif du hasard démarre effectivement une partie à quatre et distribue les mots privés sans révéler les rôles ou les mots dans l'état public. Les quatre variantes Compose et le fragment Caddy sont validés ; la pile de test a été retirée après la recette.
- Le générateur LiveKit peut être exécuté avec l'image officielle Node dans Docker, sans installer Node.js sur le serveur. Les variantes Compose restent documentées pour joindre un Caddy déjà en place.
