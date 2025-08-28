/*
  Warnings:

  - You are about to drop the column `isVerified` on the `Auth` table. All the data in the column will be lost.
  - You are about to drop the column `passwordResetTime` on the `Auth` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `Auth` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[accessToken]` on the table `Auth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[refreshToken]` on the table `Auth` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accessToken` to the `Auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshExpiresAt` to the `Auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshToken` to the `Auth` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Auth_token_key";

-- DropIndex
DROP INDEX "public"."Users_password_key";

-- AlterTable
ALTER TABLE "public"."Auth" DROP COLUMN "isVerified",
DROP COLUMN "passwordResetTime",
DROP COLUMN "token",
ADD COLUMN     "accessToken" TEXT NOT NULL,
ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refreshToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Users" ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Auth_accessToken_key" ON "public"."Auth"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Auth_refreshToken_key" ON "public"."Auth"("refreshToken");
