/**
 * Query surface used by the dealer and shopper stores, backed by a
 * disposable local Postgres connection. Production keeps using supabase-js
 * through appAdminClient when DREVYY_LOCAL_PG is off.
 */

export type LocalSql = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
};

type Filter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] };

type QueryResult = { data: unknown; error: { message: string } | null };

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
}

function quoteTable(name: string): string {
  const parts = name.split('.');
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => !/^[a-z_][a-z0-9_]*$/i.test(part))) {
    throw new Error(`bad table ${name}`);
  }
  return parts.map(quoteIdent).join('.');
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

class LocalQuery implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private columns = '*';
  private filters: Filter[] = [];
  private payload: Record<string, unknown> | null = null;
  private conflict: string | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;

  constructor(
    private readonly db: LocalSql,
    private readonly table: string,
  ) {}

  select(columns = '*'): this {
    this.operation = 'select';
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'in', column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  insert(row: Record<string, unknown>): this {
    this.operation = 'insert';
    this.payload = row;
    return this;
  }

  update(row: Record<string, unknown>): this {
    this.operation = 'update';
    this.payload = row;
    return this;
  }

  upsert(row: Record<string, unknown>, options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.payload = row;
    this.conflict = options?.onConflict ?? null;
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = Array.isArray(result.data) ? result.data : [];
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    try {
      if (this.operation === 'select') {
        return { data: await this.selectRows(), error: null };
      }
      if (this.operation === 'update') {
        await this.writeUpdate();
        return { data: null, error: null };
      }
      await this.writeInsert(this.operation === 'upsert');
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'query failed' } };
    }
  }

  private columnList(): string {
    if (this.columns.trim() === '*') return '*';
    return this.columns.split(',').map((column) => quoteIdent(column.trim())).join(', ');
  }

  private where(params: unknown[]): string {
    if (this.filters.length === 0) return '';
    const parts = this.filters.map((filter) => {
      if (filter.kind === 'eq') {
        params.push(filter.value);
        return `${quoteIdent(filter.column)} = $${params.length}`;
      }
      if (filter.values.length === 0) return 'false';
      const holders = filter.values.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `${quoteIdent(filter.column)} in (${holders.join(', ')})`;
    });
    return ` where ${parts.join(' and ')}`;
  }

  private async selectRows(): Promise<Record<string, unknown>[]> {
    if (this.filters.some((filter) => filter.kind === 'in' && filter.values.length === 0)) return [];
    const params: unknown[] = [];
    let sql = `select ${this.columnList()} from ${quoteTable(this.table)}${this.where(params)}`;
    if (this.orderBy) {
      sql += ` order by ${quoteIdent(this.orderBy.column)} ${this.orderBy.ascending ? 'asc' : 'desc'}`;
    }
    if (this.limitCount != null) sql += ` limit ${Math.max(0, Math.trunc(this.limitCount))}`;
    const result = await this.db.query(sql, params);
    return result.rows.map((row) => normalize(row) as Record<string, unknown>);
  }

  private async writeInsert(conflictUpdate: boolean): Promise<void> {
    const row = this.payload ?? {};
    const keys = Object.keys(row);
    if (keys.length === 0) throw new Error('insert requires columns');
    const params = keys.map((key) => row[key]);
    const columns = keys.map((key) => quoteIdent(key)).join(', ');
    const holders = keys.map((_, index) => `$${index + 1}`).join(', ');
    let sql = `insert into ${quoteTable(this.table)} (${columns}) values (${holders})`;
    if (conflictUpdate) {
      const conflict = (this.conflict ?? '').split(',').map((column) => column.trim()).filter(Boolean);
      if (conflict.length === 0) throw new Error('upsert requires onConflict');
      const updates = keys.filter((key) => !conflict.includes(key) && key !== 'id' && key !== 'created_at' && key !== 'recorded_at');
      sql += ` on conflict (${conflict.map((column) => quoteIdent(column)).join(', ')})`;
      sql += updates.length === 0
        ? ' do nothing'
        : ` do update set ${updates.map((key) => `${quoteIdent(key)} = excluded.${quoteIdent(key)}`).join(', ')}`;
    }
    await this.db.query(sql, params);
  }

  private async writeUpdate(): Promise<void> {
    if (!this.filters.some((filter) => filter.kind === 'eq' || (filter.kind === 'in' && filter.values.length > 0))) {
      throw new Error('update requires a filter');
    }
    const row = this.payload ?? {};
    const keys = Object.keys(row);
    if (keys.length === 0) return;
    const params: unknown[] = [];
    const assignments = keys.map((key) => {
      params.push(row[key]);
      return `${quoteIdent(key)} = $${params.length}`;
    });
    const sql = `update ${quoteTable(this.table)} set ${assignments.join(', ')}${this.where(params)}`;
    await this.db.query(sql, params);
  }
}

export function createLocalQueryClient(db: LocalSql) {
  return {
    from(table: string) {
      return new LocalQuery(db, table);
    },
  };
}
