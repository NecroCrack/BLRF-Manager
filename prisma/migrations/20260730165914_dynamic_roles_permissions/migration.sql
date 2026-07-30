-- Rôles/permissions dynamiques : remplace l'enum Role figé + la table Permissions
-- (4 booléens fixes) par un catalogue de droits + des rôles personnalisables.

-- Renommer l'ancien type enum pour libérer le nom "Role" (collision sinon avec la
-- nouvelle table du même nom : Postgres partage l'espace de noms types/tables).
ALTER TYPE "Role" RENAME TO "LegacyRoleEnum";

CREATE TABLE "Permission" (
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rang" INTEGER NOT NULL,
  "protege" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionKey"),
  CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Catalogue fixe des droits (défini en code ; cette liste doit rester alignée avec
-- server/permissions.ts).
INSERT INTO "Permission" ("key","label","category") VALUES
  ('map.edit', 'Modifier la carte stellaire', 'Carte'),
  ('missions.manage', 'Gérer les missions', 'Missions'),
  ('squadron.manage', 'Modifier les informations de l''escadron', 'Escadron'),
  ('members.administer', 'Administrer les membres', 'Membres'),
  ('forum.moderate', 'Modérer le forum', 'Forum'),
  ('stats.view', 'Voir les statistiques des membres', 'Membres'),
  ('builds.approve', 'Approuver les builds de vaisseaux', 'Vaisseaux'),
  ('roles.manage', 'Gérer les rôles et permissions', 'Administration'),
  ('dashboard.manage', 'Configurer le tableau de bord', 'Administration'),
  ('colonisation.add', 'Ajouter des sites de colonisation', 'Colonisation');

-- Rôles équivalents à l'ancien enum, pour une migration sans perte d'accès.
-- COMMANDANT est "protege" : jamais supprimable/renommable, garantit un super-admin.
INSERT INTO "Role" ("id","name","rang","protege") VALUES
  ('00000000-0000-4000-8000-000000000001', 'RECRUE', 0, false),
  ('00000000-0000-4000-8000-000000000002', 'PILOTE', 1, false),
  ('00000000-0000-4000-8000-000000000003', 'OFFICIER', 2, false),
  ('00000000-0000-4000-8000-000000000004', 'COMMANDANT', 3, true);

-- Droits accordés reproduisant l'accès effectif précédent : OFFICIER+ pouvait
-- gérer carte/missions (via requireRole codé en dur), COMMANDANT avait tout.
INSERT INTO "RolePermission" ("roleId","permissionKey","granted") VALUES
  ('00000000-0000-4000-8000-000000000003', 'map.edit', true),
  ('00000000-0000-4000-8000-000000000003', 'missions.manage', true),
  ('00000000-0000-4000-8000-000000000004', 'map.edit', true),
  ('00000000-0000-4000-8000-000000000004', 'missions.manage', true),
  ('00000000-0000-4000-8000-000000000004', 'squadron.manage', true),
  ('00000000-0000-4000-8000-000000000004', 'members.administer', true),
  ('00000000-0000-4000-8000-000000000004', 'forum.moderate', true),
  ('00000000-0000-4000-8000-000000000004', 'stats.view', true),
  ('00000000-0000-4000-8000-000000000004', 'builds.approve', true),
  ('00000000-0000-4000-8000-000000000004', 'roles.manage', true),
  ('00000000-0000-4000-8000-000000000004', 'dashboard.manage', true),
  ('00000000-0000-4000-8000-000000000004', 'colonisation.add', true);

-- Backfill : ajouter la nouvelle colonne, la remplir depuis l'ancien enum, puis
-- la rendre obligatoire.
ALTER TABLE "Member" ADD COLUMN "roleId" TEXT;

UPDATE "Member" SET "roleId" = CASE "role"
  WHEN 'RECRUE' THEN '00000000-0000-4000-8000-000000000001'
  WHEN 'PILOTE' THEN '00000000-0000-4000-8000-000000000002'
  WHEN 'OFFICIER' THEN '00000000-0000-4000-8000-000000000003'
  WHEN 'COMMANDANT' THEN '00000000-0000-4000-8000-000000000004'
END;

ALTER TABLE "Member" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "Member" ADD CONSTRAINT "Member_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Member_roleId_idx" ON "Member"("roleId");

-- Nettoyage : supprimer l'ancien enum et l'ancienne table de permissions fixes.
ALTER TABLE "Member" DROP COLUMN "role";
DROP TYPE "LegacyRoleEnum";
DROP TABLE "Permissions";
