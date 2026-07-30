-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RECRUE', 'PILOTE', 'OFFICIER', 'COMMANDANT');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('EN_COURS', 'COMPLETE', 'ARCHIVE');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECRUE',
    "dateJoin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permissions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "peutEditerCarte" BOOLEAN NOT NULL DEFAULT false,
    "peutVoirStats" BOOLEAN NOT NULL DEFAULT false,
    "peutAdministrer" BOOLEAN NOT NULL DEFAULT false,
    "peutModererForum" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSync" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "inaraToken" TEXT,
    "frontierAuth" TEXT,

    CONSTRAINT "ExternalSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "System" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coordX" DOUBLE PRECISION NOT NULL,
    "coordY" DOUBLE PRECISION NOT NULL,
    "coordZ" DOUBLE PRECISION NOT NULL,
    "typeSysteme" TEXT,

    CONSTRAINT "System_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waypoint" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "marker" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waypoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'EN_COURS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipBuild" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "urlCoriolis" TEXT NOT NULL,
    "nomVaisseau" TEXT,

    CONSTRAINT "ShipBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateNote" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_matricule_key" ON "Member"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Member_pseudo_key" ON "Member"("pseudo");

-- CreateIndex
CREATE UNIQUE INDEX "Permissions_memberId_key" ON "Permissions"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSync_memberId_key" ON "ExternalSync"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "System_name_key" ON "System"("name");

-- AddForeignKey
ALTER TABLE "Permissions" ADD CONSTRAINT "Permissions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSync" ADD CONSTRAINT "ExternalSync_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waypoint" ADD CONSTRAINT "Waypoint_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waypoint" ADD CONSTRAINT "Waypoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipBuild" ADD CONSTRAINT "ShipBuild_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNote" ADD CONSTRAINT "PrivateNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
