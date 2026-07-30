-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- AlterTable
ALTER TABLE "ShipBuild" ADD COLUMN     "status" "BuildStatus" NOT NULL DEFAULT 'EN_ATTENTE';

-- CreateTable
CREATE TABLE "BuildComment" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildComment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BuildComment" ADD CONSTRAINT "BuildComment_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "ShipBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildComment" ADD CONSTRAINT "BuildComment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
