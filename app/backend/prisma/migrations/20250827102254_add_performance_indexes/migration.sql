/*
  Warnings:

  - You are about to drop the `Auth` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Auth" DROP CONSTRAINT "Auth_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."comments" DROP CONSTRAINT "comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."content" DROP CONSTRAINT "content_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."content" DROP CONSTRAINT "content_deletedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."content" DROP CONSTRAINT "content_updatedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."content_comment_likes" DROP CONSTRAINT "content_comment_likes_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."content_comments" DROP CONSTRAINT "content_comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."content_likes" DROP CONSTRAINT "content_likes_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."content_reports" DROP CONSTRAINT "content_reports_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "public"."content_reports" DROP CONSTRAINT "content_reports_reviewedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."content_shares" DROP CONSTRAINT "content_shares_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."followers" DROP CONSTRAINT "followers_followerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."followers" DROP CONSTRAINT "followers_followingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."likes" DROP CONSTRAINT "likes_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."posts" DROP CONSTRAINT "posts_authorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_reportedUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "public"."reports" DROP CONSTRAINT "reports_reviewedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."shares" DROP CONSTRAINT "shares_userId_fkey";

-- DropTable
DROP TABLE "public"."Auth";

-- DropTable
DROP TABLE "public"."Users";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "roles" "public"."Roles" NOT NULL DEFAULT 'USER',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "profilePicture" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth" (
    "id" SERIAL NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),

    CONSTRAINT "auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "users_roles_idx" ON "public"."users"("roles");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE INDEX "users_isEmailVerified_idx" ON "public"."users"("isEmailVerified");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accessToken_key" ON "public"."auth"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refreshToken_key" ON "public"."auth"("refreshToken");

-- CreateIndex
CREATE INDEX "auth_accessToken_idx" ON "public"."auth"("accessToken");

-- CreateIndex
CREATE INDEX "auth_refreshToken_idx" ON "public"."auth"("refreshToken");

-- CreateIndex
CREATE INDEX "auth_expiresAt_idx" ON "public"."auth"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_passwordResetToken_idx" ON "public"."auth"("passwordResetToken");

-- CreateIndex
CREATE INDEX "auth_emailVerificationToken_idx" ON "public"."auth"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "comments_postId_idx" ON "public"."comments"("postId");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "public"."comments"("authorId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "public"."comments"("parentId");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "public"."comments"("created_at");

-- CreateIndex
CREATE INDEX "content_status_idx" ON "public"."content"("status");

-- CreateIndex
CREATE INDEX "content_type_idx" ON "public"."content"("type");

-- CreateIndex
CREATE INDEX "content_genre_idx" ON "public"."content"("genre");

-- CreateIndex
CREATE INDEX "content_language_idx" ON "public"."content"("language");

-- CreateIndex
CREATE INDEX "content_country_idx" ON "public"."content"("country");

-- CreateIndex
CREATE INDEX "content_rating_idx" ON "public"."content"("rating");

-- CreateIndex
CREATE INDEX "content_isFeatured_idx" ON "public"."content"("isFeatured");

-- CreateIndex
CREATE INDEX "content_isTrending_idx" ON "public"."content"("isTrending");

-- CreateIndex
CREATE INDEX "content_isPopular_idx" ON "public"."content"("isPopular");

-- CreateIndex
CREATE INDEX "content_isTopRated_idx" ON "public"."content"("isTopRated");

-- CreateIndex
CREATE INDEX "content_createdBy_idx" ON "public"."content"("createdBy");

-- CreateIndex
CREATE INDEX "content_createdAt_idx" ON "public"."content"("createdAt");

-- CreateIndex
CREATE INDEX "content_status_type_idx" ON "public"."content"("status", "type");

-- CreateIndex
CREATE INDEX "content_status_isFeatured_idx" ON "public"."content"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "content_status_isTrending_idx" ON "public"."content"("status", "isTrending");

-- CreateIndex
CREATE INDEX "content_title_idx" ON "public"."content"("title");

-- CreateIndex
CREATE INDEX "content_comments_contentId_idx" ON "public"."content_comments"("contentId");

-- CreateIndex
CREATE INDEX "content_comments_authorId_idx" ON "public"."content_comments"("authorId");

-- CreateIndex
CREATE INDEX "content_comments_parentId_idx" ON "public"."content_comments"("parentId");

-- CreateIndex
CREATE INDEX "content_comments_contentId_createdAt_idx" ON "public"."content_comments"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "content_comments_createdAt_idx" ON "public"."content_comments"("createdAt");

-- CreateIndex
CREATE INDEX "content_reports_status_idx" ON "public"."content_reports"("status");

-- CreateIndex
CREATE INDEX "content_reports_type_idx" ON "public"."content_reports"("type");

-- CreateIndex
CREATE INDEX "content_reports_reporterId_idx" ON "public"."content_reports"("reporterId");

-- CreateIndex
CREATE INDEX "content_reports_reviewedBy_idx" ON "public"."content_reports"("reviewedBy");

-- CreateIndex
CREATE INDEX "content_reports_contentId_idx" ON "public"."content_reports"("contentId");

-- CreateIndex
CREATE INDEX "content_reports_createdAt_idx" ON "public"."content_reports"("createdAt");

-- CreateIndex
CREATE INDEX "posts_authorId_idx" ON "public"."posts"("authorId");

-- CreateIndex
CREATE INDEX "posts_categoryId_idx" ON "public"."posts"("categoryId");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "public"."posts"("status");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "public"."posts"("created_at");

-- CreateIndex
CREATE INDEX "posts_status_created_at_idx" ON "public"."posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "public"."reports"("status");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "public"."reports"("type");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "public"."reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_reviewedBy_idx" ON "public"."reports"("reviewedBy");

-- CreateIndex
CREATE INDEX "reports_created_at_idx" ON "public"."reports"("created_at");

-- AddForeignKey
ALTER TABLE "public"."auth" ADD CONSTRAINT "auth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."likes" ADD CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."followers" ADD CONSTRAINT "followers_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."followers" ADD CONSTRAINT "followers_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shares" ADD CONSTRAINT "shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content" ADD CONSTRAINT "content_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content" ADD CONSTRAINT "content_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content" ADD CONSTRAINT "content_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_likes" ADD CONSTRAINT "content_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comments" ADD CONSTRAINT "content_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comment_likes" ADD CONSTRAINT "content_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_shares" ADD CONSTRAINT "content_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
