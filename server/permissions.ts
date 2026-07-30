// server/permissions.ts
//
// Système de permissions dynamique : remplace l'ancien enum Role figé + la
// table Permissions (4 booléens fixes) par un catalogue de droits associés à
// des rôles personnalisables (voir prisma/schema.prisma : Permission, Role,
// RolePermission). Cette liste doit rester alignée avec le catalogue seedé
// dans la migration `dynamic_roles_permissions`.

import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export const PERMISSION_KEYS = [
  'map.edit',
  'missions.manage',
  'squadron.manage',
  'members.administer',
  'forum.moderate',
  'stats.view',
  'builds.approve',
  'roles.manage',
  'dashboard.manage',
  'colonisation.add',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && (PERMISSION_KEYS as readonly string[]).includes(value);
}

export async function memberHasPermission(
  prisma: PrismaClient,
  roleId: string | undefined,
  key: PermissionKey
): Promise<boolean> {
  // roleId manquant : jeton émis avant l'introduction des rôles dynamiques (ou altéré).
  // Échec propre plutôt qu'une erreur Prisma non catchée.
  if (!roleId) return false;
  const grant = await prisma.rolePermission.findUnique({
    where: { roleId_permissionKey: { roleId, permissionKey: key } },
  });
  return !!grant?.granted;
}

// Résout à chaque requête (pas de cache JWT) : un changement de droits par le
// commandant s'applique donc immédiatement, sans que les membres concernés
// aient besoin de se reconnecter.
export function createPermissionMiddleware(prisma: PrismaClient) {
  return function requirePermission(key: PermissionKey) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentification requise.' });
        return;
      }
      if (!req.user.roleId) {
        res.status(401).json({ error: 'Session obsolète, veuillez vous reconnecter.' });
        return;
      }
      const granted = await memberHasPermission(prisma, req.user.roleId, key);
      if (!granted) {
        res.status(403).json({ error: 'Permissions insuffisantes.' });
        return;
      }
      next();
    };
  };
}
