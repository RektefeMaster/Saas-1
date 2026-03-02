type PostgrestLikeError = {
  message?: string | null;
};

const MISSING_COLUMN_RE =
  /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i;
const MISSING_TABLE_RE =
  /Could not find the table '([^']+)' in the schema cache/i;
const PG_MISSING_COLUMN_QUALIFIED_RE =
  /column\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+does not exist/i;
const PG_MISSING_COLUMN_RELATION_RE =
  /column\s+"?([a-zA-Z0-9_]+)"?\s+of relation\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i;
const PG_MISSING_RELATION_RE =
  /relation\s+"?([a-zA-Z0-9_.]+)"?\s+does not exist/i;

function normalizeRelationName(value: string): string {
  const last = value.split(".").pop() || value;
  return last.replace(/"/g, "").trim();
}

export function extractMissingSchemaColumn(
  error: PostgrestLikeError | null | undefined
): { column: string; table: string } | null {
  const message = error?.message || "";
  const match = message.match(MISSING_COLUMN_RE);
  if (match) {
    return { column: match[1], table: match[2] };
  }

  const qualified = message.match(PG_MISSING_COLUMN_QUALIFIED_RE);
  if (qualified) {
    return { table: qualified[1], column: qualified[2] };
  }

  const relation = message.match(PG_MISSING_COLUMN_RELATION_RE);
  if (relation) {
    return { table: relation[2], column: relation[1] };
  }

  return null;
}

export function extractMissingSchemaTable(
  error: PostgrestLikeError | null | undefined
): string | null {
  const message = error?.message || "";

  const match = message.match(MISSING_TABLE_RE);
  if (match) {
    return normalizeRelationName(match[1]);
  }

  const pgMatch = message.match(PG_MISSING_RELATION_RE);
  if (pgMatch) {
    return normalizeRelationName(pgMatch[1]);
  }

  return null;
}
