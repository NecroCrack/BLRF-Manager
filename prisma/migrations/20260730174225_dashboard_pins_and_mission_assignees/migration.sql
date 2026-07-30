-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "showEdsmPanel" BOOLEAN,
ADD COLUMN     "showMemberStatusPanel" BOOLEAN,
ADD COLUMN     "systemId" TEXT;

-- CreateTable
CREATE TABLE "MissionAssignee" (
    "missionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "MissionAssignee_pkey" PRIMARY KEY ("missionId","memberId")
);

-- CreateTable
CREATE TABLE "DashboardPreference" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "pinnedMissionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinnedSystemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAssignee" ADD CONSTRAINT "MissionAssignee_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAssignee" ADD CONSTRAINT "MissionAssignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ligne singleton, même pattern que Squadron : évite un upsert défensif à chaque lecture.
INSERT INTO "DashboardPreference" ("id") VALUES ('singleton');

