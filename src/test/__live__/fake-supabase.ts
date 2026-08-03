/**
 * Bellek içi PostgREST ikizi.
 * Amaç: gerçek bot kodunu (processor, prompt, tool executor, guardrail, servisler)
 * hiç değiştirmeden çalıştırmak; yalnızca VERİ KATMANI sahte olsun.
 * Böylece canlı Supabase'e tek satır yazmadan gerçek konuşma yapılabilir.
 */

export type Row = Record<string, unknown>;
export type Store = Record<string, Row[]>;

type Filter = (row: Row) => boolean;

/**
 * Noktalı yol desteği: PostgREST embed filtreleri `eq("packages.service_slug", x)`
 * biçiminde geliyor (customer_packages → packages!inner join'i böyle süzülüyor).
 */
function get(row: Row, col: string): unknown {
  if (!col.includes(".")) return row[col];
  return col
    .split(".")
    .reduce<unknown>((acc, k) => (acc == null ? acc : (acc as Row)[k]), row);
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** "*, business_types(*)" → ["*", "business_types"] */
function parseSelect(sel: string): string[] {
  if (!sel || sel.trim() === "*") return ["*"];
  const cols: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of sel) {
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth--;
      continue;
    }
    if (ch === "," && depth === 0) {
      cols.push(cur.trim());
      cur = "";
      continue;
    }
    if (depth === 0) cur += ch;
  }
  if (cur.trim()) cols.push(cur.trim());
  // `packages!inner(...)` → `packages`; `alias:col` → `col`
  return cols
    .map((c) => c.split(":").pop()!.trim().split("!")[0].trim())
    .filter(Boolean);
}

function project(row: Row, cols: string[]): Row {
  if (cols.includes("*")) return { ...row };
  const out: Row = {};
  for (const c of cols) out[c] = row[c];
  return out;
}

class QueryBuilder implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filters: Filter[] = [];
  private selectCols: string[] = ["*"];
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private rangeAB: [number, number] | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private wantSingle = false;
  private wantMaybe = false;
  private wantsSelect = false;

  constructor(
    private store: Store,
    private table: string,
    private onWrite?: (table: string, op: string, rows: Row[]) => void
  ) {}

  private rows(): Row[] {
    return (this.store[this.table] ||= []);
  }

  // ── filtreler ────────────────────────────────────────────────────────────
  eq(col: string, val: unknown) {
    this.filters.push((r) => String(get(r, col)) === String(val));
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => String(get(r, col)) !== String(val));
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (val === null ? get(r, col) == null : get(r, col) === val));
    return this;
  }
  in(col: string, vals: unknown[]) {
    const set = new Set((vals || []).map((v) => String(v)));
    this.filters.push((r) => set.has(String(get(r, col))));
    return this;
  }
  gt(col: string, val: unknown) {
    this.filters.push((r) => cmp(get(r, col), val) > 0);
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => cmp(get(r, col), val) >= 0);
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push((r) => cmp(get(r, col), val) < 0);
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => cmp(get(r, col), val) <= 0);
    return this;
  }
  like(col: string, pat: string) {
    return this.ilike(col, pat);
  }
  ilike(col: string, pat: string) {
    const re = new RegExp(`^${String(pat).replace(/%/g, ".*")}$`, "i");
    this.filters.push((r) => re.test(String(get(r, col) ?? "")));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === "is") this.filters.push((r) => !(val === null ? get(r, col) == null : get(r, col) === val));
    else this.filters.push((r) => String(get(r, col)) !== String(val));
    return this;
  }
  /** `or("a.is.null,b.eq.x")` — testler için yeterli düzeyde. */
  or(expr: string) {
    const parts = String(expr).split(",");
    this.filters.push((r) =>
      parts.some((p) => {
        const [col, op, ...rest] = p.split(".");
        const val = rest.join(".");
        if (op === "is") return val === "null" ? get(r, col) == null : false;
        if (op === "eq") return String(get(r, col)) === val;
        if (op === "neq") return String(get(r, col)) !== val;
        return false;
      })
    );
    return this;
  }
  contains(col: string, val: unknown) {
    this.filters.push((r) => JSON.stringify(get(r, col) ?? "").includes(JSON.stringify(val).slice(1, -1)));
    return this;
  }
  overlaps() {
    return this;
  }
  filter(col: string, op: string, val: unknown) {
    if (op === "eq") return this.eq(col, val);
    if (op === "is") return this.is(col, val === "null" ? null : val);
    return this;
  }

  // ── shape ────────────────────────────────────────────────────────────────
  select(cols = "*") {
    if (this.mode === "select") this.selectCols = parseSelect(cols);
    else {
      this.wantsSelect = true;
      this.selectCols = parseSelect(cols);
    }
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(a: number, b: number) {
    this.rangeAB = [a, b];
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  maybeSingle() {
    this.wantMaybe = true;
    return this;
  }

  // ── yazma ────────────────────────────────────────────────────────────────
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = [patch];
    return this;
  }
  upsert(rows: Row | Row[]) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  private matched(): Row[] {
    return this.rows().filter((r) => this.filters.every((f) => f(r)));
  }

  private run(): { data: unknown; error: unknown } {
    let result: Row[] = [];

    if (this.mode === "select") {
      result = this.matched();
      for (const o of [...this.orderBy].reverse()) {
        result.sort((a, b) => (o.asc ? cmp(get(a, o.col), get(b, o.col)) : -cmp(get(a, o.col), get(b, o.col))));
      }
      if (this.rangeAB) result = result.slice(this.rangeAB[0], this.rangeAB[1] + 1);
      if (this.limitN != null) result = result.slice(0, this.limitN);
      result = result.map((r) => project(r, this.selectCols));
    } else if (this.mode === "insert" || this.mode === "upsert") {
      const created = this.payload.map((p) => ({
        id: p.id ?? `${this.table}_${Math.random().toString(36).slice(2, 10)}`,
        created_at: p.created_at ?? new Date().toISOString(),
        ...p,
      }));
      if (this.mode === "upsert") {
        for (const c of created) {
          const idx = this.rows().findIndex((r) => String(r.id) === String(c.id));
          if (idx >= 0) this.rows()[idx] = { ...this.rows()[idx], ...c };
          else this.rows().push(c);
        }
      } else {
        this.rows().push(...created);
      }
      this.onWrite?.(this.table, this.mode, created);
      result = created;
    } else if (this.mode === "update") {
      const patch = this.payload[0] || {};
      const hits = this.matched();
      for (const r of hits) Object.assign(r, patch);
      this.onWrite?.(this.table, "update", hits);
      result = hits;
    } else if (this.mode === "delete") {
      const hits = this.matched();
      this.store[this.table] = this.rows().filter((r) => !hits.includes(r));
      this.onWrite?.(this.table, "delete", hits);
      result = hits;
    }

    if (this.wantSingle) {
      if (result.length !== 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
        };
      }
      return { data: result[0], error: null };
    }
    if (this.wantMaybe) {
      return { data: result[0] ?? null, error: null };
    }
    if (this.mode !== "select" && !this.wantsSelect) {
      return { data: null, error: null };
    }
    return { data: result, error: null };
  }

  then<T1 = { data: unknown; error: unknown }, T2 = never>(
    onfulfilled?: ((v: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected);
    }
  }
}

export function createFakeSupabase(store: Store, onWrite?: (t: string, op: string, r: Row[]) => void) {
  return {
    from(table: string) {
      return new QueryBuilder(store, table, onWrite);
    },
    // RPC'ler yok: çağıranlar zaten hata görünce filtreli update'e düşüyor.
    rpc() {
      return Promise.resolve({ data: null, error: { message: "function does not exist" } });
    },
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  };
}
