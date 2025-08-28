-- AlterTable
ALTER TABLE "public"."Users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profilePicture" TEXT;

-- AlterTable
ALTER TABLE "public"."comments" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."posts" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "images" TEXT[];
