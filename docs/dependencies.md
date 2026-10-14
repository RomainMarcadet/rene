# Dépendances et audit npm

Correctifs appliqués le 14 octobre 2026 à partir de l'audit fourni après la première installation. Les manifestes, le verrou et les dépendances installées sont alignés ; TypeScript, ESLint, 60 tests hors Socket.IO et les deux builds passent. Un nouvel audit en ligne reste à exécuter depuis un environnement ayant accès au registre.

| Dépendance | Version retenue | Motif |
| --- | --- | --- |
| `@fastify/static` | `^10.1.6` | Correctifs de traversée de chemins et de contournement des gardes de routes. Cette branche reste compatible avec Fastify 5. RENÉ n'utilise pas le callback `setHeaders` dont la signature change en v10. |
| Prisma CLI et client | `6.19.3` | Versions identiques, conservées pour éviter une migration du moteur et de la configuration de base de données pendant le correctif. |
| `deepmerge-ts` via `@prisma/config@6.19.3` | `8.0.2` | Override limité à la dépendance vulnérable du CLI Prisma. La fonction `deepmerge` utilisée par Prisma reste disponible ; Prisma a lui-même adopté cette version sur sa branche v7. |
| `esbuild` | `^0.28.2` | Override global pour éliminer la copie vulnérable conservée sous tsup par la résolution des workspaces. Vite et tsx utilisent déjà cette version. Corrige la lecture arbitraire de fichiers du serveur de développement sous Windows. |
| ESLint / `@eslint/js` | `^10.12.0` / `^10.0.1` | Remplace la branche 9 dépréciée. `typescript-eslint >=8.71.2` prend en charge ESLint 10. Le projet cible Node 24 ou supérieur. |
| Vite | `^7.3.7` | Même version pour l'application, le plugin React et Vitest ; évite les types incompatibles des deux versions majeures installées lors de la résolution initiale. |

Les overrides sont déclarés à la racine du monorepo. tsup est aussi déclaré à la racine pour que npm transmette effectivement l'override esbuild à son arbre de dépendances malgré le lien workspace. Retirer l'override Prisma lorsque la version retenue de Prisma dépend elle-même d'une version corrigée de `deepmerge-ts`. Retirer l'override esbuild quand tsup adopte une version corrigée. L'override Vite conserve une seule version du bundler dans les workspaces et les tests.

Après toute modification des manifestes :

```sh
npm install
npm audit
npm run db:generate
npx prisma validate --schema apps/server/prisma/schema.prisma
npm run check
```

Conserver le `package-lock.json` produit par cette installation avec les manifestes. Un audit sans vulnérabilité ne peut être annoncé qu'après exécution effective de `npm audit` avec accès au registre.

Sources : [compatibilité Fastify Static](https://github.com/fastify/fastify-static#compatibility), [migration Static v10](https://github.com/fastify/fastify-static/releases/tag/v10.0.0), [avis deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [correctif adopté par Prisma](https://github.com/prisma/orm/pull/30189), [avis esbuild](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), [migration ESLint 10](https://eslint.org/docs/latest/use/migrate-to-10.0.0).
