# **MISSION — DÉVELOPPER UNDERCOVER : RENÉ**

## **1\. TON RÔLE**

Tu es un **Lead Game Developer Full Stack**, spécialisé dans le développement de jeux multijoueurs temps réel accessibles depuis un navigateur.

Tu maîtrises :

* TypeScript, React et Node.js.  
* Three.js, React Three Fiber et les environnements 3D interactifs.  
* Les architectures multijoueurs avec WebSockets.  
* La synchronisation des états entre plusieurs clients.  
* La conception de moteurs de jeu et de machines à états.  
* Le game design, l'UX/UI et les interfaces immersives.  
* La sécurité des applications multijoueurs et les tests automatisés.

Tu agis comme un développeur senior responsable de la conception, de l'architecture, de l'implémentation et de la qualité du produit.

**Ta mission n'est pas de produire une démonstration visuelle ou une maquette : tu dois développer un véritable jeu fonctionnel, multijoueur, jouable de bout en bout.**

---

## **2\. VISION DU PROJET**

Le jeu s'appelle **UNDERCOVER — RENÉ**.

C'est un jeu d'ambiance, de déduction sociale, de bluff et de manipulation, entièrement jouable en ligne depuis un navigateur.

Les joueurs rejoignent une salle privée, incarnent un avatar personnalisable et évoluent dans un environnement 3D partagé.

Chaque partie distribue des mots secrets et des rôles cachés. Les joueurs doivent discuter, déduire les identités des autres et éliminer leurs adversaires.

### **Expérience recherchée**

Je veux retrouver :

* La convivialité et les interactions sociales d'Among Us.  
* La tension psychologique d'un jeu de bluff.  
* La simplicité des règles d'Undercover.  
* Un environnement 3D ludique et vivant.  
* Une expérience fluide, immédiatement accessible, sans installation.

Le jeu doit donner envie de rester dans le hub avec ses amis, même entre deux parties.

L'identité visuelle doit être reconnaissable, moderne, légèrement absurde et humoristique, sans sacrifier la lisibilité.

---

## **3\. PARCOURS DU JOUEUR**

### **Étape 1 — Arrivée dans le jeu**

Le joueur accède au site depuis son navigateur.

Il peut :

* Choisir un pseudonyme.  
* Personnaliser son avatar.  
* Créer une salle privée.  
* Rejoindre une salle avec un code ou un lien d'invitation.

La création de compte ne doit pas être obligatoire.

### **Étape 2 — Hub multijoueur 3D**

Après avoir rejoint une salle, le joueur apparaît dans un environnement 3D partagé avec les autres participants.

Le hub doit permettre de :

* Visualiser les avatars de tous les joueurs connectés.  
* Afficher leur pseudonyme au-dessus de leur tête.  
* Se déplacer dans l'environnement.  
* Voir les déplacements et animations des autres en temps réel.  
* Utiliser des emotes.  
* Communiquer vocalement et par écrit.  
* Modifier son apparence avant la partie.  
* Consulter la liste des participants.  
* Indiquer qu'on est prêt.  
* Visualiser les paramètres et le statut de la partie.

**Les déplacements, les arrivées et les départs des joueurs doivent être réellement synchronisés entre les navigateurs.**

### **Étape 3 — Personnalisation des avatars**

Créer un système d'avatars stylisés, simples, expressifs et optimisés pour le navigateur.

Personnalisation initiale :

* Couleur de peau.  
* Coiffure et couleur des cheveux.  
* Visage et expressions.  
* Vêtements et couleurs.  
* Accessoires.  
* Animations et emotes.

Les choix doivent être visibles par tous les joueurs et conservés lors des prochaines visites, dans la mesure du possible sans compte utilisateur.

Privilégier une direction artistique low-poly, cartoon, avec des silhouettes identifiables.

---

## **4\. RÈGLES DU JEU UNDERCOVER**

Le jeu contient trois types de rôles.

### **CIVILS**

Tous les Civils reçoivent exactement le même mot secret.

Objectif : identifier et éliminer tous les Undercovers et les Mr. Whites.

### **UNDERCOVERS**

Tous les Undercovers reçoivent un deuxième mot secret, proche sémantiquement de celui des Civils.

Exemple :

* Civils : CHIEN  
* Undercovers : CHAT

Objectif : survivre et éviter d'être éliminés.

Point fondamental : **un joueur recevant un mot ne sait pas initialement s'il est Civil ou Undercover**.

Il doit le découvrir en analysant les descriptions et les discussions.

### **MR. WHITE**

Mr. White ne reçoit aucun mot secret.

Il doit improviser pendant les descriptions et tenter de découvrir le mot des Civils.

Il peut remporter la partie immédiatement s'il parvient à deviner le mot des Civils après son élimination.

### **Composition des parties**

Prévoir des parties de 4 à 12 joueurs, avec possibilité d'adapter cette limite.

Le jeu propose automatiquement une répartition équilibrée des rôles, que l'hôte peut modifier.

Paramètres :

* Nombre de Civils.  
* Nombre d'Undercovers.  
* Nombre de Mr. Whites.  
* Composition aléatoire ou personnalisée.  
* Nombre de manches si plusieurs parties s'enchaînent.

Le système doit vérifier que chaque composition est valide et qu'aucune équipe ne remporte automatiquement la partie dès le démarrage.

---

## **5\. DÉROULEMENT D'UNE PARTIE**

Le jeu utilise une **machine à états explicite**, contrôlée par le serveur.

### **PHASE 1 — DISTRIBUTION DES MOTS**

Au démarrage :

1. Le serveur sélectionne aléatoirement une paire de mots.  
2. Les rôles sont attribués aux participants.  
3. Chaque joueur reçoit secrètement son mot ou l'absence de mot pour Mr. White.  
4. Un joueur est choisi aléatoirement pour commencer.

Le mot secret ne doit jamais être accessible depuis les données publiques de la salle.

La distribution doit être individuelle et confidentielle.

### **PHASE 2 — DESCRIPTION**

Chaque joueur encore vivant doit décrire son mot avec un mot ou une courte phrase.

Le système doit :

* Définir un ordre de passage.  
* Afficher le joueur dont c'est le tour.  
* Afficher son avatar et mettre celui-ci en valeur.  
* Permettre de saisir sa description.  
* Publier les descriptions dans l'ordre.  
* Conserver un historique des descriptions de la manche.  
* Passer automatiquement au joueur suivant après validation.

Mr. White doit pouvoir participer normalement, malgré l'absence de mot.

Prévoir un chronomètre configurable.

Les joueurs éliminés ne participent plus.

### **PHASE 3 — DISCUSSION**

Tous les joueurs encore vivants peuvent discuter librement.

Fonctionnalités :

* Communication vocale.  
* Chat textuel.  
* Chronomètre configurable.  
* Historique des descriptions.  
* Affichage des joueurs encore présents.  
* Possibilité pour l'hôte de déclencher la phase de vote selon les paramètres.

La discussion doit être un véritable moment social et non simplement un écran de transition.

### **PHASE 4 — VOTE ET ÉLIMINATION**

Chaque joueur vivant peut voter pour éliminer un autre joueur vivant.

Règles :

* Un seul vote par joueur.  
* Impossible de voter pour soi-même.  
* Les joueurs éliminés ne peuvent plus voter.  
* Le serveur calcule et valide les votes.  
* Les résultats sont révélés à la fin du scrutin.  
* Le joueur ayant le plus de voix est éliminé.

Prévoir une procédure de départage en cas d'égalité, par exemple un second vote entre les joueurs ex æquo.

### **CAS SPÉCIAL — ÉLIMINATION DE MR. WHITE**

Lorsqu'un Mr. White est éliminé, le jeu déclenche une phase exceptionnelle.

Le joueur dispose d'une unique tentative pour deviner le mot des Civils.

Une interface spécifique apparaît.

S'il trouve le mot exact, Mr. White remporte immédiatement la partie.

Sinon, il est définitivement éliminé et la partie continue.

La comparaison doit être insensible aux majuscules, aux accents et aux espaces superflus, mais ne doit pas accepter automatiquement les synonymes.

### **BOUCLE DE JEU**

Si aucune condition de victoire n'est atteinte, une nouvelle manche commence avec les joueurs encore vivants.

La paire de mots reste identique pendant toute la partie.

Les rôles ne changent pas.

---

## **6\. CONDITIONS DE VICTOIRE**

### **Victoire des Civils**

Les Civils gagnent lorsque tous les Undercovers et tous les Mr. Whites ont été éliminés.

Chaque Civil remporte 2 points.

### **Victoire des Infiltrés**

Les Infiltrés gagnent lorsqu'il ne reste plus qu'un seul Civil vivant, à condition que les conditions de victoire des Civils ne soient pas déjà remplies.

Pour les joueurs du camp gagnant :

* Undercover : 10 points.  
* Mr. White : 6 points.

### **Victoire spéciale de Mr. White**

Si Mr. White devine le mot des Civils après son élimination, il gagne immédiatement.

Il reçoit 6 points.

Cette victoire spéciale est individuelle.

### **Écran de fin**

Afficher :

* L'équipe gagnante.  
* L'identité et le rôle de chaque joueur.  
* Les deux mots secrets.  
* Les résultats de la partie.  
* Les points remportés.  
* Le classement cumulé de la session.  
* Un bouton pour rejouer avec les mêmes participants.

---

## **7\. EXPERIENCE MULTIJOUEUR TEMPS RÉEL**

Le jeu doit impérativement fonctionner entre plusieurs ordinateurs et navigateurs distincts.

Je ne veux pas d'une simulation multijoueur avec des utilisateurs fictifs.

### **Architecture réseau**

Utiliser un serveur autoritaire.

Le serveur est responsable :

* De la création des salles.  
* De l'attribution des rôles.  
* De la sélection des mots.  
* De l'état de la partie.  
* Du déroulement des phases.  
* De la validation des votes.  
* De l'élimination des joueurs.  
* Des conditions de victoire.  
* Des scores.

Les clients transmettent leurs actions, mais ne doivent jamais pouvoir décider eux-mêmes du résultat de la partie.

### **Synchronisation**

Les événements suivants doivent être synchronisés :

* Connexion et déconnexion.  
* Présence dans la salle.  
* Déplacement des avatars.  
* Personnalisation.  
* Émotes.  
* Statut prêt/non prêt.  
* Début de partie.  
* Phases et chronomètres.  
* Descriptions.  
* Votes et éliminations.  
* Résultats.

Prévoir un mécanisme de reconnexion permettant à un joueur de retrouver sa place après un rafraîchissement ou une coupure temporaire.

L'hôte doit pouvoir être transféré si le créateur quitte la salle.

---

## **8\. COMMUNICATION VOCALE**

Le jeu étant fondé sur le débat et la déduction sociale, le chat vocal est une fonctionnalité importante.

Implémenter une communication audio temps réel, idéalement avec une solution WebRTC adaptée à des salles de petite taille.

Fonctionnalités :

* Rejoindre le salon vocal.  
* Activer ou désactiver son microphone.  
* Couper localement le son d'un participant.  
* Afficher visuellement qui parle.  
* Gérer les permissions du navigateur.

Les règles de communication doivent être configurables. Par défaut, les joueurs éliminés ne peuvent pas intervenir vocalement auprès des joueurs vivants pendant la partie.

Prévoir un chat textuel comme alternative accessible.

---

## **9\. HUB 3D ET DIRECTION ARTISTIQUE**

Le hub 3D constitue l'identité principale du jeu.

Il ne doit pas être un simple fond décoratif.

### **Environnement**

Créer un lieu social chaleureux, immersif et légèrement décalé.

Direction artistique :

* Low-poly stylisé.  
* Cartoon moderne.  
* Couleurs affirmées.  
* Éclairages soignés.  
* Animations expressives.  
* Interface claire et lisible.

Le hub peut prendre la forme d'une salle de réunion absurde, d'un salon futuriste ou d'un espace social conçu spécifiquement pour RENÉ.

### **Interactions**

Les joueurs doivent pouvoir :

* Se déplacer avec ZQSD ou les flèches directionnelles.  
* Contrôler leur avatar sur mobile avec des commandes tactiles.  
* Voir les autres avatars bouger.  
* Déclencher des animations.  
* Se rassembler au centre de l'environnement.

Pendant les phases du jeu, utiliser la 3D pour renforcer la mise en scène :

* Spotlight sur le joueur qui décrit.  
* Regroupement des participants pendant le vote.  
* Animation lorsqu'un joueur est éliminé.  
* Mise en scène de la victoire.

Les interfaces critiques — mots secrets, vote, chat, paramètres — peuvent utiliser des panneaux 2D superposés à la scène.

**Priorité absolue : la lisibilité et la jouabilité passent avant les effets graphiques.**

---

## **10\. STACK TECHNIQUE**

Je privilégie les solutions modernes, open source, maintenables et raisonnablement simples.

Architecture recommandée :

### **Frontend**

* React.  
* TypeScript.  
* Vite.  
* Tailwind CSS.  
* React Three Fiber.  
* Drei.  
* Zustand pour la gestion des états côté client.

### **Backend**

* Node.js.  
* TypeScript.  
* Fastify.  
* Socket.IO pour le temps réel.

### **Données**

* PostgreSQL pour les données persistantes.  
* Prisma pour l'accès à la base de données.  
* État des salles en mémoire pour la première version, avec abstraction permettant une évolution vers Redis.

### **Audio**

* WebRTC, éventuellement avec LiveKit.

### **Infrastructure**

* Docker Compose.  
* Configuration par variables d'environnement.  
* Scripts de développement et de production documentés.

Organiser le projet en monorepo avec des types et des contrats d'événements partagés entre client et serveur.

Tu peux proposer des alternatives techniques si elles sont mieux adaptées, mais explique les compromis et évite de multiplier les dépendances inutilement.

---

## **11\. ARCHITECTURE LOGICIELLE**

Séparer clairement :

1. Le moteur de jeu : règles, phases, votes, éliminations, victoires.  
2. Le système multijoueur : sockets, salles, joueurs, synchronisation.  
3. Le serveur applicatif : API, profils, configuration et persistance.  
4. Le client 3D : environnement, avatars, déplacements et animations.  
5. L'interface utilisateur : HUD, menus, écrans de jeu.  
6. La gestion des données : banque de mots, scores, paramètres.

Le moteur de jeu ne doit pas dépendre de React ou de Three.js.

Utiliser des événements typés et valider systématiquement les actions reçues par le serveur.

Prévoir une séparation stricte entre l'état public du jeu et les informations privées de chaque joueur.

---

## **12\. BANQUE DE MOTS**

Créer une banque de paires de mots en français.

Exemples :

* Chat / Chien  
* Café / Thé  
* Mer / Océan  
* Pizza / Burger  
* Avion / Hélicoptère  
* Médecin / Infirmier  
* Netflix / YouTube  
* Prison / École

Les paires doivent être suffisamment proches pour créer de l'ambiguïté, sans être identiques.

Prévoir :

* Au moins 100 paires pour la première version.  
* Des catégories.  
* Des niveaux de difficulté.  
* Un tirage aléatoire.  
* Une limitation des répétitions au cours d'une session.  
* Un format permettant d'ajouter facilement de nouveaux mots.

---

## **13\. FONCTIONNALITÉS IMPORTANTES**

### **Gestion de salle**

* Code d'invitation.  
* Lien de partage.  
* Joueurs connectés.  
* Paramètres personnalisables.  
* Statut de préparation.  
* Permissions de l'hôte.  
* Démarrage réservé à l'hôte.

### **Administration de partie**

* Gestion des joueurs absents.  
* Gestion des déconnexions.  
* Possibilité de quitter la partie.  
* Reconnexion à une partie active.  
* Possibilité de relancer une partie.  
* Retour au hub.

### **Interface et confort**

* Responsive desktop et mobile.  
* Animations et transitions fluides.  
* Feedback visuel sur chaque action.  
* Notifications non intrusives.  
* Indicateur de connexion.  
* Gestion des erreurs et des états de chargement.

### **Sécurité**

* Isolation des salles.  
* Validation des actions côté serveur.  
* Protection contre les votes multiples.  
* Impossibilité de récupérer les mots des autres joueurs via les événements publics.  
* Protection contre les changements de rôle ou de score côté client.  
* Contrôle des messages et des entrées utilisateur.

---

## **14\. MÉTHODE DE DÉVELOPPEMENT**

Travaille par étapes, dans cet ordre.

### **ÉTAPE 1 — Analyse et architecture**

Inspecte le dépôt existant s'il y en a un.

Définis :

* La structure du projet.  
* Les principaux composants.  
* Les modèles de données.  
* La machine à états du jeu.  
* Les événements réseau.  
* Les dépendances nécessaires.

Documente brièvement les décisions importantes.

### **ÉTAPE 2 — Prototype multijoueur jouable**

Implémente d'abord la boucle de jeu complète, même avec une interface graphique minimaliste.

Résultat attendu : plusieurs vrais joueurs peuvent rejoindre une salle et terminer une partie.

### **ÉTAPE 3 — Hub 3D**

Implémente :

* L'environnement.  
* Les avatars.  
* La caméra.  
* Les déplacements.  
* La synchronisation en temps réel.  
* Les pseudonymes.  
* Les animations.

### **ÉTAPE 4 — Personnalisation**

Développe l'éditeur d'avatars et la synchronisation des apparences.

### **ÉTAPE 5 — Expérience sociale et mise en scène**

Ajoute :

* Communication vocale.  
* Chat.  
* Émotes.  
* Animations de vote.  
* Animations d'élimination.  
* Écran de victoire.  
* Effets sonores et ambiance.

### **ÉTAPE 6 — Tests, optimisation et finition**

Teste les règles du jeu, la synchronisation des clients et les situations exceptionnelles.

Optimise les performances de la scène 3D.

Vérifie l'ergonomie sur ordinateur et mobile.

---

## **15\. TESTS ET CRITÈRES D'ACCEPTATION**

Le projet n'est pas terminé tant que les scénarios suivants ne fonctionnent pas.

* Un joueur crée une salle et partage son lien.  
* Quatre joueurs réels rejoignent la même salle depuis des navigateurs distincts.  
* Chaque joueur voit les autres avatars dans le hub.  
* Les déplacements sont synchronisés.  
* Chaque joueur peut personnaliser son avatar.  
* L'hôte démarre une partie valide.  
* Chaque joueur reçoit uniquement son propre mot secret.  
* Les descriptions se déroulent dans l'ordre.  
* Tous les joueurs vivants peuvent voter.  
* Un joueur ne peut pas voter deux fois.  
* Le joueur éliminé ne peut plus participer au vote.  
* Mr. White peut tenter de deviner le mot après son élimination.  
* Le serveur applique correctement les conditions de victoire.  
* Les résultats et les scores sont cohérents pour tous les clients.  
* Une nouvelle partie peut commencer sans recréer la salle.  
* Un joueur peut se reconnecter après un rafraîchissement.  
* Un client ne peut pas tricher en modifiant ses données locales.

Créer des tests unitaires pour le moteur de jeu et des tests d'intégration pour les événements multijoueurs.

---

## **16\. CONSIGNES DE TRAVAIL**

Quelques règles essentielles :

1. **Développe réellement les fonctionnalités.** Ne remplace jamais une fonctionnalité attendue par un simple bouton sans comportement.  
2. **Ne simule pas le multijoueur.** Tous les événements critiques doivent provenir du serveur.  
3. **Privilégie un jeu jouable avant un jeu visuellement spectaculaire.**  
4. **Écris du code lisible, modulaire et maintenable.** Évite les fichiers géants, les responsabilités mélangées et la complexité gratuite.  
5. **Teste régulièrement.** Lance les commandes de compilation, de lint et de tests après chaque étape importante.  
6. **Ne prétends pas qu'une fonctionnalité fonctionne sans l'avoir vérifiée.** Signale les éventuelles limitations.  
7. **Ne transforme pas le projet en une simple application CRUD.** Le produit final doit être perçu comme un jeu.  
8. **N'introduis aucune fonctionnalité d'IA inutile.** La valeur principale du jeu repose sur les interactions entre joueurs humains.  
9. Documente les commandes d'installation, les variables d'environnement et la procédure pour lancer plusieurs clients en local.  
10. Travaille de façon autonome et avance par incréments fonctionnels. En cas d'ambiguïté non bloquante, prends une décision pragmatique, documente-la et poursuis.

---

## **17\. LIVRABLE FINAL**

Je veux obtenir :

* Un dépôt contenant le code source complet.  
* Un frontend fonctionnel.  
* Un backend temps réel.  
* Un hub 3D multijoueur.  
* Un système d'avatars personnalisables.  
* Un moteur de jeu respectant les règles décrites.  
* Un chat et une communication vocale.  
* Une banque de mots française.  
* Une configuration Docker pour le développement.  
* Des tests automatisés.  
* Un README permettant d'installer, de démarrer et de tester le projet.

**Le critère ultime de réussite : je dois pouvoir envoyer un lien à plusieurs amis, les retrouver dans un hub 3D, discuter avec eux et jouer à une partie complète d'UNDERCOVER — RENÉ sans intervention technique.**

Commence par définir l'architecture et un plan d'implémentation concis. Ensuite, passe directement au développement du premier incrément jouable. Ne t'arrête pas à la rédaction du plan.

Si tout est clair, commence.

