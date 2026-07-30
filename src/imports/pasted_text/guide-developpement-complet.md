# Guide complet de développement — Application de Gestion d'Escadron (Elite Dangerous)

**Ce document remplace et étend `ARCHITECTURE.md`.** Il contient l'architecture complète,
l'infrastructure technique, la roadmap détaillée, et un kit de prompts prêts à l'emploi pour
piloter un agent de code (Claude Code recommandé) tout au long du développement.

---

## 0. Comment utiliser ce guide

1. Créez un dépôt Git vide, ouvrez-le dans **Claude Code** (terminal, VS Code, ou l'appli desktop).
2. Placez ce fichier à la racine du projet (`GUIDE-DEVELOPPEMENT-COMPLET.md`).
3. Au début de **chaque nouvelle session**, collez d'abord le **prompt de démarrage de session**
   (section 6.0).
4. Pour chaque nouvelle phase de développement, collez le **prompt de phase** correspondant
   (sections 6.1 à 6.5) — un seul à la fois, dans l'ordre.
5. Ne passez à la phase suivante que lorsque l'agent a terminé ses 3 auto-vérifications et que
   vous avez vous-même testé le résultat.

Ce guide est volontairement conçu pour un **mainteneur solo assisté par IA** : chaque prompt est
autonome, contient tout le contexte nécessaire, et force l'agent à vérifier son propre travail
avant de le considérer terminé.

---

## 1. Résumé des recherches et contraintes réelles de l'écosystème

Avant de concevoir l'architecture, voici ce que les recherches ont confirmé sur les sources de
données externes — ce sont des **contraintes réelles**, pas des choix arbitraires :

### Inara
- API à **un seul endpoint** JSON (`POST`), organisée en "events" (ex. `getCommanderProfile`).
- Chaque membre doit fournir sa **propre clé API personnelle** — impossible d'accéder aux données
  de l'escadron entier via un seul compte.
- **Aucun endpoint n'agrège les données de tout un escadron.** C'est confirmé par la communauté
  elle-même : il faut collecter les données individuellement, membre par membre, avec leur accord.
- Toute application utilisant l'API doit être **whitelistée manuellement** par l'administrateur
  d'Inara avant de fonctionner en production — à demander tôt, ça peut prendre du temps.
- Fair use strict : pas de scraping massif, mise en cache obligatoire côté client, pas de requêtes
  répétées inutiles.

### Frontier Companion API (CAPI)
- Authentification **OAuth2 par membre** (chaque membre autorise l'appli depuis son propre compte
  Frontier).
- **Cooldown imposé par Frontier** entre deux appels — la synchronisation "à la demande" doit être
  limitée côté serveur (ex. 1 fois toutes les X minutes par membre), pas illimitée.
- Complexe à implémenter proprement (le flux OAuth2 PKCE est documenté par la communauté EDCD,
  mais reste un morceau technique à part entière).

### EDSM (Elite Dangerous Star Map)
- API **publique, sans authentification**, pour rechercher des systèmes et récupérer leurs
  coordonnées 3D (x, y, z) et informations (allégeance, gouvernement, économie...).
- Limite de ~360 requêtes/heure — largement suffisant pour peupler ponctuellement la carte de
  l'escadron.
- C'est la source la plus simple et la plus fiable pour le module Carte.

### Coriolis
- Pas d'API officielle stable, mais deux options d'intégration :
  1. **MVP — stocker le lien de partage tel quel** (ex. `https://coriolis.io/outfit/...`). Simple,
     fiable, fonctionne toujours.
  2. **Amélioration — parser le JSON d'export détaillé** (schéma connu :
     `coriolis.edcd.io/schemas/ship-loadout/4.json`) si le membre colle le JSON en plus du lien,
     pour afficher proprement le nom du vaisseau, la classe et les modules dans l'interface.

### Conséquence directe sur l'architecture
Le modèle "chaque membre connecte son propre compte" n'est donc pas un choix de design gratuit :
**c'est la seule façon dont ces API fonctionnent réellement.** L'escadron ne peut techniquement
pas imposer une synchronisation centralisée — chaque membre garde le contrôle de sa propre
connexion externe.

---

## 2. Stack technique (confirmée et à jour)

| Couche | Techno | Notes 2026 |
|---|---|---|
| Frontend | React + Vite + `vite-plugin-pwa` | Standard actuel pour une PWA React performante et installable |
| Backend | Node.js + Express | Un seul langage avec le frontend |
| Base de données | PostgreSQL + Prisma ORM | Migrations auto, schéma déclaratif lisible |
| Temps réel | Socket.io | Waypoints, forum, missions en direct |
| Auth | JWT + rôles | Matricule + mot de passe, permissions par rang |
| Cron / sync externe | `node-cron` | Sync Inara/Frontier 12-24h + throttle par membre |
| Monorepo | Dossiers `apps/` + `packages/` (pas besoin de Turborepo/Nx pour un projet solo — inutile complexité) | |

---

## 3. Modèle de données (version détaillée, prête pour Prisma)

```prisma
model Squadron {
  id          String   @id @default(cuid())
  nom         String
  tag         String
  description String?
}

model Rank {
  id                  String    @id @default(cuid())
  nom                 String
  peutEditerCarte     Boolean   @default(false)
  peutVoirStats       Boolean   @default(false)
  peutAdministrer     Boolean   @default(false)
  peutModererForum    Boolean   @default(false)
  membres             Member[]
}

model Member {
  id                  String    @id @default(cuid())
  matricule           String    @unique
  pseudo              String
  motDePasseHash      String
  rank                Rank      @relation(fields: [rankId], references: [id])
  rankId              String
  dateJoin            DateTime  @default(now())
  localisationActuelle String?
  vaisseauActuel      String?
  actif               Boolean   @default(true)

  notes               Note[]
  builds              ShipBuild[]
  activityLogs        ActivityLog[]
  externalSyncs       ExternalSync[]
  forumPosts          ForumPost[]
  forumComments       ForumComment[]
  waypointsCrees      Waypoint[]
}

model Mission {
  id               String    @id @default(cuid())
  titre            String
  description      String?
  statut           StatutMission @default(EN_COURS)
  priorite         Int       @default(0)
  system           System?   @relation(fields: [systemId], references: [id])
  systemId         String?
  responsableId    String?
  dateCreation     DateTime  @default(now())
  dateCompletion   DateTime?
}

enum StatutMission {
  EN_COURS
  COMPLETE
  ARCHIVE
}

model System {
  id         String     @id @default(cuid())
  nom        String     @unique
  coordX     Float
  coordY     Float
  coordZ     Float
  type       TypeSysteme @default(AUTRE)
  notes      String?
  source     String     @default("manuel") // "manuel" | "edsm"
  missions   Mission[]
  waypoints  Waypoint[]
}

enum TypeSysteme {
  OBJECTIF
  BASE
  RAVITAILLEMENT
  AUTRE
}

model Waypoint {
  id           String   @id @default(cuid())
  system       System   @relation(fields: [systemId], references: [id])
  systemId     String
  label        String
  type         String
  creePar      Member   @relation(fields: [creeParId], references: [id])
  creeParId    String
  dateCreation DateTime @default(now())
}

model ShipBuild {
  id           String   @id @default(cuid())
  member       Member   @relation(fields: [memberId], references: [id])
  memberId     String
  nom          String
  lienCoriolis String
  vaisseau     String?
  role         String?  // combat | exploration | minage | transport | multirole
  dateImport   DateTime @default(now())
  notes        String?
}

model Note {
  id         String   @id @default(cuid())
  member     Member   @relation(fields: [memberId], references: [id])
  memberId   String
  contenu    String
  dateMaj    DateTime @updatedAt
}

model ForumPost {
  id           String   @id @default(cuid())
  auteur       Member   @relation(fields: [auteurId], references: [id])
  auteurId     String
  categorie    String
  titre        String
  contenu      String
  dateCreation DateTime @default(now())
  epingle      Boolean  @default(false)
  comments     ForumComment[]
}

model ForumComment {
  id           String   @id @default(cuid())
  post         ForumPost @relation(fields: [postId], references: [id])
  postId       String
  auteur       Member   @relation(fields: [auteurId], references: [id])
  auteurId     String
  contenu      String
  dateCreation DateTime @default(now())
}

model ActivityLog {
  id          String   @id @default(cuid())
  member      Member   @relation(fields: [memberId], references: [id])
  memberId    String
  typeAction  String
  description String
  date        DateTime @default(now())
}

model ExternalSync {
  id            String   @id @default(cuid())
  member        Member   @relation(fields: [memberId], references: [id])
  memberId      String
  service       String   // "inara" | "frontier"
  tokenChiffre  String
  derniereSync  DateTime?
  statut        String   @default("non_connecte")
}
```

---

## 4. Architecture applicative

```
escadron-app/
├── apps/
│   ├── web/                 # React + Vite + PWA
│   │   └── src/
│   │       ├── features/    # un dossier par onglet (dashboard, carte, membres, builds, notes, forum)
│   │       ├── components/
│   │       └── lib/
│   └── api/                  # Node.js + Express
│       └── src/
│           ├── routes/
│           ├── services/     # logique métier + intégrations Inara/Frontier/EDSM
│           ├── sockets/       # Socket.io
│           ├── jobs/          # cron de sync périodique
│           └── middleware/    # auth JWT, permissions par rôle
├── packages/
│   └── db/                   # schema.prisma + migrations, partagé par apps/api
├── progress.md                # suivi d'avancement entre sessions (voir section 6.0)
├── tests.json                 # liste structurée des tests attendus par phase
└── GUIDE-DEVELOPPEMENT-COMPLET.md
```

### Stratégie de synchronisation (rappel)
- **Temps réel (Socket.io)** : waypoints, missions, forum — tout ce qui est interne et partagé.
- **Périodique (cron 12-24h) + bouton manuel avec throttle serveur** : uniquement Inara/Frontier,
  à cause du fair use et du cooldown CAPI.

### Sécurité — points non négociables
- Mots de passe hashés (bcrypt/argon2), jamais en clair.
- Tokens Inara/Frontier **chiffrés** en base (pas stockés en clair, même côté serveur).
- Toute route qui touche aux données d'un autre membre (notes, stats individuelles) doit vérifier
  l'autorisation côté serveur, jamais faire confiance au frontend.
- Le rôle "officier/commandant" est vérifié à chaque requête sensible, pas seulement à l'affichage.

---

## 5. Roadmap détaillée avec critères de fin de phase

| Phase | Contenu | Critère de "terminé" |
|---|---|---|
| **0 — Bootstrap** | Structure du monorepo, Prisma initialisé, Docker Postgres local, CI basique | `npm run dev` lance front + back + DB sans erreur |
| **1 — Auth & Membres** | Login par matricule, rôles, CRUD membres, dashboard missions | Un commandant peut créer un membre, ce membre peut se connecter et voir le dashboard |
| **2 — Carte** | Carte 2D interactive, waypoints, permissions d'édition, recherche EDSM | Un officier ajoute un waypoint, il apparaît en temps réel chez les autres membres connectés |
| **3 — Vie d'escadron** | Builds Coriolis, notes privées, forum | Un membre importe un build via lien Coriolis, poste sur le forum, écrit une note privée invisible aux autres |
| **4 — Intégrations externes** | Connexion Inara, Frontier CAPI, sync auto + stats individuelles pour officiers | Un membre connecte son compte Inara, une sync se déclenche (manuelle puis auto 12-24h), un officier voit ses stats |

---

## 6. Kit de prompts

Chaque prompt suit la structure recommandée par la documentation officielle de prompt engineering
de Claude : rôle clair, contexte explicite, contraintes anti-sur-ingénierie, et **3
auto-vérifications obligatoires avant de considérer la tâche terminée**. Copiez-collez-les tels
quels dans Claude Code.

### 6.0 — Prompt de démarrage de session (à coller à CHAQUE nouvelle session)

```
<contexte_session>
Tu reprends le travail sur le projet "escadron-app". Avant de faire quoi que ce soit :
1. Exécute `pwd` puis `git log --oneline -15` pour voir où en est le projet.
2. Lis `progress.md` à la racine pour connaître l'état d'avancement et les décisions déjà prises.
3. Lis `tests.json` pour connaître les tests déjà écrits et leur statut.
4. Lis `GUIDE-DEVELOPPEMENT-COMPLET.md` pour l'architecture et le modèle de données de référence.
5. Ne relance pas depuis zéro : appuie-toi sur ce qui existe déjà dans le dépôt.
</contexte_session>

<consignes_permanentes>
- Ne jamais inventer une information sur le code sans l'avoir lu : si un fichier est mentionné,
  ouvre-le avant de répondre ou d'agir.
- Committe sur git à chaque étape logique terminée, avec un message clair.
- Mets à jour progress.md à la fin de la session avec ce qui a été fait et ce qui reste à faire.
- Pour toute action destructrice (suppression de fichiers, migration qui efface des données,
  git push --force), demande confirmation avant d'agir.
</consignes_permanentes>

Une fois ce contexte chargé, dis-moi en une phrase où en est le projet et attends mes instructions
pour la phase suivante.
```

### 6.1 — Phase 0 : Bootstrap du projet

```
<role>
Tu es un développeur full-stack senior en TypeScript/React/Node/Prisma, autonome, travaillant
pour un mainteneur solo qui s'appuie sur toi pour la qualité et la fiabilité du code.
</role>

<contexte>
Le fichier GUIDE-DEVELOPPEMENT-COMPLET.md ci-joint contient l'architecture complète du projet
(section 2, 3 et 4). Réfère-toi y systématiquement.
</contexte>

<objectif>
Initialiser la structure du projet "escadron-app" décrite en section 4 du guide :
1. Monorepo avec apps/web (React + Vite + vite-plugin-pwa), apps/api (Node.js + Express +
   TypeScript), packages/db (Prisma avec le schéma complet de la section 3).
2. Docker Compose pour PostgreSQL en local.
3. Scripts npm à la racine pour lancer front + back + DB ensemble en dev.
4. Fichiers progress.md et tests.json créés (vides mais structurés) à la racine.
5. .env.example documentant toutes les variables nécessaires (DB, JWT secret, etc.), sans valeurs
   réelles.
</objectif>

<contraintes>
- Reste minimal : pas d'abstraction, de config ou de dépendance non demandée. Pas de Turborepo/Nx,
  la structure de dossiers simple suffit pour un projet solo.
- N'ajoute aucune fonctionnalité métier à cette étape — uniquement l'ossature.
- Utilise exactement le schéma Prisma fourni en section 3 du guide, sans le modifier.
</contraintes>

<verification_avant_de_terminer>
Avant de déclarer cette phase terminée, effectue ces 3 vérifications et corrige tout ce qui échoue :

1. Vérification fonctionnelle : `npm install` puis la commande de lancement dev démarrent
   effectivement le front, le back et la base sans erreur. Vérifie en lançant réellement les
   commandes, pas en supposant qu'elles fonctionnent.
2. Vérification de cohérence avec l'architecture : le schéma Prisma généré correspond exactement
   au modèle de données de la section 3 du guide (mêmes entités, mêmes relations, mêmes enums).
   Relis les deux côte à côte.
3. Vérification de sécurité de base : aucun secret (mot de passe DB, futur JWT secret) n'est
   commité en clair dans le dépôt ; .env est bien dans .gitignore.
</verification_avant_de_terminer>

<rapport_final>
Termine par un résumé court : ce qui a été créé, le résultat des 3 vérifications, et toute
déviation par rapport au guide avec la justification.
</rapport_final>
```

### 6.2 — Phase 1 : Auth, membres, dashboard

```
<role>
Tu es un développeur full-stack senior en TypeScript/React/Node/Prisma, autonome, travaillant
pour un mainteneur solo.
</role>

<contexte>
Le projet est initialisé (voir progress.md et git log pour l'état actuel). Réfère-toi à
GUIDE-DEVELOPPEMENT-COMPLET.md, sections 2 à 4, pour l'architecture et le modèle de données.
</contexte>

<objectif>
Implémenter la Phase 1 de la roadmap (section 5) :
1. Authentification par matricule + mot de passe, avec JWT et rôles (Rank).
2. Un commandant peut créer/éditer/désactiver des membres et leur assigner un rang.
3. Réinitialisation de mot de passe : un officier/commandant peut réinitialiser le mot de passe
   d'un membre directement depuis l'appli (pas de système d'email à ce stade — hypothèse à
   valider avec l'utilisateur si besoin).
4. Dashboard : liste des missions en cours (statut EN_COURS) triées par priorité, et historique
   des dernières missions COMPLETE.
5. CRUD missions réservé aux officiers/commandants (peutAdministrer ou un droit dédié).
</objectif>

<contraintes>
- Toute vérification de permission (qui peut créer un membre, réinitialiser un mot de passe,
  créer une mission) doit être faite côté serveur, jamais seulement côté frontend.
- Les mots de passe sont hashés (bcrypt ou argon2), jamais stockés ni loggés en clair.
- Implémente une solution générale et robuste, pas une solution qui ne marche que pour un cas de
  test particulier. N'ajoute pas de fonctionnalité non demandée (pas de récupération par email à
  ce stade, par exemple).
- Avant d'écrire du code touchant à un fichier existant, ouvre-le et lis-le en entier.
</contraintes>

<verification_avant_de_terminer>
1. Vérification fonctionnelle : un scénario complet fonctionne réellement — un commandant se
   connecte, crée un membre, ce membre se connecte avec son matricule, voit le dashboard avec les
   missions. Teste ce scénario, ne le suppose pas.
2. Vérification de sécurité : un membre simple ne peut pas, même en modifiant les requêtes
   réseau, créer un autre membre ni changer son propre rang. Vérifie que la route côté serveur
   refuse bien la requête, pas seulement que le bouton est caché côté frontend.
3. Vérification de cohérence : le code respecte le schéma Prisma de la section 3 sans le modifier
   sans raison documentée, et suit la structure de dossiers de la section 4.
</verification_avant_de_terminer>

<rapport_final>
Résume ce qui a été livré, le résultat des 3 vérifications, et mets à jour progress.md et
tests.json avant de terminer.
</rapport_final>
```

### 6.3 — Phase 2 : Carte interactive et waypoints

```
<role>
Tu es un développeur full-stack senior en TypeScript/React/Node/Prisma, autonome, travaillant
pour un mainteneur solo.
</role>

<contexte>
Les phases 0 et 1 sont terminées (voir progress.md). Réfère-toi à
GUIDE-DEVELOPPEMENT-COMPLET.md, sections 1 (contraintes EDSM), 2 à 4.
</contexte>

<objectif>
Implémenter la Phase 2 (section 5) :
1. Recherche de systèmes via l'API publique EDSM (https://www.edsm.net/api-v1/system) pour
   ajouter un System avec ses coordonnées réelles — reste sous la limite de ~360 requêtes/heure
   documentée en section 1 (mets en cache les résultats déjà recherchés).
2. Carte 2D interactive (projection top-down, ex. axes X/Z) affichant les systèmes enregistrés.
3. CRUD des Waypoints, réservé aux membres avec peutEditerCarte = true sur leur rang.
4. Mise à jour en temps réel via Socket.io : quand un waypoint est ajouté/supprimé, tous les
   membres connectés le voient sans recharger la page.
</objectif>

<contraintes>
- Vérifie peutEditerCarte côté serveur avant toute création/suppression de waypoint, jamais
  seulement côté interface.
- N'implémente pas une vraie carte 3D — une projection 2D simple suffit, conformément à la
  section 4. Pas de dépendance lourde (three.js, etc.) pour ce besoin.
- Respecte la limite de taux EDSM : centralise les appels EDSM côté serveur avec un cache, pas
  d'appel direct depuis le frontend à chaque frappe clavier.
</contraintes>

<verification_avant_de_terminer>
1. Vérification fonctionnelle : recherche un vrai système EDSM (ex. "Sol"), vérifie que les
   coordonnées retournées sont correctement stockées et affichées sur la carte.
2. Vérification temps réel : ouvre (ou simule) deux sessions différentes, ajoute un waypoint dans
   l'une, vérifie qu'il apparaît bien dans l'autre sans rechargement.
3. Vérification de permissions et de robustesse : un membre sans peutEditerCarte ne peut pas
   ajouter de waypoint même en appelant directement l'API ; une recherche EDSM sur un nom de
   système inexistant est gérée proprement (pas de crash).
</verification_avant_de_terminer>

<rapport_final>
Résume le résultat des 3 vérifications et mets à jour progress.md et tests.json.
</rapport_final>
```

### 6.4 — Phase 3 : Builds Coriolis, notes, forum

```
<role>
Tu es un développeur full-stack senior en TypeScript/React/Node/Prisma, autonome, travaillant
pour un mainteneur solo.
</role>

<contexte>
Les phases 0 à 2 sont terminées. Réfère-toi à GUIDE-DEVELOPPEMENT-COMPLET.md, sections 1
(contraintes Coriolis), 2 à 4.
</contexte>

<objectif>
Implémenter la Phase 3 (section 5) :
1. Import de build : le membre colle un lien Coriolis (ex. https://coriolis.io/outfit/...),
   valide que c'est bien une URL Coriolis, et l'enregistre avec un nom, un rôle (combat,
   exploration, minage, transport, multirole) et des notes optionnelles.
2. Notes personnelles : CRUD simple, strictement privées — un membre ne doit jamais pouvoir lire
   les notes d'un autre, y compris un officier.
3. Forum : création de posts par catégorie, commentaires, épinglage réservé aux modérateurs
   (peutModererForum).
</objectif>

<contraintes>
- Valide et échappe (sanitize) tout contenu utilisateur affiché dans le forum et les notes pour
  éviter l'injection de HTML/scripts (XSS) — n'affiche jamais de contenu utilisateur en HTML brut
  non échappé.
- La confidentialité des notes est absolue : même le commandant ne doit pas pouvoir y accéder via
  l'API. Vérifie ça explicitement, ce n'est pas négociable.
- Ne construis pas de parseur du format d'export Coriolis à cette étape — se contenter du lien
  suffit pour le MVP, conformément à la section 1.
</contraintes>

<verification_avant_de_terminer>
1. Vérification fonctionnelle : un membre importe un vrai lien Coriolis, le retrouve dans sa
   liste de builds ; poste un message sur le forum ; écrit une note.
2. Vérification de confidentialité : tente, avec un compte commandant, d'accéder aux notes d'un
   autre membre via l'API directement (pas seulement via l'interface) — la requête doit être
   refusée.
3. Vérification de sécurité XSS : poste un contenu de forum contenant une balise `<script>` et
   vérifie qu'elle est bien neutralisée à l'affichage, pas exécutée.
</verification_avant_de_terminer>

<rapport_final>
Résume le résultat des 3 vérifications et mets à jour progress.md et tests.json.
</rapport_final>
```

### 6.5 — Phase 4 : Intégrations externes (Inara, Frontier CAPI, sync)

```
<role>
Tu es un développeur full-stack senior en TypeScript/React/Node/Prisma, autonome, travaillant
pour un mainteneur solo.
</role>

<contexte>
Les phases 0 à 3 sont terminées. Réfère-toi à GUIDE-DEVELOPPEMENT-COMPLET.md, section 1
(contraintes Inara/Frontier en détail — relis-la avant de commencer, c'est critique pour cette
phase), sections 2 à 4.
</contexte>

<objectif>
Implémenter la Phase 4 (section 5) :
1. Connexion Inara : chaque membre entre sa propre clé API Inara personnelle (rappel : l'appli
   doit être whitelistée par Inara au préalable côté administratif, ce n'est pas un blocage
   technique — implémente le code en assumant que la whitelist sera accordée).
2. Connexion Frontier CAPI : flux OAuth2 par membre.
3. Chiffrement des tokens/clés en base (jamais en clair), stockés dans ExternalSync.
4. Job cron (12-24h) qui synchronise automatiquement les membres connectés, plus un bouton
   "synchroniser maintenant" avec un throttle serveur (ex. pas plus d'une sync manuelle toutes les
   X minutes par membre) pour respecter le cooldown CAPI et le fair use Inara.
5. Vue "stats individuelles" réservée aux membres avec peutVoirStats = true, basée sur
   ActivityLog et les données importées.
</objectif>

<contraintes>
- Ne fais aucun appel direct à Inara/CAPI depuis le frontend — tout passe par le backend, qui
  gère le throttle et le chiffrement.
- Gère explicitement les cas d'erreur des API externes (indisponibilité, token expiré, réponse
  vide) sans faire planter le job cron pour les autres membres — un échec sur un membre ne doit
  pas bloquer la synchronisation des autres.
- Ne mets pas en place de scraping ou de requêtes répétées agressives — respecte strictement les
  limites documentées en section 1 (cooldown CAPI, fair use Inara).
- N'implémente pas de fonctionnalité de synchronisation d'escadron entier via un seul compte —
  ça ne correspond pas à la façon dont ces API fonctionnent (voir section 1).
</contraintes>

<verification_avant_de_terminer>
1. Vérification fonctionnelle : un membre connecte un compte (au moins en environnement de test
   ou avec des identifiants factices si les vrais ne sont pas disponibles), une synchronisation se
   déclenche et les données arrivent bien dans ExternalSync / ActivityLog.
2. Vérification de sécurité : les tokens/clés API ne sont jamais visibles en clair, ni dans les
   logs serveur, ni dans les réponses API envoyées au frontend, ni committés dans le dépôt.
3. Vérification de robustesse : simule l'échec d'un des deux services externes (Inara ou CAPI en
   panne / clé invalide) et vérifie que le job cron continue de traiter les autres membres sans
   planter, et que l'échec est visible quelque part (statut sur ExternalSync) pour que le membre
   sache que sa sync n'a pas fonctionné.
</verification_avant_de_terminer>

<rapport_final>
Résume le résultat des 3 vérifications, les points restés en TODO (ex. whitelist Inara pas encore
obtenue), et mets à jour progress.md et tests.json.
</rapport_final>
```

---

## 7. Points ouverts et hypothèses prises dans ce guide

- **Récupération de mot de passe** : hypothèse retenue = réinitialisation par un officier depuis
  l'appli, pas de système d'email. À confirmer ou changer avant la Phase 1.
- **Whitelist Inara** : à demander dès que possible auprès de l'administrateur d'Inara (voir
  section 1) — c'est une démarche manuelle, pas technique, qui peut prendre du temps. Ne bloque
  pas les phases 0 à 3.
- **Hébergement définitif** : non tranché, mais la stack choisie (Node + Postgres) fonctionne sans
  changement sur Railway, Render, Fly.io ou un VPS classique.
- **Nom de domaine, branding** : non abordés dans ce guide.