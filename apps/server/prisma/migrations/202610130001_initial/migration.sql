CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "appearance" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Guest_tokenHash_key" ON "Guest"("tokenHash");

CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "roomSessionId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GameResult_roomSessionId_createdAt_idx" ON "GameResult"("roomSessionId", "createdAt");
