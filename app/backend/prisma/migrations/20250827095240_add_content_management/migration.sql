-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('MOVIE', 'SERIES');

-- CreateEnum
CREATE TYPE "public"."ContentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."StreamingPlatform" AS ENUM ('NETFLIX', 'HULU', 'AMAZON_PRIME', 'HBO_MAX', 'SHOWTIME', 'STARZ', 'HGTV', 'DISCOVERY_PLUS', 'PEACOCK', 'APPLE_TV', 'DISNEY_PLUS', 'YOUTUBE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "trailer" TEXT,
    "rating" DOUBLE PRECISION,
    "releaseDate" TIMESTAMP(3),
    "genre" TEXT NOT NULL,
    "type" "public"."ContentType" NOT NULL,
    "duration" INTEGER,
    "language" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" "public"."ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" INTEGER NOT NULL,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isTopRated" BOOLEAN NOT NULL DEFAULT false,
    "isUpcoming" BOOLEAN NOT NULL DEFAULT false,
    "isNowPlaying" BOOLEAN NOT NULL DEFAULT false,
    "isComingSoon" BOOLEAN NOT NULL DEFAULT false,
    "isInTheaters" BOOLEAN NOT NULL DEFAULT false,
    "seasons" INTEGER,
    "episodes" INTEGER,
    "episodeDuration" INTEGER,
    "streamingPlatforms" "public"."StreamingPlatform"[],

    CONSTRAINT "content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_likes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_comments" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_comment_likes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "commentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_shares" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_reports" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "contentId" TEXT,
    "commentId" INTEGER,
    "type" "public"."ReportType" NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_likes_userId_contentId_key" ON "public"."content_likes"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "content_comment_likes_userId_commentId_key" ON "public"."content_comment_likes"("userId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "content_shares_userId_contentId_key" ON "public"."content_shares"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "public"."content" ADD CONSTRAINT "content_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content" ADD CONSTRAINT "content_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content" ADD CONSTRAINT "content_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "public"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_likes" ADD CONSTRAINT "content_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_likes" ADD CONSTRAINT "content_likes_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "public"."content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comments" ADD CONSTRAINT "content_comments_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "public"."content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comments" ADD CONSTRAINT "content_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comments" ADD CONSTRAINT "content_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."content_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comment_likes" ADD CONSTRAINT "content_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_comment_likes" ADD CONSTRAINT "content_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_shares" ADD CONSTRAINT "content_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_shares" ADD CONSTRAINT "content_shares_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "public"."content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "public"."content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_reports" ADD CONSTRAINT "content_reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
