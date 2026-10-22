# Catégorie Spécial

Ajout du thème public `special`, affiché « Spécial » dans les paramètres existants. Le thème peut être sélectionné seul ou mélangé avec les autres ; « Tout mélanger » l'inclut. Le préréglage par défaut « Soirée pop culture » reste inchangé.

## Catalogue

Huit associations fournies par le propriétaire sont enregistrées dans `packages/engine/src/word-data/special.json`, avec identifiants stables, niveaux de difficulté et deux axes d'indice par entrée. Aucune association n'est reproduite dans ce rapport. Le nom de la dernière proposition est conservé tel que confirmé par le propriétaire.

Le catalogue contient désormais 1 667 paires, dont 1 547 ajouts et 120 paires historiques conservées à l'identique. Le thème Spécial contient 2 paires faciles, 3 moyennes et 3 difficiles. Ce lot éditorial ciblé ne modifie pas la répartition du lot initial de 1 500 nouvelles paires.

## Architecture et confidentialité

Les contrats partagés ne contiennent que l'identifiant et le libellé de catégorie. L'interface réutilise la grille de thèmes ; la validation des paramètres, la sélection aléatoire, les cycles sans répétition et la distribution des mots restent contrôlés par le serveur. Aucun nouvel événement réseau, aucune migration et aucune dépendance ne sont nécessaires.

## Validation

Les tests couvrent la validation et le libellé du thème, la conservation du préréglage initial, les trois difficultés, deux cycles de tirage sans répétition, la synchronisation des paramètres de salle et l'absence de mots ou d'identifiants de paires dans la projection publique. Les contrôles existants de doublons, de compatibilité Undercover/Mr. White et de frontière du bundle client incluent le nouveau lot.

- `npm ci` et `npm run db:generate` : réussis. L'audit npm signale deux vulnérabilités modérées dans les dépendances installées ; aucune dépendance n'est modifiée dans ce lot.
- `npm run check` : typage et lint réussis ; 387 tests réussis et un échec de nettoyage temporaire Vite (`ENOTEMPTY`). Le seul test concerné, rejoué avec `npx vitest run apps/web/vite.test.ts`, réussit ensuite. Les 388 tests ont donc chacun réussi, sans relancer la suite complète.
- `npm run build`, `npm run words:check` et `npm run words:boundary` : réussis, zéro anomalie de catalogue et zéro fuite détectée dans les neuf assets client contrôlés.
- `npm run test:e2e -- tests/e2e/wordLibrary.spec.ts` : réussi, avec quatre clients, affichage du nouveau thème, distribution privée sur catalogue fictif et blocage des imports HTTP des fichiers de mots.
- Les autres scénarios E2E et LiveKit ne sont pas relancés pour cet ajout de contenu.
- Après confirmation et ajout de la huitième proposition : les trois suites ciblées catalogue et sélection de salle passent, soit 21 tests. La compilation et le scénario navigateur ci-dessus ont été exécutés sur la version à sept entrées ; seule la donnée et les décomptes associés changent ensuite.

Aucun déploiement ni fusion automatique.
