-- AlterTable
ALTER TABLE "ShipBuild" ADD COLUMN     "modules" JSONB,
ADD COLUMN     "shipId" INTEGER,
ALTER COLUMN "urlCoriolis" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ShipBuild_memberId_shipId_key" ON "ShipBuild"("memberId", "shipId");
