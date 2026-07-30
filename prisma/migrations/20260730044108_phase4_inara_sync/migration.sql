-- AlterTable
ALTER TABLE "ExternalSync" ADD COLUMN     "inaraCommanderName" TEXT,
ADD COLUMN     "inaraLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "inaraLastSyncOk" BOOLEAN;
