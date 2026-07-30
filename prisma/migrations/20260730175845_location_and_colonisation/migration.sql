-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "localisationAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "localisationSystemId" TEXT,
ADD COLUMN     "localisationUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ColonisationSite" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteType" TEXT NOT NULL,
    "progressPct" DOUBLE PRECISION,
    "statusText" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT NOT NULL,

    CONSTRAINT "ColonisationSite_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_localisationSystemId_fkey" FOREIGN KEY ("localisationSystemId") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColonisationSite" ADD CONSTRAINT "ColonisationSite_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColonisationSite" ADD CONSTRAINT "ColonisationSite_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

