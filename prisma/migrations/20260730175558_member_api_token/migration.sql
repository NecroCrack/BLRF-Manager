-- CreateTable
CREATE TABLE "MemberApiToken" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "MemberApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberApiToken_memberId_key" ON "MemberApiToken"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberApiToken_tokenHash_key" ON "MemberApiToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "MemberApiToken" ADD CONSTRAINT "MemberApiToken_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

