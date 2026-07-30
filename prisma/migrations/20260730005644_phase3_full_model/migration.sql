/*
  Warnings:

  - You are about to drop the column `nomVaisseau` on the `ShipBuild` table. All the data in the column will be lost.
  - Added the required column `dateMaj` to the `PrivateNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titre` to the `PrivateNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nom` to the `ShipBuild` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vaisseauModele` to the `ShipBuild` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('COMBAT', 'EXPLORATION', 'LOGISTIQUE', 'ESCORTE', 'INTERNE');

-- CreateEnum
CREATE TYPE "ShipRole" AS ENUM ('COMBAT', 'EXPLORATION', 'MINAGE', 'TRANSPORT', 'MULTIROLE');

-- CreateEnum
CREATE TYPE "ForumCategorie" AS ENUM ('OPERATIONS', 'TACTIQUE', 'INGENIERIE', 'GENERAL', 'ANNONCES');

-- AlterTable
ALTER TABLE "ForumPost" ADD COLUMN     "categorie" "ForumCategorie" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "epingle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vues" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "combats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commerce" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "explorations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "localisation" TEXT,
ADD COLUMN     "specialite" TEXT,
ADD COLUMN     "vaisseau" TEXT,
ADD COLUMN     "vaisseauModele" TEXT;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "dateCompletion" TIMESTAMP(3),
ADD COLUMN     "priorite" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "responsableId" TEXT,
ADD COLUMN     "systeme" TEXT,
ADD COLUMN     "type" "MissionType" NOT NULL DEFAULT 'INTERNE';

-- AlterTable
ALTER TABLE "PrivateNote" ADD COLUMN     "categorie" TEXT NOT NULL DEFAULT 'Personnel',
ADD COLUMN     "dateMaj" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "titre" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ShipBuild" DROP COLUMN "nomVaisseau",
ADD COLUMN     "dateImport" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nom" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "portee" TEXT,
ADD COLUMN     "role" "ShipRole" NOT NULL DEFAULT 'MULTIROLE',
ADD COLUMN     "vaisseauModele" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Squadron" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nom" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fondation" TEXT NOT NULL,

    CONSTRAINT "Squadron_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumComment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
