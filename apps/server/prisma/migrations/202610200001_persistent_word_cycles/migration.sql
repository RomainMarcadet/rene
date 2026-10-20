-- Additive, non-destructive migration: no guests, results or rooms are removed.
CREATE TABLE "WordCycle" (
    "key" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "lastPairId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WordCycle_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "WordDraw" (
    "gameId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "pairId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WordDraw_pkey" PRIMARY KEY ("gameId")
);
CREATE UNIQUE INDEX "WordDraw_scopeKey_cycle_pairId_key" ON "WordDraw"("scopeKey", "cycle", "pairId");
CREATE INDEX "WordDraw_scopeKey_cycle_idx" ON "WordDraw"("scopeKey", "cycle");
ALTER TABLE "WordDraw" ADD CONSTRAINT "WordDraw_scopeKey_fkey" FOREIGN KEY ("scopeKey") REFERENCES "WordCycle"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
