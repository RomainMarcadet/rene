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
node --check deploy/render.mjs
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
- Démarrage Docker, compilation Caddy et recette HTTPS/TURN : **non vérifiés ici**, accès au daemon Docker indisponible dans l'environnement d'implémentation.
- **60 tests réussis avec les dépendances du projet installées par l'utilisateur** : moteur et banque de mots (28), cycle de vie des salles et sérialisation des mutations (13), persistance mémoire (3), configuration (2), identifiants de commande HTTP local (2), intégration HTTP avec les vrais plugins Fastify (12). Commande : `npm test -- --exclude '**/network.test.ts'`.
- Les tests HTTP utilisent `app.inject` sans port réseau et couvrent les fichiers statiques, le retour SPA, les erreurs API, des chemins de traversal avec un fichier témoin hors du dossier public, et les sessions invitées. Ils ne constituent pas une validation Socket.IO.
- **Build client et serveur réussi** avec Vite 7.3.7 et tsup 8.5.1. Les modules 3D et vocal restent chargés séparément.
- **Génération Prisma 6.19.3 et validation du schéma réussies** avec les binaires déjà installés dans le workspace. Aucune connexion PostgreSQL n'est nécessaire pour ces deux commandes.
- **TypeScript complet réussi** après génération du client Prisma, correction du typage des en-têtes de test et alignement des résolutions sur Vite 7.3.7.
- **ESLint 10.12.0 réussi** avec `typescript-eslint 8.71.2`.
- **Cinq tests Socket.IO tentés, tous bloqués par `listen EPERM` sur `127.0.0.1`**. Ils couvrent une partie complète à quatre identités, reconnexion, origine étrangère, déconnexion pendant une écriture et arrêt du serveur avec WebSocket ouvert. Ils restent obligatoires dans la CI ; aucun test n'est désactivé dans la configuration du projet.
- **Playwright, PostgreSQL effectif, rendu 3D, vocal et migration de la base : non vérifiés ici.** Les tests de persistance exécutés concernent l'adaptateur mémoire.
- **Correctifs de dépendances installés et verrou actualisé.** Les contrôles ont été relancés avec Fastify Static 10.1.6, deepmerge-ts 8.0.2 et esbuild 0.28.2, ce dernier dédupliqué pour tsup, tsx et Vite. `npm ci --dry-run --ignore-scripts --offline --no-audit` réussit ; Docker et la CI utilisent désormais `npm ci`. Le nouvel audit en ligne reste à exécuter depuis un environnement ayant accès au registre (`ENOTFOUND` dans le sandbox). Voir [les versions retenues et leurs justifications](dependencies.md).
- Les essais WebSocket et navigateur nécessitent un environnement autorisant l'écoute locale.
- Recette humaine multiappareil : **à réaliser avec les amis et l'hébergement réels**.

Date de cette vérification : 14 octobre 2026. Runtime local : Node.js 25.8.0 ; la cible documentée pour développement et Docker est Node.js 24 LTS.
