CREATE TABLE "SupabaseIdentity" (
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupabaseIdentity_pkey" PRIMARY KEY ("issuer", "subject"),
    CONSTRAINT "SupabaseIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SupabaseIdentity_userId_key" ON "SupabaseIdentity"("userId");

ALTER TABLE "SupabaseIdentity" ENABLE ROW LEVEL SECURITY;
