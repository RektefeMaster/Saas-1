type PostgrestLikeError = {
  message?: string | null;
};

const MISSING_COLUMN_RE =
  /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i;

export function extractMissingSchemaColumn(
  error: PostgrestLikeError | null | undefined
): { column: string; table: string } | null {
  const message = error?.message || "";
  const match = message.match(MISSING_COLUMN_RE);
  if (!match) return null;
  return { column: match[1], table: match[2] };
}

