-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "appellation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Squadron" ADD COLUMN     "logo" TEXT;

