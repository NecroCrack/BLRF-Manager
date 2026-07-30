-- AlterTable
ALTER TABLE "ColonisationSite" ADD COLUMN     "marketId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ColonisationSite_marketId_key" ON "ColonisationSite"("marketId");
