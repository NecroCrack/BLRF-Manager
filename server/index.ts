// server/index.ts
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Prisma,
  type WaypointType,
  type MissionType,
  type MissionStatus,
  type ShipRole,
  type ForumCategorie,
  type BuildStatus,
} from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { signAuthToken, setAuthCookie, clearAuthCookie, requireAuth } from './auth';
import { createPermissionMiddleware, memberHasPermission, isPermissionKey } from './permissions';
import { createPluginAuthMiddleware, generatePluginToken, hashPluginToken } from './pluginAuth';
import { generateStrongPassword } from './passwords';
import { encrypt } from './crypto';
import { startInaraSyncCron } from './cron';

dotenv.config();

// PORT : Render (et la plupart des PaaS) assigne le port via cette variable — priorité sur
// BACKEND_PORT, qui reste le réglage utilisé en développement local.
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3001;
// RENDER_EXTERNAL_URL est injecté automatiquement par Render (URL publique du service) ;
// utile ici car en production front et API sont servis depuis la même origine (voir plus bas).
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:8443';
const WAYPOINT_TYPES: WaypointType[] = ['BASE', 'OBJECTIF', 'RAVITAILLEMENT', 'AUTRE'];
const MISSION_TYPES: MissionType[] = ['COMBAT', 'EXPLORATION', 'LOGISTIQUE', 'ESCORTE', 'INTERNE'];
const MISSION_STATUSES: MissionStatus[] = ['EN_COURS', 'COMPLETE', 'ARCHIVE'];
const SHIP_ROLES: ShipRole[] = ['COMBAT', 'EXPLORATION', 'MINAGE', 'TRANSPORT', 'MULTIROLE'];
const FORUM_CATEGORIES: ForumCategorie[] = ['OPERATIONS', 'TACTIQUE', 'INGENIERIE', 'GENERAL', 'ANNONCES'];
const BUILD_STATUSES: BuildStatus[] = ['EN_ATTENTE', 'APPROUVE', 'REJETE'];
const MATRICULE_PATTERN = /^BLRF-\d+$/;
const BCRYPT_COST = 12;
const ONLINE_WINDOW_MS = 3 * 60 * 1000; // tolère ~3 battements de coeur manqués (heartbeat toutes les 60s)

// Limite EDSM (~360 req/h) : garde-fou en mémoire, largement suffisant pour un usage MVP mono-processus.
const EDSM_HOURLY_LIMIT = 300;
const HOUR_MS = 60 * 60 * 1000;
let edsmCallCount = 0;
let edsmWindowStart = Date.now();

function consumeEdsmQuota(): boolean {
  const now = Date.now();
  if (now - edsmWindowStart > HOUR_MS) {
    edsmWindowStart = now;
    edsmCallCount = 0;
  }
  if (edsmCallCount >= EDSM_HOURLY_LIMIT) return false;
  edsmCallCount++;
  return true;
}

interface EdsmSystem {
  name: string;
  coordX: number;
  coordY: number;
  coordZ: number;
}

// Ne fait jamais confiance à des coordonnées fournies par le client : toujours re-vérifiées ici.
async function lookupEdsmSystem(systemName: string): Promise<EdsmSystem | null> {
  if (!consumeEdsmQuota()) {
    throw new Error('EDSM_RATE_LIMIT');
  }
  const url = `https://www.edsm.net/api-v1/system?systemName=${encodeURIComponent(systemName)}&showCoordinates=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) || !data?.coords) return null;
  return { name: data.name, coordX: data.coords.x, coordY: data.coords.y, coordZ: data.coords.z };
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const requirePermission = createPermissionMiddleware(prisma);
const requirePluginToken = createPluginAuthMiddleware(prisma);

startInaraSyncCron(prisma);

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
// Limite relevée au-delà du défaut (100kb) pour permettre le logo de l'escadron
// (data URI base64, plafonné à ~1MB côté route).
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const memberWithRoleInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
} satisfies Prisma.MemberInclude;

type MemberWithRole = Prisma.MemberGetPayload<{ include: typeof memberWithRoleInclude }>;

function toPublicMember(member: MemberWithRole) {
  return {
    id: member.id,
    matricule: member.matricule,
    pseudo: member.pseudo,
    role: {
      id: member.role.id,
      name: member.role.name,
      appellation: member.role.appellation,
      rang: member.role.rang,
      protege: member.role.protege,
    },
    permissions: member.role.permissions.filter(p => p.granted).map(p => p.permissionKey),
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

type WaypointWithRelations = Prisma.WaypointGetPayload<{
  include: { system: true; createdBy: { select: { pseudo: true } } };
}>;

function toPublicWaypoint(wp: WaypointWithRelations) {
  return {
    id: wp.id,
    type: wp.type,
    marker: wp.marker,
    pinned: wp.pinned,
    timestamp: wp.timestamp,
    createdBy: wp.createdBy.pseudo,
    system: {
      id: wp.system.id,
      name: wp.system.name,
      coordX: wp.system.coordX,
      coordY: wp.system.coordY,
      coordZ: wp.system.coordZ,
    },
  };
}

function isMemberOnline(lastSeenAt: Date | null): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

const rosterMemberInclude = { role: true, localisationSystem: true } satisfies Prisma.MemberInclude;
type RosterMember = Prisma.MemberGetPayload<{ include: typeof rosterMemberInclude }>;

function toRosterMember(m: RosterMember) {
  return {
    id: m.id,
    matricule: m.matricule,
    pseudo: m.pseudo,
    role: { id: m.role.id, name: m.role.name, appellation: m.role.appellation, rang: m.role.rang },
    actif: m.actif,
    online: isMemberOnline(m.lastSeenAt),
    localisation: m.localisationAuto ? m.localisationSystem?.name ?? null : m.localisation,
    localisationAuto: m.localisationAuto,
    localisationUpdatedAt: m.localisationUpdatedAt,
    vaisseau: m.vaisseau,
    vaisseauModele: m.vaisseauModele,
    specialite: m.specialite,
    combats: m.combats,
    explorations: m.explorations,
    commerce: m.commerce,
    dateJoin: m.dateJoin,
  };
}

const missionInclude = {
  responsable: { select: { pseudo: true } },
  assignees: { include: { member: { select: { id: true, pseudo: true, lastSeenAt: true } } } },
} satisfies Prisma.MissionInclude;

type MissionWithRelations = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;

function toPublicMission(m: MissionWithRelations) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    status: m.status,
    priorite: m.priorite,
    type: m.type,
    systeme: m.systeme,
    systemId: m.systemId,
    responsableId: m.responsableId,
    responsable: m.responsable?.pseudo ?? null,
    createdAt: m.createdAt,
    dateCompletion: m.dateCompletion,
    showEdsmPanel: m.showEdsmPanel,
    showMemberStatusPanel: m.showMemberStatusPanel,
    assignees: m.assignees.map(a => ({
      id: a.member.id,
      pseudo: a.member.pseudo,
      online: isMemberOnline(a.member.lastSeenAt),
    })),
  };
}

const buildInclude = {
  member: { select: { pseudo: true } },
  comments: { include: { reviewer: { select: { pseudo: true } } }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ShipBuildInclude;

type ShipBuildWithRelations = Prisma.ShipBuildGetPayload<{ include: typeof buildInclude }>;

function toPublicBuild(b: ShipBuildWithRelations) {
  return {
    id: b.id,
    membreId: b.memberId,
    membre: b.member.pseudo,
    nom: b.nom,
    vaisseauModele: b.vaisseauModele,
    lienCoriolis: b.urlCoriolis,
    role: b.role,
    portee: b.portee,
    notes: b.notes,
    status: b.status,
    dateImport: b.dateImport,
    comments: b.comments.map(c => ({
      id: c.id,
      contenu: c.content,
      date: c.createdAt,
      reviewer: c.reviewer.pseudo,
    })),
  };
}

type ForumPostWithRelations = Prisma.ForumPostGetPayload<{
  include: {
    member: { select: { pseudo: true; role: { select: { name: true; appellation: true } } } };
    comments: { include: { member: { select: { pseudo: true; role: { select: { name: true; appellation: true } } } } } };
    _count: { select: { comments: true } };
  };
}>;

function toPublicPost(p: ForumPostWithRelations) {
  return {
    id: p.id,
    titre: p.title,
    contenu: p.content,
    categorie: p.categorie,
    epingle: p.epingle,
    vues: p.vues,
    dateCreation: p.createdAt,
    auteur: p.member.pseudo,
    auteurRole: p.member.role.appellation || p.member.role.name,
    nbCommentaires: p._count.comments,
    comments: p.comments.map(c => ({
      id: c.id,
      contenu: c.content,
      date: c.createdAt,
      auteur: c.member.pseudo,
      auteurRole: c.member.role.appellation || c.member.role.name,
    })),
  };
}

const colonisationSiteInclude = {
  system: true,
  addedBy: { select: { pseudo: true } },
} satisfies Prisma.ColonisationSiteInclude;

type ColonisationSiteWithRelations = Prisma.ColonisationSiteGetPayload<{ include: typeof colonisationSiteInclude }>;

function toPublicColonisationSite(s: ColonisationSiteWithRelations) {
  return {
    id: s.id,
    nom: s.name,
    type: s.siteType,
    progression: s.progressPct,
    statut: s.statusText,
    dateMaj: s.lastUpdatedAt,
    ajoutePar: s.addedBy.pseudo,
    systeme: { id: s.system.id, name: s.system.name, coordX: s.system.coordX, coordY: s.system.coordY, coordZ: s.system.coordZ },
  };
}

function toPublicNote(n: Prisma.PrivateNoteGetPayload<{}>) {
  return {
    id: n.id,
    titre: n.titre,
    categorie: n.categorie,
    contenu: n.content,
    dateCreation: n.createdAt,
    dateMaj: n.dateMaj,
  };
}

function toPublicSquadron(sq: Prisma.SquadronGetPayload<{}>, commandant: string | null, totalMembres: number) {
  return {
    nom: sq.nom,
    tag: sq.tag,
    description: sq.description,
    fondation: sq.fondation,
    logo: sq.logo,
    commandant,
    totalMembres,
  };
}

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Le serveur Express tourne correctement.' });
});

app.post('/api/auth/login', async (req, res) => {
  const { matricule, motDePasse } = req.body ?? {};

  if (typeof matricule !== 'string' || typeof motDePasse !== 'string') {
    res.status(400).json({ error: 'Matricule et mot de passe requis.' });
    return;
  }

  const normalizedMatricule = matricule.trim().toUpperCase();
  const member = await prisma.member.findUnique({
    where: { matricule: normalizedMatricule },
    include: memberWithRoleInclude,
  });

  // Message identique que le matricule existe ou non : ne révèle pas quels matricules sont valides.
  if (!member || !(await bcrypt.compare(motDePasse, member.passwordHash))) {
    res.status(401).json({ error: 'Matricule ou mot de passe incorrect.' });
    return;
  }

  const token = signAuthToken({ sub: member.id, matricule: member.matricule, roleId: member.roleId, roleName: member.role.name });
  setAuthCookie(res, token);
  res.json(toPublicMember(member));
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.user!.sub },
    include: memberWithRoleInclude,
  });
  if (!member) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }
  res.json(toPublicMember(member));
});

// Roster complet visible par tout membre connecté (pas de permissions ici, réservées à la gestion admin).
app.get('/api/members', requireAuth, async (req, res) => {
  const members = await prisma.member.findMany({ orderBy: { dateJoin: 'asc' }, include: rosterMemberInclude });
  res.json(members.map(toRosterMember));
});

app.post('/api/members', requireAuth, requirePermission('members.administer'), async (req, res) => {
  const { matricule, pseudo, roleId } = req.body ?? {};

  if (typeof matricule !== 'string' || typeof pseudo !== 'string' || typeof roleId !== 'string') {
    res.status(400).json({ error: 'Matricule, pseudo et rôle requis.' });
    return;
  }

  const normalizedMatricule = matricule.trim().toUpperCase();
  const normalizedPseudo = pseudo.trim();

  if (!MATRICULE_PATTERN.test(normalizedMatricule)) {
    res.status(400).json({ error: 'Le matricule doit suivre le format BLRF- suivi de chiffres (ex. BLRF-002).' });
    return;
  }
  if (!normalizedPseudo) {
    res.status(400).json({ error: 'Le pseudo est requis.' });
    return;
  }
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    res.status(400).json({ error: 'Rôle invalide.' });
    return;
  }

  // Vérification préalable : message précis par champ, sans dépendre du format d'erreur du driver adapter.
  const [existingMatricule, existingPseudo] = await Promise.all([
    prisma.member.findUnique({ where: { matricule: normalizedMatricule } }),
    prisma.member.findUnique({ where: { pseudo: normalizedPseudo } }),
  ]);
  if (existingMatricule) {
    res.status(409).json({ error: 'Ce matricule est déjà attribué à un autre membre.' });
    return;
  }
  if (existingPseudo) {
    res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
    return;
  }

  const generatedPassword = generateStrongPassword();
  const passwordHash = await bcrypt.hash(generatedPassword, BCRYPT_COST);

  try {
    const member = await prisma.member.create({
      data: {
        matricule: normalizedMatricule,
        pseudo: normalizedPseudo,
        roleId: role.id,
        passwordHash,
      },
      include: memberWithRoleInclude,
    });

    // Le mot de passe en clair n'apparaît que dans cette réponse HTTP unique ; il n'est ni loggé ni persisté.
    res.status(201).json({ ...toPublicMember(member), generatedPassword });
  } catch (err) {
    // Filet de sécurité pour une course concurrente entre la vérification et l'insertion : jamais de 500 brut.
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: 'Matricule ou pseudo déjà utilisé.' });
      return;
    }
    throw err;
  }
});

app.patch('/api/members/:id', requireAuth, requirePermission('members.administer'), async (req, res) => {
  const { roleId } = req.body ?? {};

  if (roleId !== undefined) {
    if (typeof roleId !== 'string') {
      res.status(400).json({ error: 'Rôle invalide.' });
      return;
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      res.status(400).json({ error: 'Rôle invalide.' });
      return;
    }
  }

  try {
    const member = await prisma.member.update({
      where: { id: req.params.id as string },
      data: {
        ...(roleId !== undefined && { roleId }),
      },
      include: rosterMemberInclude,
    });
    res.json(toRosterMember(member));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Membre introuvable.' });
      return;
    }
    throw err;
  }
});

// ─── Rôles & permissions ────────────────────────────────────────────────────
// Catalogue en lecture libre (non sensible) ; toute mutation est réservée à
// 'roles.manage'. Le rôle "protege" (COMMANDANT) est verrouillé : jamais
// renommé/modifié/supprimé, pour garantir qu'il reste toujours un super-admin.

app.get('/api/permissions', requireAuth, async (req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: { category: 'asc' } });
  res.json(permissions);
});

app.get('/api/roles', requireAuth, async (req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { members: true } } },
    orderBy: { rang: 'asc' },
  });
  res.json(
    roles.map(r => ({
      id: r.id,
      name: r.name,
      appellation: r.appellation,
      description: r.description,
      rang: r.rang,
      protege: r.protege,
      permissions: r.permissions.filter(p => p.granted).map(p => p.permissionKey),
      membresCount: r._count.members,
    }))
  );
});

app.post('/api/roles', requireAuth, requirePermission('roles.manage'), async (req, res) => {
  const { name, appellation, description, rang, permissions } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Nom de rôle requis.' });
    return;
  }
  const rangValue = Number.isInteger(rang) ? (rang as number) : 0;
  const permissionKeys = Array.isArray(permissions) ? permissions.filter(isPermissionKey) : [];

  try {
    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        appellation: typeof appellation === 'string' ? appellation.trim() : '',
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        rang: rangValue,
        permissions: { create: permissionKeys.map(key => ({ permissionKey: key, granted: true })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
    res.status(201).json({
      id: role.id,
      name: role.name,
      appellation: role.appellation,
      description: role.description,
      rang: role.rang,
      protege: role.protege,
      permissions: role.permissions.filter(p => p.granted).map(p => p.permissionKey),
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: 'Ce nom de rôle est déjà utilisé.' });
      return;
    }
    throw err;
  }
});

app.patch('/api/roles/:id', requireAuth, requirePermission('roles.manage'), async (req, res) => {
  const existing = await prisma.role.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ error: 'Rôle introuvable.' });
    return;
  }
  if (existing.protege) {
    res.status(403).json({ error: 'Ce rôle est protégé et ne peut pas être modifié.' });
    return;
  }

  const { name, appellation, description, rang, permissions } = req.body ?? {};
  const permissionKeys = Array.isArray(permissions) ? permissions.filter(isPermissionKey) : undefined;

  try {
    const role = await prisma.$transaction(async tx => {
      await tx.role.update({
        where: { id: existing.id },
        data: {
          ...(typeof name === 'string' && name.trim() && { name: name.trim() }),
          ...(typeof appellation === 'string' && { appellation: appellation.trim() }),
          ...(description !== undefined && { description: typeof description === 'string' && description.trim() ? description.trim() : null }),
          ...(Number.isInteger(rang) && { rang: rang as number }),
        },
      });
      if (permissionKeys !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: existing.id } });
        if (permissionKeys.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionKeys.map(key => ({ roleId: existing.id, permissionKey: key, granted: true })),
          });
        }
      }
      return tx.role.findUniqueOrThrow({
        where: { id: existing.id },
        include: { permissions: { include: { permission: true } } },
      });
    });
    res.json({
      id: role.id,
      name: role.name,
      appellation: role.appellation,
      description: role.description,
      rang: role.rang,
      protege: role.protege,
      permissions: role.permissions.filter(p => p.granted).map(p => p.permissionKey),
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      res.status(409).json({ error: 'Ce nom de rôle est déjà utilisé.' });
      return;
    }
    throw err;
  }
});

app.delete('/api/roles/:id', requireAuth, requirePermission('roles.manage'), async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: req.params.id as string },
    include: { _count: { select: { members: true } } },
  });
  if (!role) {
    res.status(404).json({ error: 'Rôle introuvable.' });
    return;
  }
  if (role.protege) {
    res.status(403).json({ error: 'Ce rôle est protégé et ne peut pas être supprimé.' });
    return;
  }
  if (role._count.members > 0) {
    res.status(409).json({ error: `${role._count.members} membre(s) utilisent encore ce rôle. Réassignez-les avant de le supprimer.` });
    return;
  }
  await prisma.role.delete({ where: { id: role.id } });
  res.status(204).end();
});

app.patch('/api/members/me/password', requireAuth, async (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body ?? {};

  if (typeof ancienMotDePasse !== 'string' || typeof nouveauMotDePasse !== 'string') {
    res.status(400).json({ error: 'Ancien et nouveau mot de passe requis.' });
    return;
  }
  if (nouveauMotDePasse.length < 8) {
    res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    return;
  }

  const member = await prisma.member.findUnique({ where: { id: req.user!.sub } });
  if (!member || !(await bcrypt.compare(ancienMotDePasse, member.passwordHash))) {
    res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
    return;
  }

  const passwordHash = await bcrypt.hash(nouveauMotDePasse, BCRYPT_COST);
  await prisma.member.update({ where: { id: member.id }, data: { passwordHash } });
  res.status(204).end();
});

app.post('/api/members/me/heartbeat', requireAuth, async (req, res) => {
  await prisma.member.update({ where: { id: req.user!.sub }, data: { lastSeenAt: new Date() } });
  res.status(204).end();
});

app.patch('/api/members/me/profile', requireAuth, async (req, res) => {
  const { localisation, vaisseau, vaisseauModele, specialite } = req.body ?? {};
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) || null : undefined);

  const member = await prisma.member.update({
    where: { id: req.user!.sub },
    data: {
      ...(clean(localisation) !== undefined && { localisation: clean(localisation) }),
      ...(clean(vaisseau) !== undefined && { vaisseau: clean(vaisseau) }),
      ...(clean(vaisseauModele) !== undefined && { vaisseauModele: clean(vaisseauModele) }),
      ...(clean(specialite) !== undefined && { specialite: clean(specialite) }),
    },
    include: rosterMemberInclude,
  });
  res.json(toRosterMember(member));
});

// Paramètres de compte : clé API Inara personnelle. Jamais retournée en clair après écriture —
// seul le statut (configurée ou non, dernier sync) est exposé au client.
app.get('/api/members/me/sync', requireAuth, async (req, res) => {
  const sync = await prisma.externalSync.findUnique({ where: { memberId: req.user!.sub } });
  res.json({
    inaraConfigured: !!sync?.inaraToken,
    inaraCommanderName: sync?.inaraCommanderName ?? null,
    inaraLastSyncAt: sync?.inaraLastSyncAt ?? null,
    inaraLastSyncOk: sync?.inaraLastSyncOk ?? null,
  });
});

app.put('/api/members/me/sync', requireAuth, async (req, res) => {
  const { inaraApiKey, inaraCommanderName } = req.body ?? {};

  if (inaraApiKey === null) {
    // Déconnexion explicite : efface la clé et le nom de commandant.
    await prisma.externalSync.upsert({
      where: { memberId: req.user!.sub },
      update: { inaraToken: null, inaraCommanderName: null, inaraLastSyncAt: null, inaraLastSyncOk: null },
      create: { memberId: req.user!.sub },
    });
    res.json({ inaraConfigured: false, inaraCommanderName: null, inaraLastSyncAt: null, inaraLastSyncOk: null });
    return;
  }

  if (typeof inaraApiKey !== 'string' || !inaraApiKey.trim() || typeof inaraCommanderName !== 'string' || !inaraCommanderName.trim()) {
    res.status(400).json({ error: 'Clé API et nom de commandant Inara requis.' });
    return;
  }

  const sync = await prisma.externalSync.upsert({
    where: { memberId: req.user!.sub },
    update: {
      inaraToken: encrypt(inaraApiKey.trim()),
      inaraCommanderName: inaraCommanderName.trim(),
      inaraLastSyncAt: null,
      inaraLastSyncOk: null,
    },
    create: {
      memberId: req.user!.sub,
      inaraToken: encrypt(inaraApiKey.trim()),
      inaraCommanderName: inaraCommanderName.trim(),
    },
  });

  res.json({
    inaraConfigured: true,
    inaraCommanderName: sync.inaraCommanderName,
    inaraLastSyncAt: sync.inaraLastSyncAt,
    inaraLastSyncOk: sync.inaraLastSyncOk,
  });
});

// Jeton pour le plugin EDMC (voir edmc-plugin/) : régénère à chaque appel, ne renvoie
// le jeton en clair qu'une seule fois dans cette réponse — jamais reloggé, jamais relu.
app.get('/api/members/me/api-token', requireAuth, async (req, res) => {
  const existing = await prisma.memberApiToken.findUnique({ where: { memberId: req.user!.sub } });
  res.json({ configured: !!existing, lastUsedAt: existing?.lastUsedAt ?? null });
});

app.post('/api/members/me/api-token', requireAuth, async (req, res) => {
  const token = generatePluginToken();
  const tokenHash = hashPluginToken(token);
  await prisma.memberApiToken.upsert({
    where: { memberId: req.user!.sub },
    update: { tokenHash, lastUsedAt: null },
    create: { memberId: req.user!.sub, tokenHash },
  });
  res.json({ token });
});

// ─── Plugin EDMC : localisation & colonisation ─────────────────────────────
// Auth par jeton porteur (requirePluginToken), pas par cookie — voir server/pluginAuth.ts
// et edmc-plugin/. Best-effort : ne lève jamais d'erreur bloquante pour le plugin,
// répond simplement par un code d'erreur clair si le système EDSM est introuvable.

app.post('/api/plugin/location', requirePluginToken, async (req, res) => {
  const { systemName } = req.body ?? {};
  if (typeof systemName !== 'string' || !systemName.trim()) {
    res.status(400).json({ error: 'Nom de système requis.' });
    return;
  }

  let coords: EdsmSystem | null;
  try {
    coords = await lookupEdsmSystem(systemName.trim());
  } catch {
    res.status(429).json({ error: 'Limite de requêtes EDSM atteinte, réessayez plus tard.' });
    return;
  }
  if (!coords) {
    res.status(404).json({ error: 'Système introuvable sur EDSM.' });
    return;
  }

  const system = await prisma.system.upsert({
    where: { name: coords.name },
    update: {},
    create: { name: coords.name, coordX: coords.coordX, coordY: coords.coordY, coordZ: coords.coordZ },
  });

  await prisma.member.update({
    where: { id: req.pluginMember!.id },
    data: { localisationSystemId: system.id, localisationUpdatedAt: new Date(), localisationAuto: true },
  });

  res.status(204).end();
});

app.post('/api/plugin/colonisation', requirePluginToken, async (req, res) => {
  const { systemName, name, siteType, progressPct, statusText } = req.body ?? {};
  if (typeof systemName !== 'string' || !systemName.trim() || typeof name !== 'string' || !name.trim() || typeof siteType !== 'string' || !siteType.trim()) {
    res.status(400).json({ error: 'Système, nom et type de site requis.' });
    return;
  }

  let coords: EdsmSystem | null;
  try {
    coords = await lookupEdsmSystem(systemName.trim());
  } catch {
    res.status(429).json({ error: 'Limite de requêtes EDSM atteinte, réessayez plus tard.' });
    return;
  }
  if (!coords) {
    res.status(404).json({ error: 'Système introuvable sur EDSM.' });
    return;
  }

  const system = await prisma.system.upsert({
    where: { name: coords.name },
    update: {},
    create: { name: coords.name, coordX: coords.coordX, coordY: coords.coordY, coordZ: coords.coordZ },
  });

  const existing = await prisma.colonisationSite.findFirst({ where: { systemId: system.id, name: name.trim() } });

  if (!existing) {
    const canAdd = await memberHasPermission(prisma, req.pluginMember!.roleId, 'colonisation.add');
    if (!canAdd) {
      res.status(403).json({ error: "Ce membre n'a pas le droit d'ajouter un nouveau site de colonisation." });
      return;
    }
    const created = await prisma.colonisationSite.create({
      data: {
        systemId: system.id,
        name: name.trim(),
        siteType: siteType.trim(),
        progressPct: typeof progressPct === 'number' ? progressPct : null,
        statusText: typeof statusText === 'string' ? statusText.trim() : null,
        addedById: req.pluginMember!.id,
      },
      include: colonisationSiteInclude,
    });
    res.status(201).json(toPublicColonisationSite(created));
    return;
  }

  const updated = await prisma.colonisationSite.update({
    where: { id: existing.id },
    data: {
      progressPct: typeof progressPct === 'number' ? progressPct : existing.progressPct,
      statusText: typeof statusText === 'string' ? statusText.trim() : existing.statusText,
      lastUpdatedAt: new Date(),
    },
    include: colonisationSiteInclude,
  });
  res.json(toPublicColonisationSite(updated));
});

app.get('/api/colonisation', requireAuth, async (req, res) => {
  const sites = await prisma.colonisationSite.findMany({
    include: colonisationSiteInclude,
    orderBy: { lastUpdatedAt: 'desc' },
  });
  res.json(sites.map(toPublicColonisationSite));
});

// Ajout manuel d'un site à suivre (le membre choisit le système) — la progression elle-même
// arrive ensuite automatiquement via le plugin EDMC (POST /api/plugin/colonisation).
app.post('/api/colonisation', requireAuth, requirePermission('colonisation.add'), async (req, res) => {
  const { systemName, name, siteType } = req.body ?? {};
  if (typeof systemName !== 'string' || !systemName.trim() || typeof name !== 'string' || !name.trim() || typeof siteType !== 'string' || !siteType.trim()) {
    res.status(400).json({ error: 'Système, nom et type de site requis.' });
    return;
  }

  let coords: EdsmSystem | null;
  try {
    coords = await lookupEdsmSystem(systemName.trim());
  } catch {
    res.status(429).json({ error: 'Limite de requêtes EDSM atteinte, réessayez plus tard.' });
    return;
  }
  if (!coords) {
    res.status(404).json({ error: 'Système introuvable sur EDSM.' });
    return;
  }

  const system = await prisma.system.upsert({
    where: { name: coords.name },
    update: {},
    create: { name: coords.name, coordX: coords.coordX, coordY: coords.coordY, coordZ: coords.coordZ },
  });

  const existing = await prisma.colonisationSite.findFirst({ where: { systemId: system.id, name: name.trim() } });
  if (existing) {
    res.status(409).json({ error: 'Ce site est déjà suivi pour ce système.' });
    return;
  }

  const site = await prisma.colonisationSite.create({
    data: { systemId: system.id, name: name.trim(), siteType: siteType.trim(), addedById: req.user!.sub },
    include: colonisationSiteInclude,
  });
  res.status(201).json(toPublicColonisationSite(site));
});

app.post('/api/edsm/lookup', requireAuth, requirePermission('map.edit'), async (req, res) => {
  const { systemName } = req.body ?? {};
  if (typeof systemName !== 'string' || !systemName.trim()) {
    res.status(400).json({ error: 'Nom de système requis.' });
    return;
  }

  let result: EdsmSystem | null;
  try {
    result = await lookupEdsmSystem(systemName.trim());
  } catch {
    res.status(429).json({ error: 'Limite de requêtes EDSM atteinte pour cette heure, réessayez plus tard.' });
    return;
  }

  if (!result) {
    res.status(404).json({ error: 'Système introuvable sur EDSM.' });
    return;
  }
  res.json(result);
});

app.get('/api/waypoints', requireAuth, async (req, res) => {
  const waypoints = await prisma.waypoint.findMany({
    include: { system: true, createdBy: { select: { pseudo: true } } },
    orderBy: { timestamp: 'desc' },
  });
  res.json(waypoints.map(toPublicWaypoint));
});

app.post('/api/waypoints', requireAuth, requirePermission('map.edit'), async (req, res) => {
  const { systemName, type, marker } = req.body ?? {};

  if (typeof systemName !== 'string' || !systemName.trim()) {
    res.status(400).json({ error: 'Nom de système requis.' });
    return;
  }
  const waypointType = typeof type === 'string' && WAYPOINT_TYPES.includes(type as WaypointType)
    ? (type as WaypointType)
    : 'AUTRE';

  let coords: EdsmSystem | null;
  try {
    coords = await lookupEdsmSystem(systemName.trim());
  } catch {
    res.status(429).json({ error: 'Limite de requêtes EDSM atteinte pour cette heure, réessayez plus tard.' });
    return;
  }
  if (!coords) {
    res.status(404).json({ error: 'Système introuvable sur EDSM.' });
    return;
  }

  const system = await prisma.system.upsert({
    where: { name: coords.name },
    update: {},
    create: { name: coords.name, coordX: coords.coordX, coordY: coords.coordY, coordZ: coords.coordZ },
  });

  const waypoint = await prisma.waypoint.create({
    data: {
      systemId: system.id,
      createdById: req.user!.sub,
      type: waypointType,
      marker: typeof marker === 'string' && marker.trim() ? marker.trim() : null,
    },
    include: { system: true, createdBy: { select: { pseudo: true } } },
  });

  res.status(201).json(toPublicWaypoint(waypoint));
});

app.delete('/api/waypoints/:id', requireAuth, requirePermission('map.edit'), async (req, res) => {
  try {
    await prisma.waypoint.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Waypoint introuvable.' });
      return;
    }
    throw err;
  }
});

app.patch('/api/waypoints/:id/pin', requireAuth, requirePermission('map.edit'), async (req, res) => {
  const { pinned } = req.body ?? {};
  if (typeof pinned !== 'boolean') {
    res.status(400).json({ error: 'Valeur "pinned" (booléen) requise.' });
    return;
  }
  try {
    const waypoint = await prisma.waypoint.update({
      where: { id: req.params.id as string },
      data: { pinned },
      include: { system: true, createdBy: { select: { pseudo: true } } },
    });
    res.json(toPublicWaypoint(waypoint));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Waypoint introuvable.' });
      return;
    }
    throw err;
  }
});

// ─── Squadron ──────────────────────────────────────────────────────────────

// Public (pas de requireAuth) : l'écran de connexion affiche le nom/tag de l'escadron avant authentification.
app.get('/api/squadron', async (req, res) => {
  const [squadron, commandant, totalMembres] = await Promise.all([
    prisma.squadron.findUniqueOrThrow({ where: { id: 'singleton' } }),
    prisma.member.findFirst({ where: { role: { protege: true } }, select: { pseudo: true }, orderBy: { dateJoin: 'asc' } }),
    prisma.member.count(),
  ]);
  res.json(toPublicSquadron(squadron, commandant?.pseudo ?? null, totalMembres));
});

// Data URI base64 uniquement (pas de stockage objet) — plafonné pour éviter de gonfler la base.
const MAX_LOGO_DATA_URI_LENGTH = 1_500_000; // ~1MB en base64

app.patch('/api/squadron', requireAuth, requirePermission('squadron.manage'), async (req, res) => {
  const { nom, tag, description, fondation, logo } = req.body ?? {};
  const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  if (logo !== undefined && logo !== null) {
    if (typeof logo !== 'string' || !logo.startsWith('data:image/') || logo.length > MAX_LOGO_DATA_URI_LENGTH) {
      res.status(400).json({ error: 'Logo invalide (image trop lourde ou format non reconnu).' });
      return;
    }
  }

  const squadron = await prisma.squadron.update({
    where: { id: 'singleton' },
    data: {
      ...(clean(nom) !== undefined && { nom: clean(nom) }),
      ...(clean(tag) !== undefined && { tag: clean(tag) }),
      ...(clean(description) !== undefined && { description: clean(description) }),
      ...(clean(fondation) !== undefined && { fondation: clean(fondation) }),
      ...(logo !== undefined && { logo }),
    },
  });

  const [commandant, totalMembres] = await Promise.all([
    prisma.member.findFirst({ where: { role: { protege: true } }, select: { pseudo: true }, orderBy: { dateJoin: 'asc' } }),
    prisma.member.count(),
  ]);
  res.json(toPublicSquadron(squadron, commandant?.pseudo ?? null, totalMembres));
});

// ─── Missions ──────────────────────────────────────────────────────────────

app.get('/api/missions', requireAuth, async (req, res) => {
  const missions = await prisma.mission.findMany({
    include: missionInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(missions.map(toPublicMission));
});

// Résolution best-effort du système cible via EDSM : ne bloque jamais la création/
// mise à jour d'une mission (quota EDSM atteint ou nom introuvable → systemId reste null,
// le champ texte "systeme" reste affiché tel quel).
async function resolveMissionSystemId(systeme: string): Promise<string | null> {
  try {
    const coords = await lookupEdsmSystem(systeme);
    if (!coords) return null;
    const system = await prisma.system.upsert({
      where: { name: coords.name },
      update: {},
      create: { name: coords.name, coordX: coords.coordX, coordY: coords.coordY, coordZ: coords.coordZ },
    });
    return system.id;
  } catch {
    return null;
  }
}

app.post('/api/missions', requireAuth, requirePermission('missions.manage'), async (req, res) => {
  const { title, description, type, priorite, systeme, responsableId } = req.body ?? {};

  if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'Titre et description requis.' });
    return;
  }
  const missionType = typeof type === 'string' && MISSION_TYPES.includes(type as MissionType) ? (type as MissionType) : 'INTERNE';
  const missionPriorite = [1, 2, 3].includes(priorite) ? priorite : 3;
  const missionSysteme = typeof systeme === 'string' && systeme.trim() ? systeme.trim() : null;
  const systemId = missionSysteme ? await resolveMissionSystemId(missionSysteme) : null;

  try {
    const mission = await prisma.mission.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        type: missionType,
        priorite: missionPriorite,
        systeme: missionSysteme,
        systemId,
        responsableId: typeof responsableId === 'string' && responsableId.trim() ? responsableId.trim() : null,
      },
      include: missionInclude,
    });
    res.status(201).json(toPublicMission(mission));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(400).json({ error: 'Responsable introuvable.' });
      return;
    }
    throw err;
  }
});

app.patch('/api/missions/:id', requireAuth, requirePermission('missions.manage'), async (req, res) => {
  const { status, priorite, type, systeme, responsableId, dateCompletion, showEdsmPanel, showMemberStatusPanel } = req.body ?? {};

  if (status !== undefined && !MISSION_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Statut invalide.' });
    return;
  }
  if (type !== undefined && !MISSION_TYPES.includes(type)) {
    res.status(400).json({ error: 'Type invalide.' });
    return;
  }

  const nextSysteme = systeme !== undefined ? (typeof systeme === 'string' && systeme.trim() ? systeme.trim() : null) : undefined;
  const nextSystemId = nextSysteme !== undefined ? (nextSysteme ? await resolveMissionSystemId(nextSysteme) : null) : undefined;

  try {
    const mission = await prisma.mission.update({
      where: { id: req.params.id as string },
      data: {
        ...(status !== undefined && { status: status as MissionStatus }),
        ...(type !== undefined && { type: type as MissionType }),
        ...([1, 2, 3].includes(priorite) && { priorite }),
        ...(nextSysteme !== undefined && { systeme: nextSysteme, systemId: nextSystemId }),
        ...(responsableId !== undefined && { responsableId: typeof responsableId === 'string' && responsableId.trim() ? responsableId.trim() : null }),
        ...(dateCompletion !== undefined && { dateCompletion: dateCompletion ? new Date(dateCompletion) : null }),
        ...(showEdsmPanel !== undefined && { showEdsmPanel: showEdsmPanel === null ? null : !!showEdsmPanel }),
        ...(showMemberStatusPanel !== undefined && { showMemberStatusPanel: showMemberStatusPanel === null ? null : !!showMemberStatusPanel }),
      },
      include: missionInclude,
    });
    res.json(toPublicMission(mission));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2025' || err.code === 'P2003')) {
      res.status(404).json({ error: 'Mission ou responsable introuvable.' });
      return;
    }
    throw err;
  }
});

app.patch('/api/missions/:id/assignees', requireAuth, requirePermission('missions.manage'), async (req, res) => {
  const { memberIds } = req.body ?? {};
  if (!Array.isArray(memberIds) || !memberIds.every(id => typeof id === 'string')) {
    res.status(400).json({ error: 'Liste de membres invalide.' });
    return;
  }
  try {
    const [mission] = await prisma.$transaction([
      prisma.mission.findUniqueOrThrow({ where: { id: req.params.id as string } }),
      prisma.missionAssignee.deleteMany({ where: { missionId: req.params.id as string } }),
      ...(memberIds.length > 0
        ? [prisma.missionAssignee.createMany({ data: memberIds.map(memberId => ({ missionId: req.params.id as string, memberId })) })]
        : []),
    ]);
    const updated = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id }, include: missionInclude });
    res.json(toPublicMission(updated));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2025' || err.code === 'P2003')) {
      res.status(404).json({ error: 'Mission ou membre introuvable.' });
      return;
    }
    throw err;
  }
});

// Panneau live "état EDSM du système" — distinct du lookup coordonnées utilisé pour la carte,
// interroge showInformation=1 (faction/sécurité/gouvernement). Best-effort, jamais bloquant.
app.get('/api/missions/:id/edsm-panel', requireAuth, async (req, res) => {
  const mission = await prisma.mission.findUnique({ where: { id: req.params.id as string }, include: { system: true } });
  if (!mission) {
    res.status(404).json({ error: 'Mission introuvable.' });
    return;
  }
  const systemName = mission.system?.name ?? mission.systeme;
  if (!systemName) {
    res.json(null);
    return;
  }
  if (!consumeEdsmQuota()) {
    res.status(429).json({ error: 'Limite de requêtes EDSM atteinte pour cette heure, réessayez plus tard.' });
    return;
  }
  try {
    const url = `https://www.edsm.net/api-v1/system?systemName=${encodeURIComponent(systemName)}&showInformation=1`;
    const edsmRes = await fetch(url);
    if (!edsmRes.ok) {
      res.json(null);
      return;
    }
    const data = await edsmRes.json();
    if (Array.isArray(data) || !data?.information) {
      res.json(null);
      return;
    }
    res.json({
      systeme: data.name,
      faction: data.information.faction ?? null,
      allegiance: data.information.allegiance ?? null,
      government: data.information.government ?? null,
      security: data.information.security ?? null,
      population: data.information.population ?? null,
    });
  } catch {
    res.json(null);
  }
});

// ─── Tableau de bord : préférences d'épinglage ─────────────────────────────
// Réglages globaux à l'escadron (pas par utilisateur consultant) — voir DashboardPreference.

app.get('/api/dashboard/preferences', requireAuth, async (req, res) => {
  const prefs = await prisma.dashboardPreference.findUniqueOrThrow({ where: { id: 'singleton' } });
  res.json(prefs);
});

app.patch('/api/dashboard/preferences', requireAuth, requirePermission('dashboard.manage'), async (req, res) => {
  const { pinnedMissionIds, pinnedSystemIds } = req.body ?? {};
  if (pinnedMissionIds !== undefined && (!Array.isArray(pinnedMissionIds) || !pinnedMissionIds.every(id => typeof id === 'string'))) {
    res.status(400).json({ error: 'Liste de missions épinglées invalide.' });
    return;
  }
  if (pinnedSystemIds !== undefined && (!Array.isArray(pinnedSystemIds) || !pinnedSystemIds.every(id => typeof id === 'string'))) {
    res.status(400).json({ error: 'Liste de systèmes épinglés invalide.' });
    return;
  }
  const prefs = await prisma.dashboardPreference.update({
    where: { id: 'singleton' },
    data: {
      ...(pinnedMissionIds !== undefined && { pinnedMissionIds }),
      ...(pinnedSystemIds !== undefined && { pinnedSystemIds }),
    },
  });
  res.json(prefs);
});

// ─── Builds (hangar) ────────────────────────────────────────────────────────

app.get('/api/builds', requireAuth, async (req, res) => {
  const builds = await prisma.shipBuild.findMany({
    include: buildInclude,
    orderBy: { dateImport: 'desc' },
  });
  res.json(builds.map(toPublicBuild));
});

app.post('/api/builds', requireAuth, async (req, res) => {
  const { nom, vaisseauModele, lienCoriolis, role, portee, notes } = req.body ?? {};

  if (typeof nom !== 'string' || !nom.trim() || typeof vaisseauModele !== 'string' || !vaisseauModele.trim()) {
    res.status(400).json({ error: 'Nom du build et modèle de vaisseau requis.' });
    return;
  }
  if (typeof lienCoriolis !== 'string') {
    res.status(400).json({ error: 'Lien Coriolis requis.' });
    return;
  }
  try {
    new URL(lienCoriolis);
  } catch {
    res.status(400).json({ error: 'Le lien Coriolis doit être une URL valide.' });
    return;
  }
  const buildRole = typeof role === 'string' && SHIP_ROLES.includes(role as ShipRole) ? (role as ShipRole) : 'MULTIROLE';

  const build = await prisma.shipBuild.create({
    data: {
      memberId: req.user!.sub,
      nom: nom.trim(),
      vaisseauModele: vaisseauModele.trim(),
      urlCoriolis: lienCoriolis.trim(),
      role: buildRole,
      portee: typeof portee === 'string' && portee.trim() ? portee.trim() : null,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    },
    include: buildInclude,
  });
  res.status(201).json(toPublicBuild(build));
});

app.patch('/api/builds/:id/status', requireAuth, requirePermission('builds.approve'), async (req, res) => {
  const { status } = req.body ?? {};
  if (typeof status !== 'string' || !BUILD_STATUSES.includes(status as BuildStatus)) {
    res.status(400).json({ error: 'Statut invalide.' });
    return;
  }
  try {
    const build = await prisma.shipBuild.update({
      where: { id: req.params.id as string },
      data: { status: status as BuildStatus },
      include: buildInclude,
    });
    res.json(toPublicBuild(build));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Build introuvable.' });
      return;
    }
    throw err;
  }
});

app.post('/api/builds/:id/comments', requireAuth, requirePermission('builds.approve'), async (req, res) => {
  const { contenu } = req.body ?? {};
  if (typeof contenu !== 'string' || !contenu.trim()) {
    res.status(400).json({ error: 'Contenu du retour requis.' });
    return;
  }
  try {
    await prisma.buildComment.create({
      data: { buildId: req.params.id as string, reviewerId: req.user!.sub, content: contenu.trim() },
    });
    const build = await prisma.shipBuild.findUniqueOrThrow({ where: { id: req.params.id as string }, include: buildInclude });
    res.status(201).json(toPublicBuild(build));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(404).json({ error: 'Build introuvable.' });
      return;
    }
    throw err;
  }
});

app.delete('/api/builds/:id', requireAuth, async (req, res) => {
  const build = await prisma.shipBuild.findUnique({ where: { id: req.params.id as string } });
  if (!build) {
    res.status(404).json({ error: 'Build introuvable.' });
    return;
  }
  if (build.memberId !== req.user!.sub) {
    const canModerate = await memberHasPermission(prisma, req.user!.roleId, 'builds.approve');
    if (!canModerate) {
      res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres builds.' });
      return;
    }
  }
  await prisma.shipBuild.delete({ where: { id: build.id } });
  res.status(204).end();
});

// ─── Forum ─────────────────────────────────────────────────────────────────

const forumPostInclude = {
  member: { select: { pseudo: true, role: { select: { name: true, appellation: true } } } },
  comments: {
    include: { member: { select: { pseudo: true, role: { select: { name: true, appellation: true } } } } },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.ForumPostInclude;

app.get('/api/forum/posts', requireAuth, async (req, res) => {
  const posts = await prisma.forumPost.findMany({
    include: forumPostInclude,
    orderBy: [{ epingle: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(posts.map(toPublicPost));
});

app.post('/api/forum/posts', requireAuth, async (req, res) => {
  const { titre, contenu, categorie } = req.body ?? {};

  if (typeof titre !== 'string' || !titre.trim() || typeof contenu !== 'string' || !contenu.trim()) {
    res.status(400).json({ error: 'Titre et contenu requis.' });
    return;
  }
  const postCategorie = typeof categorie === 'string' && FORUM_CATEGORIES.includes(categorie as ForumCategorie)
    ? (categorie as ForumCategorie)
    : 'GENERAL';

  const post = await prisma.forumPost.create({
    data: { memberId: req.user!.sub, title: titre.trim(), content: contenu.trim(), categorie: postCategorie },
    include: forumPostInclude,
  });
  res.status(201).json(toPublicPost(post));
});

app.post('/api/forum/posts/:id/comments', requireAuth, async (req, res) => {
  const { contenu } = req.body ?? {};
  if (typeof contenu !== 'string' || !contenu.trim()) {
    res.status(400).json({ error: 'Contenu du commentaire requis.' });
    return;
  }

  try {
    await prisma.forumComment.create({
      data: { postId: req.params.id as string, memberId: req.user!.sub, content: contenu.trim() },
    });
    const post = await prisma.forumPost.findUniqueOrThrow({ where: { id: req.params.id as string }, include: forumPostInclude });
    res.status(201).json(toPublicPost(post));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(404).json({ error: 'Post introuvable.' });
      return;
    }
    throw err;
  }
});

app.post('/api/forum/posts/:id/view', requireAuth, async (req, res) => {
  try {
    await prisma.forumPost.update({ where: { id: req.params.id as string }, data: { vues: { increment: 1 } } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Post introuvable.' });
      return;
    }
    throw err;
  }
});

// ─── Notes privées ─────────────────────────────────────────────────────────
// Filtrage strictement côté serveur (where: memberId), jamais côté front.

app.get('/api/notes', requireAuth, async (req, res) => {
  const notes = await prisma.privateNote.findMany({
    where: { memberId: req.user!.sub },
    orderBy: { dateMaj: 'desc' },
  });
  res.json(notes.map(toPublicNote));
});

app.post('/api/notes', requireAuth, async (req, res) => {
  const { titre, categorie, contenu } = req.body ?? {};
  if (typeof titre !== 'string' || !titre.trim()) {
    res.status(400).json({ error: 'Titre requis.' });
    return;
  }
  const note = await prisma.privateNote.create({
    data: {
      memberId: req.user!.sub,
      titre: titre.trim(),
      categorie: typeof categorie === 'string' && categorie.trim() ? categorie.trim() : 'Personnel',
      content: typeof contenu === 'string' ? contenu : '',
    },
  });
  res.status(201).json(toPublicNote(note));
});

app.patch('/api/notes/:id', requireAuth, async (req, res) => {
  const existing = await prisma.privateNote.findUnique({ where: { id: req.params.id as string } });
  // 404 (pas 403) : ne confirme jamais l'existence de la note d'un autre membre.
  if (!existing || existing.memberId !== req.user!.sub) {
    res.status(404).json({ error: 'Note introuvable.' });
    return;
  }

  const { titre, categorie, contenu } = req.body ?? {};
  const note = await prisma.privateNote.update({
    where: { id: existing.id },
    data: {
      ...(typeof titre === 'string' && titre.trim() && { titre: titre.trim() }),
      ...(typeof categorie === 'string' && categorie.trim() && { categorie: categorie.trim() }),
      ...(typeof contenu === 'string' && { content: contenu }),
    },
  });
  res.json(toPublicNote(note));
});

app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  const existing = await prisma.privateNote.findUnique({ where: { id: req.params.id as string } });
  if (!existing || existing.memberId !== req.user!.sub) {
    res.status(404).json({ error: 'Note introuvable.' });
    return;
  }
  await prisma.privateNote.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ─── Messagerie privée ──────────────────────────────────────────────────────
// Texte seul, membre à membre, aucune pièce jointe — volume négligeable, pas de
// purge/rétention nécessaire à l'échelle d'un escadron.

app.get('/api/messages/conversations', requireAuth, async (req, res) => {
  const myId = req.user!.sub;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: myId }, { recipientId: myId }] },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: { pseudo: true } }, recipient: { select: { pseudo: true } } },
  });

  const conversations = new Map<string, { partnerId: string; pseudo: string; lastMessage: string; lastDate: Date; unread: number }>();
  for (const m of messages) {
    const partnerId = m.senderId === myId ? m.recipientId : m.senderId;
    const partnerPseudo = m.senderId === myId ? m.recipient.pseudo : m.sender.pseudo;
    const isUnreadForMe = m.recipientId === myId && !m.luAt;
    const existing = conversations.get(partnerId);
    if (!existing) {
      conversations.set(partnerId, { partnerId, pseudo: partnerPseudo, lastMessage: m.content, lastDate: m.createdAt, unread: isUnreadForMe ? 1 : 0 });
    } else if (isUnreadForMe) {
      existing.unread += 1;
    }
  }

  res.json(Array.from(conversations.values()).sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime()));
});

app.get('/api/messages/with/:memberId', requireAuth, async (req, res) => {
  const myId = req.user!.sub;
  const partnerId = req.params.memberId as string;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, recipientId: partnerId },
        { senderId: partnerId, recipientId: myId },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.message.updateMany({
    where: { senderId: partnerId, recipientId: myId, luAt: null },
    data: { luAt: new Date() },
  });

  res.json(messages.map(m => ({
    id: m.id,
    senderId: m.senderId,
    recipientId: m.recipientId,
    contenu: m.content,
    date: m.createdAt,
    lu: !!m.luAt,
  })));
});

app.post('/api/messages', requireAuth, async (req, res) => {
  const { recipientId, contenu } = req.body ?? {};
  if (typeof recipientId !== 'string' || !recipientId.trim()) {
    res.status(400).json({ error: 'Destinataire requis.' });
    return;
  }
  if (typeof contenu !== 'string' || !contenu.trim()) {
    res.status(400).json({ error: 'Message vide.' });
    return;
  }
  if (recipientId === req.user!.sub) {
    res.status(400).json({ error: 'Impossible de vous envoyer un message à vous-même.' });
    return;
  }
  try {
    const message = await prisma.message.create({
      data: { senderId: req.user!.sub, recipientId, content: contenu.trim().slice(0, 4000) },
    });
    res.status(201).json({ id: message.id, senderId: message.senderId, recipientId: message.recipientId, contenu: message.content, date: message.createdAt, lu: false });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      res.status(404).json({ error: 'Destinataire introuvable.' });
      return;
    }
    throw err;
  }
});

// ─── Activité récente ────────────────────────────────────────────────────
// Flux dérivé des tables réelles (pas de journal d'activité dédié) : derniers
// waypoints, posts de forum et builds importés, fusionnés et triés par date.

app.get('/api/activity', requireAuth, async (req, res) => {
  const [waypoints, posts, builds] = await Promise.all([
    prisma.waypoint.findMany({
      take: 6,
      orderBy: { timestamp: 'desc' },
      include: { createdBy: { select: { pseudo: true } }, system: { select: { name: true } } },
    }),
    prisma.forumPost.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { member: { select: { pseudo: true } } },
    }),
    prisma.shipBuild.findMany({
      take: 6,
      orderBy: { dateImport: 'desc' },
      include: { member: { select: { pseudo: true } } },
    }),
  ]);

  const events = [
    ...waypoints.map(w => ({
      id: `wp-${w.id}`, membre: w.createdBy.pseudo, action: 'Waypoint ajouté', detail: w.system.name, date: w.timestamp, type: 'nav' as const,
    })),
    ...posts.map(p => ({
      id: `fp-${p.id}`, membre: p.member.pseudo, action: 'Post forum publié', detail: p.title, date: p.createdAt, type: 'forum' as const,
    })),
    ...builds.map(b => ({
      id: `sb-${b.id}`, membre: b.member.pseudo, action: 'Build importé', detail: `${b.nom} — ${b.vaisseauModele}`, date: b.dateImport, type: 'build' as const,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);

  res.json(events);
});

// ─── Fichiers statiques (production) ───────────────────────────────────────
// Sert le build Vite (dist/) depuis ce même processus Express, sur la même origine
// que l'API — évite tout problème de cookie cross-origin. En développement, c'est
// le serveur Vite (proxy /api vers ce backend) qui sert le frontend, pas ce bloc.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(import.meta.dirname, '..', 'dist');
  app.use(express.static(distPath));
  // RegExp (pas un pattern string) : compatible avec le nouveau parseur de routes d'Express 5.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Backend] Serveur démarré sur http://localhost:${PORT}`);
});
