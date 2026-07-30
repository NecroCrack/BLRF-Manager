-- Remplace la hiérarchie de rôles générique (RECRUE/PILOTE/OFFICIER/COMMANDANT)
-- par la vraie hiérarchie de l'escadron BLRF. Le rôle protégé (ex-COMMANDANT) est
-- renommé en "Ingénieur" — rôle technique hors chaîne de commandement militaire,
-- garantissant toujours un super-admin. Aucun droit technique n'est accordé aux
-- 15 nouveaux grades par défaut : à configurer via l'onglet Rôles & Permissions.

-- Le seul compte réel existant (matricule BLRF-001) devient le compte "Ingénieur".
UPDATE "Member" SET "matricule" = 'BLRF-143', "pseudo" = 'NecroCrack' WHERE "matricule" = 'BLRF-001';

-- Rôle protégé renommé (même id : 00000000-0000-4000-8000-000000000004).
UPDATE "Role" SET
  "name" = 'Ingénieur',
  "appellation" = 'Ingénieur',
  "description" = 'Administration technique de l''application — hors chaîne de commandement militaire de l''escadron.',
  "rang" = 100
WHERE "id" = '00000000-0000-4000-8000-000000000004';

-- Suppression des anciens rôles génériques (aucun membre ne les référence encore,
-- le seul compte réel vient d'être basculé sur le rôle protégé ci-dessus).
DELETE FROM "Role" WHERE "id" IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003'
);

-- Nouvelle hiérarchie (rang croissant = ancienneté croissante ; Ingénieur reste à
-- part avec rang=100). Aucune permission technique accordée par défaut.
INSERT INTO "Role" ("id", "name", "appellation", "description", "rang", "protege") VALUES
  ('00000000-0000-4000-8000-000000000101', 'Moussaillon', 'Moussaillon', 'Recrue.', 1, false),
  ('00000000-0000-4000-8000-000000000102', 'Matelot', 'Matelot', 'Recrue reconnue active.', 2, false),
  ('00000000-0000-4000-8000-000000000103', 'Quartier maitre', 'Quartier maitre', 'Recrue active. Prérequis : 10 ingénieurs déverrouillés, compte Inara à jour.', 3, false),
  ('00000000-0000-4000-8000-000000000104', 'Commando Alpha', 'Commando', '3 joueurs sous l''autorité d''1 capitaine.', 4, false),
  ('00000000-0000-4000-8000-000000000105', 'Second-Maitre', 'Second', 'Prérequis : 10 ingénieurs déverrouillés, Élite (ou mérite), compte Inara à jour.', 5, false),
  ('00000000-0000-4000-8000-000000000106', 'Aspirant', 'Lieutenant', 'Prérequis : 15 ingénieurs déverrouillés, Élite (ou mérite), compte Inara à jour.', 6, false),
  ('00000000-0000-4000-8000-000000000107', 'Enseigne de vaisseaux', 'Lieutenant', 'Doit posséder un fleet et être Élite dans un domaine, plus 15 ingénieurs déverrouillés. Gère des groupes de joueurs de grades inférieurs.', 7, false),
  ('00000000-0000-4000-8000-000000000108', 'Lieutenant de vaisseaux', 'Capitaine', 'Gère les événements de l''escadron.', 8, false),
  ('00000000-0000-4000-8000-000000000109', 'Capitaine émérite', 'Capitaine', 'Grade de mérite décerné pour une action ou un fait d''armes notable.', 9, false),
  ('00000000-0000-4000-8000-00000000010a', 'Capitaine du Commando Alpha', 'Capitaine', 'Grade de mérite. Dirige les opérations du Commando Alpha (4 joueurs) ; répond aux ordres du Capitaine de vaisseaux major avec une certaine autonomie d''action.', 10, false),
  ('00000000-0000-4000-8000-00000000010b', 'Capitaine de corvette', 'Commandant', 'Maintenance informatique et site internet.', 11, false),
  ('00000000-0000-4000-8000-00000000010c', 'Capitaine de vaisseau', 'Commandant', 'Gestion des nouveaux et formation — recrutement.', 12, false),
  ('00000000-0000-4000-8000-00000000010d', 'Capitaine de vaisseaux major', 'Commandant', 'Responsable des missions BGS.', 13, false),
  ('00000000-0000-4000-8000-00000000010e', 'Capitaine de frégate', 'Commandant', 'Responsable des missions de colonisation.', 14, false),
  ('00000000-0000-4000-8000-00000000010f', 'Vice amiral', 'Amiral', 'Mini boss.', 15, false),
  ('00000000-0000-4000-8000-000000000110', 'Amiral', 'Amiral', 'Big Boss.', 16, false);
