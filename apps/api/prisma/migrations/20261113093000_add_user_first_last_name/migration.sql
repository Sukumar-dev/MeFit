ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Preserve legacy display names as first/last name fields where the value is
-- clearly a person's name. Email placeholders remain null for provider sync.
UPDATE "User"
SET
  "firstName" = (regexp_match(trim("displayName"), '^(\S+)\s+(.+)$'))[1],
  "lastName" = (regexp_match(trim("displayName"), '^(\S+)\s+(.+)$'))[2]
WHERE "displayName" <> "email"
  AND trim("displayName") ~ '^\S+\s+.+$';
