# Roadmap de livraison

Les étapes sont des incréments vérifiables, sans calendrier artificiel. Une fonctionnalité implémentée n'est considérée validée que lorsque son scénario de recette a été exercé.

| Étape | Contenu livré dans le code | Validation attendue |
| --- | --- | --- |
| 0 — Fondations | Monorepo TypeScript, scripts, contrats, CI, Prisma, Docker | Installation vierge, types, lint et builds |
| 1 — Moteur | Machine à états, règles, scores, hasard/horloge injectables, 120 paires françaises catégorisées | 28 tests réussis ; moteur et contrats contrôlés en TypeScript strict |
| 2 — Partie complète | Salle privée, identité invitée, préparation, descriptions, discussion, vote, résultats et relance | Quatre clients réseau finissent une partie |
| 3 — Continuité | Reconnexion, changement d'hôte, validation, échéances, enregistrement idempotent | Coupure, double envoi, isolation des salles |
| 4 — Direction artistique | Trois silhouettes procédurales, accessoires et palette RENÉ | Revue visuelle sur ordinateur et mobile |
| 5 — Hub | Scène partagée, déplacements, collisions, emotes et apparences | Quatre puis douze clients, déplacements fluides |
| 6 — Social | Chat, LiveKit audio, permissions, silence local et mise en scène | Microphone refusé, reconnexion audio et élimination |
| 7 — Livraison Internet | Configurations HTTPS/TURN, exploitation et recette | Déploiement réel, quatre amis sur plusieurs réseaux |

## Priorités de recette

- Les 48 tests actuellement exécutables et la revue statique sont passés ; les vérifications réseau, navigateur et déploiement restent nécessaires avant de qualifier la V1 de livrée.
- Exécuter la chaîne automatisée et archiver les éventuelles limites d'environnement dans `acceptance.md`.
- Vérifier la cohérence visuelle des trois avatars au cadrage réel, puis la lisibilité à douze joueurs.
- Déployer sur les domaines réels ; exercer le vocal direct et le repli TURN/TLS, y compris après élimination.
- Faire terminer et relancer une partie à quatre personnes sur plusieurs appareils/réseaux ; cette recette humaine ne peut pas être remplacée par des clients automatisés.

## Évolutions après V1

- Reprise des salles actives après un redémarrage, puis coordination multi-instance si la charge le justifie.
- Historique consultable des résultats archivés et outils d'exploitation supplémentaires.
- Enrichissement des accessoires, animations et paires de mots d'après les retours de parties.

La V1 ne comprend ni comptes obligatoires, ni matchmaking public, ni bot simulant des joueurs, ni fonctionnalité d'IA en jeu.
