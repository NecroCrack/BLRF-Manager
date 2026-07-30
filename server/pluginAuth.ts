// server/pluginAuth.ts
//
// Auth par jeton porteur pour le plugin EDMC (voir edmc-plugin/), seul mécanisme
// non-cookie de l'app. Le jeton est hashé (SHA-256) en base, jamais stocké en clair —
// contrairement à ExternalSync.inaraToken (chiffré de façon réversible car il faut
// pouvoir le relayer vers Inara), ce jeton n'a pas besoin d'être relu : seule sa
// présence compte, donc un hash à sens unique suffit et c'est plus sûr.

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export interface PluginMember {
  id: string;
  roleId: string;
}

declare global {
  namespace Express {
    interface Request {
      pluginMember?: PluginMember;
    }
  }
}

export function hashPluginToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generatePluginToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function createPluginAuthMiddleware(prisma: PrismaClient) {
  return async function requirePluginToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
    if (!token) {
      res.status(401).json({ error: 'Jeton manquant.' });
      return;
    }
    const tokenHash = hashPluginToken(token);
    const record = await prisma.memberApiToken.findUnique({
      where: { tokenHash },
      include: { member: { select: { id: true, roleId: true } } },
    });
    if (!record) {
      res.status(401).json({ error: 'Jeton invalide.' });
      return;
    }
    await prisma.memberApiToken.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } });
    req.pluginMember = { id: record.member.id, roleId: record.member.roleId };
    next();
  };
}
