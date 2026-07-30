-- CreateEnum
CREATE TYPE "FactionSnapshotSource" AS ENUM ('PLUGIN', 'EDSM');

-- CreateTable
CREATE TABLE "Faction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allegiance" TEXT,
    "government" TEXT,
    "isSquadron" BOOLEAN NOT NULL DEFAULT false,
    "isSquadronManual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionSnapshot" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "influence" DOUBLE PRECISION NOT NULL,
    "state" TEXT NOT NULL,
    "happiness" TEXT,
    "activeStates" JSONB,
    "recoveringStates" JSONB,
    "pendingStates" JSONB,
    "isControlling" BOOLEAN NOT NULL DEFAULT false,
    "source" "FactionSnapshotSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedById" TEXT,

    CONSTRAINT "FactionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faction_name_key" ON "Faction"("name");

-- CreateIndex
CREATE INDEX "FactionSnapshot_systemId_factionId_recordedAt_idx" ON "FactionSnapshot"("systemId", "factionId", "recordedAt");

-- AddForeignKey
ALTER TABLE "FactionSnapshot" ADD CONSTRAINT "FactionSnapshot_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionSnapshot" ADD CONSTRAINT "FactionSnapshot_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionSnapshot" ADD CONSTRAINT "FactionSnapshot_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
