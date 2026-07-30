/*
  Warnings:

  - You are about to drop the column `typeSysteme` on the `System` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "WaypointType" AS ENUM ('BASE', 'OBJECTIF', 'RAVITAILLEMENT', 'AUTRE');

-- AlterTable
ALTER TABLE "System" DROP COLUMN "typeSysteme";

-- AlterTable
ALTER TABLE "Waypoint" ADD COLUMN     "type" "WaypointType" NOT NULL DEFAULT 'AUTRE';
